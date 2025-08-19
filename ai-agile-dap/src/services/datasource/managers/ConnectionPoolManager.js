/**
 * 数据源连接池管理器
 * 负责管理MySQL连接池的创建、配置、监控和安全性
 */

const mysql = require('mysql2/promise');
const crypto = require('crypto');
const EventEmitter = require('events');

class ConnectionPoolManager extends EventEmitter {
  constructor() {
    super();
    this.pools = new Map(); // 存储所有连接池
    this.poolConfigs = new Map(); // 存储连接池配置
    this.poolStats = new Map(); // 存储连接池统计信息
    this.encryptionKey = process.env.DB_ENCRYPTION_KEY || 'default-key-change-in-production';
  }

  /**
   * 创建MySQL连接池
   * @param {Object} config - 连接配置
   * @param {string} config.id - 连接池唯一标识
   * @param {string} config.host - 数据库主机
   * @param {number} config.port - 数据库端口
   * @param {string} config.database - 数据库名
   * @param {string} config.user - 用户名
   * @param {string} config.password - 密码
   * @param {Object} config.poolConfig - 连接池配置
   * @returns {Promise<Object>} 连接池实例
   */
  async createMySQLPool(config) {
    try {
      const poolId = config.id || this.generatePoolId(config);

      // 验证配置
      this.validateConfig(config);

      // 加密存储敏感信息
      const encryptedConfig = this.encryptSensitiveData(config);
      this.poolConfigs.set(poolId, encryptedConfig);

      // 创建连接池配置
      const poolConfig = {
        host: config.host,
        port: config.port || 3306,
        database: config.database,
        user: config.user,
        password: config.password,
        // 连接池配置
        connectionLimit: config.poolConfig?.max || 10,
        acquireTimeout: config.poolConfig?.acquireTimeoutMillis || 30000,
        timeout: config.poolConfig?.acquireTimeoutMillis || 30000,
        reconnect: true,
        // SSL配置
        ssl: config.ssl
          ? {
              rejectUnauthorized: false,
              ...config.ssl,
            }
          : false,
        // 字符集
        charset: 'utf8mb4',
        // 时区
        timezone: '+00:00',
      };

      // 创建连接池
      const pool = mysql.createPool(poolConfig);

      // 测试连接
      await this.testConnection(pool);

      // 存储连接池
      this.pools.set(poolId, pool);

      // 初始化统计信息
      this.poolStats.set(poolId, {
        created: new Date(),
        totalConnections: 0,
        activeConnections: 0,
        errors: 0,
        lastError: null,
        lastUsed: new Date(),
      });

      // 设置监控
      this.setupPoolMonitoring(poolId, pool);

      this.emit('pool-created', { poolId, config: encryptedConfig });

      return {
        poolId,
        pool,
        status: 'active',
      };
    } catch (error) {
      this.emit('pool-error', { error, config });
      throw new Error(`Failed to create MySQL pool: ${error.message}`);
    }
  }

  /**
   * 获取连接池
   * @param {string} poolId - 连接池ID
   * @returns {Object|null} 连接池实例
   */
  getPool(poolId) {
    return this.pools.get(poolId);
  }

  /**
   * 获取连接
   * @param {string} poolId - 连接池ID
   * @returns {Promise<Object>} 数据库连接
   */
  async getConnection(poolId) {
    const pool = this.pools.get(poolId);
    if (!pool) {
      throw new Error(`Pool not found: ${poolId}`);
    }

    try {
      const connection = await pool.getConnection();

      // 更新统计信息
      const stats = this.poolStats.get(poolId);
      stats.activeConnections++;
      stats.totalConnections++;
      stats.lastUsed = new Date();

      this.emit('connection-acquired', { poolId });

      return connection;
    } catch (error) {
      // 更新错误统计
      const stats = this.poolStats.get(poolId);
      stats.errors++;
      stats.lastError = error.message;

      this.emit('connection-error', { poolId, error });
      throw error;
    }
  }

  /**
   * 释放连接
   * @param {string} poolId - 连接池ID
   * @param {Object} connection - 数据库连接
   */
  releaseConnection(poolId, connection) {
    try {
      connection.release();

      // 更新统计信息
      const stats = this.poolStats.get(poolId);
      stats.activeConnections = Math.max(0, stats.activeConnections - 1);

      this.emit('connection-released', { poolId });
    } catch (error) {
      this.emit('connection-release-error', { poolId, error });
    }
  }

  /**
   * 关闭连接池
   * @param {string} poolId - 连接池ID
   */
  async closePool(poolId) {
    const pool = this.pools.get(poolId);
    if (pool) {
      try {
        await pool.end();
        this.pools.delete(poolId);
        this.poolConfigs.delete(poolId);
        this.poolStats.delete(poolId);

        this.emit('pool-closed', { poolId });
      } catch (error) {
        this.emit('pool-close-error', { poolId, error });
        throw error;
      }
    }
  }

  /**
   * 获取连接池状态
   * @param {string} poolId - 连接池ID
   * @returns {Object} 连接池状态信息
   */
  getPoolStatus(poolId) {
    const pool = this.pools.get(poolId);
    const stats = this.poolStats.get(poolId);

    if (!pool || !stats) {
      return null;
    }

    return {
      poolId,
      status: 'active',
      stats: {
        ...stats,
        poolSize: pool.pool?.allConnections?.length || 0,
        freeConnections: pool.pool?.freeConnections?.length || 0,
        usedConnections: pool.pool?.usedConnections?.length || 0,
      },
    };
  }

  /**
   * 获取所有连接池状态
   * @returns {Array} 所有连接池状态
   */
  getAllPoolStatus() {
    return Array.from(this.pools.keys())
      .map(poolId => this.getPoolStatus(poolId))
      .filter(Boolean);
  }

  /**
   * 验证配置
   * @private
   */
  validateConfig(config) {
    const required = ['host', 'database', 'user', 'password'];
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // 验证端口
    if (config.port && (config.port < 1 || config.port > 65535)) {
      throw new Error('Invalid port number');
    }
  }

  /**
   * 加密敏感数据
   * @private
   */
  encryptSensitiveData(config) {
    const sensitiveFields = ['password'];
    const encrypted = { ...config };

    for (const field of sensitiveFields) {
      if (encrypted[field]) {
        encrypted[field] = this.encrypt(encrypted[field]);
      }
    }

    return encrypted;
  }

  /**
   * 加密字符串
   * @private
   */
  encrypt(text) {
    const algorithm = 'aes-256-cbc';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 解密字符串
   * @private
   */
  decrypt(encryptedText) {
    const algorithm = 'aes-256-cbc';
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * 生成连接池ID
   * @private
   */
  generatePoolId(config) {
    return `mysql_${config.host}_${config.database}_${Date.now()}`;
  }

  /**
   * 测试连接
   * @private
   */
  async testConnection(pool) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('SELECT 1');
    } finally {
      connection.release();
    }
  }

  /**
   * 设置连接池监控
   * @private
   */
  setupPoolMonitoring(poolId, pool) {
    // 监控连接池事件
    pool.on('connection', connection => {
      this.emit('new-connection', { poolId, connectionId: connection.threadId });
    });

    pool.on('error', error => {
      const stats = this.poolStats.get(poolId);
      stats.errors++;
      stats.lastError = error.message;

      this.emit('pool-error', { poolId, error });
    });

    // 定期清理空闲连接
    setInterval(() => {
      this.cleanupIdleConnections(poolId);
    }, 300000); // 5分钟
  }

  /**
   * 清理空闲连接
   * @private
   */
  cleanupIdleConnections(poolId) {
    const pool = this.pools.get(poolId);
    if (pool && pool.pool) {
      // MySQL2 连接池会自动管理空闲连接
      // 这里可以添加自定义的清理逻辑
      this.emit('cleanup-idle-connections', { poolId });
    }
  }
}

module.exports = ConnectionPoolManager;

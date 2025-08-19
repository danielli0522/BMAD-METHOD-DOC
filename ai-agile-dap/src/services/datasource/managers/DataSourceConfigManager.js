/**
 * 数据源配置管理器
 * 负责数据源配置的安全存储、验证和管理
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class DataSourceConfigManager {
  constructor() {
    this.configs = new Map();
    this.configFile =
      process.env.DATASOURCE_CONFIG_FILE || path.join(process.cwd(), 'config', 'datasources.json');
    this.encryptionKey =
      process.env.CONFIG_ENCRYPTION_KEY || 'default-config-key-change-in-production';
  }

  /**
   * 保存数据源配置
   * @param {Object} config - 数据源配置
   * @returns {Promise<string>} 配置ID
   */
  async saveConfig(config) {
    try {
      // 生成唯一ID
      const configId = this.generateConfigId(config);

      // 验证配置
      this.validateConfig(config);

      // 加密敏感数据
      const encryptedConfig = this.encryptSensitiveFields(config);

      // 添加元数据
      const configWithMeta = {
        ...encryptedConfig,
        id: configId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0',
      };

      // 存储到内存
      this.configs.set(configId, configWithMeta);

      // 持久化到文件
      await this.persistConfigs();

      return configId;
    } catch (error) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  /**
   * 获取数据源配置
   * @param {string} configId - 配置ID
   * @param {boolean} decrypt - 是否解密敏感数据
   * @returns {Object|null} 数据源配置
   */
  async getConfig(configId, decrypt = false) {
    const config = this.configs.get(configId);
    if (!config) {
      return null;
    }

    if (decrypt) {
      return this.decryptSensitiveFields({ ...config });
    }

    return { ...config };
  }

  /**
   * 更新数据源配置
   * @param {string} configId - 配置ID
   * @param {Object} updates - 更新的配置
   * @returns {Promise<boolean>} 更新成功标志
   */
  async updateConfig(configId, updates) {
    try {
      const existingConfig = this.configs.get(configId);
      if (!existingConfig) {
        throw new Error(`Config not found: ${configId}`);
      }

      // 合并配置
      const updatedConfig = {
        ...existingConfig,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // 验证更新后的配置
      this.validateConfig(updatedConfig);

      // 加密敏感数据
      const encryptedConfig = this.encryptSensitiveFields(updatedConfig);

      // 更新内存中的配置
      this.configs.set(configId, encryptedConfig);

      // 持久化
      await this.persistConfigs();

      return true;
    } catch (error) {
      throw new Error(`Failed to update config: ${error.message}`);
    }
  }

  /**
   * 删除数据源配置
   * @param {string} configId - 配置ID
   * @returns {Promise<boolean>} 删除成功标志
   */
  async deleteConfig(configId) {
    try {
      const deleted = this.configs.delete(configId);
      if (deleted) {
        await this.persistConfigs();
      }
      return deleted;
    } catch (error) {
      throw new Error(`Failed to delete config: ${error.message}`);
    }
  }

  /**
   * 获取所有数据源配置
   * @param {boolean} includeCredentials - 是否包含凭据信息
   * @returns {Array} 所有配置列表
   */
  getAllConfigs(includeCredentials = false) {
    const configs = Array.from(this.configs.values());

    if (!includeCredentials) {
      return configs.map(config => this.sanitizeConfig(config));
    }

    return configs;
  }

  /**
   * 按类型筛选配置
   * @param {string} type - 数据源类型
   * @returns {Array} 筛选后的配置列表
   */
  getConfigsByType(type) {
    return Array.from(this.configs.values())
      .filter(config => config.type === type)
      .map(config => this.sanitizeConfig(config));
  }

  /**
   * 测试数据源连接
   * @param {string} configId - 配置ID
   * @returns {Promise<Object>} 测试结果
   */
  async testConnection(configId) {
    const config = await this.getConfig(configId, true);
    if (!config) {
      throw new Error(`Config not found: ${configId}`);
    }

    const startTime = Date.now();

    try {
      // 根据类型测试连接
      let result;
      switch (config.type) {
        case 'mysql':
          result = await this.testMySQLConnection(config);
          break;
        case 'postgresql':
          result = await this.testPostgreSQLConnection(config);
          break;
        case 'file':
          result = await this.testFileAccess(config);
          break;
        default:
          throw new Error(`Unsupported connection type: ${config.type}`);
      }

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime,
        message: 'Connection successful',
        details: result,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        success: false,
        responseTime,
        message: error.message,
        error: error.code || 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * 加载配置文件
   * @returns {Promise<void>}
   */
  async loadConfigs() {
    try {
      const configData = await fs.readFile(this.configFile, 'utf8');
      const configs = JSON.parse(configData);

      // 清空现有配置
      this.configs.clear();

      // 加载配置到内存
      for (const config of configs) {
        this.configs.set(config.id, config);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 配置文件不存在，创建空配置
        await this.persistConfigs();
      } else {
        throw new Error(`Failed to load configs: ${error.message}`);
      }
    }
  }

  /**
   * 持久化配置到文件
   * @private
   */
  async persistConfigs() {
    try {
      const configDir = path.dirname(this.configFile);
      await fs.mkdir(configDir, { recursive: true });

      const configs = Array.from(this.configs.values());
      await fs.writeFile(this.configFile, JSON.stringify(configs, null, 2));
    } catch (error) {
      throw new Error(`Failed to persist configs: ${error.message}`);
    }
  }

  /**
   * 验证配置
   * @private
   */
  validateConfig(config) {
    // 必需字段检查
    const requiredFields = ['name', 'type'];
    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // 类型特定验证
    switch (config.type) {
      case 'mysql':
      case 'postgresql':
        this.validateDatabaseConfig(config);
        break;
      case 'file':
        this.validateFileConfig(config);
        break;
      default:
        throw new Error(`Unsupported data source type: ${config.type}`);
    }
  }

  /**
   * 验证数据库配置
   * @private
   */
  validateDatabaseConfig(config) {
    const required = ['host', 'database', 'user', 'password'];
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required database field: ${field}`);
      }
    }

    if (config.port && (config.port < 1 || config.port > 65535)) {
      throw new Error('Invalid port number');
    }
  }

  /**
   * 验证文件配置
   * @private
   */
  validateFileConfig(config) {
    if (!config.path && !config.uploadPath) {
      throw new Error('File path or upload path is required');
    }

    if (config.maxSize && config.maxSize > 100 * 1024 * 1024) {
      throw new Error('File size cannot exceed 100MB');
    }
  }

  /**
   * 加密敏感字段
   * @private
   */
  encryptSensitiveFields(config) {
    const sensitiveFields = ['password', 'apiKey', 'secret', 'token'];
    const encrypted = { ...config };

    for (const field of sensitiveFields) {
      if (encrypted[field]) {
        encrypted[field] = this.encrypt(encrypted[field]);
      }
    }

    return encrypted;
  }

  /**
   * 解密敏感字段
   * @private
   */
  decryptSensitiveFields(config) {
    const sensitiveFields = ['password', 'apiKey', 'secret', 'token'];
    const decrypted = { ...config };

    for (const field of sensitiveFields) {
      if (decrypted[field] && typeof decrypted[field] === 'string') {
        try {
          decrypted[field] = this.decrypt(decrypted[field]);
        } catch (error) {
          // 如果解密失败，可能是未加密的数据
          console.warn(`Failed to decrypt field ${field}: ${error.message}`);
        }
      }
    }

    return decrypted;
  }

  /**
   * 清理配置（移除敏感信息）
   * @private
   */
  sanitizeConfig(config) {
    const sanitized = { ...config };
    const sensitiveFields = ['password', 'apiKey', 'secret', 'token'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***';
      }
    }

    return sanitized;
  }

  /**
   * 生成配置ID
   * @private
   */
  generateConfigId(config) {
    const data = `${config.type}_${config.name}_${Date.now()}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * 加密
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
   * 解密
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
   * 测试MySQL连接
   * @private
   */
  async testMySQLConnection(config) {
    const mysql = require('mysql2/promise');

    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port || 3306,
      database: config.database,
      user: config.user,
      password: config.password,
      connectTimeout: 30000,
    });

    try {
      const [rows] = await connection.execute('SELECT VERSION() as version');
      return { version: rows[0].version };
    } finally {
      await connection.end();
    }
  }

  /**
   * 测试PostgreSQL连接
   * @private
   */
  async testPostgreSQLConnection(config) {
    // 这里将在Task 2中实现
    throw new Error('PostgreSQL connection test not implemented yet');
  }

  /**
   * 测试文件访问
   * @private
   */
  async testFileAccess(config) {
    if (config.path) {
      const stats = await fs.stat(config.path);
      return {
        exists: true,
        size: stats.size,
        modified: stats.mtime,
      };
    }

    return { uploadReady: true };
  }
}

module.exports = DataSourceConfigManager;

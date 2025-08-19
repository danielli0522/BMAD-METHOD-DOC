/**
 * PostgreSQL数据库适配器
 * 实现PostgreSQL数据库的连接、查询和元数据提取功能
 */

const { Pool } = require('pg');
const crypto = require('crypto');

class PostgreSQLAdapter {
  constructor() {
    this.pools = new Map(); // 存储连接池
    this.poolConfigs = new Map(); // 存储连接池配置
    this.type = 'postgresql';
  }

  /**
   * 创建数据源连接
   * @param {Object} config - 连接配置
   * @returns {Promise<Object>} 连接结果
   */
  async connect(config) {
    try {
      const connectionId = this.generateConnectionId(config);

      // 验证配置
      this.validateConfig(config);

      // 创建连接池配置
      const poolConfig = {
        host: config.host,
        port: config.port || 5432,
        database: config.database,
        user: config.user,
        password: config.password,
        // 连接池配置
        max: config.maxConnections || 10,
        min: config.minConnections || 2,
        idleTimeoutMillis: config.idleTimeoutMillis || 600000,
        connectionTimeoutMillis: config.connectionTimeoutMillis || 30000,
        // SSL配置
        ssl: config.ssl
          ? {
              rejectUnauthorized: false,
              ...config.ssl,
            }
          : false,
        // 应用名称
        application_name: config.applicationName || 'ai-agile-dap',
      };

      // 创建连接池
      const pool = new Pool(poolConfig);

      // 测试连接
      await this.testPoolConnection(pool);

      // 存储连接池和配置
      this.pools.set(connectionId, pool);
      this.poolConfigs.set(connectionId, this.encryptSensitiveData(config));

      // 设置错误处理
      pool.on('error', error => {
        console.error(`PostgreSQL pool error for ${connectionId}:`, error);
      });

      return {
        success: true,
        connectionId,
        message: 'PostgreSQL connection established successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code || 'CONNECTION_ERROR',
      };
    }
  }

  /**
   * 测试连接
   * @param {Object} config - 连接配置
   * @returns {Promise<Object>} 测试结果
   */
  async testConnection(config) {
    const startTime = Date.now();

    try {
      // 创建临时连接进行测试
      const testPool = new Pool({
        host: config.host,
        port: config.port || 5432,
        database: config.database,
        user: config.user,
        password: config.password,
        max: 1,
        connectionTimeoutMillis: 30000,
        ssl: config.ssl || false,
      });

      const client = await testPool.connect();

      try {
        // 执行测试查询
        const result = await client.query('SELECT version(), current_database(), current_user');
        const responseTime = Date.now() - startTime;

        return {
          success: true,
          responseTime,
          version: result.rows[0].version,
          database: result.rows[0].current_database,
          user: result.rows[0].current_user,
          message: 'Connection test successful',
        };
      } finally {
        client.release();
        await testPool.end();
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        success: false,
        responseTime,
        error: error.message,
        code: error.code || 'TEST_FAILED',
      };
    }
  }

  /**
   * 执行查询
   * @param {string} connectionId - 连接ID
   * @param {string} query - SQL查询
   * @param {Array} params - 查询参数
   * @returns {Promise<Object>} 查询结果
   */
  async executeQuery(connectionId, query, params = []) {
    const pool = this.pools.get(connectionId);
    if (!pool) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const startTime = Date.now();
    const client = await pool.connect();

    try {
      const result = await client.query(query, params);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: result.rows,
        fields: result.fields.map(field => ({
          name: field.name,
          type: this.mapPostgreSQLType(field.dataTypeID),
          tableID: field.tableID,
          columnID: field.columnID,
        })),
        rowCount: result.rowCount,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: error.message,
        code: error.code,
        executionTime,
      };
    } finally {
      client.release();
    }
  }

  /**
   * 获取数据库元数据
   * @param {string} connectionId - 连接ID
   * @returns {Promise<Object>} 元数据信息
   */
  async getMetadata(connectionId) {
    try {
      const [tables, schemas, columns] = await Promise.all([
        this.getTables(connectionId),
        this.getSchemas(connectionId),
        this.getColumns(connectionId),
      ]);

      return {
        success: true,
        metadata: {
          tables,
          schemas,
          columns,
          type: this.type,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取数据库表列表
   * @private
   */
  async getTables(connectionId) {
    const query = `
            SELECT 
                schemaname as schema_name,
                tablename as table_name,
                tableowner as table_owner,
                hasindexes as has_indexes,
                hasrules as has_rules,
                hastriggers as has_triggers
            FROM pg_tables 
            WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
            ORDER BY schemaname, tablename
        `;

    const result = await this.executeQuery(connectionId, query);
    return result.success ? result.data : [];
  }

  /**
   * 获取数据库架构信息
   * @private
   */
  async getSchemas(connectionId) {
    const query = `
            SELECT 
                schema_name,
                schema_owner
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
            ORDER BY schema_name
        `;

    const result = await this.executeQuery(connectionId, query);
    return result.success ? result.data : [];
  }

  /**
   * 获取表字段信息
   * @private
   */
  async getColumns(connectionId) {
    const query = `
            SELECT 
                table_schema,
                table_name,
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length,
                numeric_precision,
                numeric_scale,
                ordinal_position
            FROM information_schema.columns 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
            ORDER BY table_schema, table_name, ordinal_position
        `;

    const result = await this.executeQuery(connectionId, query);
    return result.success ? result.data : [];
  }

  /**
   * 获取表数据预览
   * @param {string} connectionId - 连接ID
   * @param {string} tableName - 表名
   * @param {string} schemaName - 架构名
   * @param {number} limit - 限制行数
   * @returns {Promise<Object>} 预览数据
   */
  async getTablePreview(connectionId, tableName, schemaName = 'public', limit = 100) {
    const query = `SELECT * FROM "${schemaName}"."${tableName}" LIMIT $1`;
    const params = [limit];

    return await this.executeQuery(connectionId, query, params);
  }

  /**
   * 获取表行数统计
   * @param {string} connectionId - 连接ID
   * @param {string} tableName - 表名
   * @param {string} schemaName - 架构名
   * @returns {Promise<Object>} 行数统计
   */
  async getTableRowCount(connectionId, tableName, schemaName = 'public') {
    const query = `SELECT COUNT(*) as count FROM "${schemaName}"."${tableName}"`;

    const result = await this.executeQuery(connectionId, query);

    if (result.success && result.data.length > 0) {
      return {
        success: true,
        count: parseInt(result.data[0].count),
      };
    }

    return {
      success: false,
      error: 'Failed to get row count',
    };
  }

  /**
   * 分析数据类型
   * @param {string} connectionId - 连接ID
   * @param {string} tableName - 表名
   * @param {string} columnName - 字段名
   * @param {string} schemaName - 架构名
   * @returns {Promise<Object>} 数据类型分析结果
   */
  async analyzeDataTypes(connectionId, tableName, columnName, schemaName = 'public') {
    const queries = [
      // 获取数据类型信息
      `SELECT 
                data_type,
                is_nullable,
                column_default,
                character_maximum_length,
                numeric_precision,
                numeric_scale
             FROM information_schema.columns 
             WHERE table_schema = $1 
             AND table_name = $2 
             AND column_name = $3`,

      // 获取数据样本
      `SELECT "${columnName}" as value, COUNT(*) as count 
             FROM "${schemaName}"."${tableName}" 
             WHERE "${columnName}" IS NOT NULL 
             GROUP BY "${columnName}" 
             ORDER BY count DESC 
             LIMIT 10`,
    ];

    try {
      const typeResult = await this.executeQuery(connectionId, queries[0], [
        schemaName,
        tableName,
        columnName,
      ]);
      const sampleResult = await this.executeQuery(connectionId, queries[1]);

      if (!typeResult.success) {
        throw new Error(typeResult.error);
      }

      const typeInfo = typeResult.data[0];

      return {
        success: true,
        analysis: {
          dataType: typeInfo?.data_type,
          nullable: typeInfo?.is_nullable === 'YES',
          defaultValue: typeInfo?.column_default,
          maxLength: typeInfo?.character_maximum_length,
          precision: typeInfo?.numeric_precision,
          scale: typeInfo?.numeric_scale,
          sampleValues: sampleResult.success ? sampleResult.data : [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 关闭连接
   * @param {string} connectionId - 连接ID
   */
  async disconnect(connectionId) {
    try {
      const pool = this.pools.get(connectionId);
      if (pool) {
        await pool.end();
        this.pools.delete(connectionId);
        this.poolConfigs.delete(connectionId);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取连接状态
   * @param {string} connectionId - 连接ID
   * @returns {Object} 连接状态
   */
  getConnectionStatus(connectionId) {
    const pool = this.pools.get(connectionId);
    if (!pool) {
      return null;
    }

    return {
      connectionId,
      status: 'active',
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };
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
   * 生成连接ID
   * @private
   */
  generateConnectionId(config) {
    const data = `postgresql_${config.host}_${config.database}_${Date.now()}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * 测试连接池连接
   * @private
   */
  async testPoolConnection(pool) {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }

  /**
   * 加密敏感数据
   * @private
   */
  encryptSensitiveData(config) {
    // 简化版本，实际应用中应该使用更安全的加密方式
    const sensitive = { ...config };
    if (sensitive.password) {
      sensitive.password = '***encrypted***';
    }
    return sensitive;
  }

  /**
   * 映射PostgreSQL数据类型到标准类型
   * @private
   */
  mapPostgreSQLType(dataTypeID) {
    const typeMap = {
      16: 'BOOLEAN', // bool
      17: 'BYTEA', // bytea
      18: 'CHAR', // char
      19: 'NAME', // name
      20: 'BIGINT', // int8
      21: 'SMALLINT', // int2
      23: 'INTEGER', // int4
      25: 'TEXT', // text
      26: 'OID', // oid
      700: 'REAL', // float4
      701: 'DOUBLE', // float8
      1043: 'VARCHAR', // varchar
      1082: 'DATE', // date
      1083: 'TIME', // time
      1114: 'TIMESTAMP', // timestamp
      1184: 'TIMESTAMPTZ', // timestamptz
      1700: 'NUMERIC', // numeric
      2950: 'UUID', // uuid
    };

    return typeMap[dataTypeID] || 'UNKNOWN';
  }
}

module.exports = PostgreSQLAdapter;

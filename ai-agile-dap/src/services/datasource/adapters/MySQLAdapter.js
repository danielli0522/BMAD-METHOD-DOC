/**
 * MySQL数据库适配器
 * 实现MySQL数据库的连接、查询和元数据提取功能
 */

const ConnectionPoolManager = require('../managers/ConnectionPoolManager');

class MySQLAdapter {
  constructor() {
    this.poolManager = new ConnectionPoolManager();
    this.type = 'mysql';
  }

  /**
   * 创建数据源连接
   * @param {Object} config - 连接配置
   * @returns {Promise<Object>} 连接结果
   */
  async connect(config) {
    try {
      const result = await this.poolManager.createMySQLPool({
        ...config,
        poolConfig: {
          max: config.maxConnections || 10,
          min: config.minConnections || 2,
          acquireTimeoutMillis: 30000,
          idleTimeoutMillis: 600000,
        },
      });

      return {
        success: true,
        connectionId: result.poolId,
        message: 'MySQL connection established successfully',
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
      const testResult = await this.poolManager.createMySQLPool({
        ...config,
        id: `test_${Date.now()}`,
        poolConfig: { max: 1, min: 1 },
      });

      // 执行测试查询
      const connection = await this.poolManager.getConnection(testResult.poolId);

      try {
        const [rows] = await connection.execute('SELECT 1 as test, VERSION() as version');
        const responseTime = Date.now() - startTime;

        return {
          success: true,
          responseTime,
          version: rows[0].version,
          message: 'Connection test successful',
        };
      } finally {
        this.poolManager.releaseConnection(testResult.poolId, connection);
        await this.poolManager.closePool(testResult.poolId);
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
    const connection = await this.poolManager.getConnection(connectionId);
    const startTime = Date.now();

    try {
      const [rows, fields] = await connection.execute(query, params);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: rows,
        fields: fields.map(field => ({
          name: field.name,
          type: this.mapMySQLType(field.type),
          nullable: field.flags & 1 ? false : true,
          length: field.length,
        })),
        rowCount: rows.length,
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
      this.poolManager.releaseConnection(connectionId, connection);
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
                TABLE_NAME as name,
                TABLE_COMMENT as comment,
                TABLE_ROWS as row_count,
                CREATE_TIME as created_at
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE()
            ORDER BY TABLE_NAME
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
                SCHEMA_NAME as name,
                DEFAULT_CHARACTER_SET_NAME as charset,
                DEFAULT_COLLATION_NAME as collation
            FROM INFORMATION_SCHEMA.SCHEMATA 
            WHERE SCHEMA_NAME = DATABASE()
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
                TABLE_NAME as table_name,
                COLUMN_NAME as column_name,
                DATA_TYPE as data_type,
                IS_NULLABLE as is_nullable,
                COLUMN_DEFAULT as default_value,
                CHARACTER_MAXIMUM_LENGTH as max_length,
                COLUMN_COMMENT as comment,
                COLUMN_KEY as key_type
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE()
            ORDER BY TABLE_NAME, ORDINAL_POSITION
        `;

    const result = await this.executeQuery(connectionId, query);
    return result.success ? result.data : [];
  }

  /**
   * 获取表数据预览
   * @param {string} connectionId - 连接ID
   * @param {string} tableName - 表名
   * @param {number} limit - 限制行数
   * @returns {Promise<Object>} 预览数据
   */
  async getTablePreview(connectionId, tableName, limit = 100) {
    const query = `SELECT * FROM ?? LIMIT ?`;
    const params = [tableName, limit];

    return await this.executeQuery(connectionId, query, params);
  }

  /**
   * 获取表行数统计
   * @param {string} connectionId - 连接ID
   * @param {string} tableName - 表名
   * @returns {Promise<Object>} 行数统计
   */
  async getTableRowCount(connectionId, tableName) {
    const query = `SELECT COUNT(*) as count FROM ??`;
    const params = [tableName];

    const result = await this.executeQuery(connectionId, query, params);

    if (result.success && result.data.length > 0) {
      return {
        success: true,
        count: result.data[0].count,
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
   * @returns {Promise<Object>} 数据类型分析结果
   */
  async analyzeDataTypes(connectionId, tableName, columnName) {
    const queries = [
      // 获取数据类型分布
      `SELECT 
                DATA_TYPE,
                COLUMN_TYPE,
                IS_NULLABLE,
                COLUMN_DEFAULT
             FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = ? 
             AND COLUMN_NAME = ?`,

      // 获取数据样本
      `SELECT DISTINCT ?? as value, COUNT(*) as count 
             FROM ?? 
             WHERE ?? IS NOT NULL 
             GROUP BY ?? 
             ORDER BY count DESC 
             LIMIT 10`,
    ];

    try {
      const [typeInfo] = await this.executeQuery(connectionId, queries[0], [tableName, columnName]);
      const sampleData = await this.executeQuery(connectionId, queries[1], [
        columnName,
        tableName,
        columnName,
        columnName,
      ]);

      return {
        success: true,
        analysis: {
          dataType: typeInfo.data[0]?.DATA_TYPE,
          columnType: typeInfo.data[0]?.COLUMN_TYPE,
          nullable: typeInfo.data[0]?.IS_NULLABLE === 'YES',
          defaultValue: typeInfo.data[0]?.COLUMN_DEFAULT,
          sampleValues: sampleData.success ? sampleData.data : [],
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
      await this.poolManager.closePool(connectionId);
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
    return this.poolManager.getPoolStatus(connectionId);
  }

  /**
   * 映射MySQL数据类型到标准类型
   * @private
   */
  mapMySQLType(mysqlType) {
    const typeMap = {
      1: 'TINYINT', // MYSQL_TYPE_TINY
      2: 'SMALLINT', // MYSQL_TYPE_SHORT
      3: 'INT', // MYSQL_TYPE_LONG
      4: 'FLOAT', // MYSQL_TYPE_FLOAT
      5: 'DOUBLE', // MYSQL_TYPE_DOUBLE
      7: 'TIMESTAMP', // MYSQL_TYPE_TIMESTAMP
      8: 'BIGINT', // MYSQL_TYPE_LONGLONG
      9: 'MEDIUMINT', // MYSQL_TYPE_INT24
      10: 'DATE', // MYSQL_TYPE_DATE
      11: 'TIME', // MYSQL_TYPE_TIME
      12: 'DATETIME', // MYSQL_TYPE_DATETIME
      13: 'YEAR', // MYSQL_TYPE_YEAR
      15: 'VARCHAR', // MYSQL_TYPE_VARCHAR
      16: 'BIT', // MYSQL_TYPE_BIT
      246: 'DECIMAL', // MYSQL_TYPE_NEWDECIMAL
      247: 'ENUM', // MYSQL_TYPE_ENUM
      248: 'SET', // MYSQL_TYPE_SET
      249: 'TEXT', // MYSQL_TYPE_TINY_BLOB
      250: 'TEXT', // MYSQL_TYPE_MEDIUM_BLOB
      251: 'TEXT', // MYSQL_TYPE_LONG_BLOB
      252: 'TEXT', // MYSQL_TYPE_BLOB
      253: 'VARCHAR', // MYSQL_TYPE_VAR_STRING
      254: 'CHAR', // MYSQL_TYPE_STRING
    };

    return typeMap[mysqlType] || 'UNKNOWN';
  }
}

module.exports = MySQLAdapter;

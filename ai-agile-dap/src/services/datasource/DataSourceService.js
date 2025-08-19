/**
 * 数据源服务
 * 统一管理所有数据源的连接、查询和管理功能
 */

const DataSourceConfigManager = require('./managers/DataSourceConfigManager');
const AdapterFactory = require('./adapters/AdapterFactory');
const ExcelProcessor = require('./processors/ExcelProcessor');
const CSVProcessor = require('./processors/CSVProcessor');

class DataSourceService {
  constructor() {
    this.configManager = new DataSourceConfigManager();
    this.adapterFactory = AdapterFactory;
    this.excelProcessor = new ExcelProcessor();
    this.csvProcessor = new CSVProcessor();
    this.connections = new Map(); // 活动连接映射
    this.initialized = false;
  }

  /**
   * 初始化服务
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await this.configManager.loadConfigs();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize DataSourceService: ${error.message}`);
    }
  }

  /**
   * 创建数据源配置
   * @param {Object} config - 数据源配置
   * @returns {Promise<Object>} 创建结果
   */
  async createDataSource(config) {
    try {
      await this.initialize();

      // 验证配置
      const validation = this.validateDataSourceConfig(config);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          code: 'INVALID_CONFIG',
        };
      }

      // 保存配置
      const configId = await this.configManager.saveConfig(config);

      return {
        success: true,
        configId,
        message: 'Data source created successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'CREATE_ERROR',
      };
    }
  }

  /**
   * 连接到数据源
   * @param {string} configId - 配置ID
   * @returns {Promise<Object>} 连接结果
   */
  async connect(configId) {
    try {
      await this.initialize();

      const config = await this.configManager.getConfig(configId, true);
      if (!config) {
        return {
          success: false,
          error: `Data source configuration not found: ${configId}`,
          code: 'CONFIG_NOT_FOUND',
        };
      }

      // 检查是否已经连接
      if (this.connections.has(configId)) {
        return {
          success: true,
          connectionId: this.connections.get(configId),
          message: 'Already connected',
        };
      }

      // 根据类型获取适配器
      if (config.type === 'file') {
        // 文件类型不需要连接，直接返回成功
        this.connections.set(configId, configId);
        return {
          success: true,
          connectionId: configId,
          message: 'File data source ready',
        };
      } else {
        // 数据库类型需要建立连接
        const adapter = this.adapterFactory.createAdapter(config.type);
        const result = await adapter.connect(config);

        if (result.success) {
          this.connections.set(configId, result.connectionId);
          return {
            success: true,
            connectionId: result.connectionId,
            message: result.message,
          };
        } else {
          return result;
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'CONNECTION_ERROR',
      };
    }
  }

  /**
   * 测试数据源连接
   * @param {string} configId - 配置ID
   * @returns {Promise<Object>} 测试结果
   */
  async testConnection(configId) {
    try {
      await this.initialize();
      return await this.configManager.testConnection(configId);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'TEST_ERROR',
      };
    }
  }

  /**
   * 直接测试连接配置
   * @param {Object} config - 连接配置
   * @returns {Promise<Object>} 测试结果
   */
  async testConnectionConfig(config) {
    try {
      const validation = this.validateDataSourceConfig(config);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          code: 'INVALID_CONFIG',
        };
      }

      if (config.type === 'file') {
        // 文件类型的测试
        return await this.testFileConfig(config);
      } else {
        // 数据库类型的测试
        const adapter = this.adapterFactory.createAdapter(config.type);
        return await adapter.testConnection(config);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'TEST_ERROR',
      };
    }
  }

  /**
   * 获取数据源元数据
   * @param {string} configId - 配置ID
   * @returns {Promise<Object>} 元数据
   */
  async getMetadata(configId) {
    try {
      await this.initialize();

      const config = await this.configManager.getConfig(configId, true);
      if (!config) {
        return {
          success: false,
          error: `Configuration not found: ${configId}`,
          code: 'CONFIG_NOT_FOUND',
        };
      }

      if (config.type === 'file') {
        return await this.getFileMetadata(config);
      } else {
        const connectionId = this.connections.get(configId);
        if (!connectionId) {
          return {
            success: false,
            error: 'Not connected to data source',
            code: 'NOT_CONNECTED',
          };
        }

        const adapter = this.adapterFactory.getAdapter(config.type);
        return await adapter.getMetadata(connectionId);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'METADATA_ERROR',
      };
    }
  }

  /**
   * 执行查询
   * @param {string} configId - 配置ID
   * @param {string} query - 查询语句
   * @param {Array} params - 查询参数
   * @returns {Promise<Object>} 查询结果
   */
  async executeQuery(configId, query, params = []) {
    try {
      await this.initialize();

      const config = await this.configManager.getConfig(configId);
      if (!config) {
        return {
          success: false,
          error: `Configuration not found: ${configId}`,
          code: 'CONFIG_NOT_FOUND',
        };
      }

      if (config.type === 'file') {
        return {
          success: false,
          error: 'Query execution not supported for file data sources',
          code: 'OPERATION_NOT_SUPPORTED',
        };
      }

      const connectionId = this.connections.get(configId);
      if (!connectionId) {
        return {
          success: false,
          error: 'Not connected to data source',
          code: 'NOT_CONNECTED',
        };
      }

      const adapter = this.adapterFactory.getAdapter(config.type);
      return await adapter.executeQuery(connectionId, query, params);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'QUERY_ERROR',
      };
    }
  }

  /**
   * 获取文件数据预览
   * @param {string} configId - 配置ID
   * @param {Object} options - 预览选项
   * @returns {Promise<Object>} 预览数据
   */
  async getFilePreview(configId, options = {}) {
    try {
      await this.initialize();

      const config = await this.configManager.getConfig(configId);
      if (!config) {
        return {
          success: false,
          error: `Configuration not found: ${configId}`,
          code: 'CONFIG_NOT_FOUND',
        };
      }

      if (config.type !== 'file') {
        return {
          success: false,
          error: 'Preview only supported for file data sources',
          code: 'OPERATION_NOT_SUPPORTED',
        };
      }

      const filePath = config.path || config.uploadPath;
      if (!filePath) {
        return {
          success: false,
          error: 'File path not configured',
          code: 'INVALID_CONFIG',
        };
      }

      const extension = require('path').extname(filePath).toLowerCase();

      if (this.excelProcessor.getSupportedExtensions().includes(extension)) {
        return await this.excelProcessor.getPreview(filePath, options);
      } else if (this.csvProcessor.getSupportedExtensions().includes(extension)) {
        return await this.csvProcessor.getPreview(filePath, options);
      } else {
        return {
          success: false,
          error: `Unsupported file type: ${extension}`,
          code: 'UNSUPPORTED_FILE_TYPE',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'PREVIEW_ERROR',
      };
    }
  }

  /**
   * 分析文件数据质量
   * @param {string} configId - 配置ID
   * @param {Object} options - 分析选项
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeFileData(configId, options = {}) {
    try {
      await this.initialize();

      const config = await this.configManager.getConfig(configId);
      if (!config) {
        return {
          success: false,
          error: `Configuration not found: ${configId}`,
          code: 'CONFIG_NOT_FOUND',
        };
      }

      if (config.type !== 'file') {
        return {
          success: false,
          error: 'Analysis only supported for file data sources',
          code: 'OPERATION_NOT_SUPPORTED',
        };
      }

      const filePath = config.path || config.uploadPath;
      const extension = require('path').extname(filePath).toLowerCase();

      if (this.excelProcessor.getSupportedExtensions().includes(extension)) {
        return await this.excelProcessor.analyzeDataTypes(filePath, options);
      } else if (this.csvProcessor.getSupportedExtensions().includes(extension)) {
        return await this.csvProcessor.analyzeDataQuality(filePath, options);
      } else {
        return {
          success: false,
          error: `Unsupported file type: ${extension}`,
          code: 'UNSUPPORTED_FILE_TYPE',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'ANALYSIS_ERROR',
      };
    }
  }

  /**
   * 获取所有数据源配置
   * @returns {Promise<Object>} 配置列表
   */
  async getAllDataSources() {
    try {
      await this.initialize();

      const configs = this.configManager.getAllConfigs(false);
      const enrichedConfigs = configs.map(config => ({
        ...config,
        connected: this.connections.has(config.id),
        connectionId: this.connections.get(config.id) || null,
      }));

      return {
        success: true,
        dataSources: enrichedConfigs,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'LIST_ERROR',
      };
    }
  }

  /**
   * 获取数据源配置
   * @param {string} configId - 配置ID
   * @returns {Promise<Object>} 配置信息
   */
  async getDataSource(configId) {
    try {
      await this.initialize();

      const config = await this.configManager.getConfig(configId, false);
      if (!config) {
        return {
          success: false,
          error: `Configuration not found: ${configId}`,
          code: 'CONFIG_NOT_FOUND',
        };
      }

      return {
        success: true,
        dataSource: {
          ...config,
          connected: this.connections.has(configId),
          connectionId: this.connections.get(configId) || null,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'GET_ERROR',
      };
    }
  }

  /**
   * 更新数据源配置
   * @param {string} configId - 配置ID
   * @param {Object} updates - 更新内容
   * @returns {Promise<Object>} 更新结果
   */
  async updateDataSource(configId, updates) {
    try {
      await this.initialize();

      const success = await this.configManager.updateConfig(configId, updates);

      if (success) {
        // 如果数据源已连接，需要重新连接
        if (this.connections.has(configId)) {
          await this.disconnect(configId);
        }

        return {
          success: true,
          message: 'Data source updated successfully',
        };
      } else {
        return {
          success: false,
          error: 'Failed to update configuration',
          code: 'UPDATE_ERROR',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'UPDATE_ERROR',
      };
    }
  }

  /**
   * 删除数据源配置
   * @param {string} configId - 配置ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteDataSource(configId) {
    try {
      await this.initialize();

      // 先断开连接
      if (this.connections.has(configId)) {
        await this.disconnect(configId);
      }

      const success = await this.configManager.deleteConfig(configId);

      if (success) {
        return {
          success: true,
          message: 'Data source deleted successfully',
        };
      } else {
        return {
          success: false,
          error: 'Configuration not found',
          code: 'CONFIG_NOT_FOUND',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'DELETE_ERROR',
      };
    }
  }

  /**
   * 断开数据源连接
   * @param {string} configId - 配置ID
   * @returns {Promise<Object>} 断开结果
   */
  async disconnect(configId) {
    try {
      const config = await this.configManager.getConfig(configId);
      if (!config) {
        return {
          success: false,
          error: `Configuration not found: ${configId}`,
          code: 'CONFIG_NOT_FOUND',
        };
      }

      const connectionId = this.connections.get(configId);
      if (!connectionId) {
        return {
          success: true,
          message: 'Already disconnected',
        };
      }

      if (config.type !== 'file') {
        const adapter = this.adapterFactory.getAdapter(config.type);
        if (adapter) {
          await adapter.disconnect(connectionId);
        }
      }

      this.connections.delete(configId);

      return {
        success: true,
        message: 'Disconnected successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'DISCONNECT_ERROR',
      };
    }
  }

  /**
   * 获取服务状态
   * @returns {Object} 服务状态
   */
  getStatus() {
    return {
      initialized: this.initialized,
      activeConnections: this.connections.size,
      supportedTypes: this.adapterFactory.getSupportedTypes(),
      connections: Array.from(this.connections.entries()).map(([configId, connectionId]) => ({
        configId,
        connectionId,
      })),
    };
  }

  /**
   * 验证数据源配置
   * @private
   */
  validateDataSourceConfig(config) {
    if (!config.name) {
      return { valid: false, error: 'Data source name is required' };
    }

    if (!config.type) {
      return { valid: false, error: 'Data source type is required' };
    }

    if (!this.adapterFactory.isSupported(config.type) && config.type !== 'file') {
      return { valid: false, error: `Unsupported data source type: ${config.type}` };
    }

    return { valid: true };
  }

  /**
   * 测试文件配置
   * @private
   */
  async testFileConfig(config) {
    const filePath = config.path || config.uploadPath;
    if (!filePath) {
      return {
        success: false,
        error: 'File path is required',
        code: 'INVALID_CONFIG',
      };
    }

    try {
      const extension = require('path').extname(filePath).toLowerCase();

      if (this.excelProcessor.getSupportedExtensions().includes(extension)) {
        return await this.excelProcessor.validateFile(filePath);
      } else if (this.csvProcessor.getSupportedExtensions().includes(extension)) {
        return await this.csvProcessor.validateFile(filePath);
      } else {
        return {
          success: false,
          error: `Unsupported file type: ${extension}`,
          code: 'UNSUPPORTED_FILE_TYPE',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'TEST_ERROR',
      };
    }
  }

  /**
   * 获取文件元数据
   * @private
   */
  async getFileMetadata(config) {
    const filePath = config.path || config.uploadPath;
    const extension = require('path').extname(filePath).toLowerCase();

    try {
      if (this.excelProcessor.getSupportedExtensions().includes(extension)) {
        const validation = await this.excelProcessor.validateFile(filePath);
        if (validation.valid) {
          return {
            success: true,
            metadata: {
              type: 'excel',
              fileName: require('path').basename(filePath),
              fileSize: validation.fileSize,
              extension: validation.extension,
              sheetCount: validation.sheetCount,
              sheetNames: validation.sheetNames,
            },
          };
        } else {
          return { success: false, error: validation.error };
        }
      } else if (this.csvProcessor.getSupportedExtensions().includes(extension)) {
        const validation = await this.csvProcessor.validateFile(filePath);
        if (validation.valid) {
          return {
            success: true,
            metadata: {
              type: 'csv',
              fileName: require('path').basename(filePath),
              fileSize: validation.fileSize,
              extension: validation.extension,
              formatInfo: validation.formatInfo,
            },
          };
        } else {
          return { success: false, error: validation.error };
        }
      } else {
        return {
          success: false,
          error: `Unsupported file type: ${extension}`,
          code: 'UNSUPPORTED_FILE_TYPE',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: 'METADATA_ERROR',
      };
    }
  }
}

module.exports = DataSourceService;

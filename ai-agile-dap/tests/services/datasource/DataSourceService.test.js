/**
 * DataSourceService 单元测试
 */

const DataSourceService = require('../../../src/services/datasource/DataSourceService');

// Mock dependencies
jest.mock('../../../src/services/datasource/managers/DataSourceConfigManager');
jest.mock('../../../src/services/datasource/adapters/AdapterFactory');
jest.mock('../../../src/services/datasource/processors/ExcelProcessor');
jest.mock('../../../src/services/datasource/processors/CSVProcessor');

describe('DataSourceService', () => {
  let service;
  let mockConfigManager;
  let mockAdapterFactory;
  let mockExcelProcessor;
  let mockCSVProcessor;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create service instance
    service = new DataSourceService();

    // Get mock instances
    mockConfigManager = service.configManager;
    mockAdapterFactory = service.adapterFactory;
    mockExcelProcessor = service.excelProcessor;
    mockCSVProcessor = service.csvProcessor;

    // Setup default mock implementations
    mockConfigManager.loadConfigs = jest.fn().mockResolvedValue();
    mockConfigManager.saveConfig = jest.fn().mockResolvedValue('test-config-id');
    mockConfigManager.getConfig = jest.fn().mockResolvedValue({
      id: 'test-config-id',
      name: 'Test Data Source',
      type: 'mysql',
      host: 'localhost',
      database: 'test_db',
      user: 'test_user',
      password: 'test_password',
    });
    mockConfigManager.getAllConfigs = jest.fn().mockReturnValue([]);
    mockConfigManager.updateConfig = jest.fn().mockResolvedValue(true);
    mockConfigManager.deleteConfig = jest.fn().mockResolvedValue(true);
    mockConfigManager.testConnection = jest.fn().mockResolvedValue({
      success: true,
      responseTime: 100,
      message: 'Connection successful',
    });

    mockAdapterFactory.createAdapter = jest.fn().mockReturnValue({
      connect: jest.fn().mockResolvedValue({
        success: true,
        connectionId: 'test-connection-id',
        message: 'Connected successfully',
      }),
      testConnection: jest.fn().mockResolvedValue({
        success: true,
        responseTime: 100,
        message: 'Test successful',
      }),
      getMetadata: jest.fn().mockResolvedValue({
        success: true,
        metadata: { tables: [], schemas: [], columns: [] },
      }),
      executeQuery: jest.fn().mockResolvedValue({
        success: true,
        data: [],
        fields: [],
        rowCount: 0,
        executionTime: 50,
      }),
      disconnect: jest.fn().mockResolvedValue({ success: true }),
    });
    mockAdapterFactory.getAdapter = jest.fn().mockReturnValue(mockAdapterFactory.createAdapter());
    mockAdapterFactory.isSupported = jest.fn().mockReturnValue(true);
    mockAdapterFactory.getSupportedTypes = jest.fn().mockReturnValue(['mysql', 'postgresql']);

    mockExcelProcessor.validateFile = jest.fn().mockResolvedValue({
      valid: true,
      fileSize: 1024,
      extension: '.xlsx',
    });
    mockExcelProcessor.getPreview = jest.fn().mockResolvedValue({
      success: true,
      data: { headers: [], data: [] },
    });
    mockExcelProcessor.analyzeDataTypes = jest.fn().mockResolvedValue({
      success: true,
      analysis: {},
    });
    mockExcelProcessor.getSupportedExtensions = jest.fn().mockReturnValue(['.xlsx', '.xls']);

    mockCSVProcessor.validateFile = jest.fn().mockResolvedValue({
      valid: true,
      fileSize: 1024,
      extension: '.csv',
    });
    mockCSVProcessor.getPreview = jest.fn().mockResolvedValue({
      success: true,
      data: { headers: [], rows: [] },
    });
    mockCSVProcessor.analyzeDataQuality = jest.fn().mockResolvedValue({
      success: true,
      analysis: {},
    });
    mockCSVProcessor.getSupportedExtensions = jest.fn().mockReturnValue(['.csv', '.tsv']);
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      await service.initialize();

      expect(service.initialized).toBe(true);
      expect(mockConfigManager.loadConfigs).toHaveBeenCalled();
    });

    test('should not initialize twice', async () => {
      await service.initialize();
      await service.initialize();

      expect(mockConfigManager.loadConfigs).toHaveBeenCalledTimes(1);
    });

    test('should throw error if initialization fails', async () => {
      mockConfigManager.loadConfigs.mockRejectedValue(new Error('Load failed'));

      await expect(service.initialize()).rejects.toThrow('Failed to initialize DataSourceService');
    });
  });

  describe('createDataSource', () => {
    const validConfig = {
      name: 'Test MySQL',
      type: 'mysql',
      host: 'localhost',
      database: 'test_db',
      user: 'test_user',
      password: 'test_password',
    };

    test('should create data source with valid config', async () => {
      const result = await service.createDataSource(validConfig);

      expect(result.success).toBe(true);
      expect(result.configId).toBe('test-config-id');
      expect(mockConfigManager.saveConfig).toHaveBeenCalledWith(validConfig);
    });

    test('should reject invalid config', async () => {
      const invalidConfig = { type: 'mysql' }; // missing name

      const result = await service.createDataSource(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_CONFIG');
      expect(mockConfigManager.saveConfig).not.toHaveBeenCalled();
    });

    test('should handle save error', async () => {
      mockConfigManager.saveConfig.mockRejectedValue(new Error('Save failed'));

      const result = await service.createDataSource(validConfig);

      expect(result.success).toBe(false);
      expect(result.code).toBe('CREATE_ERROR');
    });
  });

  describe('connect', () => {
    test('should connect to database data source', async () => {
      const result = await service.connect('test-config-id');

      expect(result.success).toBe(true);
      expect(result.connectionId).toBe('test-connection-id');
      expect(mockAdapterFactory.createAdapter).toHaveBeenCalledWith('mysql');
    });

    test('should connect to file data source', async () => {
      mockConfigManager.getConfig.mockResolvedValue({
        id: 'file-config-id',
        name: 'Test File',
        type: 'file',
        path: '/test/file.csv',
      });

      const result = await service.connect('file-config-id');

      expect(result.success).toBe(true);
      expect(result.connectionId).toBe('file-config-id');
      expect(mockAdapterFactory.createAdapter).not.toHaveBeenCalled();
    });

    test('should return error for non-existent config', async () => {
      mockConfigManager.getConfig.mockResolvedValue(null);

      const result = await service.connect('non-existent');

      expect(result.success).toBe(false);
      expect(result.code).toBe('CONFIG_NOT_FOUND');
    });

    test('should return existing connection', async () => {
      // First connection
      await service.connect('test-config-id');

      // Second connection should return existing
      const result = await service.connect('test-config-id');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Already connected');
    });
  });

  describe('testConnection', () => {
    test('should test connection successfully', async () => {
      const result = await service.testConnection('test-config-id');

      expect(result.success).toBe(true);
      expect(result.responseTime).toBe(100);
      expect(mockConfigManager.testConnection).toHaveBeenCalledWith('test-config-id');
    });
  });

  describe('testConnectionConfig', () => {
    const validConfig = {
      name: 'Test MySQL',
      type: 'mysql',
      host: 'localhost',
      database: 'test_db',
      user: 'test_user',
      password: 'test_password',
    };

    test('should test database config', async () => {
      const result = await service.testConnectionConfig(validConfig);

      expect(result.success).toBe(true);
      expect(mockAdapterFactory.createAdapter).toHaveBeenCalledWith('mysql');
    });

    test('should test file config', async () => {
      const fileConfig = {
        name: 'Test File',
        type: 'file',
        path: '/test/file.csv',
      };

      const result = await service.testConnectionConfig(fileConfig);

      expect(result.success).toBe(true);
      expect(mockCSVProcessor.validateFile).toHaveBeenCalledWith('/test/file.csv');
    });

    test('should reject invalid config', async () => {
      const invalidConfig = { type: 'mysql' }; // missing name

      const result = await service.testConnectionConfig(invalidConfig);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_CONFIG');
    });
  });

  describe('getMetadata', () => {
    test('should get database metadata', async () => {
      service.connections.set('test-config-id', 'test-connection-id');

      const result = await service.getMetadata('test-config-id');

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
    });

    test('should get file metadata', async () => {
      mockConfigManager.getConfig.mockResolvedValue({
        id: 'file-config-id',
        name: 'Test File',
        type: 'file',
        path: '/test/file.xlsx',
      });

      const result = await service.getMetadata('file-config-id');

      expect(result.success).toBe(true);
      expect(mockExcelProcessor.validateFile).toHaveBeenCalledWith('/test/file.xlsx');
    });

    test('should return error for not connected database', async () => {
      const result = await service.getMetadata('test-config-id');

      expect(result.success).toBe(false);
      expect(result.code).toBe('NOT_CONNECTED');
    });
  });

  describe('executeQuery', () => {
    test('should execute query successfully', async () => {
      service.connections.set('test-config-id', 'test-connection-id');

      const result = await service.executeQuery('test-config-id', 'SELECT 1', []);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should reject query for file data source', async () => {
      mockConfigManager.getConfig.mockResolvedValue({
        type: 'file',
      });

      const result = await service.executeQuery('test-config-id', 'SELECT 1', []);

      expect(result.success).toBe(false);
      expect(result.code).toBe('OPERATION_NOT_SUPPORTED');
    });

    test('should return error for not connected database', async () => {
      const result = await service.executeQuery('test-config-id', 'SELECT 1', []);

      expect(result.success).toBe(false);
      expect(result.code).toBe('NOT_CONNECTED');
    });
  });

  describe('getFilePreview', () => {
    test('should get Excel file preview', async () => {
      mockConfigManager.getConfig.mockResolvedValue({
        type: 'file',
        path: '/test/file.xlsx',
      });

      const result = await service.getFilePreview('test-config-id');

      expect(result.success).toBe(true);
      expect(mockExcelProcessor.getPreview).toHaveBeenCalledWith('/test/file.xlsx', {});
    });

    test('should get CSV file preview', async () => {
      mockConfigManager.getConfig.mockResolvedValue({
        type: 'file',
        path: '/test/file.csv',
      });

      const result = await service.getFilePreview('test-config-id');

      expect(result.success).toBe(true);
      expect(mockCSVProcessor.getPreview).toHaveBeenCalledWith('/test/file.csv', {});
    });

    test('should reject preview for non-file data source', async () => {
      mockConfigManager.getConfig.mockResolvedValue({
        type: 'mysql',
      });

      const result = await service.getFilePreview('test-config-id');

      expect(result.success).toBe(false);
      expect(result.code).toBe('OPERATION_NOT_SUPPORTED');
    });
  });

  describe('analyzeFileData', () => {
    test('should analyze Excel file data', async () => {
      mockConfigManager.getConfig.mockResolvedValue({
        type: 'file',
        path: '/test/file.xlsx',
      });

      const result = await service.analyzeFileData('test-config-id');

      expect(result.success).toBe(true);
      expect(mockExcelProcessor.analyzeDataTypes).toHaveBeenCalledWith('/test/file.xlsx', {});
    });

    test('should analyze CSV file data', async () => {
      mockConfigManager.getConfig.mockResolvedValue({
        type: 'file',
        path: '/test/file.csv',
      });

      const result = await service.analyzeFileData('test-config-id');

      expect(result.success).toBe(true);
      expect(mockCSVProcessor.analyzeDataQuality).toHaveBeenCalledWith('/test/file.csv', {});
    });
  });

  describe('getAllDataSources', () => {
    test('should return all data sources', async () => {
      mockConfigManager.getAllConfigs.mockReturnValue([
        { id: 'config1', name: 'Data Source 1' },
        { id: 'config2', name: 'Data Source 2' },
      ]);

      const result = await service.getAllDataSources();

      expect(result.success).toBe(true);
      expect(result.dataSources).toHaveLength(2);
      expect(result.dataSources[0].connected).toBe(false);
    });
  });

  describe('updateDataSource', () => {
    test('should update data source successfully', async () => {
      const result = await service.updateDataSource('test-config-id', { name: 'Updated Name' });

      expect(result.success).toBe(true);
      expect(mockConfigManager.updateConfig).toHaveBeenCalledWith('test-config-id', {
        name: 'Updated Name',
      });
    });

    test('should disconnect if connected during update', async () => {
      service.connections.set('test-config-id', 'test-connection-id');

      const result = await service.updateDataSource('test-config-id', { name: 'Updated Name' });

      expect(result.success).toBe(true);
      expect(service.connections.has('test-config-id')).toBe(false);
    });
  });

  describe('deleteDataSource', () => {
    test('should delete data source successfully', async () => {
      const result = await service.deleteDataSource('test-config-id');

      expect(result.success).toBe(true);
      expect(mockConfigManager.deleteConfig).toHaveBeenCalledWith('test-config-id');
    });

    test('should disconnect before deleting', async () => {
      service.connections.set('test-config-id', 'test-connection-id');

      const result = await service.deleteDataSource('test-config-id');

      expect(result.success).toBe(true);
      expect(service.connections.has('test-config-id')).toBe(false);
    });
  });

  describe('disconnect', () => {
    test('should disconnect database successfully', async () => {
      service.connections.set('test-config-id', 'test-connection-id');

      const result = await service.disconnect('test-config-id');

      expect(result.success).toBe(true);
      expect(service.connections.has('test-config-id')).toBe(false);
    });

    test('should disconnect file data source', async () => {
      mockConfigManager.getConfig.mockResolvedValue({ type: 'file' });
      service.connections.set('test-config-id', 'test-config-id');

      const result = await service.disconnect('test-config-id');

      expect(result.success).toBe(true);
      expect(service.connections.has('test-config-id')).toBe(false);
    });

    test('should handle already disconnected', async () => {
      const result = await service.disconnect('test-config-id');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Already disconnected');
    });
  });

  describe('getStatus', () => {
    test('should return service status', () => {
      service.initialized = true;
      service.connections.set('config1', 'connection1');

      const status = service.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.activeConnections).toBe(1);
      expect(status.supportedTypes).toEqual(['mysql', 'postgresql']);
      expect(status.connections).toHaveLength(1);
    });
  });

  describe('validation', () => {
    test('should validate required name', () => {
      const result = service.validateDataSourceConfig({ type: 'mysql' });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('name is required');
    });

    test('should validate required type', () => {
      const result = service.validateDataSourceConfig({ name: 'Test' });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('type is required');
    });

    test('should validate supported type', () => {
      mockAdapterFactory.isSupported.mockReturnValue(false);

      const result = service.validateDataSourceConfig({
        name: 'Test',
        type: 'unsupported',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported data source type');
    });

    test('should accept file type', () => {
      const result = service.validateDataSourceConfig({
        name: 'Test',
        type: 'file',
      });

      expect(result.valid).toBe(true);
    });
  });
});

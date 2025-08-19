/**
 * DataPreviewService 单元测试
 */

const DataPreviewService = require('../../../src/services/data/DataPreviewService');

describe('DataPreviewService', () => {
  let dataPreviewService;

  beforeEach(() => {
    dataPreviewService = new DataPreviewService();
  });

  describe('generateSample', () => {
    it('应该成功生成数据样本', async () => {
      const datasourceId = 'test-datasource-1';
      const options = {
        sampleSize: 100,
        samplingMethod: 'random',
      };

      const result = await dataPreviewService.generateSample(datasourceId, options);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.datasourceId).toBe(datasourceId);
      expect(result.data.sampleSize).toBe(100);
      expect(result.data.data).toBeInstanceOf(Array);
      expect(result.data.data.length).toBe(100);
    });

    it('应该处理无效的数据源ID', async () => {
      const result = await dataPreviewService.generateSample('', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('analyzeDataQuality', () => {
    it('应该成功分析数据质量', async () => {
      const sampleData = [
        { id: 1, name: 'User 1', email: 'user1@example.com', status: 'active' },
        { id: 2, name: 'User 2', email: 'user2@example.com', status: 'inactive' },
        { id: 3, name: null, email: 'user3@example.com', status: 'active' },
      ];

      const result = await dataPreviewService.analyzeDataQuality({ data: sampleData });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.overallScore).toBeGreaterThan(0);
      expect(result.data.overallScore).toBeLessThanOrEqual(1);
      expect(result.data.metrics).toBeDefined();
    });

    it('应该处理空样本数据', async () => {
      const result = await dataPreviewService.analyzeDataQuality({ data: [] });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('detectRelationships', () => {
    it('应该成功检测数据关系', async () => {
      const sampleData = [
        { id: 1, age: 25, salary: 50000, department: 'IT' },
        { id: 2, age: 30, salary: 60000, department: 'IT' },
        { id: 3, age: 35, salary: 70000, department: 'HR' },
      ];

      const result = await dataPreviewService.detectRelationships({ data: sampleData });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.correlations).toBeInstanceOf(Array);
      expect(result.data.dependencies).toBeInstanceOf(Array);
      expect(result.data.similarities).toBeInstanceOf(Array);
    });
  });

  describe('generateExplorationReport', () => {
    it('应该成功生成探索报告', async () => {
      const datasourceId = 'test-datasource-1';

      const result = await dataPreviewService.generateExplorationReport(datasourceId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.metadata).toBeDefined();
      expect(result.data.summary).toBeDefined();
      expect(result.data.dataQuality).toBeDefined();
      expect(result.data.relationships).toBeDefined();
      expect(result.data.recommendations).toBeInstanceOf(Array);
      expect(result.data.insights).toBeInstanceOf(Array);
    });
  });

  describe('getDataPreview', () => {
    it('应该成功获取数据预览', async () => {
      const datasourceId = 'test-datasource-1';
      const options = {
        page: 1,
        pageSize: 10,
        includeStatistics: true,
        includeQualityScore: true,
      };

      const result = await dataPreviewService.getDataPreview(datasourceId, options);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.datasourceId).toBe(datasourceId);
      expect(result.data.currentPage).toBe(1);
      expect(result.data.pageSize).toBe(10);
      expect(result.data.data).toBeInstanceOf(Array);
      expect(result.data.data.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getDataStatistics', () => {
    it('应该成功获取数据统计信息', async () => {
      const datasourceId = 'test-datasource-1';

      const result = await dataPreviewService.getDataStatistics(datasourceId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('缓存功能', () => {
    it('应该成功缓存和获取样本数据', async () => {
      const datasourceId = 'test-cache-datasource';
      const sampleData = { id: 1, name: 'Test Data' };

      // 缓存数据
      await dataPreviewService.cacheSample(datasourceId, sampleData);

      // 获取缓存数据
      const cachedData = await dataPreviewService.getCachedSample(datasourceId);

      expect(cachedData).toBeDefined();
      expect(cachedData.id).toBe(1);
      expect(cachedData.name).toBe('Test Data');
    });

    it('应该成功清除缓存', async () => {
      const datasourceId = 'test-cache-datasource';
      const sampleData = { id: 1, name: 'Test Data' };

      // 缓存数据
      await dataPreviewService.cacheSample(datasourceId, sampleData);

      // 清除缓存
      await dataPreviewService.clearCache(datasourceId);

      // 验证缓存已清除
      const cachedData = await dataPreviewService.getCachedSample(datasourceId);
      expect(cachedData).toBeNull();
    });
  });

  describe('getServiceStatus', () => {
    it('应该返回正确的服务状态', () => {
      const status = dataPreviewService.getServiceStatus();

      expect(status).toBeDefined();
      expect(status.service).toBe('DataPreviewService');
      expect(status.status).toBe('running');
      expect(status.version).toBe('1.0.0');
      expect(status.components).toBeDefined();
      expect(status.components.samplingService).toBeDefined();
      expect(status.components.qualityAnalyzer).toBeDefined();
      expect(status.components.typeDetector).toBeDefined();
      expect(status.components.relationshipDetector).toBeDefined();
      expect(status.components.explorationReporter).toBeDefined();
    });
  });
});

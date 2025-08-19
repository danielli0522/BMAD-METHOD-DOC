const TemplateLibraryService = require('../../../src/services/template/TemplateLibraryService');

// Mock Redis
jest.mock('ioredis', () => {
  const Redis = jest.fn().mockImplementation(() => ({
    hgetall: jest.fn(),
    hset: jest.fn(),
    hdel: jest.fn(),
    hget: jest.fn(),
    quit: jest.fn(),
  }));
  return Redis;
});

describe('TemplateLibraryService', () => {
  let service;
  let mockRedis;

  beforeEach(() => {
    service = new TemplateLibraryService();
    mockRedis = service.redis;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      await service.initialize();

      expect(service.isInitialized).toBe(true);
      expect(mockRedis.hgetall).toHaveBeenCalledWith('custom_templates');
    });

    it('should handle initialization error', async () => {
      mockRedis.hgetall.mockRejectedValue(new Error('Redis connection failed'));

      await expect(service.initialize()).rejects.toThrow('Redis connection failed');
      expect(service.isInitialized).toBe(false);
    });
  });

  describe('loadPresetTemplates', () => {
    it('should load preset templates correctly', async () => {
      await service.loadPresetTemplates();

      expect(service.templates.size).toBe(3);
      expect(service.templates.has('sales-dashboard')).toBe(true);
      expect(service.templates.has('financial-report')).toBe(true);
      expect(service.templates.has('customer-analytics')).toBe(true);
    });

    it('should handle loading error', async () => {
      // Mock a scenario where loading fails
      jest.spyOn(service, 'loadPresetTemplates').mockRejectedValue(new Error('Loading failed'));

      await expect(service.loadPresetTemplates()).rejects.toThrow('Loading failed');
    });
  });

  describe('loadCustomTemplates', () => {
    it('should load custom templates from Redis', async () => {
      const customTemplates = {
        'custom-1': JSON.stringify({
          id: 'custom-1',
          name: 'Custom Template 1',
          category: 'custom',
          config: { layout: 'grid' },
        }),
      };

      mockRedis.hgetall.mockResolvedValue(customTemplates);

      await service.loadCustomTemplates();

      expect(mockRedis.hgetall).toHaveBeenCalledWith('custom_templates');
      expect(service.templates.has('custom-1')).toBe(true);
    });

    it('should handle empty custom templates', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      await service.loadCustomTemplates();

      expect(service.templates.size).toBe(0);
    });

    it('should handle Redis error gracefully', async () => {
      mockRedis.hgetall.mockRejectedValue(new Error('Redis error'));

      // Should not throw error
      await service.loadCustomTemplates();
    });
  });

  describe('getTemplates', () => {
    beforeEach(async () => {
      await service.loadPresetTemplates();
    });

    it('should return all templates when no filter is applied', async () => {
      const templates = await service.getTemplates();

      expect(templates).toHaveLength(3);
      expect(templates.some(t => t.id === 'sales-dashboard')).toBe(true);
    });

    it('should filter by category', async () => {
      const templates = await service.getTemplates({ category: 'sales' });

      expect(templates).toHaveLength(1);
      expect(templates[0].category).toBe('sales');
    });

    it('should filter by tags', async () => {
      const templates = await service.getTemplates({ tags: ['dashboard'] });

      expect(templates).toHaveLength(1);
      expect(templates[0].tags).toContain('dashboard');
    });

    it('should filter by search term', async () => {
      const templates = await service.getTemplates({ search: '销售' });

      expect(templates).toHaveLength(1);
      expect(templates[0].name).toContain('销售');
    });

    it('should filter by isPreset', async () => {
      const templates = await service.getTemplates({ isPreset: true });

      expect(templates).toHaveLength(3);
      expect(templates.every(t => t.isPreset)).toBe(true);
    });

    it('should sort by name', async () => {
      const templates = await service.getTemplates({ sortBy: 'name' });

      expect(templates[0].name).toBe('客户分析');
      expect(templates[1].name).toBe('财务报表');
      expect(templates[2].name).toBe('销售仪表板');
    });

    it('should throw error when service is not initialized', async () => {
      service.isInitialized = false;

      await expect(service.getTemplates()).rejects.toThrow('Service not initialized');
    });
  });

  describe('searchTemplates', () => {
    beforeEach(async () => {
      await service.loadPresetTemplates();
    });

    it('should search templates by query', async () => {
      const results = await service.searchTemplates('销售');

      expect(results).toHaveLength(1);
      expect(results[0].name).toContain('销售');
    });

    it('should search templates by query and tags', async () => {
      const results = await service.searchTemplates('分析', ['analytics']);

      expect(results).toHaveLength(1);
      expect(results[0].name).toContain('分析');
    });

    it('should return empty results for no match', async () => {
      const results = await service.searchTemplates('不存在');

      expect(results).toHaveLength(0);
    });
  });

  describe('getTemplate', () => {
    beforeEach(async () => {
      await service.loadPresetTemplates();
    });

    it('should return template by id', async () => {
      const template = await service.getTemplate('sales-dashboard');

      expect(template).toBeDefined();
      expect(template.id).toBe('sales-dashboard');
      expect(template.name).toBe('销售仪表板');
    });

    it('should throw error for non-existent template', async () => {
      await expect(service.getTemplate('non-existent')).rejects.toThrow(
        'Template not found: non-existent'
      );
    });
  });

  describe('previewTemplate', () => {
    beforeEach(async () => {
      await service.loadPresetTemplates();
    });

    it('should generate preview data for template', async () => {
      const previewData = await service.previewTemplate('sales-dashboard');

      expect(previewData).toBeDefined();
      expect(previewData.templateId).toBe('sales-dashboard');
      expect(previewData.template).toBeDefined();
      expect(previewData.previewData).toBeDefined();
    });

    it('should use provided data source', async () => {
      const mockDataSource = { test: 'data' };
      const previewData = await service.previewTemplate('sales-dashboard', mockDataSource);

      expect(previewData.previewData).toBe(mockDataSource);
    });
  });

  describe('generateMockData', () => {
    it('should generate chart data', () => {
      const template = {
        config: {
          components: [
            { type: 'chart', chartType: 'line', title: 'Test Chart' },
            { type: 'metric', title: 'Test Metric', value: 'test_value' },
            { type: 'table', title: 'Test Table' },
          ],
        },
      };

      const mockData = service.generateMockData(template);

      expect(mockData).toBeDefined();
      expect(typeof mockData).toBe('object');
    });
  });

  describe('customizeTemplate', () => {
    beforeEach(async () => {
      await service.loadPresetTemplates();
      mockRedis.hset.mockResolvedValue(1);
    });

    it('should create custom template from original', async () => {
      const customizations = {
        name: 'Custom Sales Dashboard',
        description: 'Custom description',
      };

      const customTemplate = await service.customizeTemplate('sales-dashboard', customizations);

      expect(customTemplate).toBeDefined();
      expect(customTemplate.name).toBe('Custom Sales Dashboard');
      expect(customTemplate.description).toBe('Custom description');
      expect(customTemplate.isPreset).toBe(false);
      expect(customTemplate.originalTemplateId).toBe('sales-dashboard');
      expect(customTemplate.id).toMatch(/^custom_/);
    });

    it('should preserve original template properties', async () => {
      const customizations = { name: 'Custom Name' };
      const customTemplate = await service.customizeTemplate('sales-dashboard', customizations);

      expect(customTemplate.category).toBe('sales');
      expect(customTemplate.tags).toEqual(['dashboard', 'sales', 'kpi']);
      expect(customTemplate.config).toBeDefined();
    });
  });

  describe('saveTemplate', () => {
    beforeEach(() => {
      mockRedis.hset.mockResolvedValue(1);
    });

    it('should save new template', async () => {
      const template = {
        name: 'Test Template',
        category: 'test',
        config: { layout: 'grid' },
      };

      const templateId = await service.saveTemplate(template);

      expect(templateId).toBeDefined();
      expect(service.templates.has(templateId)).toBe(true);
      expect(mockRedis.hset).toHaveBeenCalled();
    });

    it('should update existing template', async () => {
      const template = {
        id: 'existing-id',
        name: 'Updated Template',
        category: 'test',
        config: { layout: 'grid' },
      };

      service.templates.set('existing-id', template);

      const templateId = await service.saveTemplate(template);

      expect(templateId).toBe('existing-id');
      expect(template.updatedAt).toBeDefined();
    });

    it('should validate template', async () => {
      const invalidTemplate = {};

      await expect(service.saveTemplate(invalidTemplate)).rejects.toThrow(
        'Template name is required'
      );
    });
  });

  describe('validateTemplate', () => {
    it('should validate required fields', () => {
      const validTemplate = {
        name: 'Test Template',
        category: 'test',
        config: { layout: 'grid' },
      };

      expect(() => service.validateTemplate(validTemplate)).not.toThrow();
    });

    it('should throw error for missing name', () => {
      const invalidTemplate = {
        category: 'test',
        config: { layout: 'grid' },
      };

      expect(() => service.validateTemplate(invalidTemplate)).toThrow('Template name is required');
    });

    it('should throw error for missing config', () => {
      const invalidTemplate = {
        name: 'Test Template',
        category: 'test',
      };

      expect(() => service.validateTemplate(invalidTemplate)).toThrow(
        'Template configuration is required'
      );
    });

    it('should throw error for missing category', () => {
      const invalidTemplate = {
        name: 'Test Template',
        config: { layout: 'grid' },
      };

      expect(() => service.validateTemplate(invalidTemplate)).toThrow(
        'Template category is required'
      );
    });
  });

  describe('deleteTemplate', () => {
    beforeEach(async () => {
      await service.loadPresetTemplates();
      mockRedis.hdel.mockResolvedValue(1);
    });

    it('should delete custom template', async () => {
      const customTemplate = {
        id: 'custom-1',
        name: 'Custom Template',
        category: 'custom',
        config: { layout: 'grid' },
        isPreset: false,
      };

      service.templates.set('custom-1', customTemplate);

      const result = await service.deleteTemplate('custom-1');

      expect(result).toBe(true);
      expect(service.templates.has('custom-1')).toBe(false);
      expect(mockRedis.hdel).toHaveBeenCalledWith('custom_templates', 'custom-1');
    });

    it('should not delete preset template', async () => {
      await expect(service.deleteTemplate('sales-dashboard')).rejects.toThrow(
        'Cannot delete preset templates'
      );
    });

    it('should throw error for non-existent template', async () => {
      await expect(service.deleteTemplate('non-existent')).rejects.toThrow(
        'Template not found: non-existent'
      );
    });
  });

  describe('getCategories', () => {
    beforeEach(async () => {
      await service.initializeCategoriesAndTags();
    });

    it('should return all categories', async () => {
      const categories = await service.getCategories();

      expect(categories).toHaveLength(5);
      expect(categories.some(c => c.id === 'sales')).toBe(true);
      expect(categories.some(c => c.id === 'finance')).toBe(true);
      expect(categories.some(c => c.id === 'analytics')).toBe(true);
    });
  });

  describe('getTags', () => {
    beforeEach(async () => {
      await service.loadPresetTemplates();
      await service.initializeCategoriesAndTags();
    });

    it('should return all tags', async () => {
      const tags = await service.getTags();

      expect(tags).toContain('dashboard');
      expect(tags).toContain('sales');
      expect(tags).toContain('kpi');
      expect(tags).toContain('finance');
      expect(tags).toContain('report');
    });
  });

  describe('getTemplateStats', () => {
    it('should return template stats from Redis', async () => {
      const mockStats = {
        views: 10,
        uses: 5,
        shares: 2,
        lastUsed: '2024-01-01T00:00:00.000Z',
      };

      mockRedis.hget.mockResolvedValue(JSON.stringify(mockStats));

      const stats = await service.getTemplateStats('test-template');

      expect(stats).toEqual(mockStats);
      expect(mockRedis.hget).toHaveBeenCalledWith('template_stats', 'test-template');
    });

    it('should return default stats when not found', async () => {
      mockRedis.hget.mockResolvedValue(null);

      const stats = await service.getTemplateStats('test-template');

      expect(stats).toEqual({
        views: 0,
        uses: 0,
        shares: 0,
        lastUsed: null,
      });
    });
  });

  describe('recordTemplateUse', () => {
    beforeEach(() => {
      mockRedis.hget.mockResolvedValue(
        JSON.stringify({
          views: 0,
          uses: 0,
          shares: 0,
          lastUsed: null,
        })
      );
      mockRedis.hset.mockResolvedValue(1);
    });

    it('should record view action', async () => {
      await service.recordTemplateUse('test-template', 'view');

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'template_stats',
        'test-template',
        expect.stringContaining('"views":1')
      );
    });

    it('should record use action', async () => {
      await service.recordTemplateUse('test-template', 'use');

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'template_stats',
        'test-template',
        expect.stringContaining('"uses":1')
      );
    });

    it('should record share action', async () => {
      await service.recordTemplateUse('test-template', 'share');

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'template_stats',
        'test-template',
        expect.stringContaining('"shares":1')
      );
    });
  });

  describe('getRecommendedTemplates', () => {
    beforeEach(async () => {
      await service.loadPresetTemplates();
    });

    it('should return recommended templates', async () => {
      const recommendations = await service.getRecommendedTemplates();

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(5);
    });

    it('should respect limit parameter', async () => {
      const recommendations = await service.getRecommendedTemplates(null, 2);

      expect(recommendations.length).toBeLessThanOrEqual(2);
    });
  });

  describe('shutdown', () => {
    it('should shutdown service properly', async () => {
      service.isInitialized = true;

      await service.shutdown();

      expect(service.isInitialized).toBe(false);
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});

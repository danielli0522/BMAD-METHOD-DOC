const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const Redis = require('ioredis');
const fs = require('fs').promises;
const path = require('path');

/**
 * 报表模板库核心服务
 * 负责管理预置模板、自定义模板和模板操作
 */
class TemplateLibraryService extends EventEmitter {
  constructor() {
    super();
    this.redis = null;
    this.templates = new Map();
    this.categories = new Map();
    this.tags = new Set();
    this.isInitialized = false;
    this.templateDir = path.join(__dirname, '../../../templates');
  }

  /**
   * 初始化服务
   */
  async initialize() {
    try {
      // 初始化Redis连接
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });

      // 加载预置模板
      await this.loadPresetTemplates();

      // 加载自定义模板
      await this.loadCustomTemplates();

      // 初始化分类和标签
      await this.initializeCategoriesAndTags();

      this.isInitialized = true;
      this.emit('initialized');

      console.log('TemplateLibraryService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TemplateLibraryService:', error);
      throw error;
    }
  }

  /**
   * 加载预置模板
   */
  async loadPresetTemplates() {
    try {
      const presetTemplates = [
        {
          id: 'sales-dashboard',
          name: '销售仪表板',
          category: 'sales',
          tags: ['dashboard', 'sales', 'kpi'],
          description: '销售业绩综合仪表板，包含销售额、客户、产品等关键指标',
          thumbnail: '/templates/sales-dashboard.png',
          config: {
            layout: 'grid',
            components: [
              { type: 'chart', chartType: 'line', title: '销售趋势' },
              { type: 'metric', title: '总销售额', value: 'sales_total' },
              { type: 'chart', chartType: 'pie', title: '产品分布' },
              { type: 'table', title: '销售明细' },
            ],
          },
          isPreset: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'financial-report',
          name: '财务报表',
          category: 'finance',
          tags: ['finance', 'report', 'budget'],
          description: '标准财务报表模板，包含收入、支出、利润等财务指标',
          thumbnail: '/templates/financial-report.png',
          config: {
            layout: 'report',
            components: [
              { type: 'summary', title: '财务摘要' },
              { type: 'chart', chartType: 'bar', title: '收入支出对比' },
              { type: 'metric', title: '净利润', value: 'net_profit' },
              { type: 'table', title: '详细账目' },
            ],
          },
          isPreset: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'customer-analytics',
          name: '客户分析',
          category: 'analytics',
          tags: ['customer', 'analytics', 'segmentation'],
          description: '客户行为分析报表，包含客户画像、购买行为、留存率等',
          thumbnail: '/templates/customer-analytics.png',
          config: {
            layout: 'dashboard',
            components: [
              { type: 'chart', chartType: 'funnel', title: '客户转化漏斗' },
              { type: 'metric', title: '客户总数', value: 'customer_count' },
              { type: 'chart', chartType: 'scatter', title: '客户价值分布' },
              { type: 'table', title: '客户明细' },
            ],
          },
          isPreset: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      for (const template of presetTemplates) {
        this.templates.set(template.id, template);
      }

      console.log(`Loaded ${presetTemplates.length} preset templates`);
    } catch (error) {
      console.error('Failed to load preset templates:', error);
      throw error;
    }
  }

  /**
   * 加载自定义模板
   */
  async loadCustomTemplates() {
    try {
      const customTemplates = await this.redis.hgetall('custom_templates');

      for (const [id, templateData] of Object.entries(customTemplates)) {
        const template = JSON.parse(templateData);
        this.templates.set(id, template);
      }

      console.log(`Loaded ${Object.keys(customTemplates).length} custom templates`);
    } catch (error) {
      console.error('Failed to load custom templates:', error);
      // 不抛出错误，因为可能还没有自定义模板
    }
  }

  /**
   * 初始化分类和标签
   */
  async initializeCategoriesAndTags() {
    // 初始化分类
    this.categories.set('sales', { name: '销售', description: '销售相关报表' });
    this.categories.set('finance', { name: '财务', description: '财务相关报表' });
    this.categories.set('analytics', { name: '分析', description: '数据分析报表' });
    this.categories.set('operations', { name: '运营', description: '运营相关报表' });
    this.categories.set('custom', { name: '自定义', description: '用户自定义报表' });

    // 从模板中提取标签
    for (const template of this.templates.values()) {
      if (template.tags) {
        template.tags.forEach(tag => this.tags.add(tag));
      }
    }
  }

  /**
   * 获取模板列表
   */
  async getTemplates(filter = {}) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    let templates = Array.from(this.templates.values());

    // 应用过滤器
    if (filter.category) {
      templates = templates.filter(t => t.category === filter.category);
    }

    if (filter.tags && filter.tags.length > 0) {
      templates = templates.filter(t => t.tags && filter.tags.some(tag => t.tags.includes(tag)));
    }

    if (filter.isPreset !== undefined) {
      templates = templates.filter(t => t.isPreset === filter.isPreset);
    }

    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      templates = templates.filter(
        t =>
          t.name.toLowerCase().includes(searchTerm) ||
          t.description.toLowerCase().includes(searchTerm) ||
          (t.tags && t.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
      );
    }

    // 排序
    if (filter.sortBy) {
      templates.sort((a, b) => {
        switch (filter.sortBy) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'createdAt':
            return new Date(b.createdAt) - new Date(a.createdAt);
          case 'updatedAt':
            return new Date(b.updatedAt) - new Date(a.updatedAt);
          default:
            return 0;
        }
      });
    }

    return templates;
  }

  /**
   * 搜索模板
   */
  async searchTemplates(query, tags = []) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const filter = { search: query };
    if (tags.length > 0) {
      filter.tags = tags;
    }

    return await this.getTemplates(filter);
  }

  /**
   * 获取模板详情
   */
  async getTemplate(templateId) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return template;
  }

  /**
   * 预览模板
   */
  async previewTemplate(templateId, dataSource = null) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const template = await this.getTemplate(templateId);

    // 这里应该根据模板配置和数据源生成预览数据
    const previewData = {
      templateId,
      template,
      previewData: dataSource || this.generateMockData(template),
      generatedAt: new Date(),
    };

    return previewData;
  }

  /**
   * 生成模拟数据用于预览
   */
  generateMockData(template) {
    const mockData = {};

    if (template.config && template.config.components) {
      template.config.components.forEach(component => {
        switch (component.type) {
          case 'chart':
            mockData[component.title] = this.generateChartData(component.chartType);
            break;
          case 'metric':
            mockData[component.title] = Math.floor(Math.random() * 1000000);
            break;
          case 'table':
            mockData[component.title] = this.generateTableData();
            break;
        }
      });
    }

    return mockData;
  }

  /**
   * 生成图表数据
   */
  generateChartData(chartType) {
    const data = [];
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

    switch (chartType) {
      case 'line':
      case 'bar':
        data.push({
          labels,
          datasets: [
            {
              label: '数据',
              data: labels.map(() => Math.floor(Math.random() * 1000)),
            },
          ],
        });
        break;
      case 'pie':
        data.push({
          labels: ['类别A', '类别B', '类别C', '类别D'],
          datasets: [
            {
              data: [30, 25, 25, 20],
            },
          ],
        });
        break;
      case 'funnel':
        data.push({
          labels: ['访问', '注册', '购买', '复购'],
          data: [1000, 800, 600, 400],
        });
        break;
    }

    return data;
  }

  /**
   * 生成表格数据
   */
  generateTableData() {
    return {
      columns: ['ID', '名称', '金额', '日期'],
      data: Array.from({ length: 10 }, (_, i) => [
        i + 1,
        `项目${i + 1}`,
        Math.floor(Math.random() * 10000),
        new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ]),
    };
  }

  /**
   * 自定义模板
   */
  async customizeTemplate(templateId, customizations) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const originalTemplate = await this.getTemplate(templateId);

    // 创建自定义模板
    const customTemplate = {
      ...originalTemplate,
      id: `custom_${uuidv4()}`,
      name: customizations.name || `${originalTemplate.name} (自定义)`,
      description: customizations.description || originalTemplate.description,
      config: {
        ...originalTemplate.config,
        ...customizations.config,
      },
      isPreset: false,
      originalTemplateId: templateId,
      customizations,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 保存自定义模板
    await this.saveTemplate(customTemplate);

    return customTemplate;
  }

  /**
   * 保存模板
   */
  async saveTemplate(template) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    // 验证模板
    this.validateTemplate(template);

    // 更新模板
    template.updatedAt = new Date();
    if (!template.id) {
      template.id = uuidv4();
      template.createdAt = new Date();
    }

    // 保存到内存
    this.templates.set(template.id, template);

    // 如果是自定义模板，保存到Redis
    if (!template.isPreset) {
      await this.redis.hset('custom_templates', template.id, JSON.stringify(template));
    }

    // 更新标签
    if (template.tags) {
      template.tags.forEach(tag => this.tags.add(tag));
    }

    this.emit('templateSaved', template);
    return template.id;
  }

  /**
   * 验证模板
   */
  validateTemplate(template) {
    if (!template.name || template.name.trim() === '') {
      throw new Error('Template name is required');
    }

    if (!template.config) {
      throw new Error('Template configuration is required');
    }

    if (!template.category) {
      throw new Error('Template category is required');
    }
  }

  /**
   * 删除模板
   */
  async deleteTemplate(templateId) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const template = await this.getTemplate(templateId);

    if (template.isPreset) {
      throw new Error('Cannot delete preset templates');
    }

    // 从内存中删除
    this.templates.delete(templateId);

    // 从Redis中删除
    await this.redis.hdel('custom_templates', templateId);

    this.emit('templateDeleted', templateId);
    return true;
  }

  /**
   * 获取分类列表
   */
  async getCategories() {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    return Array.from(this.categories.entries()).map(([id, category]) => ({
      id,
      ...category,
    }));
  }

  /**
   * 获取标签列表
   */
  async getTags() {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    return Array.from(this.tags).sort();
  }

  /**
   * 获取模板使用统计
   */
  async getTemplateStats(templateId) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const stats = await this.redis.hget('template_stats', templateId);
    return stats
      ? JSON.parse(stats)
      : {
          views: 0,
          uses: 0,
          shares: 0,
          lastUsed: null,
        };
  }

  /**
   * 记录模板使用
   */
  async recordTemplateUse(templateId, action = 'view') {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const stats = await this.getTemplateStats(templateId);

    switch (action) {
      case 'view':
        stats.views++;
        break;
      case 'use':
        stats.uses++;
        stats.lastUsed = new Date().toISOString();
        break;
      case 'share':
        stats.shares++;
        break;
    }

    await this.redis.hset('template_stats', templateId, JSON.stringify(stats));
  }

  /**
   * 获取推荐模板
   */
  async getRecommendedTemplates(userId = null, limit = 5) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    // 简单的推荐算法：基于使用统计
    const allTemplates = await this.getTemplates();
    const templatesWithStats = await Promise.all(
      allTemplates.map(async template => {
        const stats = await this.getTemplateStats(template.id);
        return { ...template, stats };
      })
    );

    // 按使用次数排序
    templatesWithStats.sort((a, b) => b.stats.uses - a.stats.uses);

    return templatesWithStats.slice(0, limit);
  }

  /**
   * 关闭服务
   */
  async shutdown() {
    if (this.redis) {
      await this.redis.quit();
    }
    this.isInitialized = false;
    console.log('TemplateLibraryService shutdown');
  }
}

module.exports = TemplateLibraryService;

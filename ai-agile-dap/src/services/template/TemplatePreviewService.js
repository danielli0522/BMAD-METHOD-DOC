const Redis = require('ioredis');
const { EventEmitter } = require('events');

/**
 * 模板预览服务
 * 负责模板预览、实时数据绑定和缓存管理
 */
class TemplatePreviewService extends EventEmitter {
  constructor() {
    super();
    this.redis = null;
    this.isInitialized = false;
    this.previewCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5分钟缓存过期
  }

  /**
   * 初始化服务
   */
  async initialize() {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });

      this.isInitialized = true;
      console.log('TemplatePreviewService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TemplatePreviewService:', error);
      throw error;
    }
  }

  /**
   * 预览模板
   */
  async previewTemplate(templateId, dataSource = null, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const { useCache = true, forceRefresh = false, dataParams = {} } = options;

    // 检查缓存
    const cacheKey = this.generateCacheKey(templateId, dataSource, dataParams);
    if (useCache && !forceRefresh) {
      const cachedPreview = await this.getCachedPreview(cacheKey);
      if (cachedPreview) {
        return cachedPreview;
      }
    }

    // 获取模板
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // 生成预览数据
    const previewData = await this.generatePreviewData(template, dataSource, dataParams);

    // 缓存结果
    if (useCache) {
      await this.cachePreview(cacheKey, previewData);
    }

    return previewData;
  }

  /**
   * 生成预览数据
   */
  async generatePreviewData(template, dataSource, dataParams) {
    const previewData = {
      templateId: template.id,
      template: template,
      components: [],
      metadata: {
        generatedAt: new Date().toISOString(),
        dataSource: dataSource || 'mock',
        cacheKey: this.generateCacheKey(template.id, dataSource, dataParams),
      },
    };

    // 处理模板组件
    if (template.config && template.config.components) {
      for (const component of template.config.components) {
        const componentData = await this.generateComponentData(component, dataSource, dataParams);
        previewData.components.push({
          ...component,
          data: componentData,
        });
      }
    }

    return previewData;
  }

  /**
   * 生成组件数据
   */
  async generateComponentData(component, dataSource, dataParams) {
    switch (component.type) {
      case 'chart':
        return await this.generateChartData(component, dataSource, dataParams);
      case 'metric':
        return await this.generateMetricData(component, dataSource, dataParams);
      case 'table':
        return await this.generateTableData(component, dataSource, dataParams);
      case 'summary':
        return await this.generateSummaryData(component, dataSource, dataParams);
      default:
        return this.generateMockData(component);
    }
  }

  /**
   * 生成图表数据
   */
  async generateChartData(component, dataSource, dataParams) {
    const { chartType, title, dataField } = component;

    if (dataSource && dataField) {
      // 从数据源获取真实数据
      const realData = await this.fetchDataFromSource(dataSource, dataField, dataParams);
      if (realData) {
        return this.formatChartData(realData, chartType);
      }
    }

    // 生成模拟数据
    return this.generateMockChartData(chartType, title);
  }

  /**
   * 生成指标数据
   */
  async generateMetricData(component, dataSource, dataParams) {
    const { title, value, format, unit } = component;

    if (dataSource && value) {
      // 从数据源获取真实数据
      const realValue = await this.fetchMetricFromSource(dataSource, value, dataParams);
      if (realValue !== null) {
        return {
          value: realValue,
          formatted: this.formatMetricValue(realValue, format, unit),
          title,
          unit,
        };
      }
    }

    // 生成模拟数据
    return {
      value: Math.floor(Math.random() * 1000000),
      formatted: this.formatMetricValue(Math.floor(Math.random() * 1000000), format, unit),
      title,
      unit,
    };
  }

  /**
   * 生成表格数据
   */
  async generateTableData(component, dataSource, dataParams) {
    const { title, columns, dataField, pageSize = 10 } = component;

    if (dataSource && dataField) {
      // 从数据源获取真实数据
      const realData = await this.fetchTableDataFromSource(dataSource, dataField, dataParams);
      if (realData) {
        return {
          columns: realData.columns || columns,
          data: realData.data || [],
          total: realData.total || 0,
          pageSize,
          title,
        };
      }
    }

    // 生成模拟数据
    return this.generateMockTableData(columns, pageSize, title);
  }

  /**
   * 生成摘要数据
   */
  async generateSummaryData(component, dataSource, dataParams) {
    const { title, items } = component;

    const summaryItems = [];

    if (items && items.length > 0) {
      for (const item of items) {
        if (dataSource && item.dataField) {
          const value = await this.fetchMetricFromSource(dataSource, item.dataField, dataParams);
          summaryItems.push({
            label: item.label,
            value: value !== null ? value : Math.floor(Math.random() * 10000),
            format: item.format,
            unit: item.unit,
          });
        } else {
          summaryItems.push({
            label: item.label,
            value: Math.floor(Math.random() * 10000),
            format: item.format,
            unit: item.unit,
          });
        }
      }
    }

    return {
      title,
      items: summaryItems,
    };
  }

  /**
   * 从数据源获取数据
   */
  async fetchDataFromSource(dataSource, dataField, dataParams) {
    try {
      // 这里应该实现真实的数据源连接
      // 暂时返回null，表示使用模拟数据
      return null;
    } catch (error) {
      console.error('Failed to fetch data from source:', error);
      return null;
    }
  }

  /**
   * 从数据源获取指标数据
   */
  async fetchMetricFromSource(dataSource, value, dataParams) {
    try {
      // 这里应该实现真实的指标数据获取
      // 暂时返回null，表示使用模拟数据
      return null;
    } catch (error) {
      console.error('Failed to fetch metric from source:', error);
      return null;
    }
  }

  /**
   * 从数据源获取表格数据
   */
  async fetchTableDataFromSource(dataSource, dataField, dataParams) {
    try {
      // 这里应该实现真实的表格数据获取
      // 暂时返回null，表示使用模拟数据
      return null;
    } catch (error) {
      console.error('Failed to fetch table data from source:', error);
      return null;
    }
  }

  /**
   * 格式化图表数据
   */
  formatChartData(data, chartType) {
    // 根据图表类型格式化数据
    switch (chartType) {
      case 'line':
      case 'bar':
        return {
          labels: data.labels || [],
          datasets: data.datasets || [],
        };
      case 'pie':
      case 'doughnut':
        return {
          labels: data.labels || [],
          datasets: [
            {
              data: data.data || [],
            },
          ],
        };
      case 'funnel':
        return {
          labels: data.labels || [],
          data: data.data || [],
        };
      default:
        return data;
    }
  }

  /**
   * 格式化指标值
   */
  formatMetricValue(value, format, unit) {
    if (value === null || value === undefined) {
      return 'N/A';
    }

    let formatted = value;

    // 应用格式化
    if (format) {
      switch (format) {
        case 'currency':
          formatted = new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: 'CNY',
          }).format(value);
          break;
        case 'number':
          formatted = new Intl.NumberFormat('zh-CN').format(value);
          break;
        case 'percentage':
          formatted = `${(value * 100).toFixed(2)}%`;
          break;
        case 'decimal':
          formatted = value.toFixed(2);
          break;
      }
    }

    // 添加单位
    if (unit) {
      formatted += ` ${unit}`;
    }

    return formatted;
  }

  /**
   * 生成模拟图表数据
   */
  generateMockChartData(chartType, title) {
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

    switch (chartType) {
      case 'line':
      case 'bar':
        return {
          labels,
          datasets: [
            {
              label: title || '数据',
              data: labels.map(() => Math.floor(Math.random() * 1000)),
              backgroundColor: this.getRandomColor(),
              borderColor: this.getRandomColor(),
            },
          ],
        };
      case 'pie':
      case 'doughnut':
        return {
          labels: ['类别A', '类别B', '类别C', '类别D'],
          datasets: [
            {
              data: [30, 25, 25, 20],
              backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'],
            },
          ],
        };
      case 'funnel':
        return {
          labels: ['访问', '注册', '购买', '复购'],
          data: [1000, 800, 600, 400],
        };
      default:
        return {
          labels: [],
          datasets: [],
        };
    }
  }

  /**
   * 生成模拟表格数据
   */
  generateMockTableData(columns, pageSize, title) {
    const mockColumns = columns || ['ID', '名称', '金额', '日期', '状态'];
    const mockData = Array.from({ length: pageSize }, (_, i) => {
      const row = [];
      mockColumns.forEach(column => {
        switch (column) {
          case 'ID':
            row.push(i + 1);
            break;
          case '名称':
            row.push(`项目${i + 1}`);
            break;
          case '金额':
            row.push(Math.floor(Math.random() * 10000));
            break;
          case '日期':
            row.push(
              new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0]
            );
            break;
          case '状态':
            row.push(['活跃', '暂停', '完成'][Math.floor(Math.random() * 3)]);
            break;
          default:
            row.push(`数据${i + 1}`);
        }
      });
      return row;
    });

    return {
      columns: mockColumns,
      data: mockData,
      total: 100,
      pageSize,
      title,
    };
  }

  /**
   * 生成模拟数据
   */
  generateMockData(component) {
    return {
      value: Math.floor(Math.random() * 1000),
      label: component.title || '数据',
    };
  }

  /**
   * 获取随机颜色
   */
  getRandomColor() {
    const colors = [
      '#FF6384',
      '#36A2EB',
      '#FFCE56',
      '#4BC0C0',
      '#9966FF',
      '#FF9F40',
      '#FF6384',
      '#C9CBCF',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(templateId, dataSource, dataParams) {
    const params = dataParams ? JSON.stringify(dataParams) : '';
    return `preview:${templateId}:${dataSource || 'mock'}:${Buffer.from(params).toString('base64')}`;
  }

  /**
   * 获取缓存的预览
   */
  async getCachedPreview(cacheKey) {
    try {
      // 先检查内存缓存
      const memoryCache = this.previewCache.get(cacheKey);
      if (memoryCache && Date.now() - memoryCache.timestamp < this.cacheExpiry) {
        return memoryCache.data;
      }

      // 检查Redis缓存
      const redisCache = await this.redis.get(cacheKey);
      if (redisCache) {
        const data = JSON.parse(redisCache);
        // 更新内存缓存
        this.previewCache.set(cacheKey, {
          data,
          timestamp: Date.now(),
        });
        return data;
      }

      return null;
    } catch (error) {
      console.error('Failed to get cached preview:', error);
      return null;
    }
  }

  /**
   * 缓存预览数据
   */
  async cachePreview(cacheKey, previewData) {
    try {
      // 缓存到内存
      this.previewCache.set(cacheKey, {
        data: previewData,
        timestamp: Date.now(),
      });

      // 缓存到Redis
      await this.redis.setex(cacheKey, 300, JSON.stringify(previewData)); // 5分钟过期

      // 清理过期缓存
      this.cleanupExpiredCache();
    } catch (error) {
      console.error('Failed to cache preview:', error);
    }
  }

  /**
   * 清理过期缓存
   */
  cleanupExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.previewCache.entries()) {
      if (now - value.timestamp > this.cacheExpiry) {
        this.previewCache.delete(key);
      }
    }
  }

  /**
   * 清除预览缓存
   */
  async clearPreviewCache(templateId = null) {
    try {
      if (templateId) {
        // 清除特定模板的缓存
        const pattern = `preview:${templateId}:*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }

        // 清除内存缓存
        for (const [key] of this.previewCache.entries()) {
          if (key.startsWith(`preview:${templateId}:`)) {
            this.previewCache.delete(key);
          }
        }
      } else {
        // 清除所有预览缓存
        const keys = await this.redis.keys('preview:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        this.previewCache.clear();
      }
    } catch (error) {
      console.error('Failed to clear preview cache:', error);
    }
  }

  /**
   * 获取模板
   */
  async getTemplate(templateId) {
    try {
      // 从Redis获取模板
      const templateData = await this.redis.hget('custom_templates', templateId);
      if (templateData) {
        return JSON.parse(templateData);
      }

      // 如果找不到，返回null
      return null;
    } catch (error) {
      console.error('Failed to get template:', error);
      return null;
    }
  }

  /**
   * 获取预览统计
   */
  async getPreviewStats(templateId) {
    try {
      const stats = await this.redis.hget('preview_stats', templateId);
      return stats
        ? JSON.parse(stats)
        : {
            previews: 0,
            lastPreview: null,
            averageLoadTime: 0,
          };
    } catch (error) {
      console.error('Failed to get preview stats:', error);
      return {
        previews: 0,
        lastPreview: null,
        averageLoadTime: 0,
      };
    }
  }

  /**
   * 记录预览统计
   */
  async recordPreviewStats(templateId, loadTime) {
    try {
      const stats = await this.getPreviewStats(templateId);
      stats.previews++;
      stats.lastPreview = new Date().toISOString();

      // 计算平均加载时间
      if (stats.averageLoadTime === 0) {
        stats.averageLoadTime = loadTime;
      } else {
        stats.averageLoadTime = (stats.averageLoadTime + loadTime) / 2;
      }

      await this.redis.hset('preview_stats', templateId, JSON.stringify(stats));
    } catch (error) {
      console.error('Failed to record preview stats:', error);
    }
  }

  /**
   * 关闭服务
   */
  async shutdown() {
    if (this.redis) {
      await this.redis.quit();
    }
    this.isInitialized = false;
    console.log('TemplatePreviewService shutdown');
  }
}

module.exports = TemplatePreviewService;

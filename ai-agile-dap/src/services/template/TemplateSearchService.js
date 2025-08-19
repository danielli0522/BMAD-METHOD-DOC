const Redis = require('ioredis');

/**
 * 模板搜索服务
 * 提供高级搜索、智能推荐和统计分析功能
 */
class TemplateSearchService {
  constructor() {
    this.redis = null;
    this.isInitialized = false;
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
      console.log('TemplateSearchService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TemplateSearchService:', error);
      throw error;
    }
  }

  /**
   * 全文搜索模板
   */
  async fullTextSearch(query, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const { limit = 20, offset = 0, category = null, tags = [], sortBy = 'relevance' } = options;

    // 构建搜索关键词
    const keywords = this.extractKeywords(query);

    // 从Redis获取所有模板
    const allTemplates = await this.redis.hgetall('custom_templates');
    const presetTemplates = await this.getPresetTemplates();

    const templates = [...presetTemplates, ...Object.values(allTemplates).map(t => JSON.parse(t))];

    // 执行搜索
    const searchResults = await this.performSearch(templates, keywords, {
      category,
      tags,
      limit,
      offset,
      sortBy,
    });

    return searchResults;
  }

  /**
   * 提取搜索关键词
   */
  extractKeywords(query) {
    if (!query || typeof query !== 'string') {
      return [];
    }

    // 简单的关键词提取：分词、去重、过滤停用词
    const stopWords = new Set([
      '的',
      '了',
      '在',
      '是',
      '我',
      '有',
      '和',
      '就',
      '不',
      '人',
      '都',
      '一',
      '一个',
      '上',
      '也',
      '很',
      '到',
      '说',
      '要',
      '去',
      '你',
      '会',
      '着',
      '没有',
      '看',
      '好',
      '自己',
      '这',
    ]);

    const keywords = query
      .toLowerCase()
      .split(/[\s,，。！？；：""''（）【】]+/)
      .filter(word => word.length > 0 && !stopWords.has(word))
      .filter(word => word.length > 1);

    return [...new Set(keywords)];
  }

  /**
   * 执行搜索
   */
  async performSearch(templates, keywords, options) {
    const { category, tags, limit, offset, sortBy } = options;

    // 计算相关性分数
    const scoredTemplates = await Promise.all(
      templates.map(async template => {
        const score = await this.calculateRelevanceScore(template, keywords, options);
        return { template, score };
      })
    );

    // 过滤结果
    let filteredResults = scoredTemplates.filter(item => item.score > 0);

    // 应用分类过滤
    if (category) {
      filteredResults = filteredResults.filter(item => item.template.category === category);
    }

    // 应用标签过滤
    if (tags && tags.length > 0) {
      filteredResults = filteredResults.filter(
        item => item.template.tags && tags.some(tag => item.template.tags.includes(tag))
      );
    }

    // 排序
    filteredResults.sort((a, b) => {
      switch (sortBy) {
        case 'relevance':
          return b.score - a.score;
        case 'name':
          return a.template.name.localeCompare(b.template.name);
        case 'createdAt':
          return new Date(b.template.createdAt) - new Date(a.template.createdAt);
        case 'popularity':
          return (b.template.stats?.uses || 0) - (a.template.stats?.uses || 0);
        default:
          return b.score - a.score;
      }
    });

    // 分页
    const paginatedResults = filteredResults.slice(offset, offset + limit);

    return {
      results: paginatedResults.map(item => ({
        ...item.template,
        relevanceScore: item.score,
      })),
      total: filteredResults.length,
      limit,
      offset,
    };
  }

  /**
   * 计算相关性分数
   */
  async calculateRelevanceScore(template, keywords, options) {
    let score = 0;

    // 标题匹配权重最高
    if (template.name) {
      const titleScore = this.calculateTextMatchScore(template.name, keywords);
      score += titleScore * 3;
    }

    // 描述匹配
    if (template.description) {
      const descScore = this.calculateTextMatchScore(template.description, keywords);
      score += descScore * 2;
    }

    // 标签匹配
    if (template.tags && template.tags.length > 0) {
      const tagScore = this.calculateTagMatchScore(template.tags, keywords);
      score += tagScore * 1.5;
    }

    // 分类匹配
    if (template.category) {
      const categoryScore = this.calculateTextMatchScore(template.category, keywords);
      score += categoryScore * 1;
    }

    // 使用统计加成
    const stats = await this.getTemplateStats(template.id);
    if (stats) {
      score += Math.min(stats.uses * 0.1, 5); // 最多加5分
      score += Math.min(stats.views * 0.01, 2); // 最多加2分
    }

    return score;
  }

  /**
   * 计算文本匹配分数
   */
  calculateTextMatchScore(text, keywords) {
    if (!text || !keywords.length) return 0;

    const lowerText = text.toLowerCase();
    let score = 0;

    keywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        score += 1;
        // 完整词匹配加分
        if (
          lowerText.includes(` ${keyword} `) ||
          lowerText.startsWith(`${keyword} `) ||
          lowerText.endsWith(` ${keyword}`)
        ) {
          score += 0.5;
        }
      }
    });

    return score;
  }

  /**
   * 计算标签匹配分数
   */
  calculateTagMatchScore(tags, keywords) {
    if (!tags || !keywords.length) return 0;

    let score = 0;
    const lowerTags = tags.map(tag => tag.toLowerCase());

    keywords.forEach(keyword => {
      if (lowerTags.some(tag => tag.includes(keyword))) {
        score += 1;
      }
    });

    return score;
  }

  /**
   * 智能推荐模板
   */
  async getRecommendedTemplates(userId = null, context = {}, limit = 10) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const recommendations = [];

    // 1. 基于用户历史推荐
    if (userId) {
      const userHistory = await this.getUserTemplateHistory(userId);
      const historyBased = await this.getRecommendationsFromHistory(userHistory, limit / 2);
      recommendations.push(...historyBased);
    }

    // 2. 基于上下文推荐
    const contextBased = await this.getRecommendationsFromContext(context, limit / 2);
    recommendations.push(...contextBased);

    // 3. 基于热门推荐
    const popularBased = await this.getPopularTemplates(limit / 2);
    recommendations.push(...popularBased);

    // 去重并排序
    const uniqueRecommendations = this.deduplicateRecommendations(recommendations);

    return uniqueRecommendations.slice(0, limit);
  }

  /**
   * 获取用户模板使用历史
   */
  async getUserTemplateHistory(userId) {
    try {
      const history = await this.redis.lrange(`user_template_history:${userId}`, 0, -1);
      return history.map(item => JSON.parse(item));
    } catch (error) {
      console.error('Failed to get user template history:', error);
      return [];
    }
  }

  /**
   * 基于历史记录推荐
   */
  async getRecommendationsFromHistory(history, limit) {
    if (!history.length) return [];

    // 分析用户偏好
    const preferences = this.analyzeUserPreferences(history);

    // 获取相似模板
    const allTemplates = await this.getAllTemplates();
    const recommendations = [];

    for (const template of allTemplates) {
      const similarity = this.calculateSimilarity(template, preferences);
      if (similarity > 0.3) {
        recommendations.push({ template, score: similarity });
      }
    }

    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.template);
  }

  /**
   * 分析用户偏好
   */
  analyzeUserPreferences(history) {
    const preferences = {
      categories: {},
      tags: {},
      componentTypes: {},
    };

    history.forEach(usage => {
      // 分类偏好
      if (usage.template.category) {
        preferences.categories[usage.template.category] =
          (preferences.categories[usage.template.category] || 0) + 1;
      }

      // 标签偏好
      if (usage.template.tags) {
        usage.template.tags.forEach(tag => {
          preferences.tags[tag] = (preferences.tags[tag] || 0) + 1;
        });
      }

      // 组件类型偏好
      if (usage.template.config && usage.template.config.components) {
        usage.template.config.components.forEach(component => {
          preferences.componentTypes[component.type] =
            (preferences.componentTypes[component.type] || 0) + 1;
        });
      }
    });

    return preferences;
  }

  /**
   * 计算模板相似度
   */
  calculateSimilarity(template, preferences) {
    let similarity = 0;

    // 分类相似度
    if (template.category && preferences.categories[template.category]) {
      similarity += 0.3;
    }

    // 标签相似度
    if (template.tags) {
      const tagMatches = template.tags.filter(tag => preferences.tags[tag]).length;
      similarity += (tagMatches / template.tags.length) * 0.4;
    }

    // 组件类型相似度
    if (template.config && template.config.components) {
      const componentMatches = template.config.components.filter(
        comp => preferences.componentTypes[comp.type]
      ).length;
      similarity += (componentMatches / template.config.components.length) * 0.3;
    }

    return similarity;
  }

  /**
   * 基于上下文推荐
   */
  async getRecommendationsFromContext(context, limit) {
    const { category, tags, componentTypes } = context;
    const allTemplates = await this.getAllTemplates();
    const recommendations = [];

    for (const template of allTemplates) {
      let score = 0;

      if (category && template.category === category) {
        score += 0.5;
      }

      if (tags && template.tags) {
        const tagMatches = tags.filter(tag => template.tags.includes(tag)).length;
        score += (tagMatches / tags.length) * 0.3;
      }

      if (componentTypes && template.config && template.config.components) {
        const componentMatches = componentTypes.filter(type =>
          template.config.components.some(comp => comp.type === type)
        ).length;
        score += (componentMatches / componentTypes.length) * 0.2;
      }

      if (score > 0) {
        recommendations.push({ template, score });
      }
    }

    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.template);
  }

  /**
   * 获取热门模板
   */
  async getPopularTemplates(limit) {
    const allTemplates = await this.getAllTemplates();
    const templatesWithStats = await Promise.all(
      allTemplates.map(async template => {
        const stats = await this.getTemplateStats(template.id);
        return { template, stats };
      })
    );

    return templatesWithStats
      .sort((a, b) => (b.stats?.uses || 0) - (a.stats?.uses || 0))
      .slice(0, limit)
      .map(item => item.template);
  }

  /**
   * 去重推荐结果
   */
  deduplicateRecommendations(recommendations) {
    const seen = new Set();
    return recommendations.filter(template => {
      if (seen.has(template.id)) {
        return false;
      }
      seen.add(template.id);
      return true;
    });
  }

  /**
   * 记录模板使用
   */
  async recordTemplateUse(userId, templateId, action = 'view') {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    try {
      // 更新使用统计
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

      // 记录用户历史
      if (userId) {
        const usageRecord = {
          templateId,
          action,
          timestamp: new Date().toISOString(),
        };
        await this.redis.lpush(`user_template_history:${userId}`, JSON.stringify(usageRecord));
        await this.redis.ltrim(`user_template_history:${userId}`, 0, 99); // 保留最近100条记录
      }
    } catch (error) {
      console.error('Failed to record template use:', error);
    }
  }

  /**
   * 获取模板统计信息
   */
  async getTemplateStats(templateId) {
    try {
      const stats = await this.redis.hget('template_stats', templateId);
      return stats
        ? JSON.parse(stats)
        : {
            views: 0,
            uses: 0,
            shares: 0,
            lastUsed: null,
          };
    } catch (error) {
      console.error('Failed to get template stats:', error);
      return {
        views: 0,
        uses: 0,
        shares: 0,
        lastUsed: null,
      };
    }
  }

  /**
   * 获取所有模板
   */
  async getAllTemplates() {
    try {
      const customTemplates = await this.redis.hgetall('custom_templates');
      const presetTemplates = await this.getPresetTemplates();

      return [...presetTemplates, ...Object.values(customTemplates).map(t => JSON.parse(t))];
    } catch (error) {
      console.error('Failed to get all templates:', error);
      return [];
    }
  }

  /**
   * 获取预置模板
   */
  async getPresetTemplates() {
    // 这里应该从配置或数据库获取预置模板
    // 暂时返回空数组，实际应该从TemplateLibraryService获取
    return [];
  }

  /**
   * 获取搜索建议
   */
  async getSearchSuggestions(query, limit = 5) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    const suggestions = new Set();
    const allTemplates = await this.getAllTemplates();

    // 从模板名称中提取建议
    allTemplates.forEach(template => {
      if (template.name && template.name.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(template.name);
      }
    });

    // 从标签中提取建议
    allTemplates.forEach(template => {
      if (template.tags) {
        template.tags.forEach(tag => {
          if (tag.toLowerCase().includes(query.toLowerCase())) {
            suggestions.add(tag);
          }
        });
      }
    });

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * 关闭服务
   */
  async shutdown() {
    if (this.redis) {
      await this.redis.quit();
    }
    this.isInitialized = false;
    console.log('TemplateSearchService shutdown');
  }
}

module.exports = TemplateSearchService;

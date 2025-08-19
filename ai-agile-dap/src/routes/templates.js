const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const TemplateLibraryService = require('../services/template/TemplateLibraryService');
const TemplateSearchService = require('../services/template/TemplateSearchService');
const TemplatePreviewService = require('../services/template/TemplatePreviewService');

const router = express.Router();

// 初始化服务
const templateLibraryService = new TemplateLibraryService();
const templateSearchService = new TemplateSearchService();
const templatePreviewService = new TemplatePreviewService();

// 中间件：初始化服务
router.use(async (req, res, next) => {
  try {
    if (!templateLibraryService.isInitialized) {
      await templateLibraryService.initialize();
    }
    if (!templateSearchService.isInitialized) {
      await templateSearchService.initialize();
    }
    if (!templatePreviewService.isInitialized) {
      await templatePreviewService.initialize();
    }
    next();
  } catch (error) {
    console.error('Failed to initialize template services:', error);
    res.status(500).json({
      success: false,
      message: '服务初始化失败',
      error: error.message,
    });
  }
});

// 中间件：验证错误处理
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数验证失败',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * 获取模板列表
 * GET /api/templates
 */
router.get(
  '/',
  [
    query('category').optional().isString(),
    query('tags').optional().isArray(),
    query('search').optional().isString(),
    query('sortBy').optional().isIn(['name', 'createdAt', 'updatedAt', 'popularity']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    query('isPreset').optional().isBoolean(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { category, tags, search, sortBy, limit = 20, offset = 0, isPreset } = req.query;

      const filter = {};
      if (category) filter.category = category;
      if (tags) filter.tags = Array.isArray(tags) ? tags : [tags];
      if (search) filter.search = search;
      if (sortBy) filter.sortBy = sortBy;
      if (isPreset !== undefined) filter.isPreset = isPreset === 'true';

      const templates = await templateLibraryService.getTemplates(filter);
      const paginatedTemplates = templates.slice(offset, offset + parseInt(limit));

      res.json({
        success: true,
        data: {
          templates: paginatedTemplates,
          total: templates.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      });
    } catch (error) {
      console.error('Failed to get templates:', error);
      res.status(500).json({
        success: false,
        message: '获取模板列表失败',
        error: error.message,
      });
    }
  }
);

/**
 * 搜索模板
 * GET /api/templates/search
 */
router.get(
  '/search',
  [
    query('q').notEmpty().withMessage('搜索关键词不能为空'),
    query('tags').optional().isArray(),
    query('category').optional().isString(),
    query('sortBy').optional().isIn(['relevance', 'name', 'createdAt', 'popularity']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { q: query, tags, category, sortBy = 'relevance', limit = 20, offset = 0 } = req.query;

      const searchOptions = {
        limit: parseInt(limit),
        offset: parseInt(offset),
        category,
        tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
        sortBy,
      };

      const searchResults = await templateSearchService.fullTextSearch(query, searchOptions);

      res.json({
        success: true,
        data: searchResults,
      });
    } catch (error) {
      console.error('Failed to search templates:', error);
      res.status(500).json({
        success: false,
        message: '搜索模板失败',
        error: error.message,
      });
    }
  }
);

/**
 * 获取搜索建议
 * GET /api/templates/suggestions
 */
router.get(
  '/suggestions',
  [
    query('q').notEmpty().withMessage('搜索关键词不能为空'),
    query('limit').optional().isInt({ min: 1, max: 20 }),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { q: query, limit = 5 } = req.query;
      const suggestions = await templateSearchService.getSearchSuggestions(query, parseInt(limit));

      res.json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      console.error('Failed to get search suggestions:', error);
      res.status(500).json({
        success: false,
        message: '获取搜索建议失败',
        error: error.message,
      });
    }
  }
);

/**
 * 获取模板详情
 * GET /api/templates/:id
 */
router.get(
  '/:id',
  [param('id').notEmpty().withMessage('模板ID不能为空'), handleValidationErrors],
  async (req, res) => {
    try {
      const { id } = req.params;
      const template = await templateLibraryService.getTemplate(id);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: '模板不存在',
        });
      }

      // 记录查看统计
      await templateSearchService.recordTemplateUse(req.user?.id, id, 'view');

      res.json({
        success: true,
        data: template,
      });
    } catch (error) {
      console.error('Failed to get template:', error);
      res.status(500).json({
        success: false,
        message: '获取模板详情失败',
        error: error.message,
      });
    }
  }
);

/**
 * 预览模板
 * GET /api/templates/:id/preview
 */
router.get(
  '/:id/preview',
  [
    param('id').notEmpty().withMessage('模板ID不能为空'),
    query('dataSource').optional().isString(),
    query('useCache').optional().isBoolean(),
    query('forceRefresh').optional().isBoolean(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { dataSource, useCache = true, forceRefresh = false, dataParams } = req.query;

      const startTime = Date.now();
      const previewData = await templatePreviewService.previewTemplate(id, dataSource, {
        useCache,
        forceRefresh,
        dataParams: dataParams ? JSON.parse(dataParams) : {},
      });

      const loadTime = Date.now() - startTime;

      // 记录预览统计
      await templatePreviewService.recordPreviewStats(id, loadTime);

      res.json({
        success: true,
        data: {
          ...previewData,
          loadTime,
        },
      });
    } catch (error) {
      console.error('Failed to preview template:', error);
      res.status(500).json({
        success: false,
        message: '预览模板失败',
        error: error.message,
      });
    }
  }
);

/**
 * 自定义模板
 * POST /api/templates/:id/customize
 */
router.post(
  '/:id/customize',
  [
    param('id').notEmpty().withMessage('模板ID不能为空'),
    body('name').optional().isString().isLength({ min: 1, max: 100 }),
    body('description').optional().isString().isLength({ max: 500 }),
    body('config').optional().isObject(),
    body('tags').optional().isArray(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const customizations = req.body;

      const customTemplate = await templateLibraryService.customizeTemplate(id, customizations);

      res.json({
        success: true,
        data: customTemplate,
        message: '模板自定义成功',
      });
    } catch (error) {
      console.error('Failed to customize template:', error);
      res.status(500).json({
        success: false,
        message: '自定义模板失败',
        error: error.message,
      });
    }
  }
);

/**
 * 创建新模板
 * POST /api/templates
 */
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('模板名称不能为空').isLength({ min: 1, max: 100 }),
    body('description').optional().isString().isLength({ max: 500 }),
    body('category').notEmpty().withMessage('模板分类不能为空'),
    body('config').notEmpty().withMessage('模板配置不能为空').isObject(),
    body('tags').optional().isArray(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const templateData = req.body;
      templateData.isPreset = false;

      const templateId = await templateLibraryService.saveTemplate(templateData);
      const template = await templateLibraryService.getTemplate(templateId);

      res.status(201).json({
        success: true,
        data: template,
        message: '模板创建成功',
      });
    } catch (error) {
      console.error('Failed to create template:', error);
      res.status(500).json({
        success: false,
        message: '创建模板失败',
        error: error.message,
      });
    }
  }
);

/**
 * 更新模板
 * PUT /api/templates/:id
 */
router.put(
  '/:id',
  [
    param('id').notEmpty().withMessage('模板ID不能为空'),
    body('name').optional().isString().isLength({ min: 1, max: 100 }),
    body('description').optional().isString().isLength({ max: 500 }),
    body('category').optional().isString(),
    body('config').optional().isObject(),
    body('tags').optional().isArray(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // 检查模板是否存在
      const existingTemplate = await templateLibraryService.getTemplate(id);
      if (!existingTemplate) {
        return res.status(404).json({
          success: false,
          message: '模板不存在',
        });
      }

      // 检查是否为预置模板
      if (existingTemplate.isPreset) {
        return res.status(403).json({
          success: false,
          message: '不能修改预置模板',
        });
      }

      // 更新模板
      const updatedTemplate = { ...existingTemplate, ...updateData };
      await templateLibraryService.saveTemplate(updatedTemplate);

      res.json({
        success: true,
        data: updatedTemplate,
        message: '模板更新成功',
      });
    } catch (error) {
      console.error('Failed to update template:', error);
      res.status(500).json({
        success: false,
        message: '更新模板失败',
        error: error.message,
      });
    }
  }
);

/**
 * 删除模板
 * DELETE /api/templates/:id
 */
router.delete(
  '/:id',
  [param('id').notEmpty().withMessage('模板ID不能为空'), handleValidationErrors],
  async (req, res) => {
    try {
      const { id } = req.params;

      // 检查模板是否存在
      const template = await templateLibraryService.getTemplate(id);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: '模板不存在',
        });
      }

      // 检查是否为预置模板
      if (template.isPreset) {
        return res.status(403).json({
          success: false,
          message: '不能删除预置模板',
        });
      }

      await templateLibraryService.deleteTemplate(id);

      // 清除相关缓存
      await templatePreviewService.clearPreviewCache(id);

      res.json({
        success: true,
        message: '模板删除成功',
      });
    } catch (error) {
      console.error('Failed to delete template:', error);
      res.status(500).json({
        success: false,
        message: '删除模板失败',
        error: error.message,
      });
    }
  }
);

/**
 * 获取分类列表
 * GET /api/templates/categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await templateLibraryService.getCategories();

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Failed to get categories:', error);
    res.status(500).json({
      success: false,
      message: '获取分类列表失败',
      error: error.message,
    });
  }
});

/**
 * 获取标签列表
 * GET /api/templates/tags
 */
router.get('/tags', async (req, res) => {
  try {
    const tags = await templateLibraryService.getTags();

    res.json({
      success: true,
      data: tags,
    });
  } catch (error) {
    console.error('Failed to get tags:', error);
    res.status(500).json({
      success: false,
      message: '获取标签列表失败',
      error: error.message,
    });
  }
});

/**
 * 获取推荐模板
 * GET /api/templates/recommendations
 */
router.get(
  '/recommendations',
  [
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('category').optional().isString(),
    query('tags').optional().isArray(),
    query('componentTypes').optional().isArray(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { limit = 10, category, tags, componentTypes } = req.query;

      const context = {};
      if (category) context.category = category;
      if (tags) context.tags = Array.isArray(tags) ? tags : [tags];
      if (componentTypes)
        context.componentTypes = Array.isArray(componentTypes) ? componentTypes : [componentTypes];

      const recommendations = await templateSearchService.getRecommendedTemplates(
        req.user?.id,
        context,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: recommendations,
      });
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      res.status(500).json({
        success: false,
        message: '获取推荐模板失败',
        error: error.message,
      });
    }
  }
);

/**
 * 获取模板统计信息
 * GET /api/templates/:id/stats
 */
router.get(
  '/:id/stats',
  [param('id').notEmpty().withMessage('模板ID不能为空'), handleValidationErrors],
  async (req, res) => {
    try {
      const { id } = req.params;

      // 检查模板是否存在
      const template = await templateLibraryService.getTemplate(id);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: '模板不存在',
        });
      }

      const [usageStats, previewStats] = await Promise.all([
        templateLibraryService.getTemplateStats(id),
        templatePreviewService.getPreviewStats(id),
      ]);

      res.json({
        success: true,
        data: {
          usage: usageStats,
          preview: previewStats,
        },
      });
    } catch (error) {
      console.error('Failed to get template stats:', error);
      res.status(500).json({
        success: false,
        message: '获取模板统计失败',
        error: error.message,
      });
    }
  }
);

/**
 * 记录模板使用
 * POST /api/templates/:id/use
 */
router.post(
  '/:id/use',
  [
    param('id').notEmpty().withMessage('模板ID不能为空'),
    body('action').optional().isIn(['view', 'use', 'share']),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { action = 'use' } = req.body;

      // 检查模板是否存在
      const template = await templateLibraryService.getTemplate(id);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: '模板不存在',
        });
      }

      await templateSearchService.recordTemplateUse(req.user?.id, id, action);

      res.json({
        success: true,
        message: '使用记录已保存',
      });
    } catch (error) {
      console.error('Failed to record template use:', error);
      res.status(500).json({
        success: false,
        message: '记录模板使用失败',
        error: error.message,
      });
    }
  }
);

/**
 * 清除预览缓存
 * DELETE /api/templates/:id/cache
 */
router.delete(
  '/:id/cache',
  [param('id').optional().withMessage('模板ID不能为空'), handleValidationErrors],
  async (req, res) => {
    try {
      const { id } = req.params;
      await templatePreviewService.clearPreviewCache(id);

      res.json({
        success: true,
        message: '缓存清除成功',
      });
    } catch (error) {
      console.error('Failed to clear cache:', error);
      res.status(500).json({
        success: false,
        message: '清除缓存失败',
        error: error.message,
      });
    }
  }
);

module.exports = router;

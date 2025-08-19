/**
 * 数据预览API路由
 * 提供数据预览和探索相关的API端点
 */

const express = require('express');
const router = express.Router();
const DataPreviewService = require('../services/data/DataPreviewService');

// 初始化服务
const dataPreviewService = new DataPreviewService();

/**
 * @route GET /api/data-preview/status
 * @desc 获取数据预览服务状态
 * @access Public
 */
router.get('/status', async (req, res) => {
  try {
    const status = dataPreviewService.getServiceStatus();
    res.json({
      success: true,
      data: status,
      message: '服务状态获取成功',
    });
  } catch (error) {
    console.error('获取服务状态失败:', error);
    res.status(500).json({
      success: false,
      error: 'SERVICE_STATUS_FAILED',
      message: '获取服务状态失败',
      details: error.message,
    });
  }
});

/**
 * @route POST /api/data-preview/sample
 * @desc 生成数据样本
 * @access Private
 */
router.post('/sample', async (req, res) => {
  try {
    const { datasourceId, options = {} } = req.body;

    if (!datasourceId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_DATASOURCE_ID',
        message: '缺少数据源ID',
      });
    }

    const result = await dataPreviewService.generateSample(datasourceId, options);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('生成数据样本失败:', error);
    res.status(500).json({
      success: false,
      error: 'SAMPLE_GENERATION_FAILED',
      message: '生成数据样本失败',
      details: error.message,
    });
  }
});

/**
 * @route GET /api/data-preview/preview/:datasourceId
 * @desc 获取数据预览
 * @access Private
 */
router.get('/preview/:datasourceId', async (req, res) => {
  try {
    const { datasourceId } = req.params;
    const {
      page = 1,
      pageSize = 50,
      includeStatistics = true,
      includeQualityScore = true,
    } = req.query;

    const options = {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      includeStatistics: includeStatistics === 'true',
      includeQualityScore: includeQualityScore === 'true',
    };

    const result = await dataPreviewService.getDataPreview(datasourceId, options);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('获取数据预览失败:', error);
    res.status(500).json({
      success: false,
      error: 'PREVIEW_LOADING_FAILED',
      message: '获取数据预览失败',
      details: error.message,
    });
  }
});

/**
 * @route GET /api/data-preview/statistics/:datasourceId
 * @desc 获取数据统计信息
 * @access Private
 */
router.get('/statistics/:datasourceId', async (req, res) => {
  try {
    const { datasourceId } = req.params;

    const result = await dataPreviewService.getDataStatistics(datasourceId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({
      success: false,
      error: 'STATISTICS_LOADING_FAILED',
      message: '获取统计信息失败',
      details: error.message,
    });
  }
});

/**
 * @route POST /api/data-preview/quality-analysis
 * @desc 分析数据质量
 * @access Private
 */
router.post('/quality-analysis', async (req, res) => {
  try {
    const { sample } = req.body;

    if (!sample) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_SAMPLE_DATA',
        message: '缺少样本数据',
      });
    }

    const result = await dataPreviewService.analyzeDataQuality(sample);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('数据质量分析失败:', error);
    res.status(500).json({
      success: false,
      error: 'QUALITY_ANALYSIS_FAILED',
      message: '数据质量分析失败',
      details: error.message,
    });
  }
});

/**
 * @route POST /api/data-preview/relationships
 * @desc 检测数据关系
 * @access Private
 */
router.post('/relationships', async (req, res) => {
  try {
    const { sample } = req.body;

    if (!sample) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_SAMPLE_DATA',
        message: '缺少样本数据',
      });
    }

    const result = await dataPreviewService.detectRelationships(sample);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('数据关系检测失败:', error);
    res.status(500).json({
      success: false,
      error: 'RELATIONSHIP_DETECTION_FAILED',
      message: '数据关系检测失败',
      details: error.message,
    });
  }
});

/**
 * @route POST /api/data-preview/exploration-report
 * @desc 生成数据探索报告
 * @access Private
 */
router.post('/exploration-report', async (req, res) => {
  try {
    const { datasourceId } = req.body;

    if (!datasourceId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_DATASOURCE_ID',
        message: '缺少数据源ID',
      });
    }

    const result = await dataPreviewService.generateExplorationReport(datasourceId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('生成探索报告失败:', error);
    res.status(500).json({
      success: false,
      error: 'REPORT_GENERATION_FAILED',
      message: '生成探索报告失败',
      details: error.message,
    });
  }
});

/**
 * @route DELETE /api/data-preview/cache/:datasourceId?
 * @desc 清除缓存
 * @access Private
 */
router.delete('/cache/:datasourceId?', async (req, res) => {
  try {
    const { datasourceId } = req.params;

    await dataPreviewService.clearCache(datasourceId);

    res.json({
      success: true,
      message: `缓存已清除: ${datasourceId || 'all'}`,
    });
  } catch (error) {
    console.error('清除缓存失败:', error);
    res.status(500).json({
      success: false,
      error: 'CACHE_CLEAR_FAILED',
      message: '清除缓存失败',
      details: error.message,
    });
  }
});

/**
 * @route GET /api/data-preview/sample/:datasourceId
 * @desc 获取缓存的数据样本
 * @access Private
 */
router.get('/sample/:datasourceId', async (req, res) => {
  try {
    const { datasourceId } = req.params;

    const sample = await dataPreviewService.getCachedSample(datasourceId);

    if (sample) {
      res.json({
        success: true,
        data: sample,
        message: '获取缓存样本成功',
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'SAMPLE_NOT_FOUND',
        message: '未找到缓存的样本数据',
      });
    }
  } catch (error) {
    console.error('获取缓存样本失败:', error);
    res.status(500).json({
      success: false,
      error: 'CACHE_LOADING_FAILED',
      message: '获取缓存样本失败',
      details: error.message,
    });
  }
});

module.exports = router;

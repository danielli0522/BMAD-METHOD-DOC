/**
 * 查询管理路由
 * 处理与AI引擎的交互和查询历史管理
 */

const express = require('express');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { authenticate } = require('./auth');
const logger = require('../utils/logger');
const aiEngineClient = require('../services/aiEngineClient');

const router = express.Router();

/**
 * 模拟查询历史数据
 */
const mockQueries = [
  {
    id: 1,
    userId: 1,
    naturalQuery: '显示过去3个月的销售趋势',
    queryType: 'trend查询',
    sqlQuery: 'SELECT DATE(date) as date, SUM(sales_amount) as total_sales FROM business_data WHERE date >= DATE_SUB(NOW(), INTERVAL 3 MONTH) GROUP BY DATE(date) ORDER BY date',
    result: { status: 'success', rows: 90, executionTime: '120ms', confidence: 0.85, data: [] },
    chartConfig: { type: 'line', title: '销售趋势' },
    status: 'success',
    confidence: 0.85,
    processingTime: 1200,
    createdAt: '2024-08-18T06:30:00.000Z',
    updatedAt: '2024-08-18T06:30:00.000Z'
  },
  {
    id: 2,
    userId: 1,
    naturalQuery: '各部门销售业绩对比',
    queryType: 'comparison查询',
    sqlQuery: 'SELECT department, SUM(sales_amount) as total_sales FROM business_data GROUP BY department ORDER BY total_sales DESC',
    result: { status: 'success', rows: 5, executionTime: '85ms', confidence: 0.78, data: [] },
    chartConfig: { type: 'bar', title: '部门销售对比' },
    status: 'success',
    confidence: 0.78,
    processingTime: 850,
    createdAt: '2024-08-17T14:20:00.000Z',
    updatedAt: '2024-08-17T14:20:00.000Z'
  },
  {
    id: 3,
    userId: 1,
    naturalQuery: 'TOP10销售产品排名',
    queryType: 'ranking查询',
    sqlQuery: 'SELECT product_name, SUM(sales_amount) as total_sales FROM business_data GROUP BY product_name ORDER BY total_sales DESC LIMIT 10',
    result: { status: 'success', rows: 10, executionTime: '95ms', confidence: 0.72, data: [] },
    chartConfig: { type: 'bar', title: '产品销售排名' },
    status: 'success',
    confidence: 0.72,
    processingTime: 950,
    createdAt: '2024-08-16T10:15:00.000Z',
    updatedAt: '2024-08-16T10:15:00.000Z'
  }
];

// AI引擎客户端已在 services/aiEngineClient.js 中实现

/**
 * POST /api/queries
 * 创建新查询
 */
router.post('/', asyncHandler(async (req, res) => {
  const { naturalQuery, database = 'default' } = req.body;
  
  // 基础验证
  if (!naturalQuery || naturalQuery.trim().length === 0) {
    throw new ValidationError('查询内容不能为空');
  }
  
  if (naturalQuery.length > 1000) {
    throw new ValidationError('查询内容过长，请控制在1000字符以内');
  }
  
  const startTime = Date.now();
  
  try {
    // 调用AI引擎处理查询
    logger.info('🔍 发送查询到AI引擎', { naturalQuery, database });
    
    const aiResult = await aiEngineClient.processQuery(
      naturalQuery,
      {
        userId: req.user?.id || 1,
        database: database
      },
      {
        include_sql: true,
        include_chart: true,
        max_results: 100
      }
    );
    
    const processingTime = Date.now() - startTime;
    
    // 处理AI引擎客户端响应
    if (!aiResult.success) {
      throw new Error(aiResult.error?.message || 'AI引擎处理失败');
    }
    
    const aiData = aiResult.data;
    const resultData = aiData.data;
    
    // 创建查询记录
    const newQuery = {
      id: mockQueries.length + 1,
      userId: req.user?.id || 1,
      naturalQuery: naturalQuery.trim(),
      queryType: resultData.understood_intent || 'unknown',
      sqlQuery: resultData.sql_query || null,
      result: {
        status: 'success',
        data: resultData.execution_result || [],
        rows: resultData.execution_result?.length || 0,
        executionTime: `${resultData.processing_time || processingTime}ms`,
        confidence: resultData.confidence_score || 0
      },
      chartConfig: resultData.chart_recommendation || null,
      status: 'completed',
      processingTime: resultData.processing_time || processingTime,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    mockQueries.push(newQuery);
    
    // 记录业务日志
    logger.logBusiness('QUERY_CREATED', {
      queryId: newQuery.id,
      userId: newQuery.userId,
      queryType: newQuery.queryType,
      processingTime
    });
    
    logger.logPerformance('AI_QUERY_PROCESSING', processingTime, {
      queryLength: naturalQuery.length,
      queryType: newQuery.queryType
    });
    
    res.status(201).json({
      success: true,
      message: '查询处理成功',
      data: {
        query: newQuery,
        aiEngineResponse: aiData
      }
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.logError(error, req, {
      operation: 'AI_QUERY_PROCESSING',
      naturalQuery,
      processingTime
    });
    
    // 创建失败的查询记录
    const failedQuery = {
      id: mockQueries.length + 1,
      userId: req.user?.id || 1,
      naturalQuery: naturalQuery.trim(),
      queryType: 'unknown',
      sqlQuery: null,
      result: {
        status: 'failed',
        error: error.message,
        executionTime: `${processingTime}ms`
      },
      chartConfig: null,
      status: 'failed',
      processingTime,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    mockQueries.push(failedQuery);
    
    // 判断错误类型
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      throw new ValidationError('AI引擎服务暂不可用，请稍后重试');
    }
    
    if (error.response?.status === 400) {
      throw new ValidationError(error.response.data?.user_message || '查询格式不正确，请重新表述');
    }
    
    throw new ValidationError('查询处理失败，请检查查询内容后重试');
  }
}));

/**
 * GET /api/queries
 * 获取查询历史
 */
router.get('/', asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    status, 
    queryType, 
    search,
    userId 
  } = req.query;
  
  let filteredQueries = [...mockQueries];
  
  // 用户过滤（如果不是管理员，只能看自己的查询）
  if (userId) {
    filteredQueries = filteredQueries.filter(q => q.userId === parseInt(userId));
  }
  
  // 状态过滤
  if (status) {
    filteredQueries = filteredQueries.filter(q => q.status === status);
  }
  
  // 查询类型过滤
  if (queryType) {
    filteredQueries = filteredQueries.filter(q => q.queryType === queryType);
  }
  
  // 搜索过滤
  if (search) {
    filteredQueries = filteredQueries.filter(q => 
      q.naturalQuery.includes(search) || 
      (q.sqlQuery && q.sqlQuery.includes(search))
    );
  }
  
  // 按创建时间降序排序
  filteredQueries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // 分页
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedQueries = filteredQueries.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    message: '获取查询历史成功',
    data: {
      queries: paginatedQueries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredQueries.length,
        totalPages: Math.ceil(filteredQueries.length / limit)
      }
    }
  });
}));

/**
 * GET /api/queries/:id
 * 获取查询详情
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const query = mockQueries.find(q => q.id === parseInt(id));
  if (!query) {
    throw new NotFoundError('查询记录不存在');
  }
  
  res.json({
    success: true,
    message: '获取查询详情成功',
    data: {
      query
    }
  });
}));

/**
 * DELETE /api/queries/:id
 * 删除查询记录
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const queryIndex = mockQueries.findIndex(q => q.id === parseInt(id));
  if (queryIndex === -1) {
    throw new NotFoundError('查询记录不存在');
  }
  
  const deletedQuery = mockQueries[queryIndex];
  mockQueries.splice(queryIndex, 1);
  
  logger.logBusiness('QUERY_DELETED', {
    queryId: parseInt(id),
    userId: deletedQuery.userId
  });
  
  res.json({
    success: true,
    message: '查询记录删除成功'
  });
}));

/**
 * GET /api/queries/ai-engine/status
 * 获取AI引擎服务状态
 */
router.get('/ai-engine/status', asyncHandler(async (req, res) => {
  const status = await aiEngineClient.getServiceStatus();
  
  res.json({
    success: true,
    message: '获取AI引擎状态成功',
    data: status
  });
}));

/**
 * GET /api/queries/stats/summary
 * 获取查询统计信息
 */
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const { userId, period = '7d' } = req.query;
  
  let filteredQueries = [...mockQueries];
  
  // 用户过滤
  if (userId) {
    filteredQueries = filteredQueries.filter(q => q.userId === parseInt(userId));
  }
  
  // 时间段过滤
  const now = new Date();
  let startDate = new Date();
  
  switch (period) {
    case '24h':
      startDate.setDate(now.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(now.getDate() - 30);
      break;
    default:
      startDate.setDate(now.getDate() - 7);
  }
  
  filteredQueries = filteredQueries.filter(q => 
    new Date(q.createdAt) >= startDate
  );
  
  const stats = {
    total: filteredQueries.length,
    successful: filteredQueries.filter(q => q.status === 'completed').length,
    failed: filteredQueries.filter(q => q.status === 'failed').length,
    averageProcessingTime: filteredQueries.length > 0 
      ? Math.round(filteredQueries.reduce((sum, q) => sum + q.processingTime, 0) / filteredQueries.length)
      : 0,
    queryTypes: {
      trend: filteredQueries.filter(q => q.queryType === 'trend').length,
      comparison: filteredQueries.filter(q => q.queryType === 'comparison').length,
      ranking: filteredQueries.filter(q => q.queryType === 'ranking').length,
      statistics: filteredQueries.filter(q => q.queryType === 'statistics').length,
      proportion: filteredQueries.filter(q => q.queryType === 'proportion').length
    }
  };
  
  res.json({
    success: true,
    message: '获取查询统计成功',
    data: {
      stats,
      period
    }
  });
}));

/**
 * GET /api/queries/history
 * 获取查询历史
 */
router.get('/history', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10, status, queryType } = req.query;
  
  // 过滤用户的查询历史
  let userQueries = mockQueries.filter(q => q.userId === userId);
  
  // 按状态过滤
  if (status) {
    userQueries = userQueries.filter(q => q.status === status);
  }
  
  // 按查询类型过滤
  if (queryType) {
    userQueries = userQueries.filter(q => q.queryType.includes(queryType));
  }
  
  // 按时间降序排列
  userQueries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // 分页
  const offset = (page - 1) * limit;
  const paginatedQueries = userQueries.slice(offset, offset + parseInt(limit));
  
  // 整理返回数据
  const formattedQueries = paginatedQueries.map(query => ({
    id: query.id,
    naturalQuery: query.naturalQuery,
    queryType: query.queryType,
    status: query.status,
    confidence: query.confidence,
    processingTime: query.processingTime,
    createdAt: query.createdAt
  }));
  
  res.json({
    success: true,
    message: '获取查询历史成功',
    data: formattedQueries,
    pagination: {
      current: parseInt(page),
      pageSize: parseInt(limit),
      total: userQueries.length,
      totalPages: Math.ceil(userQueries.length / limit)
    }
  });
}));

/**
 * GET /api/queries/:id
 * 获取查询详情
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const queryId = parseInt(req.params.id);
  const userId = req.user.id;
  
  const query = mockQueries.find(q => q.id === queryId && q.userId === userId);
  
  if (!query) {
    throw new NotFoundError('查询记录不存在');
  }
  
  res.json({
    success: true,
    message: '获取查询详情成功',
    data: query
  });
}));

/**
 * DELETE /api/queries/:id
 * 删除查询记录
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const queryId = parseInt(req.params.id);
  const userId = req.user.id;
  
  const queryIndex = mockQueries.findIndex(q => q.id === queryId && q.userId === userId);
  
  if (queryIndex === -1) {
    throw new NotFoundError('查询记录不存在');
  }
  
  mockQueries.splice(queryIndex, 1);
  
  logger.logBusiness('QUERY_DELETED', {
    queryId,
    userId
  });
  
  res.json({
    success: true,
    message: '删除查询记录成功'
  });
}));

module.exports = router;
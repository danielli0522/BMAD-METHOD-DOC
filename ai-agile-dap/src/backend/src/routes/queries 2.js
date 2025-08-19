/**
 * 查询管理路由
 * 处理与AI引擎的交互和查询历史管理
 */

const express = require('express');
const axios = require('axios');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const config = require('../config');

const router = express.Router();

/**
 * 模拟查询历史数据
 */
const mockQueries = [
  {
    id: 1,
    userId: 1,
    naturalQuery: '显示过去3个月的销售趋势',
    queryType: 'trend',
    sqlQuery: 'SELECT DATE(date) as date, SUM(sales_amount) as total_sales FROM business_data WHERE date >= DATE_SUB(NOW(), INTERVAL 3 MONTH) GROUP BY DATE(date) ORDER BY date',
    result: { status: 'success', rows: 90, executionTime: '120ms' },
    chartConfig: { type: 'line', title: '销售趋势' },
    status: 'completed',
    createdAt: new Date('2024-08-18'),
    updatedAt: new Date('2024-08-18')
  },
  {
    id: 2,
    userId: 1,
    naturalQuery: '各部门销售业绩对比',
    queryType: 'comparison',
    sqlQuery: 'SELECT department, SUM(sales_amount) as total_sales FROM business_data GROUP BY department ORDER BY total_sales DESC',
    result: { status: 'success', rows: 5, executionTime: '85ms' },
    chartConfig: { type: 'bar', title: '部门销售对比' },
    status: 'completed',
    createdAt: new Date('2024-08-17'),
    updatedAt: new Date('2024-08-17')
  }
];

/**
 * AI引擎客户端
 */
const aiEngineClient = axios.create({
  baseURL: config.aiEngine.url,
  timeout: config.aiEngine.timeout,
  headers: {
    'Content-Type': 'application/json'
  }
});

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
    
    const aiResponse = await aiEngineClient.post('/api/v1/query', {
      natural_query: naturalQuery,
      database_schema: database,
      user_id: req.user?.id || 1, // TODO: 从认证中间件获取用户ID
      request_id: `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
    
    const processingTime = Date.now() - startTime;
    
    // 创建查询记录
    const newQuery = {
      id: mockQueries.length + 1,
      userId: req.user?.id || 1,
      naturalQuery: naturalQuery.trim(),
      queryType: aiResponse.data.query_intent?.query_type || 'unknown',
      sqlQuery: aiResponse.data.sql_query || null,
      result: {
        status: 'success',
        rows: aiResponse.data.result_preview?.row_count || 0,
        executionTime: `${processingTime}ms`
      },
      chartConfig: aiResponse.data.chart_recommendation || null,
      status: 'completed',
      processingTime,
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
        aiEngineResponse: aiResponse.data
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

module.exports = router;
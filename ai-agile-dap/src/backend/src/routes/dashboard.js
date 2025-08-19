/**
 * 仪表板路由
 * 提供仪表板数据和统计信息
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * 模拟仪表板数据
 */
const mockDashboardData = {
  systemStats: {
    totalUsers: 156,
    activeUsers: 89,
    totalQueries: 2847,
    successfulQueries: 2634,
    averageResponseTime: 1.2,
    systemUptime: 99.8
  },
  queryStats: {
    todayQueries: 67,
    yesterdayQueries: 54,
    weeklyGrowth: 12.5,
    monthlyGrowth: 28.7,
    popularQueryTypes: [
      { type: 'trend', count: 856, percentage: 30.1 },
      { type: 'comparison', count: 634, percentage: 22.3 },
      { type: 'statistics', count: 567, percentage: 19.9 },
      { type: 'ranking', count: 445, percentage: 15.6 },
      { type: 'proportion', count: 345, percentage: 12.1 }
    ]
  },
  performanceStats: {
    averageQueryTime: 1247, // ms
    fastestQuery: 234, // ms
    slowestQuery: 5678, // ms
    cacheHitRate: 67.8, // %
    errorRate: 2.1 // %
  },
  recentActivity: [
    {
      id: 1,
      type: 'query',
      user: '张三',
      action: '执行查询',
      description: '显示过去3个月的销售趋势',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      status: 'success'
    },
    {
      id: 2,
      type: 'user',
      user: '李四',
      action: '用户注册',
      description: '新用户注册成功',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      status: 'success'
    },
    {
      id: 3,
      type: 'query',
      user: '王五',
      action: '执行查询',
      description: '各部门销售业绩对比',
      timestamp: new Date(Date.now() - 25 * 60 * 1000),
      status: 'success'
    },
    {
      id: 4,
      type: 'system',
      user: 'system',
      action: '系统维护',
      description: '定期数据备份完成',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'success'
    }
  ]
};

/**
 * GET /api/dashboard/stats
 * 获取仪表板统计信息
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const { category = 'all' } = req.query;
  
  let responseData = {};
  
  switch (category) {
    case 'system':
      responseData = { systemStats: mockDashboardData.systemStats };
      break;
    case 'queries':
      responseData = { queryStats: mockDashboardData.queryStats };
      break;
    case 'performance':
      responseData = { performanceStats: mockDashboardData.performanceStats };
      break;
    case 'all':
    default:
      responseData = {
        systemStats: mockDashboardData.systemStats,
        queryStats: mockDashboardData.queryStats,
        performanceStats: mockDashboardData.performanceStats
      };
  }
  
  // 添加实时数据更新时间戳
  responseData.lastUpdated = new Date().toISOString();
  
  res.json({
    success: true,
    message: '获取仪表板统计成功',
    data: responseData
  });
}));

/**
 * GET /api/dashboard/charts
 * 获取图表数据
 */
router.get('/charts', asyncHandler(async (req, res) => {
  const { type = 'all', period = '7d' } = req.query;
  
  // 生成模拟的时间序列数据
  const generateTimeSeriesData = (days, baseValue) => {
    const data = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const value = baseValue + Math.floor(Math.random() * 20) - 10;
      data.push({
        date: date.toISOString().split('T')[0],
        value: Math.max(0, value)
      });
    }
    
    return data;
  };
  
  const chartData = {
    queryTrend: {
      title: '查询趋势',
      type: 'line',
      data: generateTimeSeriesData(7, 50),
      config: {
        xAxis: 'date',
        yAxis: 'value',
        color: '#1890ff'
      }
    },
    queryTypeDistribution: {
      title: '查询类型分布',
      type: 'pie',
      data: mockDashboardData.queryStats.popularQueryTypes.map(item => ({
        name: item.type,
        value: item.count
      })),
      config: {
        nameKey: 'name',
        valueKey: 'value'
      }
    },
    performanceTrend: {
      title: '性能趋势',
      type: 'line',
      data: generateTimeSeriesData(7, 1200),
      config: {
        xAxis: 'date',
        yAxis: 'value',
        color: '#52c41a',
        unit: 'ms'
      }
    },
    userActivity: {
      title: '用户活跃度',
      type: 'bar',
      data: generateTimeSeriesData(7, 30),
      config: {
        xAxis: 'date',
        yAxis: 'value',
        color: '#722ed1'
      }
    }
  };
  
  let responseData = {};
  
  if (type === 'all') {
    responseData = chartData;
  } else {
    responseData = { [type]: chartData[type] };
  }
  
  res.json({
    success: true,
    message: '获取图表数据成功',
    data: {
      charts: responseData,
      period,
      generatedAt: new Date().toISOString()
    }
  });
}));

/**
 * GET /api/dashboard/activity
 * 获取最近活动
 */
router.get('/activity', asyncHandler(async (req, res) => {
  const { limit = 10, type } = req.query;
  
  let activities = [...mockDashboardData.recentActivity];
  
  // 类型过滤
  if (type) {
    activities = activities.filter(activity => activity.type === type);
  }
  
  // 限制数量
  activities = activities.slice(0, parseInt(limit));
  
  res.json({
    success: true,
    message: '获取最近活动成功',
    data: {
      activities,
      total: mockDashboardData.recentActivity.length
    }
  });
}));

/**
 * GET /api/dashboard/health
 * 获取系统健康状态
 */
router.get('/health', asyncHandler(async (req, res) => {
  const healthData = {
    overall: 'healthy',
    services: {
      database: {
        status: 'healthy',
        responseTime: 45,
        connections: 8,
        maxConnections: 100
      },
      aiEngine: {
        status: 'healthy',
        responseTime: 1247,
        queueLength: 3,
        maxQueue: 100
      },
      cache: {
        status: 'healthy',
        responseTime: 12,
        hitRate: 67.8,
        memoryUsage: 45.6
      },
      storage: {
        status: 'healthy',
        diskUsage: 23.4,
        freeSpace: 76.6
      }
    },
    metrics: {
      cpuUsage: 34.5,
      memoryUsage: 67.8,
      diskIO: 12.3,
      networkIO: 8.9
    },
    alerts: [
      {
        level: 'info',
        message: '系统运行正常',
        timestamp: new Date().toISOString()
      }
    ],
    lastCheckTime: new Date().toISOString()
  };
  
  res.json({
    success: true,
    message: '获取系统健康状态成功',
    data: healthData
  });
}));

/**
 * GET /api/dashboard/export
 * 导出仪表板数据
 */
router.get('/export', asyncHandler(async (req, res) => {
  const { format = 'json', category = 'all' } = req.query;
  
  let exportData = mockDashboardData;
  
  if (category !== 'all') {
    exportData = { [category]: mockDashboardData[category] };
  }
  
  // 添加导出元数据
  const exportMetadata = {
    exportedAt: new Date().toISOString(),
    exportedBy: req.user?.id || 'anonymous',
    format,
    category,
    version: '1.0.0'
  };
  
  const fullExportData = {
    metadata: exportMetadata,
    data: exportData
  };
  
  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=dashboard-export-${Date.now()}.json`);
    res.json(fullExportData);
  } else {
    // 未来可以支持其他格式如CSV, Excel等
    res.status(400).json({
      success: false,
      message: '暂不支持该导出格式',
      supportedFormats: ['json']
    });
  }
}));

module.exports = router;
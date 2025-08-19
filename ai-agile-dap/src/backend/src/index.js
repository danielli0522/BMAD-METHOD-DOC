/**
 * AI-Agile-DAP 后端服务主入口
 * Sprint 1 Day 1 - 生产级API服务启动
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

// 导入配置和中间件
const config = require('./config');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { router: authRoutes } = require('./routes/auth');
const userRoutes = require('./routes/users');
const queryRoutes = require('./routes/queries');
const dashboardRoutes = require('./routes/dashboard');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();

// 基础中间件
app.use(helmet()); // 安全头
app.use(compression()); // 响应压缩
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 请求限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP最多100次请求
  message: '请求过于频繁，请稍后重试',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// 日志中间件
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// 解析中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康检查端点
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    service: 'AI-Agile-DAP 后端服务',
    version: '1.0.0',
    status: 'running',
    docs: '/api/docs',
    health: '/health'
  });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/queries', queryRoutes);
app.use('/api/dashboard', dashboardRoutes);

// API文档路由
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'AI-Agile-DAP API 文档',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/login': '用户登录',
        'POST /api/auth/register': '用户注册',
        'POST /api/auth/logout': '用户登出',
        'GET /api/auth/profile': '获取用户信息'
      },
      users: {
        'GET /api/users': '获取用户列表',
        'GET /api/users/:id': '获取用户详情',
        'PUT /api/users/:id': '更新用户信息',
        'DELETE /api/users/:id': '删除用户'
      },
      queries: {
        'POST /api/queries': '创建查询',
        'GET /api/queries': '获取查询历史',
        'GET /api/queries/:id': '获取查询详情',
        'DELETE /api/queries/:id': '删除查询'
      },
      dashboard: {
        'GET /api/dashboard/stats': '获取仪表板统计',
        'GET /api/dashboard/charts': '获取图表数据'
      }
    }
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: true,
    message: `路径 ${req.originalUrl} 不存在`,
    timestamp: new Date().toISOString()
  });
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 后端服务启动成功`);
  logger.info(`📍 服务地址: http://0.0.0.0:${PORT}`);
  logger.info(`📚 API文档: http://0.0.0.0:${PORT}/api/docs`);
  logger.info(`❤️ 健康检查: http://0.0.0.0:${PORT}/health`);
  logger.info(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，开始优雅关闭...');
  server.close((err) => {
    if (err) {
      logger.error('服务器关闭时发生错误:', err);
      process.exit(1);
    }
    logger.info('服务器已优雅关闭');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  logger.error('未捕获的异常:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});

module.exports = app;
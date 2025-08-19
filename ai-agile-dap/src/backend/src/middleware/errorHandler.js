/**
 * 全局错误处理中间件
 * 统一处理应用程序中的错误
 */

const logger = require('../utils/logger');
const config = require('../config');

/**
 * 自定义错误类
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 验证错误类
 */
class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, 400);
    this.details = details;
  }
}

/**
 * 认证错误类
 */
class AuthenticationError extends AppError {
  constructor(message = '认证失败') {
    super(message, 401);
  }
}

/**
 * 授权错误类
 */
class AuthorizationError extends AppError {
  constructor(message = '权限不足') {
    super(message, 403);
  }
}

/**
 * 资源未找到错误类
 */
class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(message, 404);
  }
}

/**
 * 数据库错误处理
 */
const handleDatabaseError = (error) => {
  logger.logError(error, null, { type: 'DATABASE_ERROR' });
  
  // Sequelize错误处理
  if (error.name === 'SequelizeValidationError') {
    const details = error.errors.map(err => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
    return new ValidationError('数据验证失败', details);
  }
  
  if (error.name === 'SequelizeUniqueConstraintError') {
    return new ValidationError('数据重复，请检查唯一性约束');
  }
  
  if (error.name === 'SequelizeForeignKeyConstraintError') {
    return new ValidationError('外键约束错误，引用的数据不存在');
  }
  
  if (error.name === 'SequelizeConnectionError') {
    return new AppError('数据库连接失败', 503);
  }
  
  return new AppError('数据库操作失败', 500);
};

/**
 * JWT错误处理
 */
const handleJWTError = (error) => {
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('无效的访问令牌');
  }
  
  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('访问令牌已过期');
  }
  
  return new AuthenticationError('令牌验证失败');
};

/**
 * 全局错误处理中间件
 */
const errorHandler = (error, req, res, next) => {
  let err = error;
  
  // 记录原始错误
  logger.logError(error, req);
  
  // 转换为标准错误格式
  if (error.name?.includes('Sequelize')) {
    err = handleDatabaseError(error);
  } else if (error.name?.includes('JsonWebToken') || error.name?.includes('Token')) {
    err = handleJWTError(error);
  } else if (!(error instanceof AppError)) {
    // 未知错误转换为通用错误
    err = new AppError(
      config.app.env === 'development' ? error.message : '服务器内部错误',
      500,
      false
    );
  }
  
  // 构建错误响应
  const errorResponse = {
    error: true,
    message: err.message,
    statusCode: err.statusCode,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  };
  
  // 开发环境返回更多调试信息
  if (config.app.env === 'development') {
    errorResponse.stack = err.stack;
    if (err.details) {
      errorResponse.details = err.details;
    }
  }
  
  // 生产环境隐藏敏感信息
  if (config.app.env === 'production' && !err.isOperational) {
    errorResponse.message = '服务器内部错误';
  }
  
  // 发送错误响应
  res.status(err.statusCode || 500).json(errorResponse);
};

/**
 * 异步路由错误包装器
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404错误处理
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`路径 ${req.originalUrl} 不存在`);
  next(error);
};

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError
};
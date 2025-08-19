/**
 * 认证路由
 * 处理用户登录、注册、登出等认证相关功能
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { asyncHandler, ValidationError, AuthenticationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const config = require('../config');

const router = express.Router();

/**
 * 模拟用户数据库（Sprint 1阶段）
 * 生产环境将替换为真实的数据库操作
 */
const mockUsers = [
  {
    id: 1,
    username: 'demo',
    email: 'admin@ai-agile-dap.com',
    password: '$2a$12$9CSCBlhhXrCtwNAr3O2UDOteQhB1BDVhiGGGNy8fqWqH/OyEU3lbi', // 123456
    name: '演示用户',
    role: 'admin',
    avatar: '',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 2,
    username: 'admin',
    email: 'user@ai-agile-dap.com',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBfrEQYz6UjNem', // admin123
    name: '管理员',
    role: 'user',
    avatar: '',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

/**
 * 生成JWT令牌
 */
const generateToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role
  };
  
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

/**
 * 生成刷新令牌
 */
const generateRefreshToken = (user) => {
  const payload = {
    id: user.id,
    type: 'refresh'
  };
  
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn
  });
};

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password, email } = req.body;
  
  // 基础验证
  const loginField = username || email;
  if (!loginField || !password) {
    throw new ValidationError('用户名/邮箱和密码不能为空');
  }
  
  // 查找用户（支持用户名或邮箱登录）
  const user = mockUsers.find(u => 
    u.username === loginField || u.email === loginField
  );
  if (!user) {
    throw new AuthenticationError('用户名/邮箱或密码错误');
  }
  
  // 验证密码
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw new AuthenticationError('邮箱或密码错误');
  }
  
  // 生成令牌
  const token = generateToken(user);
  const refreshToken = generateRefreshToken(user);
  
  // 记录登录日志
  logger.logBusiness('USER_LOGIN', {
    userId: user.id,
    username: user.username,
    email: user.email,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // 返回响应（不包含密码）
  const { password: _, ...userWithoutPassword } = user;
  
  res.json({
    success: true,
    message: '登录成功',
    data: {
      user: userWithoutPassword,
      token,
      refreshToken,
      expiresIn: config.jwt.expiresIn
    }
  });
}));

/**
 * POST /api/auth/register
 * 用户注册
 */
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;
  
  // 基础验证
  if (!email || !password || !name) {
    throw new ValidationError('邮箱、密码和姓名不能为空');
  }
  
  // 邮箱格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('邮箱格式不正确');
  }
  
  // 密码强度验证
  if (password.length < 6) {
    throw new ValidationError('密码长度至少6位');
  }
  
  // 检查邮箱是否已存在
  const existingUser = mockUsers.find(u => u.email === email);
  if (existingUser) {
    throw new ValidationError('该邮箱已被注册');
  }
  
  // 加密密码
  const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds);
  
  // 创建新用户
  const newUser = {
    id: mockUsers.length + 1,
    email,
    password: hashedPassword,
    name,
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  mockUsers.push(newUser);
  
  // 生成令牌
  const token = generateToken(newUser);
  const refreshToken = generateRefreshToken(newUser);
  
  // 记录注册日志
  logger.logBusiness('USER_REGISTER', {
    userId: newUser.id,
    email: newUser.email,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // 返回响应（不包含密码）
  const { password: _, ...userWithoutPassword } = newUser;
  
  res.status(201).json({
    success: true,
    message: '注册成功',
    data: {
      user: userWithoutPassword,
      token,
      refreshToken,
      expiresIn: config.jwt.expiresIn
    }
  });
}));

/**
 * POST /api/auth/logout
 * 用户登出
 */
router.post('/logout', asyncHandler(async (req, res) => {
  // TODO: 在生产环境中，应该将令牌加入黑名单
  // 这里只是简单的日志记录
  
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      logger.logBusiness('USER_LOGOUT', {
        userId: decoded.id,
        ip: req.ip
      });
    } catch (error) {
      // 令牌无效，忽略错误
    }
  }
  
  res.json({
    success: true,
    message: '登出成功'
  });
}));

/**
 * POST /api/auth/refresh
 * 刷新访问令牌
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    throw new ValidationError('刷新令牌不能为空');
  }
  
  try {
    const decoded = jwt.verify(refreshToken, config.jwt.secret);
    
    if (decoded.type !== 'refresh') {
      throw new AuthenticationError('无效的刷新令牌');
    }
    
    // 查找用户
    const user = mockUsers.find(u => u.id === decoded.id);
    if (!user) {
      throw new AuthenticationError('用户不存在');
    }
    
    // 生成新的访问令牌
    const newToken = generateToken(user);
    
    res.json({
      success: true,
      message: '令牌刷新成功',
      data: {
        token: newToken,
        expiresIn: config.jwt.expiresIn
      }
    });
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('刷新令牌已过期，请重新登录');
    }
    throw new AuthenticationError('无效的刷新令牌');
  }
}));

/**
 * 认证中间件
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new AuthenticationError('未提供认证令牌');
  }
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = mockUsers.find(u => u.id === decoded.id);
    
    if (!user) {
      throw new AuthenticationError('用户不存在');
    }
    
    // 将用户信息添加到请求对象
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('令牌已过期');
    }
    throw new AuthenticationError('无效令牌');
  }
});

/**
 * GET /api/auth/profile
 * 获取当前用户信息
 */
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  const { password: _, ...userWithoutPassword } = req.user;
  
  res.json({
    success: true,
    message: '获取用户信息成功',
    data: userWithoutPassword
  });
}));

module.exports = { router, authenticate };
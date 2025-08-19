/**
 * 认证相关API路由
 * 处理用户登录、注销、token刷新等认证操作
 */

const express = require('express');
const AuthenticationService = require('../services/auth/AuthenticationService');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const authService = new AuthenticationService();

/**
 * @route POST /api/auth/login
 * @desc 用户登录
 * @access Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 验证输入
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS',
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        code: 'INVALID_EMAIL',
      });
    }

    // 执行认证
    const result = await authService.authenticate(email, password);

    // 设置响应头
    res.setHeader('Authorization', `Bearer ${result.accessToken}`);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
        expiresIn: result.expiresIn,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS',
    });
  }
});

/**
 * @route POST /api/auth/logout
 * @desc 用户注销
 * @access Private
 */
router.post('/logout', authMiddleware.authenticate, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const userId = req.user.id;

    await authService.logout(userId, req.token, refreshToken);

    return res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      error: 'Logout failed',
      code: 'LOGOUT_ERROR',
    });
  }
});

/**
 * @route POST /api/auth/refresh
 * @desc 刷新访问token
 * @access Public
 */
router.post('/refresh', authMiddleware.refreshToken, (req, res) => {
  try {
    const { newTokens } = res.locals;

    // 设置响应头
    res.setHeader('Authorization', `Bearer ${newTokens.accessToken}`);

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresIn: newTokens.expiresIn,
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({
      success: false,
      error: 'Token refresh failed',
      code: 'REFRESH_ERROR',
    });
  }
});

/**
 * @route GET /api/auth/me
 * @desc 获取当前用户信息
 * @access Private
 */
router.get('/me', authMiddleware.authenticate, authMiddleware.getCurrentUser, (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        user: req.currentUser,
      },
    });
  } catch (error) {
    console.error('Get user info error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get user information',
      code: 'USER_INFO_ERROR',
    });
  }
});

/**
 * @route POST /api/auth/verify
 * @desc 验证token有效性
 * @access Public
 */
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required',
        code: 'MISSING_TOKEN',
      });
    }

    const result = await authService.verifyToken(token);

    return res.status(200).json({
      success: true,
      data: {
        valid: result.valid,
        user: result.valid ? result.user : null,
      },
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Token verification failed',
      code: 'VERIFICATION_ERROR',
    });
  }
});

/**
 * @route POST /api/auth/validate-session
 * @desc 验证会话有效性
 * @access Private
 */
router.post('/validate-session', authMiddleware.authenticate, (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Session is valid',
      data: {
        user: req.user,
        sessionValid: true,
      },
    });
  } catch (error) {
    console.error('Session validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Session validation failed',
      code: 'SESSION_VALIDATION_ERROR',
    });
  }
});

/**
 * @route POST /api/auth/revoke-all-sessions
 * @desc 撤销用户所有会话（强制注销所有设备）
 * @access Private
 */
router.post('/revoke-all-sessions', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // 从Redis删除所有refresh tokens
    await authService.removeRefreshToken(userId);

    // 记录审计日志
    await authService.logAuthEvent(userId, 'REVOKE_ALL_SESSIONS', {
      reason: req.body.reason || 'User requested',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return res.status(200).json({
      success: true,
      message: 'All sessions revoked successfully',
    });
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to revoke sessions',
      code: 'REVOKE_ERROR',
    });
  }
});

/**
 * @route GET /api/auth/health
 * @desc 认证服务健康检查
 * @access Public
 */
router.get('/health', (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Authentication service is healthy',
      timestamp: new Date().toISOString(),
      service: 'auth-service',
      version: '1.0.0',
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Service unhealthy',
      code: 'HEALTH_CHECK_ERROR',
    });
  }
});

module.exports = router;

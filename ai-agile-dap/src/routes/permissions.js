/**
 * 权限管理API路由 - Task 5实现
 * 提供权限检查、验证和状态查询的REST API接口
 */

const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const AuthorizationService = require('../services/auth/AuthorizationService');
const PermissionService = require('../services/auth/PermissionService');
const RateLimiter = require('../middleware/rateLimiter');

const router = express.Router();
const authorizationService = new AuthorizationService();
const permissionService = new PermissionService();
const rateLimiter = new RateLimiter();

// 初始化服务
(async () => {
  try {
    await authorizationService.initialize();
    await permissionService.initialize();
    await rateLimiter.initRedis();
  } catch (error) {
    console.error('Failed to initialize permission services:', error);
  }
})();

// 验证错误处理中间件
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
 * 权限检查API接口
 * POST /api/permissions/check
 */
router.post(
  '/check',
  [
    body('userId').notEmpty().withMessage('用户ID不能为空'),
    body('resource').notEmpty().withMessage('资源类型不能为空'),
    body('action').notEmpty().withMessage('操作类型不能为空'),
    body('context').optional().isObject(),
    handleValidationErrors,
  ],
  rateLimiter.createMiddleware({ windowMs: 60000, max: 1000 }), // 1分钟内最多1000次权限检查
  async (req, res) => {
    try {
      const { userId, resource, action, context = {} } = req.body;

      const hasPermission = await authorizationService.checkPermission(
        userId,
        resource,
        action,
        context
      );

      res.json({
        success: true,
        data: {
          hasPermission,
          userId,
          resource,
          action,
          context,
          checkedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Permission check failed:', error);
      res.status(500).json({
        success: false,
        message: '权限检查失败',
        error: error.message,
      });
    }
  }
);

/**
 * 批量权限检查
 * POST /api/permissions/check-batch
 */
router.post(
  '/check-batch',
  [
    body('userId').notEmpty().withMessage('用户ID不能为空'),
    body('permissions').isArray({ min: 1 }).withMessage('权限列表不能为空'),
    body('permissions.*.resource').notEmpty().withMessage('资源类型不能为空'),
    body('permissions.*.action').notEmpty().withMessage('操作类型不能为空'),
    body('context').optional().isObject(),
    handleValidationErrors,
  ],
  rateLimiter.createMiddleware({ windowMs: 60000, max: 100 }), // 1分钟内最多100次批量检查
  async (req, res) => {
    try {
      const { userId, permissions, context = {} } = req.body;

      const results = await authorizationService.preCheckPermissions(userId, permissions, context);

      res.json({
        success: true,
        data: {
          results,
          userId,
          totalPermissions: permissions.length,
          checkedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Batch permission check failed:', error);
      res.status(500).json({
        success: false,
        message: '批量权限检查失败',
        error: error.message,
      });
    }
  }
);

/**
 * 权限验证接口
 * GET /api/permissions/validate
 */
router.get(
  '/validate',
  [
    query('userId').notEmpty().withMessage('用户ID不能为空'),
    query('resource').optional().isString(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { userId, resource } = req.query;

      const permissionStatus = await authorizationService.getPermissionStatus(userId, resource);

      res.json({
        success: true,
        data: permissionStatus,
      });
    } catch (error) {
      console.error('Permission validation failed:', error);
      res.status(500).json({
        success: false,
        message: '权限验证失败',
        error: error.message,
      });
    }
  }
);

/**
 * 获取用户权限详情
 * GET /api/permissions/user/:userId
 */
router.get(
  '/user/:userId',
  [
    param('userId').notEmpty().withMessage('用户ID不能为空'),
    query('includeInherited').optional().isBoolean(),
    query('includeConditions').optional().isBoolean(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { includeInherited = true, includeConditions = true } = req.query;

      const userPermissions = await permissionService.getUserPermissions(userId, {
        includeInherited,
        includeConditions,
      });

      res.json({
        success: true,
        data: userPermissions,
      });
    } catch (error) {
      console.error('Failed to get user permissions:', error);
      res.status(500).json({
        success: false,
        message: '获取用户权限失败',
        error: error.message,
      });
    }
  }
);

/**
 * 权限缓存管理
 * GET /api/permissions/cache/status
 */
router.get('/cache/status', async (req, res) => {
  try {
    const cacheStatus = await authorizationService.getCacheStatus();

    res.json({
      success: true,
      data: cacheStatus,
    });
  } catch (error) {
    console.error('Failed to get cache status:', error);
    res.status(500).json({
      success: false,
      message: '获取缓存状态失败',
      error: error.message,
    });
  }
});

/**
 * 清除用户权限缓存
 * DELETE /api/permissions/cache/user/:userId
 */
router.delete(
  '/cache/user/:userId',
  [param('userId').notEmpty().withMessage('用户ID不能为空'), handleValidationErrors],
  async (req, res) => {
    try {
      const { userId } = req.params;

      await authorizationService.clearUserPermissionCache(userId);

      res.json({
        success: true,
        message: '用户权限缓存已清除',
        data: { userId },
      });
    } catch (error) {
      console.error('Failed to clear user permission cache:', error);
      res.status(500).json({
        success: false,
        message: '清除用户权限缓存失败',
        error: error.message,
      });
    }
  }
);

/**
 * 清除所有权限缓存
 * DELETE /api/permissions/cache/all
 */
router.delete('/cache/all', async (req, res) => {
  try {
    await authorizationService.clearAllPermissionCache();

    res.json({
      success: true,
      message: '所有权限缓存已清除',
    });
  } catch (error) {
    console.error('Failed to clear all permission cache:', error);
    res.status(500).json({
      success: false,
      message: '清除所有权限缓存失败',
      error: error.message,
    });
  }
});

/**
 * 权限性能统计
 * GET /api/permissions/performance
 */
router.get('/performance', async (req, res) => {
  try {
    const performanceStats = await authorizationService.getPerformanceMetrics();

    res.json({
      success: true,
      data: performanceStats,
    });
  } catch (error) {
    console.error('Failed to get performance stats:', error);
    res.status(500).json({
      success: false,
      message: '获取性能统计失败',
      error: error.message,
    });
  }
});

/**
 * 权限预检查接口
 * POST /api/permissions/precheck
 */
router.post(
  '/precheck',
  [
    body('userId').notEmpty().withMessage('用户ID不能为空'),
    body('operations').isArray({ min: 1 }).withMessage('操作列表不能为空'),
    body('operations.*.resource').notEmpty().withMessage('资源类型不能为空'),
    body('operations.*.action').notEmpty().withMessage('操作类型不能为空'),
    body('context').optional().isObject(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { userId, operations, context = {} } = req.body;

      const precheckResults = await authorizationService.preCheckPermissions(
        userId,
        operations,
        context
      );

      res.json({
        success: true,
        data: {
          results: precheckResults,
          userId,
          totalOperations: operations.length,
          checkedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Permission precheck failed:', error);
      res.status(500).json({
        success: false,
        message: '权限预检查失败',
        error: error.message,
      });
    }
  }
);

/**
 * 权限状态查询接口
 * GET /api/permissions/status/:userId
 */
router.get(
  '/status/:userId',
  [
    param('userId').notEmpty().withMessage('用户ID不能为空'),
    query('resource').optional().isString(),
    query('includeDetails').optional().isBoolean(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { resource, includeDetails = false } = req.query;

      const permissionStatus = await authorizationService.getPermissionStatus(userId, resource, {
        includeDetails,
      });

      res.json({
        success: true,
        data: permissionStatus,
      });
    } catch (error) {
      console.error('Failed to get permission status:', error);
      res.status(500).json({
        success: false,
        message: '获取权限状态失败',
        error: error.message,
      });
    }
  }
);

module.exports = router;

/**
 * 权限验证中间件 - Task 5实现
 * 提供路由级别的权限检查功能
 */

const AuthorizationService = require('../services/auth/AuthorizationService');

class PermissionMiddleware {
  constructor() {
    this.authService = new AuthorizationService();
  }

  /**
   * 创建权限检查中间件
   * @param {string} resource - 资源类型 (datasource, query, report, user, system)
   * @param {string} action - 操作类型 (read, write, delete, share, manage)
   * @param {object} options - 额外选项
   */
  requirePermission(resource, action, options = {}) {
    return async (req, res, next) => {
      try {
        // 从请求中获取用户信息
        const user = req.user;
        if (!user) {
          return res.status(401).json({
            error: 'AUTHENTICATION_REQUIRED',
            message: '需要用户认证'
          });
        }

        // 构建权限检查上下文
        const context = {
          userId: user.id,
          organizationId: user.organizationId,
          clientIP: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          resourceId: req.params.id || req.body.id,
          ...options.context
        };

        // 如果是资源拥有者检查，获取资源所有者信息
        if (options.checkOwnership && context.resourceId) {
          context.resourceOwnerId = await this.getResourceOwner(resource, context.resourceId);
        }

        // 执行权限检查
        const result = await this.authService.validatePermissionForRequest(
          user.id, 
          resource, 
          action, 
          context
        );

        // 检查权限验证结果是否有效
        if (!result || typeof result.valid !== 'boolean') {
          throw new Error('Permission validation returned invalid result');
        }

        if (!result.valid) {
          return res.status(result.status || 403).json({
            error: 'PERMISSION_DENIED',
            message: result.message || 'Access denied',
            details: result.details
          });
        }

        // 将权限结果附加到请求对象
        req.permissionResult = result.permissionResult;
        req.permissionContext = context;

        next();
      } catch (error) {
        console.error('Permission middleware error:', error);
        return res.status(500).json({
          error: 'PERMISSION_CHECK_ERROR',
          message: '权限检查过程中发生错误'
        });
      }
    };
  }

  /**
   * 批量权限预检查中间件
   * 用于一次性检查多个权限
   */
  preCheckPermissions(operations) {
    return async (req, res, next) => {
      try {
        const user = req.user;
        if (!user) {
          return res.status(401).json({
            error: 'AUTHENTICATION_REQUIRED',
            message: '需要用户认证'
          });
        }

        const results = await this.authService.preCheckPermissions(user.id, operations);
        
        // 检查是否有任何权限被拒绝
        const deniedPermissions = Object.entries(results)
          .filter(([key, result]) => !result.allowed)
          .map(([key]) => key);

        if (deniedPermissions.length > 0) {
          return res.status(403).json({
            error: 'MULTIPLE_PERMISSIONS_DENIED',
            message: '部分权限被拒绝',
            deniedPermissions,
            allResults: results
          });
        }

        req.permissionResults = results;
        next();
      } catch (error) {
        console.error('Pre-check permissions error:', error);
        return res.status(500).json({
          error: 'PERMISSION_PRECHECK_ERROR',
          message: '权限预检查过程中发生错误'
        });
      }
    };
  }

  /**
   * 角色检查中间件
   * 检查用户是否具有特定角色
   */
  requireRole(requiredRoles) {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    return (req, res, next) => {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          error: 'AUTHENTICATION_REQUIRED',
          message: '需要用户认证'
        });
      }

      if (!roles.includes(user.role)) {
        return res.status(403).json({
          error: 'INSUFFICIENT_ROLE',
          message: `需要以下角色之一: ${roles.join(', ')}`,
          userRole: user.role,
          requiredRoles: roles
        });
      }

      next();
    };
  }

  /**
   * 超级管理员检查中间件
   */
  requireSuperAdmin() {
    return this.requireRole('super-admin');
  }

  /**
   * 管理员检查中间件
   */
  requireAdmin() {
    return this.requireRole(['super-admin', 'admin']);
  }

  /**
   * 条件权限检查中间件
   * 根据请求动态确定权限检查参数
   */
  dynamicPermissionCheck(getPermissionConfig) {
    return async (req, res, next) => {
      try {
        const { resource, action, context = {} } = await getPermissionConfig(req);
        
        const middleware = this.requirePermission(resource, action, { context });
        return middleware(req, res, next);
      } catch (error) {
        console.error('Dynamic permission check error:', error);
        return res.status(500).json({
          error: 'DYNAMIC_PERMISSION_ERROR',
          message: '动态权限检查失败'
        });
      }
    };
  }

  /**
   * 权限状态查询中间件
   * 向响应中添加用户权限状态信息
   */
  includePermissionStatus(resource = null) {
    return async (req, res, next) => {
      try {
        const user = req.user;
        if (user) {
          const permissionStatus = await this.authService.getPermissionStatus(user.id, resource);
          res.locals.permissionStatus = permissionStatus;
        }
        next();
      } catch (error) {
        console.error('Permission status middleware error:', error);
        // 不阻塞请求，继续执行
        next();
      }
    };
  }

  /**
   * 获取资源所有者
   */
  async getResourceOwner(resource, resourceId) {
    // 根据资源类型查询资源所有者
    // 实际实现中应该查询数据库
    const resourceOwners = {
      'datasource': 'user1',
      'query': 'user1', 
      'report': 'user1'
    };
    
    return resourceOwners[resource] || null;
  }

  /**
   * 设置依赖服务
   */
  setServices(roleService, permissionService) {
    this.authService.setServices(roleService, permissionService);
  }

  /**
   * 清除用户权限缓存的中间件
   * 通常在权限变更后使用
   */
  clearUserCache() {
    return async (req, res, next) => {
      try {
        const user = req.user;
        if (user) {
          await this.authService.clearUserPermissionCache(user.id);
        }
        next();
      } catch (error) {
        console.error('Clear cache middleware error:', error);
        next(); // 不阻塞请求
      }
    };
  }
}

// 创建单例实例
const permissionMiddleware = new PermissionMiddleware();

// 导出便捷方法
module.exports = {
  // 类实例
  PermissionMiddleware,
  
  // 单例实例
  middleware: permissionMiddleware,
  
  // 便捷方法
  requirePermission: (resource, action, options) => 
    permissionMiddleware.requirePermission(resource, action, options),
  
  preCheckPermissions: (operations) => 
    permissionMiddleware.preCheckPermissions(operations),
  
  requireRole: (roles) => 
    permissionMiddleware.requireRole(roles),
  
  requireSuperAdmin: () => 
    permissionMiddleware.requireSuperAdmin(),
  
  requireAdmin: () => 
    permissionMiddleware.requireAdmin(),
  
  dynamicPermissionCheck: (getConfig) => 
    permissionMiddleware.dynamicPermissionCheck(getConfig),
  
  includePermissionStatus: (resource) => 
    permissionMiddleware.includePermissionStatus(resource),
  
  clearUserCache: () => 
    permissionMiddleware.clearUserCache()
};
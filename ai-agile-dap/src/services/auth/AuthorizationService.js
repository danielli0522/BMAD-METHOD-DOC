/**
 * AuthorizationService - 权限检查核心服务
 * 实现RBAC权限模型的权限检查算法和条件评估
 * Task 5: 权限查询和验证接口实现
 */

const redis = require('redis');
const crypto = require('crypto');
const databaseService = require('../database/DatabaseService');

class AuthorizationService {
  constructor() {
    this.redisClient = null;
    this.roleService = null;
    this.permissionService = null;
    this.cacheEnabled = process.env.PERMISSION_CACHE_ENABLED !== 'false';
    this.cacheTTL = parseInt(process.env.PERMISSION_CACHE_TTL) || 300; // 5分钟
    this.initRedis();
  }

  /**
   * 初始化Redis连接
   */
  async initRedis() {
    try {
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });
      await this.redisClient.connect();
      console.log('Redis connected for permission cache');
    } catch (error) {
      console.error('Redis connection failed:', error);
      this.redisClient = null;
    }
  }

  /**
   * 设置依赖服务
   */
  setServices(roleService, permissionService) {
    this.roleService = roleService;
    this.permissionService = permissionService;
  }

  /**
   * 权限检查API接口 - Task 5核心功能
   */
  async checkPermission(user, resource, action, context = {}) {
    try {
      // 构建缓存键
      const cacheKey = this.buildCacheKey(user.id, resource, action, context);
      
      // 尝试从缓存获取结果
      if (this.cacheEnabled && this.redisClient) {
        const cached = await this.redisClient.get(cacheKey);
        if (cached !== null) {
          return JSON.parse(cached);
        }
      }

      // 获取用户角色和权限
      const userRoles = await this.getUserRoles(user.id);
      const permissions = await this.getRolePermissions(userRoles);
      
      // 执行权限检查
      const result = await this.evaluatePermission(permissions, resource, action, context);
      
      // 缓存结果
      if (this.cacheEnabled && this.redisClient) {
        await this.redisClient.setEx(cacheKey, this.cacheTTL, JSON.stringify(result));
      }
      
      return result;
    } catch (error) {
      console.error('Permission check failed:', error);
      return {
        allowed: false,
        reason: 'PERMISSION_CHECK_ERROR',
        error: error.message
      };
    }
  }

  /**
   * 权限预检查功能 - Task 5新增
   * 批量检查多个权限操作
   */
  async preCheckPermissions(userId, operations) {
    const results = {};
    
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        // 所有操作都返回未找到用户
        operations.forEach(op => {
          results[`${op.resource}:${op.action}`] = {
            allowed: false,
            reason: 'USER_NOT_FOUND'
          };
        });
        return results;
      }

      // 并行检查所有权限
      const promises = operations.map(async (op) => {
        const { resource, action, context = {} } = op;
        const key = `${resource}:${action}`;
        
        try {
          results[key] = await this.checkPermission(user, resource, action, context);
        } catch (error) {
          results[key] = {
            allowed: false,
            reason: 'CHECK_ERROR',
            error: error.message
          };
        }
      });

      await Promise.all(promises);
      return results;
    } catch (error) {
      console.error('Pre-check permissions failed:', error);
      return { error: error.message };
    }
  }

  /**
   * 权限状态查询接口 - Task 5新增
   * 获取用户的完整权限状态
   */
  async getPermissionStatus(userId, resource = null) {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        return { 
          error: 'USER_NOT_FOUND',
          message: '用户不存在' 
        };
      }

      const userRoles = await this.getUserRoles(userId);
      const permissions = await this.getRolePermissions(userRoles);
      
      // 如果指定资源，只返回该资源的权限
      if (resource) {
        const resourcePermissions = permissions.filter(p => p.resource === resource);
        return {
          userId,
          resource,
          permissions: resourcePermissions.map(p => ({
            action: p.action,
            conditions: p.conditions,
            granted: true
          })),
          roles: userRoles,
          timestamp: new Date().toISOString()
        };
      }
      
      // 返回所有权限状态，按资源分组
      const permissionsByResource = {};
      permissions.forEach(p => {
        if (!permissionsByResource[p.resource]) {
          permissionsByResource[p.resource] = [];
        }
        permissionsByResource[p.resource].push({
          action: p.action,
          conditions: p.conditions,
          granted: true
        });
      });
      
      return {
        userId,
        roles: userRoles.map(role => ({
          id: role.id,
          name: role.name,
          description: role.description
        })),
        permissions: permissionsByResource,
        summary: {
          totalRoles: userRoles.length,
          totalPermissions: permissions.length,
          resourcesCount: Object.keys(permissionsByResource).length
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Get permission status failed:', error);
      return { 
        error: 'STATUS_QUERY_ERROR',
        message: error.message 
      };
    }
  }

  /**
   * 权限验证中间件支持函数
   */
  async validatePermissionForRequest(userId, resource, action, context = {}) {
    const user = await this.getUserById(userId);
    if (!user) {
      return {
        valid: false,
        status: 401,
        message: 'User authentication required'
      };
    }

    const result = await this.checkPermission(user, resource, action, context);
    
    if (!result.allowed) {
      return {
        valid: false,
        status: 403,
        message: result.reason || 'Access denied',
        details: result
      };
    }

    return {
      valid: true,
      user,
      permissionResult: result
    };
  }

  /**
   * 评估权限逻辑
   */
  async evaluatePermission(permissions, resource, action, context) {
    // 查找匹配的权限
    const matchingPermissions = permissions.filter(p => 
      p.resource === resource && p.action === action
    );

    if (matchingPermissions.length === 0) {
      return {
        allowed: false,
        reason: 'NO_PERMISSION',
        message: `No permission found for ${resource}:${action}`
      };
    }

    // 检查条件权限
    for (const permission of matchingPermissions) {
      if (!permission.conditions || Object.keys(permission.conditions).length === 0) {
        // 无条件权限，直接允许
        return {
          allowed: true,
          reason: 'PERMISSION_GRANTED',
          permission: permission
        };
      }

      // 检查条件是否满足
      if (await this.checkConditions(permission.conditions, context)) {
        return {
          allowed: true,
          reason: 'CONDITIONAL_PERMISSION_GRANTED',
          permission: permission,
          conditions: permission.conditions
        };
      }
    }

    return {
      allowed: false,
      reason: 'CONDITIONS_NOT_MET',
      message: 'Permission conditions not satisfied'
    };
  }

  /**
   * 检查权限条件
   */
  async checkConditions(conditions, context) {
    // 时间条件检查
    if (conditions.time_limit) {
      if (!this.checkTimeCondition(conditions.time_limit)) {
        return false;
      }
    }

    // 组织条件检查
    if (conditions.organization_only && context.organizationId) {
      if (conditions.organizationId !== context.organizationId) {
        return false;
      }
    }

    // 所有者条件检查
    if (conditions.own_only && context.resourceOwnerId) {
      if (context.userId !== context.resourceOwnerId) {
        return false;
      }
    }

    // IP地址条件检查
    if (conditions.ip_whitelist && context.clientIP) {
      if (!conditions.ip_whitelist.includes(context.clientIP)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 检查时间条件
   */
  checkTimeCondition(timeLimit) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    // 工作时间检查
    if (timeLimit.business_hours) {
      if (currentHour < 9 || currentHour > 18) {
        return false;
      }
      if (currentDay === 0 || currentDay === 6) {
        return false;
      }
    }

    // 自定义时间范围
    if (timeLimit.start_time && timeLimit.end_time) {
      const startHour = parseInt(timeLimit.start_time.split(':')[0]);
      const endHour = parseInt(timeLimit.end_time.split(':')[0]);
      
      if (currentHour < startHour || currentHour > endHour) {
        return false;
      }
    }

    return true;
  }

  /**
   * 构建缓存键
   */
  buildCacheKey(userId, resource, action, context) {
    const contextStr = JSON.stringify(context);
    const contextHash = crypto.createHash('md5').update(contextStr).digest('hex');
    return `perm:${userId}:${resource}:${action}:${contextHash}`;
  }

  /**
   * 获取用户信息
   */
  async getUserById(userId) {
    try {
      return await databaseService.getUserById(userId);
    } catch (error) {
      console.error('Failed to get user by id:', error);
      return null;
    }
  }

  /**
   * 获取用户角色
   */
  async getUserRoles(userId) {
    try {
      return await databaseService.getUserRoles(userId);
    } catch (error) {
      console.error('Failed to get user roles:', error);
      return [];
    }
  }

  /**
   * 获取角色权限
   */
  async getRolePermissions(roles) {
    try {
      return await databaseService.getRolePermissions(roles);
    } catch (error) {
      console.error('Failed to get role permissions:', error);
      return [];
    }
  }


  /**
   * 清除用户权限缓存
   */
  async clearUserPermissionCache(userId) {
    if (!this.redisClient) return;
    
    try {
      const pattern = `perm:${userId}:*`;
      const keys = await this.redisClient.keys(pattern);
      
      if (keys.length > 0) {
        await this.redisClient.del(keys);
      }
      
      return keys.length;
    } catch (error) {
      console.error('Clear permission cache failed:', error);
      return 0;
    }
  }

  /**
   * 关闭服务
   */
  async close() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}


const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

/**
 * 权限管理服务
 * 负责权限的CRUD操作、权限继承、权限组管理等功能
 */
class PermissionService {
  constructor() {
    this.redis = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });

      // 初始化预定义权限
      await this.initializePredefinedPermissions();

      this.isInitialized = true;
      console.log('PermissionService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PermissionService:', error);
      throw error;
    }
  }

  /**
   * 初始化预定义权限
   */
  async initializePredefinedPermissions() {
    const predefinedPermissions = [
      // 用户管理权限
      { resource: 'user', action: 'read', description: '查看用户信息' },
      { resource: 'user', action: 'write', description: '创建/编辑用户' },
      { resource: 'user', action: 'delete', description: '删除用户' },
      { resource: 'user', action: 'manage', description: '用户管理' },

      // 数据源管理权限
      { resource: 'datasource', action: 'read', description: '查看数据源' },
      { resource: 'datasource', action: 'write', description: '创建/编辑数据源' },
      { resource: 'datasource', action: 'delete', description: '删除数据源' },
      { resource: 'datasource', action: 'connect', description: '连接数据源' },
      { resource: 'datasource', action: 'manage', description: '数据源管理' },

      // 查询权限
      { resource: 'query', action: 'read', description: '查看查询' },
      { resource: 'query', action: 'write', description: '创建/编辑查询' },
      { resource: 'query', action: 'delete', description: '删除查询' },
      { resource: 'query', action: 'execute', description: '执行查询' },
      { resource: 'query', action: 'share', description: '分享查询' },

      // 报表权限
      { resource: 'report', action: 'read', description: '查看报表' },
      { resource: 'report', action: 'write', description: '创建/编辑报表' },
      { resource: 'report', action: 'delete', description: '删除报表' },
      { resource: 'report', action: 'export', description: '导出报表' },
      { resource: 'report', action: 'share', description: '分享报表' },

      // 系统管理权限
      { resource: 'system', action: 'read', description: '查看系统信息' },
      { resource: 'system', action: 'write', description: '修改系统配置' },
      { resource: 'system', action: 'manage', description: '系统管理' },

      // 审计权限
      { resource: 'audit', action: 'read', description: '查看审计日志' },
      { resource: 'audit', action: 'export', description: '导出审计日志' },
      { resource: 'audit', action: 'manage', description: '审计管理' },

      // 权限管理权限
      { resource: 'permission', action: 'read', description: '查看权限' },
      { resource: 'permission', action: 'write', description: '分配权限' },
      { resource: 'permission', action: 'manage', description: '权限管理' },

      // 角色管理权限
      { resource: 'role', action: 'read', description: '查看角色' },
      { resource: 'role', action: 'write', description: '创建/编辑角色' },
      { resource: 'role', action: 'delete', description: '删除角色' },
      { resource: 'role', action: 'manage', description: '角色管理' },
    ];

    for (const permission of predefinedPermissions) {
      const permissionId = `${permission.resource}:${permission.action}`;
      await this.redis.hset('permissions', permissionId, JSON.stringify(permission));
    }
  }

  /**
   * 获取用户权限
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Object>} 用户权限信息
   */
  async getUserPermissions(userId, options = {}) {
    const { includeInherited = true, includeConditions = true } = options;

    try {
      // 获取用户直接角色
      const userRoles = await this.getUserRoles(userId);

      // 获取角色权限
      const rolePermissions = await Promise.all(
        userRoles.map(role => this.getRolePermissions(role.id))
      );

      // 合并权限
      const permissions = new Map();

      for (const rolePerms of rolePermissions) {
        for (const perm of rolePerms) {
          const key = `${perm.resource}:${perm.action}`;
          if (!permissions.has(key)) {
            permissions.set(key, {
              ...perm,
              sources: [perm.roleId],
            });
          } else {
            permissions.get(key).sources.push(perm.roleId);
          }
        }
      }

      // 处理权限继承
      if (includeInherited) {
        const inheritedPermissions = await this.getInheritedPermissions(userRoles);
        for (const perm of inheritedPermissions) {
          const key = `${perm.resource}:${perm.action}`;
          if (!permissions.has(key)) {
            permissions.set(key, {
              ...perm,
              sources: [perm.roleId],
              inherited: true,
            });
          } else {
            const existing = permissions.get(key);
            existing.sources.push(perm.roleId);
            existing.inherited = true;
          }
        }
      }

      // 处理权限条件
      if (includeConditions) {
        for (const perm of permissions.values()) {
          perm.conditions = await this.getPermissionConditions(perm.resource, perm.action);
        }
      }

      return {
        userId,
        roles: userRoles,
        permissions: Array.from(permissions.values()),
        totalPermissions: permissions.size,
        includeInherited,
        includeConditions,
        retrievedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get user permissions:', error);
      throw error;
    }
  }

  /**
   * 获取用户角色
   * @param {string} userId 用户ID
   * @returns {Promise<Array>} 用户角色列表
   */
  async getUserRoles(userId) {
    try {
      const userRoles = await this.redis.hgetall(`user_roles:${userId}`);
      const roles = [];

      for (const [roleId, roleData] of Object.entries(userRoles)) {
        const role = JSON.parse(roleData);
        roles.push({
          id: roleId,
          ...role,
        });
      }

      return roles;
    } catch (error) {
      console.error('Failed to get user roles:', error);
      return [];
    }
  }

  /**
   * 获取角色权限
   * @param {string} roleId 角色ID
   * @returns {Promise<Array>} 角色权限列表
   */
  async getRolePermissions(roleId) {
    try {
      const rolePermissions = await this.redis.hgetall(`role_permissions:${roleId}`);
      const permissions = [];

      for (const [permissionId, permissionData] of Object.entries(rolePermissions)) {
        const permission = JSON.parse(permissionData);
        permissions.push({
          id: permissionId,
          roleId,
          ...permission,
        });
      }

      return permissions;
    } catch (error) {
      console.error('Failed to get role permissions:', error);
      return [];
    }
  }

  /**
   * 获取继承的权限
   * @param {Array} roles 角色列表
   * @returns {Promise<Array>} 继承的权限列表
   */
  async getInheritedPermissions(roles) {
    const inheritedPermissions = [];
    const visitedRoles = new Set();

    for (const role of roles) {
      await this.getInheritedPermissionsRecursive(role.id, inheritedPermissions, visitedRoles);
    }

    return inheritedPermissions;
  }

  /**
   * 递归获取继承的权限
   * @param {string} roleId 角色ID
   * @param {Array} inheritedPermissions 继承权限列表
   * @param {Set} visitedRoles 已访问角色集合
   */
  async getInheritedPermissionsRecursive(roleId, inheritedPermissions, visitedRoles) {
    if (visitedRoles.has(roleId)) return;
    visitedRoles.add(roleId);

    try {
      const role = await this.redis.hget('roles', roleId);
      if (!role) return;

      const roleData = JSON.parse(role);
      if (roleData.inherits && Array.isArray(roleData.inherits)) {
        for (const inheritedRoleId of roleData.inherits) {
          const inheritedPerms = await this.getRolePermissions(inheritedRoleId);
          inheritedPermissions.push(...inheritedPerms);
          await this.getInheritedPermissionsRecursive(
            inheritedRoleId,
            inheritedPermissions,
            visitedRoles
          );
        }
      }
    } catch (error) {
      console.error('Failed to get inherited permissions:', error);
    }
  }

  /**
   * 获取权限条件
   * @param {string} resource 资源类型
   * @param {string} action 操作类型
   * @returns {Promise<Object>} 权限条件
   */
  async getPermissionConditions(resource, action) {
    try {
      const conditions = await this.redis.hget('permission_conditions', `${resource}:${action}`);
      return conditions ? JSON.parse(conditions) : {};
    } catch (error) {
      console.error('Failed to get permission conditions:', error);
      return {};
    }
  }

  /**
   * 创建权限
   * @param {Object} permissionData 权限数据
   * @returns {Promise<string>} 权限ID
   */
  async createPermission(permissionData) {
    try {
      const permissionId = uuidv4();
      const permission = {
        id: permissionId,
        ...permissionData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.redis.hset('permissions', permissionId, JSON.stringify(permission));
      return permissionId;
    } catch (error) {
      console.error('Failed to create permission:', error);
      throw error;
    }
  }

  /**
   * 更新权限
   * @param {string} permissionId 权限ID
   * @param {Object} updateData 更新数据
   * @returns {Promise<boolean>} 更新结果
   */
  async updatePermission(permissionId, updateData) {
    try {
      const existingPermission = await this.redis.hget('permissions', permissionId);
      if (!existingPermission) {
        throw new Error('Permission not found');
      }

      const permission = {
        ...JSON.parse(existingPermission),
        ...updateData,
        updatedAt: new Date().toISOString(),
      };

      await this.redis.hset('permissions', permissionId, JSON.stringify(permission));
      return true;
    } catch (error) {
      console.error('Failed to update permission:', error);
      throw error;
    }
  }

  /**
   * 删除权限
   * @param {string} permissionId 权限ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deletePermission(permissionId) {
    try {
      const result = await this.redis.hdel('permissions', permissionId);
      return result > 0;
    } catch (error) {
      console.error('Failed to delete permission:', error);
      throw error;
    }
  }

  /**
   * 分配权限给角色
   * @param {string} roleId 角色ID
   * @param {string} permissionId 权限ID
   * @param {Object} conditions 权限条件
   * @returns {Promise<boolean>} 分配结果
   */
  async assignPermissionToRole(roleId, permissionId, conditions = {}) {
    try {
      const permission = await this.redis.hget('permissions', permissionId);
      if (!permission) {
        throw new Error('Permission not found');
      }

      const rolePermission = {
        ...JSON.parse(permission),
        roleId,
        conditions,
        assignedAt: new Date().toISOString(),
      };

      await this.redis.hset(
        `role_permissions:${roleId}`,
        permissionId,
        JSON.stringify(rolePermission)
      );
      return true;
    } catch (error) {
      console.error('Failed to assign permission to role:', error);
      throw error;
    }
  }

  /**
   * 从角色移除权限
   * @param {string} roleId 角色ID
   * @param {string} permissionId 权限ID
   * @returns {Promise<boolean>} 移除结果
   */
  async removePermissionFromRole(roleId, permissionId) {
    try {
      const result = await this.redis.hdel(`role_permissions:${roleId}`, permissionId);
      return result > 0;
    } catch (error) {
      console.error('Failed to remove permission from role:', error);
      throw error;
    }
  }

  /**
   * 获取所有权限
   * @returns {Promise<Array>} 权限列表
   */
  async getAllPermissions() {
    try {
      const permissions = await this.redis.hgetall('permissions');
      return Object.values(permissions).map(perm => JSON.parse(perm));
    } catch (error) {
      console.error('Failed to get all permissions:', error);
      return [];
    }
  }

  /**
   * 搜索权限
   * @param {string} query 搜索关键词
   * @param {Object} filters 过滤条件
   * @returns {Promise<Array>} 搜索结果
   */
  async searchPermissions(query, filters = {}) {
    try {
      const allPermissions = await this.getAllPermissions();
      let results = allPermissions;

      // 关键词搜索
      if (query) {
        const searchTerm = query.toLowerCase();
        results = results.filter(
          perm =>
            perm.resource.toLowerCase().includes(searchTerm) ||
            perm.action.toLowerCase().includes(searchTerm) ||
            (perm.description && perm.description.toLowerCase().includes(searchTerm))
        );
      }

      // 资源过滤
      if (filters.resource) {
        results = results.filter(perm => perm.resource === filters.resource);
      }

      // 操作过滤
      if (filters.action) {
        results = results.filter(perm => perm.action === filters.action);
      }

      return results;
    } catch (error) {
      console.error('Failed to search permissions:', error);
      return [];
    }
  }

  /**
   * 关闭服务
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
    }
    this.isInitialized = false;
  }
}

module.exports = PermissionService;

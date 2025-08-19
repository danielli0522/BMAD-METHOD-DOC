const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

/**
 * 权限继承和组管理服务
 * 负责权限继承机制、权限组管理、权限模板、冲突检测等功能
 */
class PermissionInheritanceService {
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

      // 初始化权限组
      await this.initializePermissionGroups();

      this.isInitialized = true;
      console.log('PermissionInheritanceService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PermissionInheritanceService:', error);
      throw error;
    }
  }

  /**
   * 初始化权限组
   */
  async initializePermissionGroups() {
    const defaultGroups = [
      {
        id: 'admin-group',
        name: '管理员组',
        description: '系统管理员权限组',
        permissions: ['user:manage', 'datasource:manage', 'system:manage', 'audit:manage'],
        inherits: [],
        isSystem: true,
      },
      {
        id: 'analyst-group',
        name: '分析师组',
        description: '数据分析师权限组',
        permissions: ['datasource:read', 'query:execute', 'report:write', 'report:export'],
        inherits: ['viewer-group'],
        isSystem: true,
      },
      {
        id: 'viewer-group',
        name: '查看者组',
        description: '只读用户权限组',
        permissions: ['datasource:read', 'query:read', 'report:read'],
        inherits: [],
        isSystem: true,
      },
    ];

    for (const group of defaultGroups) {
      await this.createPermissionGroup(group);
    }
  }

  /**
   * 创建权限组
   * @param {Object} groupData 权限组数据
   * @returns {Promise<string>} 权限组ID
   */
  async createPermissionGroup(groupData) {
    try {
      const groupId = groupData.id || uuidv4();
      const group = {
        id: groupId,
        ...groupData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 检查权限组名称是否已存在
      const existingGroup = await this.getPermissionGroupByName(group.name);
      if (existingGroup) {
        throw new Error('Permission group name already exists');
      }

      // 检查继承的权限组是否存在
      if (group.inherits && group.inherits.length > 0) {
        for (const inheritedGroupId of group.inherits) {
          const inheritedGroup = await this.getPermissionGroup(inheritedGroupId);
          if (!inheritedGroup) {
            throw new Error(`Inherited permission group not found: ${inheritedGroupId}`);
          }
        }
      }

      await this.redis.hset('permission_groups', groupId, JSON.stringify(group));
      return groupId;
    } catch (error) {
      console.error('Failed to create permission group:', error);
      throw error;
    }
  }

  /**
   * 获取权限组
   * @param {string} groupId 权限组ID
   * @returns {Promise<Object>} 权限组信息
   */
  async getPermissionGroup(groupId) {
    try {
      const groupData = await this.redis.hget('permission_groups', groupId);
      return groupData ? JSON.parse(groupData) : null;
    } catch (error) {
      console.error('Failed to get permission group:', error);
      return null;
    }
  }

  /**
   * 根据名称获取权限组
   * @param {string} name 权限组名称
   * @returns {Promise<Object>} 权限组信息
   */
  async getPermissionGroupByName(name) {
    try {
      const groups = await this.getAllPermissionGroups();
      return groups.find(group => group.name === name) || null;
    } catch (error) {
      console.error('Failed to get permission group by name:', error);
      return null;
    }
  }

  /**
   * 获取所有权限组
   * @returns {Promise<Array>} 权限组列表
   */
  async getAllPermissionGroups() {
    try {
      const groups = await this.redis.hgetall('permission_groups');
      return Object.values(groups).map(group => JSON.parse(group));
    } catch (error) {
      console.error('Failed to get all permission groups:', error);
      return [];
    }
  }

  /**
   * 更新权限组
   * @param {string} groupId 权限组ID
   * @param {Object} updateData 更新数据
   * @returns {Promise<boolean>} 更新结果
   */
  async updatePermissionGroup(groupId, updateData) {
    try {
      const existingGroup = await this.getPermissionGroup(groupId);
      if (!existingGroup) {
        throw new Error('Permission group not found');
      }

      // 检查是否为系统权限组
      if (existingGroup.isSystem && updateData.isSystem === false) {
        throw new Error('Cannot modify system permission groups');
      }

      const group = {
        ...existingGroup,
        ...updateData,
        updatedAt: new Date().toISOString(),
      };

      await this.redis.hset('permission_groups', groupId, JSON.stringify(group));
      return true;
    } catch (error) {
      console.error('Failed to update permission group:', error);
      throw error;
    }
  }

  /**
   * 删除权限组
   * @param {string} groupId 权限组ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deletePermissionGroup(groupId) {
    try {
      const group = await this.getPermissionGroup(groupId);
      if (!group) {
        throw new Error('Permission group not found');
      }

      // 检查是否为系统权限组
      if (group.isSystem) {
        throw new Error('Cannot delete system permission groups');
      }

      // 检查是否有其他权限组继承此权限组
      const inheritingGroups = await this.getGroupsInheritingFrom(groupId);
      if (inheritingGroups.length > 0) {
        throw new Error('Cannot delete permission group that is inherited by other groups');
      }

      const result = await this.redis.hdel('permission_groups', groupId);
      return result > 0;
    } catch (error) {
      console.error('Failed to delete permission group:', error);
      throw error;
    }
  }

  /**
   * 获取继承指定权限组的权限组列表
   * @param {string} groupId 权限组ID
   * @returns {Promise<Array>} 继承的权限组列表
   */
  async getGroupsInheritingFrom(groupId) {
    try {
      const allGroups = await this.getAllPermissionGroups();
      return allGroups.filter(group => group.inherits && group.inherits.includes(groupId));
    } catch (error) {
      console.error('Failed to get groups inheriting from:', error);
      return [];
    }
  }

  /**
   * 实现角色权限继承机制
   * @param {string} roleId 角色ID
   * @returns {Promise<Array>} 继承的权限列表
   */
  async getRoleInheritedPermissions(roleId) {
    try {
      const role = await this.redis.hget('roles', roleId);
      if (!role) return [];

      const roleData = JSON.parse(role);
      const inheritedPermissions = [];

      if (roleData.inherits && Array.isArray(roleData.inherits)) {
        for (const inheritedRoleId of roleData.inherits) {
          const inheritedRolePerms = await this.redis.hgetall(
            `role_permissions:${inheritedRoleId}`
          );

          for (const [permId, permData] of Object.entries(inheritedRolePerms)) {
            const permission = JSON.parse(permData);
            inheritedPermissions.push({
              ...permission,
              inheritedFrom: inheritedRoleId,
            });
          }

          // 递归获取继承角色的继承权限
          const recursivePerms = await this.getRoleInheritedPermissions(inheritedRoleId);
          inheritedPermissions.push(...recursivePerms);
        }
      }

      return inheritedPermissions;
    } catch (error) {
      console.error('Failed to get role inherited permissions:', error);
      return [];
    }
  }

  /**
   * 创建权限模板
   * @param {Object} templateData 模板数据
   * @returns {Promise<string>} 模板ID
   */
  async createPermissionTemplate(templateData) {
    try {
      const templateId = uuidv4();
      const template = {
        id: templateId,
        ...templateData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.redis.hset('permission_templates', templateId, JSON.stringify(template));
      return templateId;
    } catch (error) {
      console.error('Failed to create permission template:', error);
      throw error;
    }
  }

  /**
   * 获取权限模板
   * @param {string} templateId 模板ID
   * @returns {Promise<Object>} 模板信息
   */
  async getPermissionTemplate(templateId) {
    try {
      const templateData = await this.redis.hget('permission_templates', templateId);
      return templateData ? JSON.parse(templateData) : null;
    } catch (error) {
      console.error('Failed to get permission template:', error);
      return null;
    }
  }

  /**
   * 获取所有权限模板
   * @returns {Promise<Array>} 模板列表
   */
  async getAllPermissionTemplates() {
    try {
      const templates = await this.redis.hgetall('permission_templates');
      return Object.values(templates).map(template => JSON.parse(template));
    } catch (error) {
      console.error('Failed to get all permission templates:', error);
      return [];
    }
  }

  /**
   * 应用权限模板到角色
   * @param {string} roleId 角色ID
   * @param {string} templateId 模板ID
   * @returns {Promise<boolean>} 应用结果
   */
  async applyTemplateToRole(roleId, templateId) {
    try {
      const template = await this.getPermissionTemplate(templateId);
      if (!template) {
        throw new Error('Permission template not found');
      }

      const role = await this.redis.hget('roles', roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      // 应用模板权限到角色
      for (const permission of template.permissions) {
        await this.redis.hset(
          `role_permissions:${roleId}`,
          permission.id || `${permission.resource}:${permission.action}`,
          JSON.stringify({
            ...permission,
            roleId,
            appliedFromTemplate: templateId,
            appliedAt: new Date().toISOString(),
          })
        );
      }

      return true;
    } catch (error) {
      console.error('Failed to apply template to role:', error);
      throw error;
    }
  }

  /**
   * 实现权限冲突检测
   * @param {string} roleId 角色ID
   * @returns {Promise<Array>} 冲突列表
   */
  async detectPermissionConflicts(roleId) {
    try {
      const conflicts = [];

      // 获取角色的所有权限（包括继承的）
      const directPermissions = await this.redis.hgetall(`role_permissions:${roleId}`);
      const inheritedPermissions = await this.getRoleInheritedPermissions(roleId);

      const allPermissions = [
        ...Object.values(directPermissions).map(perm => JSON.parse(perm)),
        ...inheritedPermissions,
      ];

      // 检测重复权限
      const permissionMap = new Map();
      for (const permission of allPermissions) {
        const key = `${permission.resource}:${permission.action}`;
        if (permissionMap.has(key)) {
          conflicts.push({
            type: 'duplicate_permission',
            resource: permission.resource,
            action: permission.action,
            sources: [permissionMap.get(key), permission],
            severity: 'medium',
          });
        } else {
          permissionMap.set(key, permission);
        }
      }

      // 检测冲突的条件
      for (const permission of allPermissions) {
        if (permission.conditions) {
          const conflict = this.detectConditionConflicts(permission);
          if (conflict) {
            conflicts.push(conflict);
          }
        }
      }

      return conflicts;
    } catch (error) {
      console.error('Failed to detect permission conflicts:', error);
      return [];
    }
  }

  /**
   * 检测条件冲突
   * @param {Object} permission 权限对象
   * @returns {Object|null} 冲突信息
   */
  detectConditionConflicts(permission) {
    const { conditions } = permission;

    // 检测时间条件冲突
    if (conditions.timeLimit) {
      const { startTime, endTime } = conditions.timeLimit;
      if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
        return {
          type: 'time_condition_conflict',
          resource: permission.resource,
          action: permission.action,
          details: 'Start time must be before end time',
          severity: 'high',
        };
      }
    }

    // 检测IP白名单冲突
    if (conditions.ipWhitelist && conditions.ipBlacklist) {
      const commonIPs = conditions.ipWhitelist.filter(ip => conditions.ipBlacklist.includes(ip));
      if (commonIPs.length > 0) {
        return {
          type: 'ip_list_conflict',
          resource: permission.resource,
          action: permission.action,
          details: `IP addresses in both whitelist and blacklist: ${commonIPs.join(', ')}`,
          severity: 'medium',
        };
      }
    }

    return null;
  }

  /**
   * 创建权限优化建议
   * @param {string} roleId 角色ID
   * @returns {Promise<Array>} 优化建议列表
   */
  async generateOptimizationSuggestions(roleId) {
    try {
      const suggestions = [];

      // 获取角色信息
      const role = await this.redis.hget('roles', roleId);
      if (!role) return suggestions;

      const roleData = JSON.parse(role);
      const permissions = await this.redis.hgetall(`role_permissions:${roleId}`);
      const permissionCount = Object.keys(permissions).length;

      // 建议1: 权限数量过多时建议使用权限组
      if (permissionCount > 20) {
        suggestions.push({
          type: 'use_permission_group',
          title: '建议使用权限组',
          description: `当前角色有${permissionCount}个权限，建议创建权限组来简化管理`,
          priority: 'high',
          impact: 'reduce_complexity',
        });
      }

      // 建议2: 检查未使用的权限
      const unusedPermissions = await this.detectUnusedPermissions(roleId);
      if (unusedPermissions.length > 0) {
        suggestions.push({
          type: 'remove_unused_permissions',
          title: '移除未使用的权限',
          description: `发现${unusedPermissions.length}个可能未使用的权限`,
          details: unusedPermissions,
          priority: 'medium',
          impact: 'security_improvement',
        });
      }

      // 建议3: 检查权限继承优化
      if (roleData.inherits && roleData.inherits.length > 0) {
        const inheritanceOptimization = await this.analyzeInheritanceOptimization(roleId);
        if (inheritanceOptimization) {
          suggestions.push(inheritanceOptimization);
        }
      }

      // 建议4: 检查权限模板应用
      const templateSuggestions = await this.suggestTemplateApplication(roleId);
      suggestions.push(...templateSuggestions);

      return suggestions;
    } catch (error) {
      console.error('Failed to generate optimization suggestions:', error);
      return [];
    }
  }

  /**
   * 检测未使用的权限
   * @param {string} roleId 角色ID
   * @returns {Promise<Array>} 未使用的权限列表
   */
  async detectUnusedPermissions(roleId) {
    try {
      const permissions = await this.redis.hgetall(`role_permissions:${roleId}`);
      const unusedPermissions = [];

      for (const [permId, permData] of Object.entries(permissions)) {
        const permission = JSON.parse(permData);

        // 检查权限使用情况（这里需要集成审计日志）
        const usageCount = await this.getPermissionUsageCount(roleId, permId);

        if (usageCount === 0) {
          unusedPermissions.push({
            permissionId: permId,
            resource: permission.resource,
            action: permission.action,
            assignedAt: permission.assignedAt,
          });
        }
      }

      return unusedPermissions;
    } catch (error) {
      console.error('Failed to detect unused permissions:', error);
      return [];
    }
  }

  /**
   * 获取权限使用次数
   * @param {string} roleId 角色ID
   * @param {string} permissionId 权限ID
   * @returns {Promise<number>} 使用次数
   */
  async getPermissionUsageCount(roleId, permissionId) {
    try {
      // 这里应该查询审计日志来获取实际使用次数
      // 暂时返回模拟数据
      const usageData = await this.redis.hget('permission_usage', `${roleId}:${permissionId}`);
      return usageData ? parseInt(usageData) : 0;
    } catch (error) {
      console.error('Failed to get permission usage count:', error);
      return 0;
    }
  }

  /**
   * 分析继承优化
   * @param {string} roleId 角色ID
   * @returns {Promise<Object|null>} 优化建议
   */
  async analyzeInheritanceOptimization(roleId) {
    try {
      const role = await this.redis.hget('roles', roleId);
      if (!role) return null;

      const roleData = JSON.parse(role);
      if (!roleData.inherits || roleData.inherits.length === 0) return null;

      // 检查是否有重复的继承路径
      const inheritancePaths = await this.getInheritancePaths(roleId);
      const duplicatePaths = this.findDuplicateInheritancePaths(inheritancePaths);

      if (duplicatePaths.length > 0) {
        return {
          type: 'optimize_inheritance',
          title: '优化权限继承',
          description: '发现重复的权限继承路径，建议优化继承结构',
          details: duplicatePaths,
          priority: 'medium',
          impact: 'performance_improvement',
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to analyze inheritance optimization:', error);
      return null;
    }
  }

  /**
   * 获取继承路径
   * @param {string} roleId 角色ID
   * @returns {Promise<Array>} 继承路径列表
   */
  async getInheritancePaths(roleId) {
    try {
      const paths = [];
      await this.getInheritancePathsRecursive(roleId, [], paths);
      return paths;
    } catch (error) {
      console.error('Failed to get inheritance paths:', error);
      return [];
    }
  }

  /**
   * 递归获取继承路径
   * @param {string} roleId 角色ID
   * @param {Array} currentPath 当前路径
   * @param {Array} allPaths 所有路径
   */
  async getInheritancePathsRecursive(roleId, currentPath, allPaths) {
    if (currentPath.includes(roleId)) return; // 避免循环继承

    const newPath = [...currentPath, roleId];
    allPaths.push(newPath);

    const role = await this.redis.hget('roles', roleId);
    if (!role) return;

    const roleData = JSON.parse(role);
    if (roleData.inherits && Array.isArray(roleData.inherits)) {
      for (const inheritedRoleId of roleData.inherits) {
        await this.getInheritancePathsRecursive(inheritedRoleId, newPath, allPaths);
      }
    }
  }

  /**
   * 查找重复的继承路径
   * @param {Array} paths 路径列表
   * @returns {Array} 重复路径列表
   */
  findDuplicateInheritancePaths(paths) {
    const duplicates = [];
    const pathMap = new Map();

    for (const path of paths) {
      const pathKey = path.join('->');
      if (pathMap.has(pathKey)) {
        duplicates.push({
          path,
          duplicateOf: pathMap.get(pathKey),
        });
      } else {
        pathMap.set(pathKey, path);
      }
    }

    return duplicates;
  }

  /**
   * 建议模板应用
   * @param {string} roleId 角色ID
   * @returns {Promise<Array>} 模板建议列表
   */
  async suggestTemplateApplication(roleId) {
    try {
      const suggestions = [];
      const templates = await this.getAllPermissionTemplates();
      const rolePermissions = await this.redis.hgetall(`role_permissions:${roleId}`);
      const rolePermKeys = Object.keys(rolePermissions);

      for (const template of templates) {
        const templatePermKeys = template.permissions.map(
          perm => perm.id || `${perm.resource}:${perm.action}`
        );

        // 计算匹配度
        const matches = templatePermKeys.filter(key => rolePermKeys.includes(key));
        const matchRate = matches.length / templatePermKeys.length;

        if (matchRate > 0.7) {
          // 70%以上匹配度
          suggestions.push({
            type: 'apply_template',
            title: `应用模板: ${template.name}`,
            description: `当前角色与模板"${template.name}"的匹配度为${(matchRate * 100).toFixed(1)}%`,
            templateId: template.id,
            matchRate,
            priority: 'low',
            impact: 'consistency_improvement',
          });
        }
      }

      return suggestions;
    } catch (error) {
      console.error('Failed to suggest template application:', error);
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

module.exports = PermissionInheritanceService;

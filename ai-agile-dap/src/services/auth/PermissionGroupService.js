/**
 * PermissionGroupService - 权限组和继承管理服务
 * Task 6: 实现权限继承和组管理功能
 * 支持权限组、角色继承、组织层级权限等高级功能
 */

const redis = require('redis');

class PermissionGroupService {
  constructor() {
    this.redisClient = null;
    this.cacheEnabled = process.env.PERMISSION_CACHE_ENABLED !== 'false';
    this.cacheTTL = parseInt(process.env.PERMISSION_CACHE_TTL) || 600; // 10分钟
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
      console.log('Redis connected for permission group service');
    } catch (error) {
      console.error('Redis connection failed:', error);
      this.redisClient = null;
    }
  }

  /**
   * 创建权限组
   */
  async createPermissionGroup(groupData) {
    try {
      const group = {
        id: this.generateGroupId(),
        name: groupData.name,
        description: groupData.description || '',
        organizationId: groupData.organizationId,
        parentGroupId: groupData.parentGroupId || null,
        permissions: groupData.permissions || [],
        metadata: groupData.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true
      };

      // 验证组名唯一性
      if (await this.isGroupNameExists(group.name, group.organizationId)) {
        throw new Error('权限组名称已存在');
      }

      // 验证父组存在性
      if (group.parentGroupId) {
        const parentGroup = await this.getGroupById(group.parentGroupId);
        if (!parentGroup) {
          throw new Error('父权限组不存在');
        }
        
        // 检查循环继承
        if (await this.hasCircularInheritance(group.id, group.parentGroupId)) {
          throw new Error('检测到循环继承，无法创建权限组');
        }
      }

      // 保存到数据库（模拟）
      await this.saveGroup(group);
      
      // 清除相关缓存
      await this.clearGroupCache(group.organizationId);
      
      return group;
    } catch (error) {
      console.error('Create permission group failed:', error);
      throw error;
    }
  }

  /**
   * 获取权限组详情
   */
  async getGroupById(groupId) {
    try {
      const cacheKey = `perm_group:${groupId}`;
      
      // 尝试从缓存获取
      if (this.cacheEnabled && this.redisClient) {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // 从数据库获取（模拟）
      const group = await this.fetchGroupFromDB(groupId);
      
      if (group && this.cacheEnabled && this.redisClient) {
        await this.redisClient.setEx(cacheKey, this.cacheTTL, JSON.stringify(group));
      }
      
      return group;
    } catch (error) {
      console.error('Get group by id failed:', error);
      return null;
    }
  }

  /**
   * 计算权限组的完整权限（包含继承）
   */
  async getGroupCompletePermissions(groupId, visitedGroups = new Set()) {
    try {
      // 防止循环继承
      if (visitedGroups.has(groupId)) {
        console.warn(`Circular inheritance detected for group: ${groupId}`);
        return [];
      }
      
      visitedGroups.add(groupId);
      
      const group = await this.getGroupById(groupId);
      if (!group || !group.isActive) {
        return [];
      }

      // 获取当前组的权限
      let allPermissions = [...(group.permissions || [])];
      
      // 如果有父组，递归获取父组权限
      if (group.parentGroupId) {
        const parentPermissions = await this.getGroupCompletePermissions(
          group.parentGroupId, 
          visitedGroups
        );
        allPermissions = [...parentPermissions, ...allPermissions];
      }
      
      // 去重并按优先级排序
      return this.deduplicateAndSortPermissions(allPermissions);
    } catch (error) {
      console.error('Get group complete permissions failed:', error);
      return [];
    }
  }

  /**
   * 为用户分配权限组
   */
  async assignGroupToUser(userId, groupId, assignedBy) {
    try {
      const group = await this.getGroupById(groupId);
      if (!group) {
        throw new Error('权限组不存在');
      }

      const assignment = {
        userId,
        groupId,
        groupName: group.name,
        organizationId: group.organizationId,
        assignedBy,
        assignedAt: new Date().toISOString(),
        isActive: true
      };

      // 保存用户组分配关系
      await this.saveUserGroupAssignment(assignment);
      
      // 清除用户权限缓存
      await this.clearUserPermissionCache(userId);
      
      return assignment;
    } catch (error) {
      console.error('Assign group to user failed:', error);
      throw error;
    }
  }

  /**
   * 获取用户的所有权限组
   */
  async getUserGroups(userId) {
    try {
      const cacheKey = `user_groups:${userId}`;
      
      if (this.cacheEnabled && this.redisClient) {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // 从数据库获取用户组分配
      const assignments = await this.getUserGroupAssignments(userId);
      const groups = [];
      
      for (const assignment of assignments) {
        if (assignment.isActive) {
          const group = await this.getGroupById(assignment.groupId);
          if (group && group.isActive) {
            groups.push({
              ...group,
              assignedAt: assignment.assignedAt,
              assignedBy: assignment.assignedBy
            });
          }
        }
      }

      if (this.cacheEnabled && this.redisClient) {
        await this.redisClient.setEx(cacheKey, this.cacheTTL, JSON.stringify(groups));
      }
      
      return groups;
    } catch (error) {
      console.error('Get user groups failed:', error);
      return [];
    }
  }

  /**
   * 计算用户的完整权限（包含组继承）
   */
  async getUserCompletePermissions(userId) {
    try {
      const userGroups = await this.getUserGroups(userId);
      let allPermissions = [];
      
      // 收集所有组的完整权限
      for (const group of userGroups) {
        const groupPermissions = await this.getGroupCompletePermissions(group.id);
        allPermissions = [...allPermissions, ...groupPermissions];
      }
      
      // 获取用户直接分配的权限（如果有）
      const directPermissions = await this.getUserDirectPermissions(userId);
      allPermissions = [...allPermissions, ...directPermissions];
      
      return this.deduplicateAndSortPermissions(allPermissions);
    } catch (error) {
      console.error('Get user complete permissions failed:', error);
      return [];
    }
  }

  /**
   * 更新权限组
   */
  async updatePermissionGroup(groupId, updateData, updatedBy) {
    try {
      const existingGroup = await this.getGroupById(groupId);
      if (!existingGroup) {
        throw new Error('权限组不存在');
      }

      const updatedGroup = {
        ...existingGroup,
        ...updateData,
        updatedAt: new Date().toISOString(),
        updatedBy
      };

      // 如果更改了父组，检查循环继承
      if (updateData.parentGroupId && updateData.parentGroupId !== existingGroup.parentGroupId) {
        if (await this.hasCircularInheritance(groupId, updateData.parentGroupId)) {
          throw new Error('更新会导致循环继承');
        }
      }

      await this.saveGroup(updatedGroup);
      
      // 清除相关缓存
      await this.clearGroupCache(existingGroup.organizationId);
      await this.clearGroupRelatedUserCache(groupId);
      
      return updatedGroup;
    } catch (error) {
      console.error('Update permission group failed:', error);
      throw error;
    }
  }

  /**
   * 删除权限组
   */
  async deletePermissionGroup(groupId, deletedBy) {
    try {
      const group = await this.getGroupById(groupId);
      if (!group) {
        throw new Error('权限组不存在');
      }

      // 检查是否有子组
      const childGroups = await this.getChildGroups(groupId);
      if (childGroups.length > 0) {
        throw new Error('存在子权限组，无法删除');
      }

      // 检查是否有用户分配
      const assignedUsers = await this.getGroupAssignedUsers(groupId);
      if (assignedUsers.length > 0) {
        throw new Error('权限组已分配给用户，无法删除');
      }

      // 软删除
      const deletedGroup = {
        ...group,
        isActive: false,
        deletedAt: new Date().toISOString(),
        deletedBy
      };

      await this.saveGroup(deletedGroup);
      
      // 清除缓存
      await this.clearGroupCache(group.organizationId);
      
      return deletedGroup;
    } catch (error) {
      console.error('Delete permission group failed:', error);
      throw error;
    }
  }

  /**
   * 获取组织的权限组层级结构
   */
  async getOrganizationGroupHierarchy(organizationId) {
    try {
      const cacheKey = `org_group_hierarchy:${organizationId}`;
      
      if (this.cacheEnabled && this.redisClient) {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      const allGroups = await this.getGroupsByOrganization(organizationId);
      const hierarchy = this.buildGroupHierarchy(allGroups);
      
      if (this.cacheEnabled && this.redisClient) {
        await this.redisClient.setEx(cacheKey, this.cacheTTL, JSON.stringify(hierarchy));
      }
      
      return hierarchy;
    } catch (error) {
      console.error('Get organization group hierarchy failed:', error);
      return [];
    }
  }

  /**
   * 构建权限组层级结构
   */
  buildGroupHierarchy(groups) {
    const groupMap = new Map();
    const rootGroups = [];

    // 创建组映射
    groups.forEach(group => {
      groupMap.set(group.id, { ...group, children: [] });
    });

    // 构建父子关系
    groups.forEach(group => {
      const groupNode = groupMap.get(group.id);
      if (group.parentGroupId) {
        const parentNode = groupMap.get(group.parentGroupId);
        if (parentNode) {
          parentNode.children.push(groupNode);
        } else {
          rootGroups.push(groupNode);
        }
      } else {
        rootGroups.push(groupNode);
      }
    });

    return rootGroups;
  }

  /**
   * 权限去重和排序
   */
  deduplicateAndSortPermissions(permissions) {
    const permissionMap = new Map();
    
    permissions.forEach(perm => {
      const key = `${perm.resource}:${perm.action}`;
      if (!permissionMap.has(key) || perm.priority > permissionMap.get(key).priority) {
        permissionMap.set(key, perm);
      }
    });
    
    return Array.from(permissionMap.values())
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * 检查循环继承
   */
  async hasCircularInheritance(groupId, parentGroupId, visited = new Set()) {
    if (visited.has(parentGroupId)) {
      return true;
    }
    
    if (parentGroupId === groupId) {
      return true;
    }
    
    visited.add(parentGroupId);
    
    const parentGroup = await this.getGroupById(parentGroupId);
    if (parentGroup && parentGroup.parentGroupId) {
      return await this.hasCircularInheritance(groupId, parentGroup.parentGroupId, visited);
    }
    
    return false;
  }

  /**
   * 辅助方法：生成组ID
   */
  generateGroupId() {
    return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 辅助方法：检查组名是否存在
   */
  async isGroupNameExists(name, organizationId) {
    // 模拟数据库查询
    return false;
  }

  /**
   * 辅助方法：保存组到数据库
   */
  async saveGroup(group) {
    // 模拟数据库保存
    console.log(`Saving group: ${group.id}`);
  }

  /**
   * 辅助方法：从数据库获取组
   */
  async fetchGroupFromDB(groupId) {
    // 模拟数据库查询
    return {
      id: groupId,
      name: 'Sample Group',
      description: 'A sample permission group',
      organizationId: 'org1',
      parentGroupId: null,
      permissions: [],
      isActive: true,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * 辅助方法：清除组缓存
   */
  async clearGroupCache(organizationId) {
    if (!this.redisClient) return;
    
    const patterns = [
      `perm_group:*`,
      `user_groups:*`,
      `org_group_hierarchy:${organizationId}`
    ];
    
    for (const pattern of patterns) {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(keys);
      }
    }
  }

  /**
   * 辅助方法：清除用户权限缓存
   */
  async clearUserPermissionCache(userId) {
    if (!this.redisClient) return;
    
    const pattern = `perm:${userId}:*`;
    const keys = await this.redisClient.keys(pattern);
    
    if (keys.length > 0) {
      await this.redisClient.del(keys);
    }
  }

  /**
   * 辅助方法：获取用户组分配关系
   */
  async getUserGroupAssignments(userId) {
    // 模拟数据库查询
    return [];
  }

  /**
   * 辅助方法：获取用户直接权限
   */
  async getUserDirectPermissions(userId) {
    // 模拟数据库查询
    return [];
  }

  /**
   * 辅助方法：保存用户组分配
   */
  async saveUserGroupAssignment(assignment) {
    // 模拟数据库保存
    console.log(`Assigning group ${assignment.groupId} to user ${assignment.userId}`);
  }

  /**
   * 辅助方法：获取子组
   */
  async getChildGroups(groupId) {
    // 模拟数据库查询
    return [];
  }

  /**
   * 辅助方法：获取组分配的用户
   */
  async getGroupAssignedUsers(groupId) {
    // 模拟数据库查询
    return [];
  }

  /**
   * 辅助方法：按组织获取权限组
   */
  async getGroupsByOrganization(organizationId) {
    // 模拟数据库查询
    return [];
  }

  /**
   * 辅助方法：清除组相关用户缓存
   */
  async clearGroupRelatedUserCache(groupId) {
    if (!this.redisClient) return;
    
    // 获取分配了此组的所有用户
    const assignedUsers = await this.getGroupAssignedUsers(groupId);
    
    for (const user of assignedUsers) {
      await this.clearUserPermissionCache(user.userId);
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

module.exports = PermissionGroupService;
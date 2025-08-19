/**
 * RoleService - 角色管理服务
 * 实现角色的CRUD操作和权限分配功能
 */

const Role = require('../../models/Role');
const Permission = require('../../models/Permission');

class RoleService {
  constructor() {
    this.roles = new Map();
    this.initializePredefinedRoles();
  }

  /**
   * 初始化预定义角色
   */
  initializePredefinedRoles() {
    const predefinedRoles = Role.createPredefinedRoles();

    for (const [id, role] of Object.entries(predefinedRoles)) {
      this.roles.set(id, role);
    }
  }

  /**
   * 创建角色
   */
  async createRole(roleData) {
    try {
      const role = new Role(roleData);
      const validation = role.validate();

      if (!validation.isValid) {
        throw new Error(`Role validation failed: ${validation.errors.join(', ')}`);
      }

      // 检查角色ID是否已存在
      if (this.roles.has(role.id)) {
        throw new Error(`Role with ID '${role.id}' already exists`);
      }

      this.roles.set(role.id, role);
      return role;
    } catch (error) {
      console.error('Create role error:', error);
      throw error;
    }
  }

  /**
   * 获取角色
   */
  async getRole(roleId) {
    return this.roles.get(roleId) || null;
  }

  /**
   * 获取所有角色
   */
  async getAllRoles() {
    return Array.from(this.roles.values());
  }

  /**
   * 更新角色
   */
  async updateRole(roleId, updateData) {
    try {
      const role = this.roles.get(roleId);
      if (!role) {
        throw new Error(`Role with ID '${roleId}' not found`);
      }

      // 更新角色属性
      if (updateData.name !== undefined) {
        role.name = updateData.name;
      }
      if (updateData.description !== undefined) {
        role.description = updateData.description;
      }
      if (updateData.inherits !== undefined) {
        role.inherits = updateData.inherits;
      }

      role.updatedAt = new Date();

      const validation = role.validate();
      if (!validation.isValid) {
        throw new Error(`Role validation failed: ${validation.errors.join(', ')}`);
      }

      return role;
    } catch (error) {
      console.error('Update role error:', error);
      throw error;
    }
  }

  /**
   * 删除角色
   */
  async deleteRole(roleId) {
    try {
      const role = this.roles.get(roleId);
      if (!role) {
        throw new Error(`Role with ID '${roleId}' not found`);
      }

      // 检查是否有其他角色继承此角色
      const dependentRoles = Array.from(this.roles.values()).filter(r =>
        r.inherits.includes(roleId)
      );

      if (dependentRoles.length > 0) {
        throw new Error(
          `Cannot delete role '${roleId}' because it is inherited by: ${dependentRoles.map(r => r.id).join(', ')}`
        );
      }

      this.roles.delete(roleId);
      return true;
    } catch (error) {
      console.error('Delete role error:', error);
      throw error;
    }
  }

  /**
   * 为角色分配权限
   */
  async assignPermissionToRole(roleId, permissionData) {
    try {
      const role = this.roles.get(roleId);
      if (!role) {
        throw new Error(`Role with ID '${roleId}' not found`);
      }

      const permission = new Permission({
        ...permissionData,
        roleId,
      });

      const validation = permission.validate();
      if (!validation.isValid) {
        throw new Error(`Permission validation failed: ${validation.errors.join(', ')}`);
      }

      role.addPermission(permission);
      return permission;
    } catch (error) {
      console.error('Assign permission error:', error);
      throw error;
    }
  }

  /**
   * 从角色移除权限
   */
  async removePermissionFromRole(roleId, resource, action) {
    try {
      const role = this.roles.get(roleId);
      if (!role) {
        throw new Error(`Role with ID '${roleId}' not found`);
      }

      role.removePermission(resource, action);
      return true;
    } catch (error) {
      console.error('Remove permission error:', error);
      throw error;
    }
  }

  /**
   * 获取角色权限
   */
  async getRolePermissions(roleId) {
    try {
      const role = this.roles.get(roleId);
      if (!role) {
        throw new Error(`Role with ID '${roleId}' not found`);
      }

      return role.permissions;
    } catch (error) {
      console.error('Get role permissions error:', error);
      throw error;
    }
  }

  /**
   * 添加角色继承
   */
  async addRoleInheritance(roleId, inheritedRoleId) {
    try {
      const role = this.roles.get(roleId);
      if (!role) {
        throw new Error(`Role with ID '${roleId}' not found`);
      }

      const inheritedRole = this.roles.get(inheritedRoleId);
      if (!inheritedRole) {
        throw new Error(`Inherited role with ID '${inheritedRoleId}' not found`);
      }

      // 检查循环继承
      if (role.hasCircularInheritance(inheritedRoleId, { roleService: this })) {
        throw new Error(
          `Circular inheritance detected when adding '${inheritedRoleId}' to '${roleId}'`
        );
      }

      role.addInheritance(inheritedRoleId);
      return role;
    } catch (error) {
      console.error('Add role inheritance error:', error);
      throw error;
    }
  }

  /**
   * 移除角色继承
   */
  async removeRoleInheritance(roleId, inheritedRoleId) {
    try {
      const role = this.roles.get(roleId);
      if (!role) {
        throw new Error(`Role with ID '${roleId}' not found`);
      }

      role.removeInheritance(inheritedRoleId);
      return role;
    } catch (error) {
      console.error('Remove role inheritance error:', error);
      throw error;
    }
  }

  /**
   * 检查角色是否有权限
   */
  async checkRolePermission(roleId, resource, action, context = {}) {
    try {
      const role = this.roles.get(roleId);
      if (!role) {
        return false;
      }

      return role.hasPermission(resource, action, { ...context, roleService: this });
    } catch (error) {
      console.error('Check role permission error:', error);
      return false;
    }
  }

  /**
   * 获取角色所有权限（包括继承的）
   */
  async getRoleAllPermissions(roleId, context = {}) {
    try {
      const role = this.roles.get(roleId);
      if (!role) {
        return [];
      }

      return role.getAllPermissions({ ...context, roleService: this });
    } catch (error) {
      console.error('Get role all permissions error:', error);
      return [];
    }
  }

  /**
   * 搜索角色
   */
  async searchRoles(query, options = {}) {
    try {
      const { limit = 10, offset = 0 } = options;
      let roles = Array.from(this.roles.values());

      // 按名称搜索
      if (query) {
        const searchTerm = query.toLowerCase();
        roles = roles.filter(
          role =>
            role.name.toLowerCase().includes(searchTerm) ||
            role.description.toLowerCase().includes(searchTerm)
        );
      }

      // 分页
      const total = roles.length;
      const paginatedRoles = roles.slice(offset, offset + limit);

      return {
        roles: paginatedRoles,
        total,
        limit,
        offset,
      };
    } catch (error) {
      console.error('Search roles error:', error);
      throw error;
    }
  }

  /**
   * 获取角色统计信息
   */
  async getRoleStats() {
    try {
      const roles = Array.from(this.roles.values());

      const stats = {
        total: roles.length,
        predefined: roles.filter(r => ['super-admin', 'admin', 'user', 'viewer'].includes(r.id))
          .length,
        custom: roles.filter(r => !['super-admin', 'admin', 'user', 'viewer'].includes(r.id))
          .length,
        withInheritance: roles.filter(r => r.inherits.length > 0).length,
        averagePermissions: roles.reduce((sum, r) => sum + r.permissions.length, 0) / roles.length,
      };

      return stats;
    } catch (error) {
      console.error('Get role stats error:', error);
      throw error;
    }
  }

  /**
   * 验证角色配置
   */
  async validateRoleConfiguration() {
    try {
      const errors = [];
      const roles = Array.from(this.roles.values());

      for (const role of roles) {
        // 检查角色验证
        const validation = role.validate();
        if (!validation.isValid) {
          errors.push(`Role '${role.id}': ${validation.errors.join(', ')}`);
        }

        // 检查循环继承
        for (const inheritedRoleId of role.inherits) {
          if (role.hasCircularInheritance(inheritedRoleId, { roleService: this })) {
            errors.push(`Role '${role.id}' has circular inheritance with '${inheritedRoleId}'`);
          }
        }

        // 检查权限验证
        for (const permission of role.permissions) {
          const permValidation = permission.validate();
          if (!permValidation.isValid) {
            errors.push(`Role '${role.id}' permission: ${permValidation.errors.join(', ')}`);
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      console.error('Validate role configuration error:', error);
      throw error;
    }
  }
}

module.exports = RoleService;

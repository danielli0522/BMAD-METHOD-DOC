/**
 * Role Model - 角色数据模型
 * 定义角色的数据结构和角色管理逻辑
 */

class Role {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.description = data.description || '';
    this.permissions = data.permissions || [];
    this.inherits = data.inherits || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * 验证角色数据
   */
  validate() {
    const errors = [];

    if (!this.name) {
      errors.push('name is required');
    }

    if (this.name.length > 100) {
      errors.push('name must be less than 100 characters');
    }

    if (this.description && this.description.length > 500) {
      errors.push('description must be less than 500 characters');
    }

    // 验证角色ID格式
    if (this.id && !/^[a-zA-Z0-9_-]+$/.test(this.id)) {
      errors.push('id must contain only alphanumeric characters, hyphens, and underscores');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 添加权限
   */
  addPermission(permission) {
    if (
      !this.permissions.find(
        p => p.resource === permission.resource && p.action === permission.action
      )
    ) {
      this.permissions.push(permission);
      this.updatedAt = new Date();
    }
    return this;
  }

  /**
   * 移除权限
   */
  removePermission(resource, action) {
    this.permissions = this.permissions.filter(
      p => !(p.resource === resource && p.action === action)
    );
    this.updatedAt = new Date();
    return this;
  }

  /**
   * 检查是否有指定权限
   */
  hasPermission(resource, action, context = {}) {
    // 检查直接权限
    for (const permission of this.permissions) {
      if (permission.matches(resource, action, context)) {
        return true;
      }
    }

    // 检查继承权限
    for (const inheritedRoleId of this.inherits) {
      // 这里需要从角色服务中获取继承的角色
      // 暂时返回false，实际实现中会递归检查
      if (context.roleService) {
        const inheritedRole = context.roleService.getRole(inheritedRoleId);
        if (inheritedRole && inheritedRole.hasPermission(resource, action, context)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 获取所有权限（包括继承的）
   */
  getAllPermissions(context = {}) {
    const allPermissions = [...this.permissions];

    // 添加继承权限
    for (const inheritedRoleId of this.inherits) {
      if (context.roleService) {
        const inheritedRole = context.roleService.getRole(inheritedRoleId);
        if (inheritedRole) {
          allPermissions.push(...inheritedRole.getAllPermissions(context));
        }
      }
    }

    return allPermissions;
  }

  /**
   * 添加继承角色
   */
  addInheritance(roleId) {
    if (!this.inherits.includes(roleId)) {
      this.inherits.push(roleId);
      this.updatedAt = new Date();
    }
    return this;
  }

  /**
   * 移除继承角色
   */
  removeInheritance(roleId) {
    this.inherits = this.inherits.filter(id => id !== roleId);
    this.updatedAt = new Date();
    return this;
  }

  /**
   * 检查是否有循环继承
   */
  hasCircularInheritance(roleId, context = {}) {
    if (this.id === roleId) {
      return true;
    }

    for (const inheritedRoleId of this.inherits) {
      if (context.roleService) {
        const inheritedRole = context.roleService.getRole(inheritedRoleId);
        if (inheritedRole && inheritedRole.hasCircularInheritance(roleId, context)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 转换为数据库记录
   */
  toDatabaseRecord() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      inherits: JSON.stringify(this.inherits),
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
  }

  /**
   * 从数据库记录创建实例
   */
  static fromDatabaseRecord(record) {
    return new Role({
      id: record.id,
      name: record.name,
      description: record.description,
      inherits: record.inherits ? JSON.parse(record.inherits) : [],
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    });
  }

  /**
   * 创建预定义角色
   */
  static createPredefinedRoles() {
    return {
      'super-admin': new Role({
        id: 'super-admin',
        name: 'Super Administrator',
        description: '系统超级管理员，拥有所有权限',
        permissions: [{ resource: '*', action: '*' }],
      }),
      admin: new Role({
        id: 'admin',
        name: 'Administrator',
        description: '组织管理员，拥有组织内管理权限',
        permissions: [
          { resource: 'user', action: 'manage', conditions: { organization_only: true } },
          { resource: 'datasource', action: 'manage', conditions: { organization_only: true } },
          { resource: 'query', action: '*' },
          { resource: 'report', action: '*' },
          { resource: 'audit', action: 'read', conditions: { organization_only: true } },
        ],
      }),
      user: new Role({
        id: 'user',
        name: 'User',
        description: '普通用户，拥有基础查询和报表权限',
        permissions: [
          { resource: 'query', action: 'read' },
          { resource: 'query', action: 'write' },
          { resource: 'report', action: 'read' },
          { resource: 'report', action: 'write', conditions: { own_only: true } },
          { resource: 'report', action: 'share', conditions: { own_only: true } },
        ],
      }),
      viewer: new Role({
        id: 'viewer',
        name: 'Viewer',
        description: '访客用户，只有只读权限',
        permissions: [
          { resource: 'query', action: 'read' },
          { resource: 'report', action: 'read' },
        ],
      }),
    };
  }

  /**
   * 转换为JSON对象
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      permissions: this.permissions,
      inherits: this.inherits,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = Role;

/**
 * UserRole Model - 用户角色关联模型
 * 管理用户和角色的关联关系
 */

class UserRole {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || null;
    this.roleId = data.roleId || null;
    this.organizationId = data.organizationId || null;
    this.assignedBy = data.assignedBy || null;
    this.assignedAt = data.assignedAt || new Date();
    this.expiresAt = data.expiresAt || null;
    this.isActive = data.isActive !== false; // 默认为true
  }

  /**
   * 验证用户角色关联数据
   */
  validate() {
    const errors = [];

    if (!this.userId) {
      errors.push('userId is required');
    }

    if (!this.roleId) {
      errors.push('roleId is required');
    }

    if (!this.assignedBy) {
      errors.push('assignedBy is required');
    }

    // 检查过期时间
    if (this.expiresAt && new Date(this.expiresAt) <= new Date()) {
      errors.push('expiresAt must be in the future');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 检查角色是否过期
   */
  isExpired() {
    if (!this.expiresAt) {
      return false;
    }
    return new Date() > new Date(this.expiresAt);
  }

  /**
   * 检查角色是否有效
   */
  isValid() {
    return this.isActive && !this.isExpired();
  }

  /**
   * 转换为数据库记录
   */
  toDatabaseRecord() {
    return {
      id: this.id,
      user_id: this.userId,
      role_id: this.roleId,
      organization_id: this.organizationId,
      assigned_by: this.assignedBy,
      assigned_at: this.assignedAt,
      expires_at: this.expiresAt,
      is_active: this.isActive,
    };
  }

  /**
   * 从数据库记录创建实例
   */
  static fromDatabaseRecord(record) {
    return new UserRole({
      id: record.id,
      userId: record.user_id,
      roleId: record.role_id,
      organizationId: record.organization_id,
      assignedBy: record.assigned_by,
      assignedAt: record.assigned_at,
      expiresAt: record.expires_at,
      isActive: record.is_active,
    });
  }

  /**
   * 转换为JSON对象
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      roleId: this.roleId,
      organizationId: this.organizationId,
      assignedBy: this.assignedBy,
      assignedAt: this.assignedAt,
      expiresAt: this.expiresAt,
      isActive: this.isActive,
      isValid: this.isValid(),
      isExpired: this.isExpired(),
    };
  }
}

module.exports = UserRole;

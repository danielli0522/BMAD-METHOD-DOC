/**
 * Permission Model - 权限数据模型
 * 定义权限的数据结构和验证规则
 */

const crypto = require('crypto');

class Permission {
  constructor(data = {}) {
    this.id = data.id || null;
    this.roleId = data.roleId || null;
    this.resource = data.resource || '';
    this.action = data.action || '';
    this.conditions = data.conditions || {};
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * 验证权限数据
   */
  validate() {
    const errors = [];

    if (!this.roleId) {
      errors.push('roleId is required');
    }

    if (!this.resource) {
      errors.push('resource is required');
    }

    if (!this.action) {
      errors.push('action is required');
    }

    // 验证资源类型
    const validResources = ['datasource', 'query', 'report', 'user', 'system'];
    if (!validResources.includes(this.resource)) {
      errors.push(`Invalid resource type. Must be one of: ${validResources.join(', ')}`);
    }

    // 验证操作类型
    const validActions = ['read', 'write', 'delete', 'share', 'manage'];
    if (!validActions.includes(this.action)) {
      errors.push(`Invalid action type. Must be one of: ${validActions.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 检查权限是否匹配
   */
  matches(resource, action, context = {}) {
    // 检查资源匹配
    const resourceMatch = this.resource === '*' || this.resource === resource;

    // 检查操作匹配
    const actionMatch = this.action === '*' || this.action === action;

    // 检查条件匹配
    const conditionMatch = this.evaluateConditions(context);

    return resourceMatch && actionMatch && conditionMatch;
  }

  /**
   * 评估权限条件
   */
  evaluateConditions(context) {
    if (!this.conditions || Object.keys(this.conditions).length === 0) {
      return true;
    }

    // 检查own_only条件
    if (this.conditions.own_only && context.resourceOwnerId) {
      return context.userId === context.resourceOwnerId;
    }

    // 检查organization_only条件
    if (this.conditions.organization_only && context.organizationId) {
      return context.userOrganizationId === context.organizationId;
    }

    // 检查时间限制条件
    if (this.conditions.time_limit) {
      const now = new Date();
      const startTime = new Date(this.conditions.time_limit.start);
      const endTime = new Date(this.conditions.time_limit.end);
      return now >= startTime && now <= endTime;
    }

    // 检查IP白名单条件
    if (this.conditions.ip_whitelist && context.clientIp) {
      return this.conditions.ip_whitelist.includes(context.clientIp);
    }

    return true;
  }

  /**
   * 转换为数据库记录
   */
  toDatabaseRecord() {
    return {
      id: this.id,
      role_id: this.roleId,
      resource: this.resource,
      action: this.action,
      conditions: JSON.stringify(this.conditions),
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
  }

  /**
   * 从数据库记录创建实例
   */
  static fromDatabaseRecord(record) {
    return new Permission({
      id: record.id,
      roleId: record.role_id,
      resource: record.resource,
      action: record.action,
      conditions: record.conditions ? JSON.parse(record.conditions) : {},
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    });
  }

  /**
   * 创建权限哈希（用于缓存键）
   */
  getHash() {
    const data = `${this.roleId}:${this.resource}:${this.action}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * 转换为JSON对象
   */
  toJSON() {
    return {
      id: this.id,
      roleId: this.roleId,
      resource: this.resource,
      action: this.action,
      conditions: this.conditions,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = Permission;

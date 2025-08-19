/**
 * AuditLog Model - 审计日志数据模型
 * 用于记录权限变更操作和系统审计信息
 */

class AuditLog {
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || null;
    this.action = data.action || '';
    this.resourceType = data.resourceType || '';
    this.resourceId = data.resourceId || null;
    this.oldValue = data.oldValue || null;
    this.newValue = data.newValue || null;
    this.ipAddress = data.ipAddress || null;
    this.userAgent = data.userAgent || null;
    this.sessionId = data.sessionId || null;
    this.organizationId = data.organizationId || null;
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date();
  }

  /**
   * 验证审计日志数据
   */
  validate() {
    const errors = [];

    if (!this.userId) {
      errors.push('userId is required');
    }

    if (!this.action) {
      errors.push('action is required');
    }

    // 验证操作类型
    const validActions = [
      'permission_granted',
      'permission_revoked',
      'role_assigned',
      'role_removed',
      'role_created',
      'role_updated',
      'role_deleted',
      'user_login',
      'user_logout',
      'access_denied',
      'access_granted',
      'configuration_changed',
    ];

    if (!validActions.includes(this.action)) {
      errors.push(`Invalid action type. Must be one of: ${validActions.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 转换为数据库记录
   */
  toDatabaseRecord() {
    return {
      id: this.id,
      user_id: this.userId,
      action: this.action,
      resource_type: this.resourceType,
      resource_id: this.resourceId,
      old_value: this.oldValue ? JSON.stringify(this.oldValue) : null,
      new_value: this.newValue ? JSON.stringify(this.newValue) : null,
      ip_address: this.ipAddress,
      user_agent: this.userAgent,
      session_id: this.sessionId,
      organization_id: this.organizationId,
      metadata: JSON.stringify(this.metadata),
      created_at: this.createdAt,
    };
  }

  /**
   * 从数据库记录创建实例
   */
  static fromDatabaseRecord(record) {
    return new AuditLog({
      id: record.id,
      userId: record.user_id,
      action: record.action,
      resourceType: record.resource_type,
      resourceId: record.resource_id,
      oldValue: record.old_value ? JSON.parse(record.old_value) : null,
      newValue: record.new_value ? JSON.parse(record.new_value) : null,
      ipAddress: record.ip_address,
      userAgent: record.user_agent,
      sessionId: record.session_id,
      organizationId: record.organization_id,
      metadata: record.metadata ? JSON.parse(record.metadata) : {},
      createdAt: record.created_at,
    });
  }

  /**
   * 转换为JSON对象
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      action: this.action,
      resourceType: this.resourceType,
      resourceId: this.resourceId,
      oldValue: this.oldValue,
      newValue: this.newValue,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      sessionId: this.sessionId,
      organizationId: this.organizationId,
      metadata: this.metadata,
      createdAt: this.createdAt,
    };
  }

  /**
   * 创建权限授予审计日志
   */
  static createPermissionGrantedLog(userId, resourceType, resourceId, permission, context = {}) {
    return new AuditLog({
      userId,
      action: 'permission_granted',
      resourceType,
      resourceId,
      newValue: permission,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      organizationId: context.organizationId,
      metadata: {
        grantedBy: context.grantedBy,
        reason: context.reason,
        expiresAt: context.expiresAt,
      },
    });
  }

  /**
   * 创建权限撤销审计日志
   */
  static createPermissionRevokedLog(userId, resourceType, resourceId, permission, context = {}) {
    return new AuditLog({
      userId,
      action: 'permission_revoked',
      resourceType,
      resourceId,
      oldValue: permission,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      organizationId: context.organizationId,
      metadata: {
        revokedBy: context.revokedBy,
        reason: context.reason,
      },
    });
  }

  /**
   * 创建角色分配审计日志
   */
  static createRoleAssignedLog(userId, roleId, context = {}) {
    return new AuditLog({
      userId,
      action: 'role_assigned',
      resourceType: 'role',
      resourceId: roleId,
      newValue: { roleId },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      organizationId: context.organizationId,
      metadata: {
        assignedBy: context.assignedBy,
        reason: context.reason,
        expiresAt: context.expiresAt,
      },
    });
  }

  /**
   * 创建角色移除审计日志
   */
  static createRoleRemovedLog(userId, roleId, context = {}) {
    return new AuditLog({
      userId,
      action: 'role_removed',
      resourceType: 'role',
      resourceId: roleId,
      oldValue: { roleId },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      organizationId: context.organizationId,
      metadata: {
        removedBy: context.removedBy,
        reason: context.reason,
      },
    });
  }

  /**
   * 创建访问拒绝审计日志
   */
  static createAccessDeniedLog(userId, resourceType, resourceId, action, context = {}) {
    return new AuditLog({
      userId,
      action: 'access_denied',
      resourceType,
      resourceId,
      metadata: {
        attemptedAction: action,
        reason: context.reason,
        userRole: context.userRole,
        requiredPermissions: context.requiredPermissions,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      organizationId: context.organizationId,
    });
  }

  /**
   * 创建访问授予审计日志
   */
  static createAccessGrantedLog(userId, resourceType, resourceId, action, context = {}) {
    return new AuditLog({
      userId,
      action: 'access_granted',
      resourceType,
      resourceId,
      metadata: {
        grantedAction: action,
        userRole: context.userRole,
        permissions: context.permissions,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      organizationId: context.organizationId,
    });
  }

  /**
   * 创建配置变更审计日志
   */
  static createConfigurationChangedLog(userId, configType, oldConfig, newConfig, context = {}) {
    return new AuditLog({
      userId,
      action: 'configuration_changed',
      resourceType: 'configuration',
      resourceId: configType,
      oldValue: oldConfig,
      newValue: newConfig,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      organizationId: context.organizationId,
      metadata: {
        changeReason: context.reason,
        impactLevel: context.impactLevel,
      },
    });
  }

  /**
   * 获取审计日志摘要
   */
  getSummary() {
    return {
      id: this.id,
      userId: this.userId,
      action: this.action,
      resourceType: this.resourceType,
      resourceId: this.resourceId,
      timestamp: this.createdAt,
      ipAddress: this.ipAddress,
    };
  }

  /**
   * 检查是否为敏感操作
   */
  isSensitiveOperation() {
    const sensitiveActions = [
      'permission_granted',
      'permission_revoked',
      'role_assigned',
      'role_removed',
      'role_deleted',
      'configuration_changed',
    ];

    return sensitiveActions.includes(this.action);
  }

  /**
   * 获取操作风险等级
   */
  getRiskLevel() {
    const highRiskActions = ['permission_granted', 'role_assigned', 'configuration_changed'];
    const mediumRiskActions = ['permission_revoked', 'role_removed'];
    const lowRiskActions = ['user_login', 'user_logout', 'access_granted'];

    if (highRiskActions.includes(this.action)) {
      return 'HIGH';
    } else if (mediumRiskActions.includes(this.action)) {
      return 'MEDIUM';
    } else if (lowRiskActions.includes(this.action)) {
      return 'LOW';
    }

    return 'UNKNOWN';
  }
}

module.exports = AuditLog;

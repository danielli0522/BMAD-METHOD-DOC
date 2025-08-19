/**
 * 审计服务
 * 实现审计日志记录、查询、分析等功能
 */

const crypto = require('crypto');

class AuditService {
  constructor() {
    this.logLevels = {
      INFO: 'info',
      WARNING: 'warning',
      ERROR: 'error',
      CRITICAL: 'critical',
    };

    this.eventTypes = {
      // 认证相关事件
      LOGIN: 'login',
      LOGOUT: 'logout',
      LOGIN_FAILED: 'login_failed',
      PASSWORD_CHANGE: 'password_change',
      PASSWORD_RESET: 'password_reset',
      MFA_ENABLE: 'mfa_enable',
      MFA_DISABLE: 'mfa_disable',
      MFA_VERIFY: 'mfa_verify',

      // 权限相关事件
      PERMISSION_GRANT: 'permission_grant',
      PERMISSION_REVOKE: 'permission_revoke',
      ROLE_ASSIGN: 'role_assign',
      ROLE_REMOVE: 'role_remove',

      // 数据访问事件
      DATA_ACCESS: 'data_access',
      DATA_MODIFY: 'data_modify',
      DATA_DELETE: 'data_delete',
      DATA_EXPORT: 'data_export',

      // 系统管理事件
      USER_CREATE: 'user_create',
      USER_UPDATE: 'user_update',
      USER_DELETE: 'user_delete',
      SYSTEM_CONFIG: 'system_config',

      // 安全事件
      SECURITY_VIOLATION: 'security_violation',
      SUSPICIOUS_ACTIVITY: 'suspicious_activity',
      BRUTE_FORCE_ATTEMPT: 'brute_force_attempt',
      IP_BLOCKED: 'ip_blocked',
    };
  }

  /**
   * 记录审计日志
   * @param {Object} logData - 日志数据
   * @returns {Promise<Object>} 记录结果
   */
  async logEvent(logData) {
    try {
      const {
        userId,
        eventType,
        level = this.logLevels.INFO,
        description,
        details = {},
        ip = 'unknown',
        userAgent = 'unknown',
        resource = null,
        outcome = 'success',
      } = logData;

      // 验证必需字段
      if (!eventType || !description) {
        throw new Error('Event type and description are required');
      }

      // 创建审计日志条目
      const auditLog = {
        id: this.generateLogId(),
        userId: userId || 'anonymous',
        eventType,
        level,
        description,
        details,
        ip,
        userAgent,
        resource,
        outcome,
        timestamp: new Date().toISOString(),
        sessionId: details.sessionId || null,
        requestId: details.requestId || null,
      };

      // 这里应该将日志存储到数据库
      // 暂时打印到控制台
      console.log(`[AUDIT] ${auditLog.level.toUpperCase()}: ${auditLog.eventType}`, {
        userId: auditLog.userId,
        description: auditLog.description,
        ip: auditLog.ip,
        timestamp: auditLog.timestamp,
        outcome: auditLog.outcome,
      });

      return {
        success: true,
        logId: auditLog.id,
        timestamp: auditLog.timestamp,
      };
    } catch (error) {
      console.error('Log event error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 记录认证事件
   * @param {string} userId - 用户ID
   * @param {string} eventType - 事件类型
   * @param {Object} details - 详细信息
   * @returns {Promise<Object>} 记录结果
   */
  async logAuthEvent(userId, eventType, details = {}) {
    const logData = {
      userId,
      eventType,
      level: this.logLevels.INFO,
      description: this.getAuthEventDescription(eventType, details),
      details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
      outcome: details.success ? 'success' : 'failure',
    };

    return await this.logEvent(logData);
  }

  /**
   * 记录权限事件
   * @param {string} userId - 用户ID
   * @param {string} eventType - 事件类型
   * @param {Object} details - 详细信息
   * @returns {Promise<Object>} 记录结果
   */
  async logPermissionEvent(userId, eventType, details = {}) {
    const logData = {
      userId,
      eventType,
      level: this.logLevels.WARNING,
      description: this.getPermissionEventDescription(eventType, details),
      details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
      resource: details.resource || null,
      outcome: details.success ? 'success' : 'failure',
    };

    return await this.logEvent(logData);
  }

  /**
   * 记录数据访问事件
   * @param {string} userId - 用户ID
   * @param {string} eventType - 事件类型
   * @param {Object} details - 详细信息
   * @returns {Promise<Object>} 记录结果
   */
  async logDataEvent(userId, eventType, details = {}) {
    const logData = {
      userId,
      eventType,
      level: this.logLevels.INFO,
      description: this.getDataEventDescription(eventType, details),
      details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
      resource: details.resource || null,
      outcome: details.success ? 'success' : 'failure',
    };

    return await this.logEvent(logData);
  }

  /**
   * 记录安全事件
   * @param {string} userId - 用户ID
   * @param {string} eventType - 事件类型
   * @param {Object} details - 详细信息
   * @returns {Promise<Object>} 记录结果
   */
  async logSecurityEvent(userId, eventType, details = {}) {
    const logData = {
      userId: userId || 'system',
      eventType,
      level: this.logLevels.ERROR,
      description: this.getSecurityEventDescription(eventType, details),
      details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
      outcome: 'failure',
    };

    return await this.logEvent(logData);
  }

  /**
   * 查询审计日志
   * @param {Object} filters - 查询过滤器
   * @returns {Promise<Array>} 日志列表
   */
  async queryLogs(filters = {}) {
    try {
      const {
        userId,
        eventType,
        level,
        startDate,
        endDate,
        ip,
        outcome,
        limit = 100,
        offset = 0,
      } = filters;

      // 这里应该从数据库查询日志
      // 暂时返回模拟数据
      const mockLogs = [
        {
          id: 'log_001',
          userId: '1',
          eventType: this.eventTypes.LOGIN,
          level: this.logLevels.INFO,
          description: 'User login successful',
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          outcome: 'success',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'log_002',
          userId: '2',
          eventType: this.eventTypes.LOGIN_FAILED,
          level: this.logLevels.WARNING,
          description: 'Failed login attempt',
          ip: '192.168.1.101',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          outcome: 'failure',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
      ];

      // 应用过滤器
      let filteredLogs = mockLogs;

      if (userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === userId);
      }

      if (eventType) {
        filteredLogs = filteredLogs.filter(log => log.eventType === eventType);
      }

      if (level) {
        filteredLogs = filteredLogs.filter(log => log.level === level);
      }

      if (ip) {
        filteredLogs = filteredLogs.filter(log => log.ip === ip);
      }

      if (outcome) {
        filteredLogs = filteredLogs.filter(log => log.outcome === outcome);
      }

      if (startDate) {
        filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= new Date(startDate));
      }

      if (endDate) {
        filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= new Date(endDate));
      }

      // 应用分页
      const paginatedLogs = filteredLogs.slice(offset, offset + limit);

      return {
        success: true,
        data: {
          logs: paginatedLogs,
          total: filteredLogs.length,
          limit,
          offset,
        },
      };
    } catch (error) {
      console.error('Query logs error:', error);
      return {
        success: false,
        error: error.message,
        data: {
          logs: [],
          total: 0,
          limit,
          offset,
        },
      };
    }
  }

  /**
   * 获取审计统计信息
   * @param {Object} filters - 查询过滤器
   * @returns {Promise<Object>} 统计信息
   */
  async getAuditStats(filters = {}) {
    try {
      const { startDate, endDate, userId } = filters;

      // 这里应该从数据库获取统计数据
      // 暂时返回模拟数据
      const stats = {
        totalEvents: 1250,
        eventsByType: {
          [this.eventTypes.LOGIN]: 450,
          [this.eventTypes.LOGOUT]: 420,
          [this.eventTypes.LOGIN_FAILED]: 180,
          [this.eventTypes.PASSWORD_CHANGE]: 50,
          [this.eventTypes.MFA_VERIFY]: 150,
        },
        eventsByLevel: {
          [this.logLevels.INFO]: 1000,
          [this.logLevels.WARNING]: 200,
          [this.logLevels.ERROR]: 50,
        },
        eventsByOutcome: {
          success: 1100,
          failure: 150,
        },
        topUsers: [
          { userId: '1', eventCount: 150 },
          { userId: '2', eventCount: 120 },
          { userId: '3', eventCount: 100 },
        ],
        topIPs: [
          { ip: '192.168.1.100', eventCount: 200 },
          { ip: '192.168.1.101', eventCount: 150 },
          { ip: '10.0.0.50', eventCount: 100 },
        ],
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error('Get audit stats error:', error);
      return {
        success: false,
        error: error.message,
        data: {},
      };
    }
  }

  /**
   * 导出审计日志
   * @param {Object} filters - 查询过滤器
   * @param {string} format - 导出格式（csv/json）
   * @returns {Promise<Object>} 导出结果
   */
  async exportLogs(filters = {}, format = 'csv') {
    try {
      const queryResult = await this.queryLogs(filters);

      if (!queryResult.success) {
        throw new Error('Failed to query logs');
      }

      const logs = queryResult.data.logs;
      let exportData;

      if (format === 'csv') {
        exportData = this.convertToCSV(logs);
      } else if (format === 'json') {
        exportData = JSON.stringify(logs, null, 2);
      } else {
        throw new Error('Unsupported export format');
      }

      return {
        success: true,
        data: {
          format,
          content: exportData,
          recordCount: logs.length,
          exportTime: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Export logs error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 生成日志ID
   * @returns {string} 日志ID
   */
  generateLogId() {
    return `log_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * 获取认证事件描述
   * @param {string} eventType - 事件类型
   * @param {Object} details - 详细信息
   * @returns {string} 事件描述
   */
  getAuthEventDescription(eventType, details) {
    const descriptions = {
      [this.eventTypes.LOGIN]: 'User login successful',
      [this.eventTypes.LOGOUT]: 'User logout',
      [this.eventTypes.LOGIN_FAILED]: 'Failed login attempt',
      [this.eventTypes.PASSWORD_CHANGE]: 'Password changed',
      [this.eventTypes.PASSWORD_RESET]: 'Password reset',
      [this.eventTypes.MFA_ENABLE]: 'MFA enabled',
      [this.eventTypes.MFA_DISABLE]: 'MFA disabled',
      [this.eventTypes.MFA_VERIFY]: 'MFA verification',
    };

    return descriptions[eventType] || `Authentication event: ${eventType}`;
  }

  /**
   * 获取权限事件描述
   * @param {string} eventType - 事件类型
   * @param {Object} details - 详细信息
   * @returns {string} 事件描述
   */
  getPermissionEventDescription(eventType, details) {
    const descriptions = {
      [this.eventTypes.PERMISSION_GRANT]: `Permission granted: ${details.permission}`,
      [this.eventTypes.PERMISSION_REVOKE]: `Permission revoked: ${details.permission}`,
      [this.eventTypes.ROLE_ASSIGN]: `Role assigned: ${details.role}`,
      [this.eventTypes.ROLE_REMOVE]: `Role removed: ${details.role}`,
    };

    return descriptions[eventType] || `Permission event: ${eventType}`;
  }

  /**
   * 获取数据事件描述
   * @param {string} eventType - 事件类型
   * @param {Object} details - 详细信息
   * @returns {string} 事件描述
   */
  getDataEventDescription(eventType, details) {
    const descriptions = {
      [this.eventTypes.DATA_ACCESS]: `Data accessed: ${details.resource}`,
      [this.eventTypes.DATA_MODIFY]: `Data modified: ${details.resource}`,
      [this.eventTypes.DATA_DELETE]: `Data deleted: ${details.resource}`,
      [this.eventTypes.DATA_EXPORT]: `Data exported: ${details.resource}`,
    };

    return descriptions[eventType] || `Data event: ${eventType}`;
  }

  /**
   * 获取安全事件描述
   * @param {string} eventType - 事件类型
   * @param {Object} details - 详细信息
   * @returns {string} 事件描述
   */
  getSecurityEventDescription(eventType, details) {
    const descriptions = {
      [this.eventTypes.SECURITY_VIOLATION]: `Security violation: ${details.reason}`,
      [this.eventTypes.SUSPICIOUS_ACTIVITY]: `Suspicious activity detected: ${details.reason}`,
      [this.eventTypes.BRUTE_FORCE_ATTEMPT]: `Brute force attempt detected from ${details.ip}`,
      [this.eventTypes.IP_BLOCKED]: `IP blocked: ${details.ip}`,
    };

    return descriptions[eventType] || `Security event: ${eventType}`;
  }

  /**
   * 转换为CSV格式
   * @param {Array} logs - 日志列表
   * @returns {string} CSV内容
   */
  convertToCSV(logs) {
    if (logs.length === 0) {
      return '';
    }

    const headers = [
      'ID',
      'User ID',
      'Event Type',
      'Level',
      'Description',
      'IP',
      'User Agent',
      'Outcome',
      'Timestamp',
    ];
    const rows = logs.map(log => [
      log.id,
      log.userId,
      log.eventType,
      log.level,
      log.description,
      log.ip,
      log.userAgent,
      log.outcome,
      log.timestamp,
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  }

  /**
   * 清理过期日志
   * @param {number} daysToKeep - 保留天数
   * @returns {Promise<Object>} 清理结果
   */
  async cleanupOldLogs(daysToKeep = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // 这里应该从数据库删除过期日志
      console.log(`[AUDIT] Cleaning up logs older than ${cutoffDate.toISOString()}`);

      return {
        success: true,
        message: `Cleaned up logs older than ${daysToKeep} days`,
        cutoffDate: cutoffDate.toISOString(),
      };
    } catch (error) {
      console.error('Cleanup old logs error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = AuditService;

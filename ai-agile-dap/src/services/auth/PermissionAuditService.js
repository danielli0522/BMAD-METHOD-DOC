/**
 * PermissionAuditService - 权限审计服务
 * 实现权限变更的审计日志记录和查询功能
 */

const AuditLog = require('../../models/AuditLog');

class PermissionAuditService {
  constructor() {
    this.auditLogs = [];
    this.auditEnabled = process.env.AUDIT_ENABLED !== 'false';
  }

  /**
   * 记录权限授予审计日志
   */
  async logPermissionGranted(userId, resourceType, resourceId, permission, context = {}) {
    if (!this.auditEnabled) return;

    try {
      const auditLog = AuditLog.createPermissionGrantedLog(
        userId,
        resourceType,
        resourceId,
        permission,
        context
      );

      await this.saveAuditLog(auditLog);
      return auditLog;
    } catch (error) {
      console.error('Log permission granted error:', error);
      throw error;
    }
  }

  /**
   * 记录权限撤销审计日志
   */
  async logPermissionRevoked(userId, resourceType, resourceId, permission, context = {}) {
    if (!this.auditEnabled) return;

    try {
      const auditLog = AuditLog.createPermissionRevokedLog(
        userId,
        resourceType,
        resourceId,
        permission,
        context
      );

      await this.saveAuditLog(auditLog);
      return auditLog;
    } catch (error) {
      console.error('Log permission revoked error:', error);
      throw error;
    }
  }

  /**
   * 记录角色分配审计日志
   */
  async logRoleAssigned(userId, roleId, context = {}) {
    if (!this.auditEnabled) return;

    try {
      const auditLog = AuditLog.createRoleAssignedLog(userId, roleId, context);
      await this.saveAuditLog(auditLog);
      return auditLog;
    } catch (error) {
      console.error('Log role assigned error:', error);
      throw error;
    }
  }

  /**
   * 记录角色移除审计日志
   */
  async logRoleRemoved(userId, roleId, context = {}) {
    if (!this.auditEnabled) return;

    try {
      const auditLog = AuditLog.createRoleRemovedLog(userId, roleId, context);
      await this.saveAuditLog(auditLog);
      return auditLog;
    } catch (error) {
      console.error('Log role removed error:', error);
      throw error;
    }
  }

  /**
   * 记录访问拒绝审计日志
   */
  async logAccessDenied(userId, resourceType, resourceId, action, context = {}) {
    if (!this.auditEnabled) return;

    try {
      const auditLog = AuditLog.createAccessDeniedLog(
        userId,
        resourceType,
        resourceId,
        action,
        context
      );

      await this.saveAuditLog(auditLog);
      return auditLog;
    } catch (error) {
      console.error('Log access denied error:', error);
      throw error;
    }
  }

  /**
   * 记录访问授予审计日志
   */
  async logAccessGranted(userId, resourceType, resourceId, action, context = {}) {
    if (!this.auditEnabled) return;

    try {
      const auditLog = AuditLog.createAccessGrantedLog(
        userId,
        resourceType,
        resourceId,
        action,
        context
      );

      await this.saveAuditLog(auditLog);
      return auditLog;
    } catch (error) {
      console.error('Log access granted error:', error);
      throw error;
    }
  }

  /**
   * 记录配置变更审计日志
   */
  async logConfigurationChanged(userId, configType, oldConfig, newConfig, context = {}) {
    if (!this.auditEnabled) return;

    try {
      const auditLog = AuditLog.createConfigurationChangedLog(
        userId,
        configType,
        oldConfig,
        newConfig,
        context
      );

      await this.saveAuditLog(auditLog);
      return auditLog;
    } catch (error) {
      console.error('Log configuration changed error:', error);
      throw error;
    }
  }

  /**
   * 保存审计日志
   */
  async saveAuditLog(auditLog) {
    try {
      // 验证审计日志
      const validation = auditLog.validate();
      if (!validation.isValid) {
        throw new Error(`Audit log validation failed: ${validation.errors.join(', ')}`);
      }

      // 添加到内存存储（实际应用中应该保存到数据库）
      this.auditLogs.push(auditLog);

      // 如果是敏感操作，记录额外信息
      if (auditLog.isSensitiveOperation()) {
        console.warn(`Sensitive operation detected: ${auditLog.action} by user ${auditLog.userId}`);
      }

      return auditLog;
    } catch (error) {
      console.error('Save audit log error:', error);
      throw error;
    }
  }

  /**
   * 查询审计日志
   */
  async queryAuditLogs(filters = {}, options = {}) {
    try {
      let logs = [...this.auditLogs];

      // 应用过滤器
      if (filters.userId) {
        logs = logs.filter(log => log.userId === filters.userId);
      }

      if (filters.action) {
        logs = logs.filter(log => log.action === filters.action);
      }

      if (filters.resourceType) {
        logs = logs.filter(log => log.resourceType === filters.resourceType);
      }

      if (filters.resourceId) {
        logs = logs.filter(log => log.resourceId === filters.resourceId);
      }

      if (filters.organizationId) {
        logs = logs.filter(log => log.organizationId === filters.organizationId);
      }

      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        logs = logs.filter(log => log.createdAt >= startDate);
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        logs = logs.filter(log => log.createdAt <= endDate);
      }

      if (filters.riskLevel) {
        logs = logs.filter(log => log.getRiskLevel() === filters.riskLevel);
      }

      // 排序
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder || 'desc';

      logs.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      // 分页
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      const total = logs.length;
      const paginatedLogs = logs.slice(offset, offset + limit);

      return {
        logs: paginatedLogs,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      console.error('Query audit logs error:', error);
      throw error;
    }
  }

  /**
   * 获取审计统计信息
   */
  async getAuditStats(filters = {}) {
    try {
      const queryResult = await this.queryAuditLogs(filters);
      const logs = queryResult.logs;

      const stats = {
        total: logs.length,
        byAction: {},
        byRiskLevel: {},
        byResourceType: {},
        byUser: {},
        timeDistribution: {
          last24Hours: 0,
          last7Days: 0,
          last30Days: 0,
        },
      };

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      for (const log of logs) {
        // 按操作类型统计
        stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;

        // 按风险等级统计
        const riskLevel = log.getRiskLevel();
        stats.byRiskLevel[riskLevel] = (stats.byRiskLevel[riskLevel] || 0) + 1;

        // 按资源类型统计
        if (log.resourceType) {
          stats.byResourceType[log.resourceType] =
            (stats.byResourceType[log.resourceType] || 0) + 1;
        }

        // 按用户统计
        stats.byUser[log.userId] = (stats.byUser[log.userId] || 0) + 1;

        // 时间分布统计
        if (log.createdAt >= oneDayAgo) {
          stats.timeDistribution.last24Hours++;
        }
        if (log.createdAt >= sevenDaysAgo) {
          stats.timeDistribution.last7Days++;
        }
        if (log.createdAt >= thirtyDaysAgo) {
          stats.timeDistribution.last30Days++;
        }
      }

      return stats;
    } catch (error) {
      console.error('Get audit stats error:', error);
      throw error;
    }
  }

  /**
   * 导出审计日志
   */
  async exportAuditLogs(filters = {}, format = 'json') {
    try {
      const queryResult = await this.queryAuditLogs(filters, { limit: 10000 }); // 最大导出10000条
      const logs = queryResult.logs;

      switch (format.toLowerCase()) {
        case 'json':
          return {
            format: 'json',
            data: logs.map(log => log.toJSON()),
            total: logs.length,
            exportedAt: new Date(),
          };

        case 'csv':
          const csvData = this.convertToCSV(logs);
          return {
            format: 'csv',
            data: csvData,
            total: logs.length,
            exportedAt: new Date(),
          };

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Export audit logs error:', error);
      throw error;
    }
  }

  /**
   * 转换为CSV格式
   */
  convertToCSV(logs) {
    const headers = [
      'ID',
      'User ID',
      'Action',
      'Resource Type',
      'Resource ID',
      'IP Address',
      'User Agent',
      'Session ID',
      'Organization ID',
      'Created At',
      'Risk Level',
    ];

    const rows = logs.map(log => [
      log.id,
      log.userId,
      log.action,
      log.resourceType,
      log.resourceId,
      log.ipAddress,
      log.userAgent,
      log.sessionId,
      log.organizationId,
      log.createdAt,
      log.getRiskLevel(),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field || ''}"`).join(','))
      .join('\n');

    return csvContent;
  }

  /**
   * 清理过期审计日志
   */
  async cleanupExpiredLogs(retentionDays = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const originalCount = this.auditLogs.length;
      this.auditLogs = this.auditLogs.filter(log => log.createdAt >= cutoffDate);
      const removedCount = originalCount - this.auditLogs.length;

      console.log(
        `Cleaned up ${removedCount} expired audit logs (older than ${retentionDays} days)`
      );
      return removedCount;
    } catch (error) {
      console.error('Cleanup expired logs error:', error);
      throw error;
    }
  }

  /**
   * 获取审计日志摘要
   */
  async getAuditSummary(filters = {}) {
    try {
      const stats = await this.getAuditStats(filters);
      const recentLogs = await this.queryAuditLogs(filters, { limit: 10 });

      return {
        stats,
        recentActivity: recentLogs.logs.map(log => log.getSummary()),
        totalLogs: stats.total,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Get audit summary error:', error);
      throw error;
    }
  }

  /**
   * 检查异常活动
   */
  async detectAnomalousActivity(filters = {}) {
    try {
      const stats = await this.getAuditStats(filters);
      const anomalies = [];

      // 检查高频操作
      for (const [action, count] of Object.entries(stats.byAction)) {
        if (count > 100) {
          // 阈值可配置
          anomalies.push({
            type: 'HIGH_FREQUENCY_ACTION',
            action,
            count,
            severity: 'MEDIUM',
          });
        }
      }

      // 检查高风险操作
      const highRiskCount = stats.byRiskLevel['HIGH'] || 0;
      if (highRiskCount > 10) {
        anomalies.push({
          type: 'HIGH_RISK_OPERATIONS',
          count: highRiskCount,
          severity: 'HIGH',
        });
      }

      // 检查异常时间活动
      const last24HoursCount = stats.timeDistribution.last24Hours;
      if (last24HoursCount > 50) {
        anomalies.push({
          type: 'UNUSUAL_ACTIVITY_VOLUME',
          period: '24h',
          count: last24HoursCount,
          severity: 'MEDIUM',
        });
      }

      return {
        anomalies,
        totalAnomalies: anomalies.length,
        detectedAt: new Date(),
      };
    } catch (error) {
      console.error('Detect anomalous activity error:', error);
      throw error;
    }
  }
}

module.exports = PermissionAuditService;

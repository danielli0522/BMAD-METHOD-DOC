/**
 * 审计相关API路由
 * 处理审计日志查询、统计、导出等操作
 */

const express = require('express');
const AuditService = require('../services/audit/AuditService');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const auditService = new AuditService();

/**
 * @route GET /api/audit/logs
 * @desc 查询审计日志
 * @access Private (Admin only)
 */
router.get('/logs', authMiddleware.authenticate, authMiddleware.requireAdmin, async (req, res) => {
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
    } = req.query;

    const filters = {
      userId,
      eventType,
      level,
      startDate,
      endDate,
      ip,
      outcome,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const result = await auditService.queryLogs(filters);

    return res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Query audit logs error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to query audit logs',
      code: 'QUERY_LOGS_ERROR',
    });
  }
});

/**
 * @route GET /api/audit/stats
 * @desc 获取审计统计信息
 * @access Private (Admin only)
 */
router.get('/stats', authMiddleware.authenticate, authMiddleware.requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;

    const filters = {
      startDate,
      endDate,
      userId,
    };

    const result = await auditService.getAuditStats(filters);

    return res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get audit statistics',
      code: 'GET_STATS_ERROR',
    });
  }
});

/**
 * @route GET /api/audit/export
 * @desc 导出审计日志
 * @access Private (Admin only)
 */
router.get(
  '/export',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  async (req, res) => {
    try {
      const {
        userId,
        eventType,
        level,
        startDate,
        endDate,
        ip,
        outcome,
        format = 'csv',
      } = req.query;

      const filters = {
        userId,
        eventType,
        level,
        startDate,
        endDate,
        ip,
        outcome,
      };

      const result = await auditService.exportLogs(filters, format);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error,
          code: 'EXPORT_ERROR',
        });
      }

      // 设置响应头
      const filename = `audit_logs_${new Date().toISOString().split('T')[0]}.${format}`;
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      return res.status(200).send(result.data.content);
    } catch (error) {
      console.error('Export audit logs error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to export audit logs',
        code: 'EXPORT_ERROR',
      });
    }
  }
);

/**
 * @route GET /api/audit/events
 * @desc 获取事件类型列表
 * @access Private (Admin only)
 */
router.get('/events', authMiddleware.authenticate, authMiddleware.requireAdmin, (req, res) => {
  try {
    const eventTypes = auditService.eventTypes;
    const logLevels = auditService.logLevels;

    return res.status(200).json({
      success: true,
      data: {
        eventTypes,
        logLevels,
      },
    });
  } catch (error) {
    console.error('Get event types error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get event types',
      code: 'GET_EVENTS_ERROR',
    });
  }
});

/**
 * @route POST /api/audit/logs
 * @desc 手动记录审计日志
 * @access Private (Admin only)
 */
router.post('/logs', authMiddleware.authenticate, authMiddleware.requireAdmin, async (req, res) => {
  try {
    const { userId, eventType, level, description, details, ip, userAgent, resource, outcome } =
      req.body;

    const logData = {
      userId,
      eventType,
      level,
      description,
      details,
      ip: ip || req.ip,
      userAgent: userAgent || req.get('User-Agent'),
      resource,
      outcome,
    };

    const result = await auditService.logEvent(logData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'LOG_EVENT_ERROR',
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        logId: result.logId,
        timestamp: result.timestamp,
      },
    });
  } catch (error) {
    console.error('Log audit event error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to log audit event',
      code: 'LOG_EVENT_ERROR',
    });
  }
});

/**
 * @route DELETE /api/audit/logs
 * @desc 清理过期日志
 * @access Private (Admin only)
 */
router.delete(
  '/logs',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  async (req, res) => {
    try {
      const { daysToKeep = 90 } = req.query;

      const result = await auditService.cleanupOldLogs(parseInt(daysToKeep));

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error,
          code: 'CLEANUP_ERROR',
        });
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          cutoffDate: result.cutoffDate,
        },
      });
    } catch (error) {
      console.error('Cleanup audit logs error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to cleanup audit logs',
        code: 'CLEANUP_ERROR',
      });
    }
  }
);

/**
 * @route GET /api/audit/logs/:logId
 * @desc 获取单个审计日志详情
 * @access Private (Admin only)
 */
router.get(
  '/logs/:logId',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  async (req, res) => {
    try {
      const { logId } = req.params;

      // 这里应该从数据库获取单个日志详情
      // 暂时返回模拟数据
      const logDetail = {
        id: logId,
        userId: '1',
        eventType: auditService.eventTypes.LOGIN,
        level: auditService.logLevels.INFO,
        description: 'User login successful',
        details: {
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          sessionId: 'session_123',
        },
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        outcome: 'success',
        timestamp: new Date().toISOString(),
      };

      return res.status(200).json({
        success: true,
        data: logDetail,
      });
    } catch (error) {
      console.error('Get audit log detail error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get audit log detail',
        code: 'GET_LOG_DETAIL_ERROR',
      });
    }
  }
);

/**
 * @route GET /api/audit/reports
 * @desc 生成审计报告
 * @access Private (Admin only)
 */
router.get(
  '/reports',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  async (req, res) => {
    try {
      const { startDate, endDate, reportType = 'summary' } = req.query;

      const filters = {
        startDate,
        endDate,
      };

      let reportData;

      switch (reportType) {
        case 'summary':
          const statsResult = await auditService.getAuditStats(filters);
          reportData = {
            type: 'summary',
            period: {
              startDate,
              endDate,
            },
            statistics: statsResult.data,
          };
          break;

        case 'security':
          // 生成安全事件报告
          const securityFilters = {
            ...filters,
            eventType: [
              auditService.eventTypes.SECURITY_VIOLATION,
              auditService.eventTypes.SUSPICIOUS_ACTIVITY,
              auditService.eventTypes.BRUTE_FORCE_ATTEMPT,
              auditService.eventTypes.IP_BLOCKED,
            ],
          };
          const securityLogs = await auditService.queryLogs(securityFilters);
          reportData = {
            type: 'security',
            period: {
              startDate,
              endDate,
            },
            events: securityLogs.data.logs,
            summary: {
              totalSecurityEvents: securityLogs.data.total,
              criticalEvents: securityLogs.data.logs.filter(log => log.level === 'critical').length,
              warningEvents: securityLogs.data.logs.filter(log => log.level === 'warning').length,
            },
          };
          break;

        case 'user-activity':
          // 生成用户活动报告
          const userActivityFilters = {
            ...filters,
            eventType: [
              auditService.eventTypes.LOGIN,
              auditService.eventTypes.LOGOUT,
              auditService.eventTypes.DATA_ACCESS,
              auditService.eventTypes.DATA_MODIFY,
            ],
          };
          const userActivityLogs = await auditService.queryLogs(userActivityFilters);
          reportData = {
            type: 'user-activity',
            period: {
              startDate,
              endDate,
            },
            events: userActivityLogs.data.logs,
            summary: {
              totalUserEvents: userActivityLogs.data.total,
              uniqueUsers: new Set(userActivityLogs.data.logs.map(log => log.userId)).size,
              mostActiveUser: getMostActiveUser(userActivityLogs.data.logs),
            },
          };
          break;

        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid report type',
            code: 'INVALID_REPORT_TYPE',
          });
      }

      return res.status(200).json({
        success: true,
        data: reportData,
      });
    } catch (error) {
      console.error('Generate audit report error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate audit report',
        code: 'GENERATE_REPORT_ERROR',
      });
    }
  }
);

/**
 * 获取最活跃用户
 * @param {Array} logs - 日志列表
 * @returns {Object} 最活跃用户信息
 */
function getMostActiveUser(logs) {
  const userCounts = {};
  logs.forEach(log => {
    userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;
  });

  const mostActiveUserId = Object.keys(userCounts).reduce((a, b) =>
    userCounts[a] > userCounts[b] ? a : b
  );

  return {
    userId: mostActiveUserId,
    eventCount: userCounts[mostActiveUserId],
  };
}

module.exports = router;

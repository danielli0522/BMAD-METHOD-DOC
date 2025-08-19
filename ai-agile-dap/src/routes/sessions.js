/**
 * 会话管理相关API路由
 * 处理会话查询、终止、统计等操作
 */

const express = require('express');
const SessionService = require('../services/auth/SessionService');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const sessionService = new SessionService();

/**
 * @route GET /api/sessions
 * @desc 获取用户活跃会话列表
 * @access Private
 */
router.get('/', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const activeSessions = await sessionService.getActiveSessions(userId);

    return res.status(200).json({
      success: true,
      data: {
        sessions: activeSessions.map(session => ({
          sessionId: session.sessionId,
          deviceInfo: {
            userAgent: session.deviceInfo.userAgent,
            platform: session.deviceInfo.platform,
            browser: session.deviceInfo.browser,
            ip: session.deviceInfo.ip,
            location: `${session.deviceInfo.city}, ${session.deviceInfo.country}`,
          },
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          expiresAt: session.expiresAt,
          isCurrentSession: session.sessionId === req.sessionId, // 假设当前会话ID存储在req中
        })),
      },
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get sessions',
      code: 'GET_SESSIONS_ERROR',
    });
  }
});

/**
 * @route DELETE /api/sessions/:sessionId
 * @desc 终止指定会话
 * @access Private
 */
router.delete('/:sessionId', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    // 验证会话是否属于当前用户
    const activeSessions = await sessionService.getActiveSessions(userId);
    const session = activeSessions.find(s => s.sessionId === sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
    }

    // 终止会话
    const result = await sessionService.terminateSession(sessionId);

    if (result) {
      return res.status(200).json({
        success: true,
        message: 'Session terminated successfully',
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to terminate session',
        code: 'TERMINATE_SESSION_ERROR',
      });
    }
  } catch (error) {
    console.error('Terminate session error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to terminate session',
      code: 'TERMINATE_SESSION_ERROR',
    });
  }
});

/**
 * @route DELETE /api/sessions
 * @desc 终止除当前会话外的所有会话
 * @access Private
 */
router.delete('/', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const currentSessionId = req.sessionId; // 假设当前会话ID存储在req中

    // 终止除当前会话外的所有会话
    const terminatedCount = await sessionService.terminateAllSessions(userId, currentSessionId);

    return res.status(200).json({
      success: true,
      message: `Terminated ${terminatedCount} sessions successfully`,
      data: {
        terminatedCount,
      },
    });
  } catch (error) {
    console.error('Terminate all sessions error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to terminate sessions',
      code: 'TERMINATE_ALL_SESSIONS_ERROR',
    });
  }
});

/**
 * @route GET /api/sessions/stats
 * @desc 获取会话统计信息
 * @access Private
 */
router.get('/stats', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await sessionService.getSessionStats(userId);

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get session stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get session stats',
      code: 'GET_SESSION_STATS_ERROR',
    });
  }
});

/**
 * @route POST /api/sessions/validate
 * @desc 验证会话有效性
 * @access Private
 */
router.post('/validate', authMiddleware.authenticate, async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
        code: 'MISSING_SESSION_ID',
      });
    }

    const result = await sessionService.validateSession(sessionId);

    return res.status(200).json({
      success: true,
      data: {
        valid: result.valid,
        reason: result.reason || null,
        session: result.session || null,
      },
    });
  } catch (error) {
    console.error('Validate session error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate session',
      code: 'VALIDATE_SESSION_ERROR',
    });
  }
});

/**
 * @route POST /api/sessions/detect-suspicious
 * @desc 检测可疑登录
 * @access Private
 */
router.post('/detect-suspicious', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const ip = req.ip || req.connection.remoteAddress;

    const result = await sessionService.detectSuspiciousLogin(userId, ip);

    return res.status(200).json({
      success: true,
      data: {
        isSuspicious: result.isSuspicious,
        suspiciousSessions: result.suspiciousSessions.map(session => ({
          sessionId: session.sessionId,
          deviceInfo: {
            userAgent: session.deviceInfo.userAgent,
            platform: session.deviceInfo.platform,
            browser: session.deviceInfo.browser,
            ip: session.deviceInfo.ip,
            location: `${session.deviceInfo.city}, ${session.deviceInfo.country}`,
          },
          lastActivity: session.lastActivity,
        })),
        currentLocation: result.currentLocation,
      },
    });
  } catch (error) {
    console.error('Detect suspicious login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to detect suspicious login',
      code: 'DETECT_SUSPICIOUS_ERROR',
    });
  }
});

/**
 * @route PUT /api/sessions/:sessionId/timeout
 * @desc 更新会话超时时间
 * @access Private
 */
router.put('/:sessionId/timeout', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { timeoutMinutes } = req.body;

    if (!timeoutMinutes || timeoutMinutes < 1 || timeoutMinutes > 1440) {
      return res.status(400).json({
        success: false,
        error: 'Timeout must be between 1 and 1440 minutes',
        code: 'INVALID_TIMEOUT',
      });
    }

    // 验证会话是否属于当前用户
    const activeSessions = await sessionService.getActiveSessions(userId);
    const session = activeSessions.find(s => s.sessionId === sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
    }

    // 更新超时时间
    const result = await sessionService.updateSessionTimeout(sessionId, timeoutMinutes);

    if (result) {
      return res.status(200).json({
        success: true,
        message: 'Session timeout updated successfully',
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to update session timeout',
        code: 'UPDATE_TIMEOUT_ERROR',
      });
    }
  } catch (error) {
    console.error('Update session timeout error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update session timeout',
      code: 'UPDATE_TIMEOUT_ERROR',
    });
  }
});

/**
 * @route GET /api/sessions/current
 * @desc 获取当前会话信息
 * @access Private
 */
router.get('/current', authMiddleware.authenticate, async (req, res) => {
  try {
    const currentSessionId = req.sessionId; // 假设当前会话ID存储在req中

    if (!currentSessionId) {
      return res.status(400).json({
        success: false,
        error: 'Current session ID not found',
        code: 'CURRENT_SESSION_NOT_FOUND',
      });
    }

    const result = await sessionService.validateSession(currentSessionId);

    if (result.valid) {
      return res.status(200).json({
        success: true,
        data: {
          sessionId: result.session.sessionId,
          deviceInfo: {
            userAgent: result.session.deviceInfo.userAgent,
            platform: result.session.deviceInfo.platform,
            browser: result.session.deviceInfo.browser,
            ip: result.session.deviceInfo.ip,
            location: `${result.session.deviceInfo.city}, ${result.session.deviceInfo.country}`,
          },
          createdAt: result.session.createdAt,
          lastActivity: result.session.lastActivity,
          expiresAt: result.session.expiresAt,
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Current session is invalid',
        code: 'INVALID_CURRENT_SESSION',
      });
    }
  } catch (error) {
    console.error('Get current session error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get current session',
      code: 'GET_CURRENT_SESSION_ERROR',
    });
  }
});

/**
 * @route POST /api/sessions/cleanup
 * @desc 清理过期会话（管理员功能）
 * @access Private (Admin only)
 */
router.post(
  '/cleanup',
  authMiddleware.authenticate,
  authMiddleware.requireAdmin,
  async (req, res) => {
    try {
      const cleanedCount = await sessionService.cleanupExpiredSessions();

      return res.status(200).json({
        success: true,
        message: `Cleaned up ${cleanedCount} expired sessions`,
        data: {
          cleanedCount,
        },
      });
    } catch (error) {
      console.error('Cleanup sessions error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to cleanup sessions',
        code: 'CLEANUP_SESSIONS_ERROR',
      });
    }
  }
);

module.exports = router;

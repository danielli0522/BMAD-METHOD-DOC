/**
 * 会话管理服务
 * 实现会话超时控制、并发会话限制、异地登录检测等功能
 */

const redis = require('redis');
const crypto = require('crypto');
const geoip = require('geoip-lite');

class SessionService {
  constructor() {
    this.redisClient = null;
    this.sessionTimeout = 30 * 60; // 30分钟
    this.maxConcurrentSessions = 5; // 最大并发会话数
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
    } catch (error) {
      console.error('Redis connection failed:', error);
      this.redisClient = null;
    }
  }

  /**
   * 创建会话
   * @param {string} userId - 用户ID
   * @param {Object} deviceInfo - 设备信息
   * @param {string} ip - IP地址
   * @returns {Promise<Object>} 会话信息
   */
  async createSession(userId, deviceInfo, ip) {
    try {
      // 检查并发会话限制
      const activeSessions = await this.getActiveSessions(userId);
      if (activeSessions.length >= this.maxConcurrentSessions) {
        // 删除最旧的会话
        const oldestSession = activeSessions.sort((a, b) => a.createdAt - b.createdAt)[0];
        await this.terminateSession(oldestSession.sessionId);
      }

      // 生成会话ID
      const sessionId = crypto.randomBytes(32).toString('hex');

      // 获取地理位置信息
      const geoInfo = this.getGeoInfo(ip);

      // 创建会话对象
      const session = {
        sessionId,
        userId,
        deviceInfo: {
          userAgent: deviceInfo.userAgent || 'Unknown',
          platform: deviceInfo.platform || 'Unknown',
          browser: deviceInfo.browser || 'Unknown',
          ip: ip,
          ...geoInfo,
        },
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: Date.now() + this.sessionTimeout * 1000,
        isActive: true,
      };

      // 存储会话到Redis
      await this.storeSession(session);

      // 添加到用户活跃会话列表
      await this.addToUserSessions(userId, sessionId);

      return session;
    } catch (error) {
      console.error('Create session error:', error);
      throw new Error('Failed to create session');
    }
  }

  /**
   * 验证会话
   * @param {string} sessionId - 会话ID
   * @returns {Promise<Object>} 验证结果
   */
  async validateSession(sessionId) {
    try {
      const session = await this.getSession(sessionId);

      if (!session) {
        return {
          valid: false,
          reason: 'Session not found',
        };
      }

      // 检查会话是否过期
      if (Date.now() > session.expiresAt) {
        await this.terminateSession(sessionId);
        return {
          valid: false,
          reason: 'Session expired',
        };
      }

      // 检查会话是否被标记为非活跃
      if (!session.isActive) {
        return {
          valid: false,
          reason: 'Session inactive',
        };
      }

      // 更新最后活动时间
      await this.updateLastActivity(sessionId);

      return {
        valid: true,
        session,
      };
    } catch (error) {
      console.error('Validate session error:', error);
      return {
        valid: false,
        reason: 'Validation error',
      };
    }
  }

  /**
   * 终止会话
   * @param {string} sessionId - 会话ID
   * @returns {Promise<boolean>} 终止结果
   */
  async terminateSession(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      // 从Redis删除会话
      await this.removeSession(sessionId);

      // 从用户活跃会话列表中移除
      await this.removeFromUserSessions(session.userId, sessionId);

      return true;
    } catch (error) {
      console.error('Terminate session error:', error);
      return false;
    }
  }

  /**
   * 获取用户活跃会话
   * @param {string} userId - 用户ID
   * @returns {Promise<Array>} 活跃会话列表
   */
  async getActiveSessions(userId) {
    try {
      if (!this.redisClient) {
        return [];
      }

      const sessionIds = await this.redisClient.sMembers(`user_sessions:${userId}`);
      const sessions = [];

      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session && session.isActive && Date.now() <= session.expiresAt) {
          sessions.push(session);
        } else if (session) {
          // 清理过期或非活跃会话
          await this.removeFromUserSessions(userId, sessionId);
        }
      }

      return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
    } catch (error) {
      console.error('Get active sessions error:', error);
      return [];
    }
  }

  /**
   * 强制注销所有会话
   * @param {string} userId - 用户ID
   * @param {string} excludeSessionId - 排除的会话ID（可选）
   * @returns {Promise<number>} 终止的会话数量
   */
  async terminateAllSessions(userId, excludeSessionId = null) {
    try {
      const activeSessions = await this.getActiveSessions(userId);
      let terminatedCount = 0;

      for (const session of activeSessions) {
        if (session.sessionId !== excludeSessionId) {
          await this.terminateSession(session.sessionId);
          terminatedCount++;
        }
      }

      return terminatedCount;
    } catch (error) {
      console.error('Terminate all sessions error:', error);
      return 0;
    }
  }

  /**
   * 检测异地登录
   * @param {string} userId - 用户ID
   * @param {string} ip - 当前IP地址
   * @returns {Promise<Object>} 检测结果
   */
  async detectSuspiciousLogin(userId, ip) {
    try {
      const activeSessions = await this.getActiveSessions(userId);
      const currentGeoInfo = this.getGeoInfo(ip);

      const suspiciousSessions = activeSessions.filter(session => {
        const sessionGeoInfo = session.deviceInfo;

        // 检查国家是否不同
        if (
          sessionGeoInfo.country &&
          currentGeoInfo.country &&
          sessionGeoInfo.country !== currentGeoInfo.country
        ) {
          return true;
        }

        // 检查城市是否不同（如果IP解析成功）
        if (
          sessionGeoInfo.city &&
          currentGeoInfo.city &&
          sessionGeoInfo.city !== currentGeoInfo.city
        ) {
          return true;
        }

        return false;
      });

      return {
        isSuspicious: suspiciousSessions.length > 0,
        suspiciousSessions,
        currentLocation: currentGeoInfo,
      };
    } catch (error) {
      console.error('Detect suspicious login error:', error);
      return {
        isSuspicious: false,
        suspiciousSessions: [],
        currentLocation: this.getGeoInfo(ip),
      };
    }
  }

  /**
   * 更新会话超时时间
   * @param {string} sessionId - 会话ID
   * @param {number} timeoutMinutes - 超时时间（分钟）
   * @returns {Promise<boolean>} 更新结果
   */
  async updateSessionTimeout(sessionId, timeoutMinutes) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      session.expiresAt = Date.now() + timeoutMinutes * 60 * 1000;
      await this.storeSession(session);

      return true;
    } catch (error) {
      console.error('Update session timeout error:', error);
      return false;
    }
  }

  /**
   * 获取会话统计信息
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 统计信息
   */
  async getSessionStats(userId) {
    try {
      const activeSessions = await this.getActiveSessions(userId);

      const stats = {
        totalActive: activeSessions.length,
        maxAllowed: this.maxConcurrentSessions,
        locations: [],
        devices: [],
      };

      // 统计地理位置
      const locationMap = new Map();
      activeSessions.forEach(session => {
        const location = `${session.deviceInfo.city || 'Unknown'}, ${session.deviceInfo.country || 'Unknown'}`;
        locationMap.set(location, (locationMap.get(location) || 0) + 1);
      });
      stats.locations = Array.from(locationMap.entries()).map(([location, count]) => ({
        location,
        count,
      }));

      // 统计设备类型
      const deviceMap = new Map();
      activeSessions.forEach(session => {
        const device = session.deviceInfo.platform || 'Unknown';
        deviceMap.set(device, (deviceMap.get(device) || 0) + 1);
      });
      stats.devices = Array.from(deviceMap.entries()).map(([device, count]) => ({ device, count }));

      return stats;
    } catch (error) {
      console.error('Get session stats error:', error);
      return {
        totalActive: 0,
        maxAllowed: this.maxConcurrentSessions,
        locations: [],
        devices: [],
      };
    }
  }

  /**
   * 存储会话到Redis
   * @param {Object} session - 会话对象
   */
  async storeSession(session) {
    if (this.redisClient) {
      const key = `session:${session.sessionId}`;
      const ttl = Math.ceil((session.expiresAt - Date.now()) / 1000);
      await this.redisClient.setEx(key, ttl, JSON.stringify(session));
    }
  }

  /**
   * 从Redis获取会话
   * @param {string} sessionId - 会话ID
   * @returns {Promise<Object|null>} 会话对象
   */
  async getSession(sessionId) {
    if (this.redisClient) {
      const key = `session:${sessionId}`;
      const data = await this.redisClient.get(key);
      return data ? JSON.parse(data) : null;
    }
    return null;
  }

  /**
   * 从Redis删除会话
   * @param {string} sessionId - 会话ID
   */
  async removeSession(sessionId) {
    if (this.redisClient) {
      const key = `session:${sessionId}`;
      await this.redisClient.del(key);
    }
  }

  /**
   * 添加会话到用户活跃会话列表
   * @param {string} userId - 用户ID
   * @param {string} sessionId - 会话ID
   */
  async addToUserSessions(userId, sessionId) {
    if (this.redisClient) {
      const key = `user_sessions:${userId}`;
      await this.redisClient.sAdd(key, sessionId);
      // 设置过期时间（7天）
      await this.redisClient.expire(key, 7 * 24 * 60 * 60);
    }
  }

  /**
   * 从用户活跃会话列表移除会话
   * @param {string} userId - 用户ID
   * @param {string} sessionId - 会话ID
   */
  async removeFromUserSessions(userId, sessionId) {
    if (this.redisClient) {
      const key = `user_sessions:${userId}`;
      await this.redisClient.sRem(key, sessionId);
    }
  }

  /**
   * 更新最后活动时间
   * @param {string} sessionId - 会话ID
   */
  async updateLastActivity(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      if (session) {
        session.lastActivity = Date.now();
        await this.storeSession(session);
      }
    } catch (error) {
      console.error('Update last activity error:', error);
    }
  }

  /**
   * 获取地理位置信息
   * @param {string} ip - IP地址
   * @returns {Object} 地理位置信息
   */
  getGeoInfo(ip) {
    try {
      if (!ip || ip === 'unknown' || ip === '127.0.0.1') {
        return {
          country: 'Unknown',
          region: 'Unknown',
          city: 'Unknown',
          timezone: 'Unknown',
        };
      }

      const geo = geoip.lookup(ip);
      if (!geo) {
        return {
          country: 'Unknown',
          region: 'Unknown',
          city: 'Unknown',
          timezone: 'Unknown',
        };
      }

      return {
        country: geo.country || 'Unknown',
        region: geo.region || 'Unknown',
        city: geo.city || 'Unknown',
        timezone: geo.timezone || 'Unknown',
        ll: geo.ll || [0, 0],
      };
    } catch (error) {
      console.error('Get geo info error:', error);
      return {
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        timezone: 'Unknown',
      };
    }
  }

  /**
   * 清理过期会话
   * @returns {Promise<number>} 清理的会话数量
   */
  async cleanupExpiredSessions() {
    try {
      if (!this.redisClient) {
        return 0;
      }

      // 这里应该实现定期清理逻辑
      // 由于Redis会自动过期，主要清理用户会话列表中的无效引用
      let cleanedCount = 0;

      // 获取所有用户会话列表
      const userKeys = await this.redisClient.keys('user_sessions:*');

      for (const userKey of userKeys) {
        const userId = userKey.split(':')[1];
        const sessionIds = await this.redisClient.sMembers(userKey);

        for (const sessionId of sessionIds) {
          const session = await this.getSession(sessionId);
          if (!session || !session.isActive || Date.now() > session.expiresAt) {
            await this.removeFromUserSessions(userId, sessionId);
            cleanedCount++;
          }
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error('Cleanup expired sessions error:', error);
      return 0;
    }
  }

  /**
   * 关闭Redis连接
   */
  async close() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

module.exports = SessionService;

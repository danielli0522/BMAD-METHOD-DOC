/**
 * 安全防护服务
 * 实现登录失败计数、锁定机制、IP白名单/黑名单、异常登录检测等功能
 */

const redis = require('redis');
const crypto = require('crypto');

class SecurityService {
  constructor() {
    this.redisClient = null;
    this.maxLoginAttempts = 5; // 最大登录尝试次数
    this.lockoutDuration = 15 * 60; // 锁定时间（秒）
    this.progressiveDelay = true; // 启用渐进式延迟
    this.maxDelaySeconds = 300; // 最大延迟时间（秒）
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
   * 记录登录尝试
   * @param {string} identifier - 标识符（邮箱或IP）
   * @param {boolean} success - 是否成功
   * @param {string} type - 类型（email/ip）
   * @returns {Promise<Object>} 登录尝试结果
   */
  async recordLoginAttempt(identifier, success, type = 'email') {
    try {
      const key = `login_attempts:${type}:${identifier}`;
      const lockoutKey = `lockout:${type}:${identifier}`;

      if (success) {
        // 登录成功，清除失败记录
        await this.clearLoginAttempts(identifier, type);
        return {
          allowed: true,
          remainingAttempts: this.maxLoginAttempts,
          lockoutUntil: null,
        };
      } else {
        // 登录失败，增加失败计数
        const attempts = await this.getLoginAttempts(identifier, type);
        const newAttempts = attempts + 1;

        // 存储新的尝试次数
        await this.storeLoginAttempts(identifier, type, newAttempts);

        // 检查是否需要锁定
        if (newAttempts >= this.maxLoginAttempts) {
          const lockoutUntil = Date.now() + this.lockoutDuration * 1000;
          await this.setLockout(identifier, type, lockoutUntil);

          return {
            allowed: false,
            remainingAttempts: 0,
            lockoutUntil: new Date(lockoutUntil),
            reason: 'Account locked due to too many failed attempts',
          };
        }

        return {
          allowed: true,
          remainingAttempts: this.maxLoginAttempts - newAttempts,
          lockoutUntil: null,
        };
      }
    } catch (error) {
      console.error('Record login attempt error:', error);
      return {
        allowed: true,
        remainingAttempts: this.maxLoginAttempts,
        lockoutUntil: null,
      };
    }
  }

  /**
   * 检查是否允许登录
   * @param {string} identifier - 标识符（邮箱或IP）
   * @param {string} type - 类型（email/ip）
   * @returns {Promise<Object>} 检查结果
   */
  async checkLoginAllowed(identifier, type = 'email') {
    try {
      const lockoutKey = `lockout:${type}:${identifier}`;

      // 检查是否被锁定
      if (this.redisClient) {
        const lockoutUntil = await this.redisClient.get(lockoutKey);
        if (lockoutUntil) {
          const lockoutTime = parseInt(lockoutUntil);
          if (Date.now() < lockoutTime) {
            return {
              allowed: false,
              remainingAttempts: 0,
              lockoutUntil: new Date(lockoutTime),
              reason: 'Account is currently locked',
            };
          } else {
            // 锁定时间已过，清除锁定
            await this.clearLockout(identifier, type);
          }
        }
      }

      // 获取剩余尝试次数
      const attempts = await this.getLoginAttempts(identifier, type);
      const remainingAttempts = Math.max(0, this.maxLoginAttempts - attempts);

      return {
        allowed: true,
        remainingAttempts,
        lockoutUntil: null,
      };
    } catch (error) {
      console.error('Check login allowed error:', error);
      return {
        allowed: true,
        remainingAttempts: this.maxLoginAttempts,
        lockoutUntil: null,
      };
    }
  }

  /**
   * 获取登录尝试次数
   * @param {string} identifier - 标识符
   * @param {string} type - 类型
   * @returns {Promise<number>} 尝试次数
   */
  async getLoginAttempts(identifier, type = 'email') {
    try {
      if (this.redisClient) {
        const key = `login_attempts:${type}:${identifier}`;
        const attempts = await this.redisClient.get(key);
        return attempts ? parseInt(attempts) : 0;
      }
      return 0;
    } catch (error) {
      console.error('Get login attempts error:', error);
      return 0;
    }
  }

  /**
   * 存储登录尝试次数
   * @param {string} identifier - 标识符
   * @param {string} type - 类型
   * @param {number} attempts - 尝试次数
   */
  async storeLoginAttempts(identifier, type = 'email', attempts) {
    try {
      if (this.redisClient) {
        const key = `login_attempts:${type}:${identifier}`;
        // 设置24小时过期
        await this.redisClient.setEx(key, 24 * 60 * 60, attempts.toString());
      }
    } catch (error) {
      console.error('Store login attempts error:', error);
    }
  }

  /**
   * 清除登录尝试记录
   * @param {string} identifier - 标识符
   * @param {string} type - 类型
   */
  async clearLoginAttempts(identifier, type = 'email') {
    try {
      if (this.redisClient) {
        const key = `login_attempts:${type}:${identifier}`;
        await this.redisClient.del(key);
      }
    } catch (error) {
      console.error('Clear login attempts error:', error);
    }
  }

  /**
   * 设置锁定
   * @param {string} identifier - 标识符
   * @param {string} type - 类型
   * @param {number} lockoutUntil - 锁定到期时间
   */
  async setLockout(identifier, type = 'email', lockoutUntil) {
    try {
      if (this.redisClient) {
        const key = `lockout:${type}:${identifier}`;
        const ttl = Math.ceil((lockoutUntil - Date.now()) / 1000);
        await this.redisClient.setEx(key, ttl, lockoutUntil.toString());
      }
    } catch (error) {
      console.error('Set lockout error:', error);
    }
  }

  /**
   * 清除锁定
   * @param {string} identifier - 标识符
   * @param {string} type - 类型
   */
  async clearLockout(identifier, type = 'email') {
    try {
      if (this.redisClient) {
        const key = `lockout:${type}:${identifier}`;
        await this.redisClient.del(key);
      }
    } catch (error) {
      console.error('Clear lockout error:', error);
    }
  }

  /**
   * 检查IP白名单/黑名单
   * @param {string} ip - IP地址
   * @returns {Promise<Object>} 检查结果
   */
  async checkIPList(ip) {
    try {
      if (!this.redisClient) {
        return { allowed: true, reason: null };
      }

      // 检查黑名单
      const blacklistKey = `ip_blacklist:${ip}`;
      const isBlacklisted = await this.redisClient.get(blacklistKey);
      if (isBlacklisted) {
        return {
          allowed: false,
          reason: 'IP is blacklisted',
        };
      }

      // 检查白名单
      const whitelistKey = `ip_whitelist:${ip}`;
      const isWhitelisted = await this.redisClient.get(whitelistKey);
      if (isWhitelisted) {
        return {
          allowed: true,
          reason: 'IP is whitelisted',
        };
      }

      return { allowed: true, reason: null };
    } catch (error) {
      console.error('Check IP list error:', error);
      return { allowed: true, reason: null };
    }
  }

  /**
   * 添加IP到黑名单
   * @param {string} ip - IP地址
   * @param {number} duration - 持续时间（秒）
   * @param {string} reason - 原因
   */
  async addToBlacklist(ip, duration = 24 * 60 * 60, reason = 'Security violation') {
    try {
      if (this.redisClient) {
        const key = `ip_blacklist:${ip}`;
        const data = JSON.stringify({
          reason,
          addedAt: Date.now(),
          expiresAt: Date.now() + duration * 1000,
        });
        await this.redisClient.setEx(key, duration, data);
      }
    } catch (error) {
      console.error('Add to blacklist error:', error);
    }
  }

  /**
   * 从黑名单移除IP
   * @param {string} ip - IP地址
   */
  async removeFromBlacklist(ip) {
    try {
      if (this.redisClient) {
        const key = `ip_blacklist:${ip}`;
        await this.redisClient.del(key);
      }
    } catch (error) {
      console.error('Remove from blacklist error:', error);
    }
  }

  /**
   * 添加IP到白名单
   * @param {string} ip - IP地址
   * @param {string} reason - 原因
   */
  async addToWhitelist(ip, reason = 'Trusted IP') {
    try {
      if (this.redisClient) {
        const key = `ip_whitelist:${ip}`;
        const data = JSON.stringify({
          reason,
          addedAt: Date.now(),
        });
        // 白名单永不过期
        await this.redisClient.set(key, data);
      }
    } catch (error) {
      console.error('Add to whitelist error:', error);
    }
  }

  /**
   * 从白名单移除IP
   * @param {string} ip - IP地址
   */
  async removeFromWhitelist(ip) {
    try {
      if (this.redisClient) {
        const key = `ip_whitelist:${ip}`;
        await this.redisClient.del(key);
      }
    } catch (error) {
      console.error('Remove from whitelist error:', error);
    }
  }

  /**
   * 检测异常登录
   * @param {string} userId - 用户ID
   * @param {string} ip - IP地址
   * @param {Object} deviceInfo - 设备信息
   * @returns {Promise<Object>} 检测结果
   */
  async detectAnomalousLogin(userId, ip, deviceInfo) {
    try {
      const anomalies = [];
      let riskScore = 0;

      // 检查IP地址异常
      const ipAnomaly = await this.checkIPAnomaly(userId, ip);
      if (ipAnomaly.isAnomalous) {
        anomalies.push(ipAnomaly);
        riskScore += ipAnomaly.riskScore;
      }

      // 检查时间异常
      const timeAnomaly = this.checkTimeAnomaly();
      if (timeAnomaly.isAnomalous) {
        anomalies.push(timeAnomaly);
        riskScore += timeAnomaly.riskScore;
      }

      // 检查设备异常
      const deviceAnomaly = await this.checkDeviceAnomaly(userId, deviceInfo);
      if (deviceAnomaly.isAnomalous) {
        anomalies.push(deviceAnomaly);
        riskScore += deviceAnomaly.riskScore;
      }

      // 检查行为模式异常
      const behaviorAnomaly = await this.checkBehaviorAnomaly(userId);
      if (behaviorAnomaly.isAnomalous) {
        anomalies.push(behaviorAnomaly);
        riskScore += behaviorAnomaly.riskScore;
      }

      const isAnomalous = anomalies.length > 0;
      const riskLevel = this.calculateRiskLevel(riskScore);

      return {
        isAnomalous,
        riskScore,
        riskLevel,
        anomalies,
        recommendations: this.getSecurityRecommendations(anomalies),
      };
    } catch (error) {
      console.error('Detect anomalous login error:', error);
      return {
        isAnomalous: false,
        riskScore: 0,
        riskLevel: 'low',
        anomalies: [],
        recommendations: [],
      };
    }
  }

  /**
   * 检查IP地址异常
   * @param {string} userId - 用户ID
   * @param {string} ip - IP地址
   * @returns {Promise<Object>} 检查结果
   */
  async checkIPAnomaly(userId, ip) {
    try {
      // 这里应该从数据库获取用户历史登录IP
      // 暂时使用模拟数据
      const knownIPs = ['192.168.1.100', '10.0.0.50'];
      const isKnownIP = knownIPs.includes(ip);

      if (!isKnownIP) {
        return {
          type: 'ip_anomaly',
          isAnomalous: true,
          riskScore: 30,
          description: 'Login from unknown IP address',
          details: {
            currentIP: ip,
            knownIPs,
          },
        };
      }

      return {
        type: 'ip_anomaly',
        isAnomalous: false,
        riskScore: 0,
        description: null,
        details: null,
      };
    } catch (error) {
      console.error('Check IP anomaly error:', error);
      return {
        type: 'ip_anomaly',
        isAnomalous: false,
        riskScore: 0,
        description: null,
        details: null,
      };
    }
  }

  /**
   * 检查时间异常
   * @returns {Object} 检查结果
   */
  checkTimeAnomaly() {
    try {
      const now = new Date();
      const hour = now.getHours();

      // 检查是否在异常时间登录（凌晨2点到6点）
      if (hour >= 2 && hour <= 6) {
        return {
          type: 'time_anomaly',
          isAnomalous: true,
          riskScore: 20,
          description: 'Login during unusual hours',
          details: {
            currentTime: now.toISOString(),
            hour,
          },
        };
      }

      return {
        type: 'time_anomaly',
        isAnomalous: false,
        riskScore: 0,
        description: null,
        details: null,
      };
    } catch (error) {
      console.error('Check time anomaly error:', error);
      return {
        type: 'time_anomaly',
        isAnomalous: false,
        riskScore: 0,
        description: null,
        details: null,
      };
    }
  }

  /**
   * 检查设备异常
   * @param {string} userId - 用户ID
   * @param {Object} deviceInfo - 设备信息
   * @returns {Promise<Object>} 检查结果
   */
  async checkDeviceAnomaly(userId, deviceInfo) {
    try {
      // 这里应该从数据库获取用户历史设备信息
      // 暂时使用模拟数据
      const knownDevices = [
        { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Windows' },
        { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacOS' },
      ];

      const isKnownDevice = knownDevices.some(
        device =>
          device.userAgent === deviceInfo.userAgent || device.platform === deviceInfo.platform
      );

      if (!isKnownDevice) {
        return {
          type: 'device_anomaly',
          isAnomalous: true,
          riskScore: 25,
          description: 'Login from unknown device',
          details: {
            currentDevice: deviceInfo,
            knownDevices,
          },
        };
      }

      return {
        type: 'device_anomaly',
        isAnomalous: false,
        riskScore: 0,
        description: null,
        details: null,
      };
    } catch (error) {
      console.error('Check device anomaly error:', error);
      return {
        type: 'device_anomaly',
        isAnomalous: false,
        riskScore: 0,
        description: null,
        details: null,
      };
    }
  }

  /**
   * 检查行为模式异常
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 检查结果
   */
  async checkBehaviorAnomaly(userId) {
    try {
      // 这里应该分析用户的历史行为模式
      // 暂时返回无异常
      return {
        type: 'behavior_anomaly',
        isAnomalous: false,
        riskScore: 0,
        description: null,
        details: null,
      };
    } catch (error) {
      console.error('Check behavior anomaly error:', error);
      return {
        type: 'behavior_anomaly',
        isAnomalous: false,
        riskScore: 0,
        description: null,
        details: null,
      };
    }
  }

  /**
   * 计算风险等级
   * @param {number} riskScore - 风险分数
   * @returns {string} 风险等级
   */
  calculateRiskLevel(riskScore) {
    if (riskScore >= 70) return 'high';
    if (riskScore >= 40) return 'medium';
    return 'low';
  }

  /**
   * 获取安全建议
   * @param {Array} anomalies - 异常列表
   * @returns {Array} 建议列表
   */
  getSecurityRecommendations(anomalies) {
    const recommendations = [];

    anomalies.forEach(anomaly => {
      switch (anomaly.type) {
        case 'ip_anomaly':
          recommendations.push('启用双因素认证以增强账户安全');
          recommendations.push('检查账户活动，确认是否为本人操作');
          break;
        case 'time_anomaly':
          recommendations.push('如果非本人操作，请立即修改密码');
          break;
        case 'device_anomaly':
          recommendations.push('检查设备列表，移除未知设备');
          recommendations.push('考虑启用设备验证');
          break;
        case 'behavior_anomaly':
          recommendations.push('检查账户活动历史');
          break;
      }
    });

    if (anomalies.length > 0) {
      recommendations.push('如有疑问，请联系客服');
    }

    return recommendations;
  }

  /**
   * 生成验证码
   * @param {string} identifier - 标识符
   * @returns {string} 验证码
   */
  generateCaptcha(identifier) {
    try {
      // 生成6位数字验证码
      const captcha = Math.floor(100000 + Math.random() * 900000).toString();

      // 存储验证码（这里应该存储到Redis）
      console.log(`[CAPTCHA] Generated for ${identifier}: ${captcha}`);

      return captcha;
    } catch (error) {
      console.error('Generate captcha error:', error);
      return '123456'; // 默认验证码
    }
  }

  /**
   * 验证验证码
   * @param {string} identifier - 标识符
   * @param {string} captcha - 验证码
   * @returns {boolean} 验证结果
   */
  async verifyCaptcha(identifier, captcha) {
    try {
      // 这里应该从Redis验证验证码
      // 暂时返回true
      return true;
    } catch (error) {
      console.error('Verify captcha error:', error);
      return false;
    }
  }

  /**
   * 计算渐进式延迟时间
   * @param {string} identifier - 标识符
   * @param {string} type - 类型
   * @returns {Promise<number>} 延迟时间（秒）
   */
  async calculateProgressiveDelay(identifier, type = 'email') {
    try {
      if (!this.progressiveDelay) {
        return 0;
      }

      const attempts = await this.getLoginAttempts(identifier, type);
      if (attempts <= 1) {
        return 0;
      }

      // 指数退避算法：2^(attempts-1) 秒，最大300秒
      const delay = Math.min(Math.pow(2, attempts - 1), this.maxDelaySeconds);
      return delay;
    } catch (error) {
      console.error('Calculate progressive delay error:', error);
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

module.exports = SecurityService;

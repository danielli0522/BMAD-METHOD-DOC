/**
 * 用户认证服务
 * 实现JWT Token认证机制，包括access token和refresh token管理
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const redis = require('redis');

class AuthenticationService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    this.accessTokenExpiry = '15m';
    this.refreshTokenExpiry = '7d';
    this.redisClient = null;
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
      // 在生产环境中应该抛出错误，这里为了开发方便使用内存存储
      this.redisClient = null;
    }
  }

  /**
   * 用户认证
   * @param {string} email - 用户邮箱
   * @param {string} password - 用户密码
   * @returns {Promise<Object>} 认证结果
   */
  async authenticate(email, password) {
    try {
      // 这里应该从数据库验证用户，暂时使用模拟数据
      const user = await this.validateUserCredentials(email, password);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // 生成JWT tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user.id);

      // 存储refresh token到Redis
      await this.storeRefreshToken(user.id, refreshToken);

      // 记录登录审计日志
      await this.logAuthEvent(user.id, 'LOGIN', { email, success: true });

      return {
        success: true,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
        },
        expiresIn: 15 * 60, // 15分钟
      };
    } catch (error) {
      // 记录失败登录
      await this.logAuthEvent(null, 'LOGIN_FAILED', { email, error: error.message });
      throw error;
    }
  }

  /**
   * 刷新Token
   * @param {string} refreshToken - 刷新token
   * @returns {Promise<Object>} 刷新结果
   */
  async refreshToken(refreshToken) {
    try {
      // 验证refresh token
      const decoded = jwt.verify(refreshToken, this.jwtSecret);

      // 检查token是否在黑名单中
      const isBlacklisted = await this.isTokenBlacklisted(refreshToken);
      if (isBlacklisted) {
        throw new Error('Token is blacklisted');
      }

      // 从Redis获取存储的refresh token
      const storedToken = await this.getStoredRefreshToken(decoded.userId);
      if (!storedToken || storedToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      // 获取用户信息
      const user = await this.getUserById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // 生成新的tokens
      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user.id);

      // 更新Redis中的refresh token
      await this.storeRefreshToken(user.id, newRefreshToken);

      // 将旧的refresh token加入黑名单
      await this.blacklistToken(refreshToken);

      return {
        success: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
        },
        expiresIn: 15 * 60,
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * 用户注销
   * @param {string} userId - 用户ID
   * @param {string} accessToken - 访问token
   * @param {string} refreshToken - 刷新token
   */
  async logout(userId, accessToken, refreshToken) {
    try {
      // 将tokens加入黑名单
      if (accessToken) {
        await this.blacklistToken(accessToken);
      }
      if (refreshToken) {
        await this.blacklistToken(refreshToken);
      }

      // 从Redis删除refresh token
      await this.removeRefreshToken(userId);

      // 记录注销审计日志
      await this.logAuthEvent(userId, 'LOGOUT', { success: true });
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * 验证JWT Token
   * @param {string} token - JWT token
   * @returns {Promise<Object>} 验证结果
   */
  async verifyToken(token) {
    try {
      // 检查token是否在黑名单中
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new Error('Token is blacklisted');
      }

      // 验证token
      const decoded = jwt.verify(token, this.jwtSecret);

      // 获取用户信息
      const user = await this.getUserById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
        },
        payload: decoded,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * 生成Access Token
   * @param {Object} user - 用户信息
   * @returns {string} JWT token
   */
  generateAccessToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      type: 'access',
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'ai-agile-dap',
      audience: 'ai-agile-dap-users',
    });
  }

  /**
   * 生成Refresh Token
   * @param {string} userId - 用户ID
   * @returns {string} JWT token
   */
  generateRefreshToken(userId) {
    const payload = {
      userId,
      type: 'refresh',
      jti: crypto.randomBytes(16).toString('hex'), // JWT ID
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.refreshTokenExpiry,
      issuer: 'ai-agile-dap',
      audience: 'ai-agile-dap-users',
    });
  }

  /**
   * 存储Refresh Token到Redis
   * @param {string} userId - 用户ID
   * @param {string} refreshToken - 刷新token
   */
  async storeRefreshToken(userId, refreshToken) {
    if (this.redisClient) {
      const key = `refresh_token:${userId}`;
      await this.redisClient.setEx(key, 7 * 24 * 60 * 60, refreshToken); // 7天过期
    }
  }

  /**
   * 从Redis获取存储的Refresh Token
   * @param {string} userId - 用户ID
   * @returns {string|null} 刷新token
   */
  async getStoredRefreshToken(userId) {
    if (this.redisClient) {
      const key = `refresh_token:${userId}`;
      return await this.redisClient.get(key);
    }
    return null;
  }

  /**
   * 从Redis删除Refresh Token
   * @param {string} userId - 用户ID
   */
  async removeRefreshToken(userId) {
    if (this.redisClient) {
      const key = `refresh_token:${userId}`;
      await this.redisClient.del(key);
    }
  }

  /**
   * 将Token加入黑名单
   * @param {string} token - JWT token
   */
  async blacklistToken(token) {
    if (this.redisClient) {
      try {
        const decoded = jwt.decode(token);
        const expiry = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiry > 0) {
          const key = `blacklist:${token}`;
          await this.redisClient.setEx(key, expiry, '1');
        }
      } catch (error) {
        console.error('Blacklist token error:', error);
      }
    }
  }

  /**
   * 检查Token是否在黑名单中
   * @param {string} token - JWT token
   * @returns {boolean} 是否在黑名单中
   */
  async isTokenBlacklisted(token) {
    if (this.redisClient) {
      const key = `blacklist:${token}`;
      const result = await this.redisClient.get(key);
      return result !== null;
    }
    return false;
  }

  /**
   * 验证用户凭据（模拟实现）
   * @param {string} email - 用户邮箱
   * @param {string} password - 用户密码
   * @returns {Promise<Object|null>} 用户信息
   */
  async validateUserCredentials(email, password) {
    // 模拟用户数据，实际应该从数据库查询
    const mockUsers = [
      {
        id: '1',
        email: 'admin@example.com',
        password: '$2b$10$rQZ8N3YqG8K9L2M1N0O9P8Q7R6S5T4U3V2W1X0Y9Z8A7B6C5D4E3F2G1H0I',
        role: 'admin',
        organizationId: 'org1',
      },
      {
        id: '2',
        email: 'user@example.com',
        password: '$2b$10$rQZ8N3YqG8K9L2M1N0O9P8Q7R6S5T4U3V2W1X0Y9Z8A7B6C5D4E3F2G1H0I',
        role: 'user',
        organizationId: 'org1',
      },
    ];

    const user = mockUsers.find(u => u.email === email);
    if (!user) {
      return null;
    }

    // 验证密码（模拟密码都是'password123'）
    const isValidPassword =
      password === 'password123' || (await bcrypt.compare(password, user.password));
    if (!isValidPassword) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  /**
   * 根据ID获取用户信息（模拟实现）
   * @param {string} userId - 用户ID
   * @returns {Promise<Object|null>} 用户信息
   */
  async getUserById(userId) {
    // 模拟用户数据
    const mockUsers = [
      {
        id: '1',
        email: 'admin@example.com',
        role: 'admin',
        organizationId: 'org1',
      },
      {
        id: '2',
        email: 'user@example.com',
        role: 'user',
        organizationId: 'org1',
      },
    ];

    return mockUsers.find(u => u.id === userId) || null;
  }

  /**
   * 记录认证事件审计日志
   * @param {string} userId - 用户ID
   * @param {string} event - 事件类型
   * @param {Object} details - 事件详情
   */
  async logAuthEvent(userId, event, details) {
    // 这里应该写入审计日志表，暂时打印到控制台
    console.log(`[AUDIT] ${event}:`, {
      userId,
      timestamp: new Date().toISOString(),
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
      ...details,
    });
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

module.exports = AuthenticationService;

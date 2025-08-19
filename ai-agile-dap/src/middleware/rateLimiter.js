/**
 * 速率限制中间件 - 修复SEC-001安全问题
 * 防止API滥用和DoS攻击
 */

const redis = require('redis');

class RateLimiter {
  constructor(options = {}) {
    this.redisClient = null;
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15分钟
    this.max = options.max || 1000; // 每个窗口最大请求数
    this.keyGenerator = options.keyGenerator || this.defaultKeyGenerator;
    this.skipSuccessfulRequests = options.skipSuccessfulRequests || false;
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
      console.log('Redis connected for rate limiting');
    } catch (error) {
      console.error('Rate limiter Redis connection failed:', error);
      this.redisClient = null;
    }
  }

  /**
   * 默认键生成器 - 基于IP地址
   */
  defaultKeyGenerator(req) {
    return `rate_limit:${req.ip || req.connection.remoteAddress}`;
  }

  /**
   * 创建速率限制中间件
   */
  createMiddleware(options = {}) {
    const config = {
      windowMs: options.windowMs || this.windowMs,
      max: options.max || this.max,
      keyGenerator: options.keyGenerator || this.keyGenerator,
      message: options.message || {
        error: 'RATE_LIMIT_EXCEEDED',
        message: '请求过于频繁，请稍后再试',
        retryAfter: Math.ceil((options.windowMs || this.windowMs) / 1000)
      }
    };

    return async (req, res, next) => {
      try {
        // 如果Redis不可用，允许请求通过（graceful degradation）
        if (!this.redisClient) {
          return next();
        }

        const key = config.keyGenerator(req);
        const windowStart = Date.now() - config.windowMs;
        
        // 获取当前窗口内的请求计数
        const current = await this.getRequestCount(key, windowStart);
        
        // 检查是否超过限制
        if (current >= config.max) {
          const resetTime = new Date(Date.now() + config.windowMs);
          
          res.set({
            'X-RateLimit-Limit': config.max,
            'X-RateLimit-Remaining': 0,
            'X-RateLimit-Reset': resetTime,
            'Retry-After': Math.ceil(config.windowMs / 1000)
          });
          
          return res.status(429).json(config.message);
        }

        // 记录此次请求
        await this.recordRequest(key, config.windowMs);
        
        // 设置响应头
        res.set({
          'X-RateLimit-Limit': config.max,
          'X-RateLimit-Remaining': Math.max(0, config.max - current - 1),
          'X-RateLimit-Reset': new Date(Date.now() + config.windowMs)
        });
        
        next();
      } catch (error) {
        console.error('Rate limiter error:', error);
        // 出错时允许请求通过
        next();
      }
    };
  }

  /**
   * 获取请求计数
   */
  async getRequestCount(key, windowStart) {
    try {
      if (!this.redisClient) return 0;
      
      // 清理过期的请求记录
      await this.redisClient.zRemRangeByScore(key, '-inf', windowStart);
      
      // 获取当前窗口内的请求数
      return await this.redisClient.zCard(key);
    } catch (error) {
      console.error('Get request count failed:', error);
      return 0;
    }
  }

  /**
   * 记录请求
   */
  async recordRequest(key, windowMs) {
    try {
      if (!this.redisClient) return;
      
      const now = Date.now();
      const uniqueId = `${now}-${Math.random()}`;
      
      // 添加当前请求到有序集合
      await this.redisClient.zAdd(key, {
        score: now,
        value: uniqueId
      });
      
      // 设置键的过期时间
      await this.redisClient.expire(key, Math.ceil(windowMs / 1000));
    } catch (error) {
      console.error('Record request failed:', error);
    }
  }

  /**
   * 为用户认证请求创建特殊限制器
   */
  createAuthLimiter() {
    return this.createMiddleware({
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 10, // 更严格的限制
      keyGenerator: (req) => `auth_limit:${req.ip}`,
      message: {
        error: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: '认证请求过于频繁，请15分钟后再试',
        retryAfter: 900
      }
    });
  }

  /**
   * 为权限检查API创建限制器
   */
  createPermissionLimiter() {
    return this.createMiddleware({
      windowMs: 1 * 60 * 1000, // 1分钟
      max: 500, // 500次权限检查每分钟
      keyGenerator: (req) => `perm_limit:${req.user?.id || req.ip}`,
      message: {
        error: 'PERMISSION_RATE_LIMIT_EXCEEDED',
        message: '权限检查请求过于频繁，请稍后再试',
        retryAfter: 60
      }
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

// 创建默认实例
const rateLimiter = new RateLimiter();

module.exports = {
  RateLimiter,
  rateLimiter,
  
  // 便捷方法
  createGeneralLimiter: (options) => rateLimiter.createMiddleware(options),
  createAuthLimiter: () => rateLimiter.createAuthLimiter(),
  createPermissionLimiter: () => rateLimiter.createPermissionLimiter()
};
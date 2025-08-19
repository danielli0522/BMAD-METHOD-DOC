/**
 * PermissionPerformanceService - 权限系统性能优化服务
 * Task 7: 实现性能优化和缓存机制
 * 提供权限预加载、批量缓存、性能监控等功能
 */

const Redis = require('ioredis');
const { EventEmitter } = require('events');

/**
 * 权限性能优化和缓存服务
 * 负责权限缓存策略、性能监控、查询优化、缓存预热等功能
 */
class PermissionPerformanceService extends EventEmitter {
  constructor() {
    super();
    this.redis = null;
    this.isInitialized = false;
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      slowQueries: [],
    };
    this.cacheConfig = {
      defaultTTL: 300, // 5分钟
      userPermissionsTTL: 600, // 10分钟
      rolePermissionsTTL: 1800, // 30分钟
      maxCacheSize: 10000,
      enableWarming: true,
      warmingInterval: 300000, // 5分钟
    };
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });

      // 启动性能监控
      this.startPerformanceMonitoring();

      // 启动缓存预热
      if (this.cacheConfig.enableWarming) {
        this.startCacheWarming();
      }

      this.isInitialized = true;
      console.log('PermissionPerformanceService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PermissionPerformanceService:', error);
      throw error;
    }
  }

  /**
   * 实现权限缓存策略
   * @param {string} userId 用户ID
   * @param {string} resource 资源类型
   * @param {string} action 操作类型
   * @param {Object} context 上下文
   * @returns {Promise<Object>} 缓存结果
   */
  async getCachedPermission(userId, resource, action, context = {}) {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(userId, resource, action, context);

    try {
      // 尝试从缓存获取
      const cachedResult = await this.redis.get(cacheKey);

      if (cachedResult) {
        this.recordCacheHit();
        this.recordMetric('cache_hit', Date.now() - startTime);

        return {
          cached: true,
          result: JSON.parse(cachedResult),
          source: 'cache',
          responseTime: Date.now() - startTime,
        };
      }

      this.recordCacheMiss();
      return {
        cached: false,
        cacheKey,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Failed to get cached permission:', error);
      this.recordMetric('cache_error', Date.now() - startTime);
      return {
        cached: false,
        error: error.message,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 缓存权限检查结果
   * @param {string} userId 用户ID
   * @param {string} resource 资源类型
   * @param {string} action 操作类型
   * @param {Object} context 上下文
   * @param {boolean} hasPermission 权限检查结果
   * @param {number} ttl 缓存时间
   * @returns {Promise<boolean>} 缓存结果
   */
  async cachePermissionResult(userId, resource, action, context, hasPermission, ttl = null) {
    try {
      const cacheKey = this.generateCacheKey(userId, resource, action, context);
      const cacheValue = {
        hasPermission,
        userId,
        resource,
        action,
        context,
        cachedAt: new Date().toISOString(),
      };

      const cacheTTL = ttl || this.getCacheTTL(resource, action);
      await this.redis.setex(cacheKey, cacheTTL, JSON.stringify(cacheValue));

      this.emit('permission_cached', {
        cacheKey,
        hasPermission,
        ttl: cacheTTL,
      });

      return true;
    } catch (error) {
      console.error('Failed to cache permission result:', error);
      return false;
    }
  }

  /**
   * 获取缓存TTL
   * @param {string} resource 资源类型
   * @param {string} action 操作类型
   * @returns {number} TTL秒数
   */
  getCacheTTL(resource, action) {
    // 根据资源和操作类型确定缓存时间
    if (resource === 'user' && action === 'read') {
      return this.cacheConfig.userPermissionsTTL;
    }

    if (resource === 'role' && action === 'read') {
      return this.cacheConfig.rolePermissionsTTL;
    }

    return this.cacheConfig.defaultTTL;
  }

  /**
   * 生成缓存键
   * @param {string} userId 用户ID
   * @param {string} resource 资源类型
   * @param {string} action 操作类型
   * @param {Object} context 上下文
   * @returns {string} 缓存键
   */
  generateCacheKey(userId, resource, action, context) {
    const contextHash = this.hashContext(context);
    return `perm:${userId}:${resource}:${action}:${contextHash}`;
  }

  /**
   * 哈希上下文对象
   * @param {Object} context 上下文对象
   * @returns {string} 哈希值
   */
  hashContext(context) {
    if (!context || Object.keys(context).length === 0) {
      return 'default';
    }

    // 简单的哈希算法，生产环境可以使用更安全的哈希
    const contextStr = JSON.stringify(context);
    let hash = 0;
    for (let i = 0; i < contextStr.length; i++) {
      const char = contextStr.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 添加权限检查性能监控
   * @param {string} operation 操作类型
   * @param {number} duration 执行时间
   * @param {Object} details 详细信息
   */
  recordMetric(operation, duration, details = {}) {
    this.metrics.totalRequests++;

    // 更新平均响应时间
    const totalTime =
      this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + duration;
    this.metrics.averageResponseTime = totalTime / this.metrics.totalRequests;

    // 记录慢查询
    if (duration > 100) {
      // 超过100ms的查询
      this.metrics.slowQueries.push({
        operation,
        duration,
        timestamp: new Date().toISOString(),
        details,
      });

      // 保持慢查询列表在合理大小
      if (this.metrics.slowQueries.length > 100) {
        this.metrics.slowQueries = this.metrics.slowQueries.slice(-50);
      }
    }

    // 发送性能事件
    this.emit('performance_metric', {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      details,
    });
  }

  /**
   * 记录缓存命中
   */
  recordCacheHit() {
    this.metrics.cacheHits++;
  }

  /**
   * 记录缓存未命中
   */
  recordCacheMiss() {
    this.metrics.cacheMisses++;
  }

  /**
   * 优化权限查询算法
   * @param {Array} permissions 权限列表
   * @param {Object} filters 过滤条件
   * @returns {Array} 优化后的权限列表
   */
  optimizePermissionQuery(permissions, filters = {}) {
    let optimizedPermissions = permissions;

    // 应用资源过滤
    if (filters.resource) {
      optimizedPermissions = optimizedPermissions.filter(
        perm => perm.resource === filters.resource
      );
    }

    // 应用操作过滤
    if (filters.action) {
      optimizedPermissions = optimizedPermissions.filter(perm => perm.action === filters.action);
    }

    // 应用条件过滤
    if (filters.conditions) {
      optimizedPermissions = optimizedPermissions.filter(perm =>
        this.evaluateConditions(perm.conditions, filters.conditions)
      );
    }

    // 去重优化
    const uniquePermissions = this.deduplicatePermissions(optimizedPermissions);

    return uniquePermissions;
  }

  /**
   * 评估条件
   * @param {Object} permissionConditions 权限条件
   * @param {Object} filterConditions 过滤条件
   * @returns {boolean} 是否匹配
   */
  evaluateConditions(permissionConditions, filterConditions) {
    if (!permissionConditions || !filterConditions) return true;

    // 时间条件评估
    if (filterConditions.timeRange && permissionConditions.timeLimit) {
      const now = new Date();
      const { startTime, endTime } = permissionConditions.timeLimit;

      if (startTime && now < new Date(startTime)) return false;
      if (endTime && now > new Date(endTime)) return false;
    }

    // IP条件评估
    if (filterConditions.clientIP && permissionConditions.ipWhitelist) {
      if (!permissionConditions.ipWhitelist.includes(filterConditions.clientIP)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 权限去重
   * @param {Array} permissions 权限列表
   * @returns {Array} 去重后的权限列表
   */
  deduplicatePermissions(permissions) {
    const uniqueMap = new Map();

    for (const permission of permissions) {
      const key = `${permission.resource}:${permission.action}`;
      if (!uniqueMap.has(key) || permission.priority > uniqueMap.get(key).priority) {
        uniqueMap.set(key, permission);
      }
    }

    return Array.from(uniqueMap.values());
  }

  /**
   * 实现权限预热机制
   * @param {Array} userIds 用户ID列表
   * @param {Array} resources 资源列表
   * @returns {Promise<Object>} 预热结果
   */
  async warmupPermissions(userIds = [], resources = []) {
    const startTime = Date.now();
    const results = {
      totalWarmed: 0,
      successCount: 0,
      errorCount: 0,
      errors: [],
    };

    try {
      // 如果没有指定用户，获取活跃用户
      if (userIds.length === 0) {
        userIds = await this.getActiveUserIds();
      }

      // 如果没有指定资源，获取常用资源
      if (resources.length === 0) {
        resources = await this.getCommonResources();
      }

      // 批量预热权限
      for (const userId of userIds) {
        for (const resource of resources) {
          try {
            await this.warmupUserResourcePermissions(userId, resource);
            results.successCount++;
          } catch (error) {
            results.errorCount++;
            results.errors.push({
              userId,
              resource,
              error: error.message,
            });
          }
          results.totalWarmed++;
        }
      }

      this.emit('cache_warmed', {
        totalWarmed: results.totalWarmed,
        successCount: results.successCount,
        errorCount: results.errorCount,
        duration: Date.now() - startTime,
      });

      return results;
    } catch (error) {
      console.error('Failed to warmup permissions:', error);
      throw error;
    }
  }

  /**
   * 预热用户资源权限
   * @param {string} userId 用户ID
   * @param {string} resource 资源类型
   * @returns {Promise<boolean>} 预热结果
   */
  async warmupUserResourcePermissions(userId, resource) {
    try {
      const actions = ['read', 'write', 'delete', 'manage'];

      for (const action of actions) {
        const cacheKey = this.generateCacheKey(userId, resource, action, {});

        // 检查是否已缓存
        const existing = await this.redis.get(cacheKey);
        if (!existing) {
          // 这里应该调用实际的权限检查逻辑
          // 暂时使用模拟数据
          const mockResult = {
            hasPermission: Math.random() > 0.5,
            userId,
            resource,
            action,
            context: {},
            cachedAt: new Date().toISOString(),
          };

          await this.redis.setex(
            cacheKey,
            this.getCacheTTL(resource, action),
            JSON.stringify(mockResult)
          );
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to warmup user resource permissions:', error);
      throw error;
    }
  }

  /**
   * 获取活跃用户ID列表
   * @returns {Promise<Array>} 用户ID列表
   */
  async getActiveUserIds() {
    try {
      // 这里应该从用户活动日志中获取活跃用户
      // 暂时返回模拟数据
      return ['user1', 'user2', 'user3', 'user4', 'user5'];
    } catch (error) {
      console.error('Failed to get active user IDs:', error);
      return [];
    }
  }

  /**
   * 获取常用资源列表
   * @returns {Promise<Array>} 资源列表
   */
  async getCommonResources() {
    try {
      // 这里应该从权限使用统计中获取常用资源
      // 暂时返回模拟数据
      return ['user', 'datasource', 'query', 'report', 'system'];
    } catch (error) {
      console.error('Failed to get common resources:', error);
      return [];
    }
  }

  /**
   * 添加权限缓存失效策略
   * @param {string} userId 用户ID
   * @param {string} resource 资源类型
   * @param {string} action 操作类型
   * @returns {Promise<boolean>} 失效结果
   */
  async invalidatePermissionCache(userId, resource, action) {
    try {
      const pattern = `perm:${userId}:${resource}:${action}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);

        this.emit('cache_invalidated', {
          userId,
          resource,
          action,
          invalidatedKeys: keys.length,
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to invalidate permission cache:', error);
      return false;
    }
  }

  /**
   * 批量失效用户权限缓存
   * @param {string} userId 用户ID
   * @returns {Promise<boolean>} 失效结果
   */
  async invalidateUserPermissionCache(userId) {
    try {
      const pattern = `perm:${userId}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);

        this.emit('user_cache_invalidated', {
          userId,
          invalidatedKeys: keys.length,
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to invalidate user permission cache:', error);
      return false;
    }
  }

  /**
   * 清除所有权限缓存
   * @returns {Promise<boolean>} 清除结果
   */
  async clearAllPermissionCache() {
    try {
      const pattern = 'perm:*';
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);

        this.emit('all_cache_cleared', {
          clearedKeys: keys.length,
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to clear all permission cache:', error);
      return false;
    }
  }

  /**
   * 启动性能监控
   */
  startPerformanceMonitoring() {
    // 定期清理性能指标
    setInterval(() => {
      this.cleanupMetrics();
    }, 300000); // 5分钟清理一次

    // 定期报告性能指标
    setInterval(() => {
      this.reportPerformanceMetrics();
    }, 60000); // 1分钟报告一次
  }

  /**
   * 启动缓存预热
   */
  startCacheWarming() {
    setInterval(async () => {
      try {
        await this.warmupPermissions();
      } catch (error) {
        console.error('Cache warming failed:', error);
      }
    }, this.cacheConfig.warmingInterval);
  }

  /**
   * 清理性能指标
   */
  cleanupMetrics() {
    // 清理慢查询记录
    const oneHourAgo = new Date(Date.now() - 3600000);
    this.metrics.slowQueries = this.metrics.slowQueries.filter(
      query => new Date(query.timestamp) > oneHourAgo
    );
  }

  /**
   * 报告性能指标
   */
  reportPerformanceMetrics() {
    const hitRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.cacheHits / this.metrics.totalRequests) * 100
        : 0;

    const report = {
      timestamp: new Date().toISOString(),
      cacheHitRate: hitRate.toFixed(2) + '%',
      averageResponseTime: this.metrics.averageResponseTime.toFixed(2) + 'ms',
      totalRequests: this.metrics.totalRequests,
      slowQueriesCount: this.metrics.slowQueries.length,
    };

    this.emit('performance_report', report);
    console.log('Performance Report:', report);
  }

  /**
   * 获取性能指标
   * @returns {Object} 性能指标
   */
  getPerformanceMetrics() {
    const hitRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.cacheHits / this.metrics.totalRequests) * 100
        : 0;

    return {
      cacheHitRate: hitRate.toFixed(2) + '%',
      averageResponseTime: this.metrics.averageResponseTime.toFixed(2) + 'ms',
      totalRequests: this.metrics.totalRequests,
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      slowQueriesCount: this.metrics.slowQueries.length,
      recentSlowQueries: this.metrics.slowQueries.slice(-10),
    };
  }

  /**
   * 获取缓存状态
   * @returns {Promise<Object>} 缓存状态
   */
  async getCacheStatus() {
    try {
      const pattern = 'perm:*';
      const keys = await this.redis.keys(pattern);

      const cacheInfo = await this.redis.info('memory');
      const memoryInfo = this.parseRedisMemoryInfo(cacheInfo);

      return {
        totalCachedPermissions: keys.length,
        memoryUsage: memoryInfo.usedMemoryHuman,
        memoryPeak: memoryInfo.usedMemoryPeakHuman,
        cacheKeys: keys.length,
        cacheConfig: this.cacheConfig,
      };
    } catch (error) {
      console.error('Failed to get cache status:', error);
      return {
        error: error.message,
      };
    }
  }

  /**
   * 解析Redis内存信息
   * @param {string} info Redis info输出
   * @returns {Object} 内存信息
   */
  parseRedisMemoryInfo(info) {
    const lines = info.split('\n');
    const memoryInfo = {};

    for (const line of lines) {
      if (line.startsWith('used_memory_human:')) {
        memoryInfo.usedMemoryHuman = line.split(':')[1].trim();
      } else if (line.startsWith('used_memory_peak_human:')) {
        memoryInfo.usedMemoryPeakHuman = line.split(':')[1].trim();
      }
    }

    return memoryInfo;
  }

  /**
   * 关闭服务
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
    }
    this.isInitialized = false;
  }
}

module.exports = PermissionPerformanceService;

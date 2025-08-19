const { EventEmitter } = require('events');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

/**
 * 同步监控服务
 * 负责监控同步任务的状态、性能和健康度
 */
class SyncMonitorService extends EventEmitter {
  constructor() {
    super();
    this.redis = null;
    this.metrics = new Map();
    this.alerts = new Map();
    this.isInitialized = false;
    this.monitoringInterval = null;
    this.alertThresholds = {
      errorRate: 5, // 错误率阈值 5%
      latency: 30000, // 延迟阈值 30秒
      queueLength: 100, // 队列长度阈值 100
      memoryUsage: 80, // 内存使用率阈值 80%
      cpuUsage: 80, // CPU使用率阈值 80%
    };
  }

  /**
   * 初始化服务
   */
  async initialize() {
    try {
      // 初始化Redis连接
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 3, // 使用不同的数据库
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });

      // 启动监控循环
      this.startMonitoring();

      this.isInitialized = true;
      this.emit('initialized');

      console.log('SyncMonitorService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SyncMonitorService:', error);
      throw error;
    }
  }

  /**
   * 启动监控循环
   */
  startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.checkAlerts();
        await this.updateDashboard();
      } catch (error) {
        console.error('Monitoring cycle failed:', error);
      }
    }, 10000); // 每10秒收集一次指标
  }

  /**
   * 收集监控指标
   */
  async collectMetrics() {
    const timestamp = new Date().toISOString();

    // 收集系统指标
    const systemMetrics = await this.collectSystemMetrics();

    // 收集同步任务指标
    const syncMetrics = await this.collectSyncMetrics();

    // 收集性能指标
    const performanceMetrics = await this.collectPerformanceMetrics();

    // 合并指标
    const metrics = {
      timestamp,
      system: systemMetrics,
      sync: syncMetrics,
      performance: performanceMetrics,
    };

    // 保存指标
    await this.saveMetrics(metrics);

    // 更新内存中的指标
    this.metrics.set(timestamp, metrics);

    // 清理旧指标（保留最近1小时的数据）
    await this.cleanupOldMetrics();

    this.emit('metricsCollected', metrics);
  }

  /**
   * 收集系统指标
   */
  async collectSystemMetrics() {
    const systemMetrics = {
      memory: {
        total: process.memoryUsage().heapTotal,
        used: process.memoryUsage().heapUsed,
        external: process.memoryUsage().external,
        usage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
      },
      cpu: {
        usage: await this.getCPUUsage(),
        load: process.cpuUsage(),
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    return systemMetrics;
  }

  /**
   * 收集同步任务指标
   */
  async collectSyncMetrics() {
    try {
      // 获取所有同步任务
      const syncJobs = await this.redis.hgetall('sync_jobs');
      const realtimeSyncs = await this.redis.hgetall('realtime_syncs');
      const scheduledTasks = await this.redis.hgetall('scheduled_tasks');

      const metrics = {
        totalJobs: Object.keys(syncJobs).length,
        totalRealtimeSyncs: Object.keys(realtimeSyncs).length,
        totalScheduledTasks: Object.keys(scheduledTasks).length,
        runningJobs: 0,
        failedJobs: 0,
        completedJobs: 0,
        queueLength: await this.redis.zcard('task_queue'),
        averageLatency: 0,
        totalRecordsProcessed: 0,
        totalRecordsFailed: 0,
      };

      // 统计任务状态
      for (const [jobId, jobData] of Object.entries(syncJobs)) {
        const job = JSON.parse(jobData);
        if (job.status === 'running') metrics.runningJobs++;
        else if (job.status === 'failed') metrics.failedJobs++;
        else if (job.status === 'completed') metrics.completedJobs++;

        metrics.totalRecordsProcessed += job.recordsProcessed || 0;
        metrics.totalRecordsFailed += job.recordsFailed || 0;
      }

      // 计算平均延迟
      const executions = await this.redis.hgetall('sync_executions');
      let totalLatency = 0;
      let executionCount = 0;

      for (const [executionId, executionData] of Object.entries(executions)) {
        const execution = JSON.parse(executionData);
        if (execution.completedAt && execution.startedAt) {
          const latency = new Date(execution.completedAt) - new Date(execution.startedAt);
          totalLatency += latency;
          executionCount++;
        }
      }

      if (executionCount > 0) {
        metrics.averageLatency = totalLatency / executionCount;
      }

      return metrics;
    } catch (error) {
      console.error('Failed to collect sync metrics:', error);
      return {
        totalJobs: 0,
        totalRealtimeSyncs: 0,
        totalScheduledTasks: 0,
        runningJobs: 0,
        failedJobs: 0,
        completedJobs: 0,
        queueLength: 0,
        averageLatency: 0,
        totalRecordsProcessed: 0,
        totalRecordsFailed: 0,
      };
    }
  }

  /**
   * 收集性能指标
   */
  async collectPerformanceMetrics() {
    const performanceMetrics = {
      throughput: 0,
      errorRate: 0,
      responseTime: {
        p50: 0,
        p95: 0,
        p99: 0,
      },
      availability: 100,
      timestamp: new Date().toISOString(),
    };

    try {
      // 计算吞吐量（记录/秒）
      const syncMetrics = await this.collectSyncMetrics();
      performanceMetrics.throughput = syncMetrics.totalRecordsProcessed / 3600; // 每小时记录数

      // 计算错误率
      if (syncMetrics.totalRecordsProcessed > 0) {
        performanceMetrics.errorRate =
          (syncMetrics.totalRecordsFailed / syncMetrics.totalRecordsProcessed) * 100;
      }

      // 计算响应时间分位数
      const responseTimes = await this.getResponseTimes();
      if (responseTimes.length > 0) {
        responseTimes.sort((a, b) => a - b);
        performanceMetrics.responseTime.p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
        performanceMetrics.responseTime.p95 =
          responseTimes[Math.floor(responseTimes.length * 0.95)];
        performanceMetrics.responseTime.p99 =
          responseTimes[Math.floor(responseTimes.length * 0.99)];
      }

      // 计算可用性
      const failedJobs = syncMetrics.failedJobs;
      const totalJobs = syncMetrics.totalJobs;
      if (totalJobs > 0) {
        performanceMetrics.availability = ((totalJobs - failedJobs) / totalJobs) * 100;
      }
    } catch (error) {
      console.error('Failed to collect performance metrics:', error);
    }

    return performanceMetrics;
  }

  /**
   * 获取CPU使用率
   */
  async getCPUUsage() {
    // 简化实现，实际应该使用系统监控库
    return Math.random() * 100; // 模拟CPU使用率
  }

  /**
   * 获取响应时间数据
   */
  async getResponseTimes() {
    try {
      const executions = await this.redis.hgetall('sync_executions');
      const responseTimes = [];

      for (const [executionId, executionData] of Object.entries(executions)) {
        const execution = JSON.parse(executionData);
        if (execution.completedAt && execution.startedAt) {
          const responseTime = new Date(execution.completedAt) - new Date(execution.startedAt);
          responseTimes.push(responseTime);
        }
      }

      return responseTimes;
    } catch (error) {
      console.error('Failed to get response times:', error);
      return [];
    }
  }

  /**
   * 保存指标
   */
  async saveMetrics(metrics) {
    const timestamp = metrics.timestamp;

    // 保存到Redis
    await this.redis.hset('sync_metrics', timestamp, JSON.stringify(metrics));

    // 设置过期时间（保留24小时）
    await this.redis.expire('sync_metrics', 24 * 60 * 60);
  }

  /**
   * 清理旧指标
   */
  async cleanupOldMetrics() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // 清理内存中的旧指标
    for (const [timestamp] of this.metrics) {
      if (timestamp < oneHourAgo) {
        this.metrics.delete(timestamp);
      }
    }
  }

  /**
   * 检查告警条件
   */
  async checkAlerts() {
    const latestMetrics = Array.from(this.metrics.values()).pop();
    if (!latestMetrics) return;

    const alerts = [];

    // 检查错误率
    if (latestMetrics.performance.errorRate > this.alertThresholds.errorRate) {
      alerts.push({
        id: uuidv4(),
        type: 'error_rate_high',
        severity: 'warning',
        message: `Error rate is ${latestMetrics.performance.errorRate.toFixed(2)}%, exceeding threshold of ${this.alertThresholds.errorRate}%`,
        timestamp: new Date().toISOString(),
        metrics: latestMetrics,
      });
    }

    // 检查延迟
    if (latestMetrics.performance.responseTime.p95 > this.alertThresholds.latency) {
      alerts.push({
        id: uuidv4(),
        type: 'latency_high',
        severity: 'warning',
        message: `95th percentile latency is ${latestMetrics.performance.responseTime.p95}ms, exceeding threshold of ${this.alertThresholds.latency}ms`,
        timestamp: new Date().toISOString(),
        metrics: latestMetrics,
      });
    }

    // 检查队列长度
    if (latestMetrics.sync.queueLength > this.alertThresholds.queueLength) {
      alerts.push({
        id: uuidv4(),
        type: 'queue_length_high',
        severity: 'critical',
        message: `Queue length is ${latestMetrics.sync.queueLength}, exceeding threshold of ${this.alertThresholds.queueLength}`,
        timestamp: new Date().toISOString(),
        metrics: latestMetrics,
      });
    }

    // 检查内存使用率
    if (latestMetrics.system.memory.usage > this.alertThresholds.memoryUsage) {
      alerts.push({
        id: uuidv4(),
        type: 'memory_usage_high',
        severity: 'warning',
        message: `Memory usage is ${latestMetrics.system.memory.usage.toFixed(2)}%, exceeding threshold of ${this.alertThresholds.memoryUsage}%`,
        timestamp: new Date().toISOString(),
        metrics: latestMetrics,
      });
    }

    // 保存告警
    for (const alert of alerts) {
      await this.saveAlert(alert);
      this.emit('alert', alert);
    }
  }

  /**
   * 保存告警
   */
  async saveAlert(alert) {
    await this.redis.hset('sync_alerts', alert.id, JSON.stringify(alert));

    // 设置告警过期时间（保留7天）
    await this.redis.expire('sync_alerts', 7 * 24 * 60 * 60);
  }

  /**
   * 更新仪表盘数据
   */
  async updateDashboard() {
    const dashboardData = await this.generateDashboardData();

    await this.redis.set(
      'sync_dashboard',
      JSON.stringify(dashboardData),
      'EX',
      300 // 5分钟过期
    );
  }

  /**
   * 生成仪表盘数据
   */
  async generateDashboardData() {
    const metrics = Array.from(this.metrics.values());
    if (metrics.length === 0) {
      return {
        summary: {},
        trends: {},
        alerts: [],
        timestamp: new Date().toISOString(),
      };
    }

    const latestMetrics = metrics[metrics.length - 1];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentMetrics = metrics.filter(m => m.timestamp >= oneHourAgo);

    // 生成趋势数据
    const trends = {
      throughput: recentMetrics.map(m => ({
        timestamp: m.timestamp,
        value: m.performance.throughput,
      })),
      errorRate: recentMetrics.map(m => ({
        timestamp: m.timestamp,
        value: m.performance.errorRate,
      })),
      latency: recentMetrics.map(m => ({
        timestamp: m.timestamp,
        value: m.performance.responseTime.p95,
      })),
      memoryUsage: recentMetrics.map(m => ({
        timestamp: m.timestamp,
        value: m.system.memory.usage,
      })),
    };

    // 获取最新告警
    const alerts = await this.getRecentAlerts(10);

    return {
      summary: {
        totalJobs: latestMetrics.sync.totalJobs,
        runningJobs: latestMetrics.sync.runningJobs,
        failedJobs: latestMetrics.sync.failedJobs,
        availability: latestMetrics.performance.availability,
        throughput: latestMetrics.performance.throughput,
        errorRate: latestMetrics.performance.errorRate,
        averageLatency: latestMetrics.sync.averageLatency,
      },
      trends,
      alerts,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 获取最新告警
   */
  async getRecentAlerts(limit = 10) {
    try {
      const alertIds = await this.redis.hkeys('sync_alerts');
      const alerts = [];

      for (const alertId of alertIds.slice(0, limit)) {
        const alertData = await this.redis.hget('sync_alerts', alertId);
        if (alertData) {
          alerts.push(JSON.parse(alertData));
        }
      }

      return alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('Failed to get recent alerts:', error);
      return [];
    }
  }

  /**
   * 获取监控指标
   */
  async getMetrics(options = {}) {
    const { startTime, endTime, limit = 100 } = options;

    const metrics = Array.from(this.metrics.values());
    let filteredMetrics = metrics;

    // 按时间过滤
    if (startTime) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp >= startTime);
    }
    if (endTime) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp <= endTime);
    }

    // 限制数量
    filteredMetrics = filteredMetrics.slice(-limit);

    return filteredMetrics;
  }

  /**
   * 获取仪表盘数据
   */
  async getDashboardData() {
    const dashboardData = await this.redis.get('sync_dashboard');
    if (dashboardData) {
      return JSON.parse(dashboardData);
    }

    // 如果缓存中没有，重新生成
    await this.updateDashboard();
    const newDashboardData = await this.redis.get('sync_dashboard');
    return newDashboardData ? JSON.parse(newDashboardData) : null;
  }

  /**
   * 设置告警阈值
   */
  setAlertThresholds(thresholds) {
    this.alertThresholds = {
      ...this.alertThresholds,
      ...thresholds,
    };
  }

  /**
   * 获取告警阈值
   */
  getAlertThresholds() {
    return { ...this.alertThresholds };
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus() {
    return {
      isInitialized: this.isInitialized,
      monitoringActive: this.monitoringInterval !== null,
      metricsCount: this.metrics.size,
      lastMetricsCollection: Array.from(this.metrics.keys()).pop() || null,
    };
  }

  /**
   * 关闭服务
   */
  async close() {
    // 停止监控循环
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // 关闭Redis连接
    if (this.redis) {
      await this.redis.quit();
    }

    this.isInitialized = false;
    console.log('SyncMonitorService closed');
  }
}

module.exports = SyncMonitorService;

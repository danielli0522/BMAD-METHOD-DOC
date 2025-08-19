const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const Redis = require('ioredis');

/**
 * 数据同步核心服务
 * 负责管理同步任务的生命周期和状态
 */
class DataSyncService extends EventEmitter {
  constructor() {
    super();
    this.redis = null;
    this.scheduler = null;
    this.activeJobs = new Map();
    this.jobQueue = new Map();
    this.isInitialized = false;
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
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });

      // 初始化调度器
      this.scheduler = new Map();

      // 加载现有任务
      await this.loadExistingJobs();

      this.isInitialized = true;
      this.emit('initialized');

      console.log('DataSyncService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DataSyncService:', error);
      throw error;
    }
  }

  /**
   * 创建同步任务
   */
  async createSyncJob(config) {
    if (!this.isInitialized) {
      throw new Error('DataSyncService not initialized');
    }

    const jobId = config.id || uuidv4();
    const jobConfig = {
      ...config,
      id: jobId,
      status: 'inactive',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 验证配置
    this.validateJobConfig(jobConfig);

    // 保存到Redis
    await this.redis.hset('sync_jobs', jobId, JSON.stringify(jobConfig));

    // 如果任务配置了调度，立即设置调度器
    if (jobConfig.schedule) {
      await this.setupScheduler(jobId, jobConfig);
    }

    this.emit('jobCreated', jobId, jobConfig);
    return jobId;
  }

  /**
   * 启动同步任务
   */
  async startSync(jobId) {
    const jobConfig = await this.getSyncJob(jobId);
    if (!jobConfig) {
      throw new Error(`Sync job ${jobId} not found`);
    }

    if (jobConfig.status === 'running') {
      throw new Error(`Sync job ${jobId} is already running`);
    }

    // 更新状态
    await this.updateJobStatus(jobId, 'running');

    // 创建执行记录
    const executionId = uuidv4();
    const execution = {
      id: executionId,
      jobId,
      status: 'running',
      startedAt: new Date().toISOString(),
      recordsProcessed: 0,
      recordsFailed: 0,
    };

    await this.redis.hset('sync_executions', executionId, JSON.stringify(execution));

    // 执行同步
    this.executeSync(jobId, executionId, jobConfig);

    this.emit('syncStarted', jobId, executionId);
    return executionId;
  }

  /**
   * 暂停同步任务
   */
  async pauseSync(jobId) {
    const jobConfig = await this.getSyncJob(jobId);
    if (!jobConfig) {
      throw new Error(`Sync job ${jobId} not found`);
    }

    if (jobConfig.status !== 'running') {
      throw new Error(`Sync job ${jobId} is not running`);
    }

    await this.updateJobStatus(jobId, 'paused');

    // 停止调度器
    if (this.scheduler.has(jobId)) {
      this.scheduler.get(jobId).stop();
    }

    this.emit('syncPaused', jobId);
  }

  /**
   * 恢复同步任务
   */
  async resumeSync(jobId) {
    const jobConfig = await this.getSyncJob(jobId);
    if (!jobConfig) {
      throw new Error(`Sync job ${jobId} not found`);
    }

    if (jobConfig.status !== 'paused') {
      throw new Error(`Sync job ${jobId} is not paused`);
    }

    await this.updateJobStatus(jobId, 'running');

    // 重新启动调度器
    if (jobConfig.schedule) {
      await this.setupScheduler(jobId, jobConfig);
    }

    this.emit('syncResumed', jobId);
  }

  /**
   * 取消同步任务
   */
  async cancelSync(jobId) {
    const jobConfig = await this.getSyncJob(jobId);
    if (!jobConfig) {
      throw new Error(`Sync job ${jobId} not found`);
    }

    await this.updateJobStatus(jobId, 'cancelled');

    // 停止调度器
    if (this.scheduler.has(jobId)) {
      this.scheduler.get(jobId).stop();
      this.scheduler.delete(jobId);
    }

    this.emit('syncCancelled', jobId);
  }

  /**
   * 获取同步状态
   */
  async getSyncStatus(jobId) {
    const jobConfig = await this.getSyncJob(jobId);
    if (!jobConfig) {
      throw new Error(`Sync job ${jobId} not found`);
    }

    // 获取最新的执行记录
    const executions = await this.getJobExecutions(jobId, 1);
    const latestExecution = executions[0];

    return {
      jobId,
      status: jobConfig.status,
      lastExecution: latestExecution,
      nextScheduledRun: this.getNextScheduledRun(jobId, jobConfig),
      metrics: await this.getJobMetrics(jobId),
    };
  }

  /**
   * 获取同步日志
   */
  async getSyncLogs(jobId, options = {}) {
    const { limit = 100, offset = 0, level } = options;

    const executionIds = await this.getJobExecutionIds(jobId);
    const logs = [];

    for (const executionId of executionIds.slice(offset, offset + limit)) {
      const executionLogs = await this.getExecutionLogs(executionId, level);
      logs.push(...executionLogs);
    }

    return logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * 验证任务配置
   */
  validateJobConfig(config) {
    if (!config.name) {
      throw new Error('Job name is required');
    }
    if (!config.sourceConfig) {
      throw new Error('Source configuration is required');
    }
    if (!config.targetConfig) {
      throw new Error('Target configuration is required');
    }
    if (!['full', 'incremental', 'realtime'].includes(config.syncMode)) {
      throw new Error('Invalid sync mode');
    }
    if (config.schedule && !cron.validate(config.schedule)) {
      throw new Error('Invalid cron expression');
    }
  }

  /**
   * 设置任务调度器
   */
  async setupScheduler(jobId, jobConfig) {
    if (!jobConfig.schedule) return;

    // 停止现有调度器
    if (this.scheduler.has(jobId)) {
      this.scheduler.get(jobId).stop();
    }

    // 创建新调度器
    const task = cron.schedule(
      jobConfig.schedule,
      async () => {
        try {
          await this.startSync(jobId);
        } catch (error) {
          console.error(`Failed to execute scheduled sync job ${jobId}:`, error);
          this.emit('scheduledSyncFailed', jobId, error);
        }
      },
      {
        scheduled: false,
      }
    );

    this.scheduler.set(jobId, task);
    task.start();
  }

  /**
   * 执行同步任务
   */
  async executeSync(jobId, executionId, jobConfig) {
    try {
      this.emit('syncExecuting', jobId, executionId);

      // 根据同步模式选择执行策略
      switch (jobConfig.syncMode) {
        case 'full':
          await this.executeFullSync(jobId, executionId, jobConfig);
          break;
        case 'incremental':
          await this.executeIncrementalSync(jobId, executionId, jobConfig);
          break;
        case 'realtime':
          await this.executeRealtimeSync(jobId, executionId, jobConfig);
          break;
        default:
          throw new Error(`Unsupported sync mode: ${jobConfig.syncMode}`);
      }

      // 更新执行状态
      await this.updateExecutionStatus(executionId, 'completed');
      await this.updateJobStatus(jobId, 'completed');

      this.emit('syncCompleted', jobId, executionId);
    } catch (error) {
      console.error(`Sync execution failed for job ${jobId}:`, error);

      await this.updateExecutionStatus(executionId, 'failed', error.message);
      await this.updateJobStatus(jobId, 'failed');

      this.emit('syncFailed', jobId, executionId, error);
    }
  }

  /**
   * 执行全量同步
   */
  async executeFullSync(jobId, executionId, jobConfig) {
    // TODO: 实现全量同步逻辑
    console.log(`Executing full sync for job ${jobId}`);

    // 模拟同步过程
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 更新执行记录
    await this.updateExecutionProgress(executionId, 1000, 0);
  }

  /**
   * 执行增量同步
   */
  async executeIncrementalSync(jobId, executionId, jobConfig) {
    // TODO: 实现增量同步逻辑
    console.log(`Executing incremental sync for job ${jobId}`);

    // 模拟同步过程
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 更新执行记录
    await this.updateExecutionProgress(executionId, 500, 0);
  }

  /**
   * 执行实时同步
   */
  async executeRealtimeSync(jobId, executionId, jobConfig) {
    // TODO: 实现实时同步逻辑
    console.log(`Executing realtime sync for job ${jobId}`);

    // 模拟同步过程
    await new Promise(resolve => setTimeout(resolve, 500));

    // 更新执行记录
    await this.updateExecutionProgress(executionId, 100, 0);
  }

  /**
   * 获取同步任务配置
   */
  async getSyncJob(jobId) {
    const jobData = await this.redis.hget('sync_jobs', jobId);
    return jobData ? JSON.parse(jobData) : null;
  }

  /**
   * 更新任务状态
   */
  async updateJobStatus(jobId, status) {
    const jobConfig = await this.getSyncJob(jobId);
    if (jobConfig) {
      jobConfig.status = status;
      jobConfig.updatedAt = new Date().toISOString();
      await this.redis.hset('sync_jobs', jobId, JSON.stringify(jobConfig));
    }
  }

  /**
   * 更新执行状态
   */
  async updateExecutionStatus(executionId, status, errorMessage = null) {
    const execution = await this.getExecution(executionId);
    if (execution) {
      execution.status = status;
      execution.completedAt = new Date().toISOString();
      if (errorMessage) {
        execution.errorMessage = errorMessage;
      }
      await this.redis.hset('sync_executions', executionId, JSON.stringify(execution));
    }
  }

  /**
   * 更新执行进度
   */
  async updateExecutionProgress(executionId, recordsProcessed, recordsFailed) {
    const execution = await this.getExecution(executionId);
    if (execution) {
      execution.recordsProcessed = recordsProcessed;
      execution.recordsFailed = recordsFailed;
      await this.redis.hset('sync_executions', executionId, JSON.stringify(execution));
    }
  }

  /**
   * 获取执行记录
   */
  async getExecution(executionId) {
    const executionData = await this.redis.hget('sync_executions', executionId);
    return executionData ? JSON.parse(executionData) : null;
  }

  /**
   * 获取任务执行历史
   */
  async getJobExecutions(jobId, limit = 10) {
    const executionIds = await this.getJobExecutionIds(jobId);
    const executions = [];

    for (const executionId of executionIds.slice(0, limit)) {
      const execution = await this.getExecution(executionId);
      if (execution) {
        executions.push(execution);
      }
    }

    return executions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  }

  /**
   * 获取任务执行ID列表
   */
  async getJobExecutionIds(jobId) {
    const keys = await this.redis.hkeys('sync_executions');
    const executionIds = [];

    for (const key of keys) {
      const execution = await this.getExecution(key);
      if (execution && execution.jobId === jobId) {
        executionIds.push(key);
      }
    }

    return executionIds.sort((a, b) => b.localeCompare(a));
  }

  /**
   * 获取执行日志
   */
  async getExecutionLogs(executionId, level = null) {
    const logs = await this.redis.lrange(`sync_logs:${executionId}`, 0, -1);
    const parsedLogs = logs.map(log => JSON.parse(log));

    if (level) {
      return parsedLogs.filter(log => log.level === level);
    }

    return parsedLogs;
  }

  /**
   * 获取下次调度时间
   */
  getNextScheduledRun(jobId, jobConfig) {
    if (!jobConfig.schedule || !this.scheduler.has(jobId)) {
      return null;
    }

    // TODO: 实现下次调度时间计算
    return new Date(Date.now() + 15 * 60 * 1000); // 模拟15分钟后
  }

  /**
   * 获取任务指标
   */
  async getJobMetrics(jobId) {
    const executions = await this.getJobExecutions(jobId, 10);

    if (executions.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        totalRecordsProcessed: 0,
        totalRecordsFailed: 0,
      };
    }

    const successfulExecutions = executions.filter(e => e.status === 'completed');
    const totalDuration = executions.reduce((sum, e) => {
      if (e.completedAt && e.startedAt) {
        return sum + (new Date(e.completedAt) - new Date(e.startedAt));
      }
      return sum;
    }, 0);

    return {
      totalExecutions: executions.length,
      successRate: (successfulExecutions.length / executions.length) * 100,
      averageDuration: totalDuration / executions.length,
      totalRecordsProcessed: executions.reduce((sum, e) => sum + (e.recordsProcessed || 0), 0),
      totalRecordsFailed: executions.reduce((sum, e) => sum + (e.recordsFailed || 0), 0),
    };
  }

  /**
   * 加载现有任务
   */
  async loadExistingJobs() {
    const jobIds = await this.redis.hkeys('sync_jobs');

    for (const jobId of jobIds) {
      const jobConfig = await this.getSyncJob(jobId);
      if (jobConfig && jobConfig.schedule && jobConfig.status !== 'cancelled') {
        await this.setupScheduler(jobId, jobConfig);
      }
    }
  }

  /**
   * 关闭服务
   */
  async close() {
    // 停止所有调度器
    for (const [jobId, task] of this.scheduler) {
      task.stop();
    }
    this.scheduler.clear();

    // 关闭Redis连接
    if (this.redis) {
      await this.redis.quit();
    }

    this.isInitialized = false;
    console.log('DataSyncService closed');
  }
}

module.exports = DataSyncService;

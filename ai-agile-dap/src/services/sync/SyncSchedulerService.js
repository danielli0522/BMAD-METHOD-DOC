const { EventEmitter } = require('events');
const cron = require('node-cron');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

/**
 * 同步任务调度服务
 * 负责管理定时任务的调度、优先级和状态
 */
class SyncSchedulerService extends EventEmitter {
  constructor() {
    super();
    this.redis = null;
    this.scheduledTasks = new Map();
    this.taskQueue = new Map();
    this.isInitialized = false;
    this.maxConcurrentJobs = 5;
    this.runningJobs = 0;
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
        db: process.env.REDIS_DB || 1, // 使用不同的数据库
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });

      // 加载现有调度任务
      await this.loadScheduledTasks();

      // 启动队列处理器
      this.startQueueProcessor();

      this.isInitialized = true;
      this.emit('initialized');

      console.log('SyncSchedulerService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SyncSchedulerService:', error);
      throw error;
    }
  }

  /**
   * 创建定时任务
   */
  async createScheduledTask(taskConfig) {
    if (!this.isInitialized) {
      throw new Error('SyncSchedulerService not initialized');
    }

    const taskId = taskConfig.id || uuidv4();
    const task = {
      ...taskConfig,
      id: taskId,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextRun: this.calculateNextRun(taskConfig.schedule),
    };

    // 验证任务配置
    this.validateTaskConfig(task);

    // 保存到Redis
    await this.redis.hset('scheduled_tasks', taskId, JSON.stringify(task));

    // 设置调度器
    await this.setupTaskScheduler(taskId, task);

    this.emit('taskScheduled', taskId, task);
    return taskId;
  }

  /**
   * 更新任务配置
   */
  async updateScheduledTask(taskId, updates) {
    const task = await this.getScheduledTask(taskId);
    if (!task) {
      throw new Error(`Scheduled task ${taskId} not found`);
    }

    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // 如果调度表达式发生变化，重新计算下次运行时间
    if (updates.schedule && updates.schedule !== task.schedule) {
      updatedTask.nextRun = this.calculateNextRun(updates.schedule);
      await this.setupTaskScheduler(taskId, updatedTask);
    }

    // 保存更新
    await this.redis.hset('scheduled_tasks', taskId, JSON.stringify(updatedTask));

    this.emit('taskUpdated', taskId, updatedTask);
  }

  /**
   * 暂停任务
   */
  async pauseScheduledTask(taskId) {
    const task = await this.getScheduledTask(taskId);
    if (!task) {
      throw new Error(`Scheduled task ${taskId} not found`);
    }

    if (task.status === 'paused') {
      throw new Error(`Task ${taskId} is already paused`);
    }

    // 停止调度器
    if (this.scheduledTasks.has(taskId)) {
      this.scheduledTasks.get(taskId).stop();
      this.scheduledTasks.delete(taskId);
    }

    // 更新状态
    await this.updateScheduledTask(taskId, { status: 'paused' });

    this.emit('taskPaused', taskId);
  }

  /**
   * 恢复任务
   */
  async resumeScheduledTask(taskId) {
    const task = await this.getScheduledTask(taskId);
    if (!task) {
      throw new Error(`Scheduled task ${taskId} not found`);
    }

    if (task.status !== 'paused') {
      throw new Error(`Task ${taskId} is not paused`);
    }

    // 重新设置调度器
    await this.setupTaskScheduler(taskId, task);

    // 更新状态
    await this.updateScheduledTask(taskId, { status: 'scheduled' });

    this.emit('taskResumed', taskId);
  }

  /**
   * 删除任务
   */
  async deleteScheduledTask(taskId) {
    const task = await this.getScheduledTask(taskId);
    if (!task) {
      throw new Error(`Scheduled task ${taskId} not found`);
    }

    // 停止调度器
    if (this.scheduledTasks.has(taskId)) {
      this.scheduledTasks.get(taskId).stop();
      this.scheduledTasks.delete(taskId);
    }

    // 从Redis删除
    await this.redis.hdel('scheduled_tasks', taskId);

    this.emit('taskDeleted', taskId);
  }

  /**
   * 获取所有调度任务
   */
  async getAllScheduledTasks() {
    const taskIds = await this.redis.hkeys('scheduled_tasks');
    const tasks = [];

    for (const taskId of taskIds) {
      const task = await this.getScheduledTask(taskId);
      if (task) {
        tasks.push(task);
      }
    }

    return tasks.sort((a, b) => {
      // 按优先级排序，然后按创建时间排序
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }

  /**
   * 获取任务详情
   */
  async getScheduledTask(taskId) {
    const taskData = await this.redis.hget('scheduled_tasks', taskId);
    return taskData ? JSON.parse(taskData) : null;
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId) {
    const task = await this.getScheduledTask(taskId);
    if (!task) {
      throw new Error(`Scheduled task ${taskId} not found`);
    }

    return {
      id: task.id,
      name: task.name,
      status: task.status,
      priority: task.priority,
      schedule: task.schedule,
      nextRun: task.nextRun,
      lastRun: task.lastRun,
      totalRuns: task.totalRuns || 0,
      successRuns: task.successRuns || 0,
      failedRuns: task.failedRuns || 0,
    };
  }

  /**
   * 手动触发任务
   */
  async triggerTask(taskId) {
    const task = await this.getScheduledTask(taskId);
    if (!task) {
      throw new Error(`Scheduled task ${taskId} not found`);
    }

    // 添加到队列
    await this.addToQueue(taskId, task, 'manual');

    this.emit('taskTriggered', taskId, 'manual');
  }

  /**
   * 验证任务配置
   */
  validateTaskConfig(config) {
    if (!config.name) {
      throw new Error('Task name is required');
    }
    if (!config.schedule) {
      throw new Error('Schedule is required');
    }
    if (!cron.validate(config.schedule)) {
      throw new Error('Invalid cron expression');
    }
    if (typeof config.priority !== 'number' || config.priority < 1 || config.priority > 10) {
      throw new Error('Priority must be a number between 1 and 10');
    }
    if (!config.jobType) {
      throw new Error('Job type is required');
    }
  }

  /**
   * 设置任务调度器
   */
  async setupTaskScheduler(taskId, task) {
    // 停止现有调度器
    if (this.scheduledTasks.has(taskId)) {
      this.scheduledTasks.get(taskId).stop();
    }

    // 创建新调度器
    const cronTask = cron.schedule(
      task.schedule,
      async () => {
        try {
          await this.executeScheduledTask(taskId, task);
        } catch (error) {
          console.error(`Failed to execute scheduled task ${taskId}:`, error);
          this.emit('scheduledTaskFailed', taskId, error);
        }
      },
      {
        scheduled: false,
      }
    );

    this.scheduledTasks.set(taskId, cronTask);
    cronTask.start();

    // 更新下次运行时间
    await this.updateScheduledTask(taskId, {
      nextRun: this.calculateNextRun(task.schedule),
    });
  }

  /**
   * 执行调度任务
   */
  async executeScheduledTask(taskId, task) {
    try {
      // 检查并发限制
      if (this.runningJobs >= this.maxConcurrentJobs) {
        await this.addToQueue(taskId, task, 'scheduled');
        return;
      }

      this.runningJobs++;

      // 更新任务状态
      await this.updateScheduledTask(taskId, {
        status: 'running',
        lastRun: new Date().toISOString(),
        totalRuns: (task.totalRuns || 0) + 1,
      });

      this.emit('taskExecuting', taskId, task);

      // 执行任务
      await this.executeTask(taskId, task);

      // 更新成功计数
      await this.updateScheduledTask(taskId, {
        status: 'scheduled',
        successRuns: (task.successRuns || 0) + 1,
      });

      this.emit('taskCompleted', taskId, task);
    } catch (error) {
      console.error(`Task execution failed for ${taskId}:`, error);

      // 更新失败计数
      await this.updateScheduledTask(taskId, {
        status: 'scheduled',
        failedRuns: (task.failedRuns || 0) + 1,
      });

      this.emit('taskFailed', taskId, task, error);
    } finally {
      this.runningJobs--;

      // 处理队列中的任务
      this.processQueue();
    }
  }

  /**
   * 执行具体任务
   */
  async executeTask(taskId, task) {
    // 根据任务类型执行不同的逻辑
    switch (task.jobType) {
      case 'data_sync':
        await this.executeDataSyncTask(taskId, task);
        break;
      case 'data_cleanup':
        await this.executeDataCleanupTask(taskId, task);
        break;
      case 'report_generation':
        await this.executeReportGenerationTask(taskId, task);
        break;
      default:
        throw new Error(`Unsupported job type: ${task.jobType}`);
    }
  }

  /**
   * 执行数据同步任务
   */
  async executeDataSyncTask(taskId, task) {
    // TODO: 集成DataSyncService
    console.log(`Executing data sync task ${taskId}`);

    // 模拟执行时间
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * 执行数据清理任务
   */
  async executeDataCleanupTask(taskId, task) {
    console.log(`Executing data cleanup task ${taskId}`);

    // 模拟执行时间
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * 执行报表生成任务
   */
  async executeReportGenerationTask(taskId, task) {
    console.log(`Executing report generation task ${taskId}`);

    // 模拟执行时间
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * 添加到队列
   */
  async addToQueue(taskId, task, triggerType) {
    const queueItem = {
      taskId,
      task,
      triggerType,
      priority: task.priority,
      addedAt: new Date().toISOString(),
    };

    // 使用Redis有序集合，按优先级排序
    await this.redis.zadd('task_queue', task.priority, JSON.stringify(queueItem));

    this.emit('taskQueued', taskId, queueItem);
  }

  /**
   * 启动队列处理器
   */
  startQueueProcessor() {
    setInterval(async () => {
      await this.processQueue();
    }, 1000); // 每秒检查一次队列
  }

  /**
   * 处理队列
   */
  async processQueue() {
    if (this.runningJobs >= this.maxConcurrentJobs) {
      return;
    }

    // 获取优先级最高的任务
    const queueItems = await this.redis.zrevrange('task_queue', 0, 0);

    if (queueItems.length === 0) {
      return;
    }

    const queueItem = JSON.parse(queueItems[0]);

    // 从队列中移除
    await this.redis.zrem('task_queue', queueItems[0]);

    // 执行任务
    await this.executeScheduledTask(queueItem.taskId, queueItem.task);
  }

  /**
   * 计算下次运行时间
   */
  calculateNextRun(schedule) {
    try {
      // 使用node-cron的解析功能计算下次运行时间
      const now = new Date();
      const nextRun = cron.getNextDate(schedule, now);
      return nextRun.toISOString();
    } catch (error) {
      console.error('Failed to calculate next run time:', error);
      return null;
    }
  }

  /**
   * 加载现有调度任务
   */
  async loadScheduledTasks() {
    const taskIds = await this.redis.hkeys('scheduled_tasks');

    for (const taskId of taskIds) {
      const task = await this.getScheduledTask(taskId);
      if (task && task.status === 'scheduled') {
        await this.setupTaskScheduler(taskId, task);
      }
    }
  }

  /**
   * 获取调度器统计信息
   */
  async getSchedulerStats() {
    const tasks = await this.getAllScheduledTasks();

    return {
      totalTasks: tasks.length,
      runningTasks: tasks.filter(t => t.status === 'running').length,
      pausedTasks: tasks.filter(t => t.status === 'paused').length,
      scheduledTasks: tasks.filter(t => t.status === 'scheduled').length,
      queueLength: await this.redis.zcard('task_queue'),
      maxConcurrentJobs: this.maxConcurrentJobs,
      currentRunningJobs: this.runningJobs,
    };
  }

  /**
   * 关闭服务
   */
  async close() {
    // 停止所有调度器
    for (const [taskId, task] of this.scheduledTasks) {
      task.stop();
    }
    this.scheduledTasks.clear();

    // 关闭Redis连接
    if (this.redis) {
      await this.redis.quit();
    }

    this.isInitialized = false;
    console.log('SyncSchedulerService closed');
  }
}

module.exports = SyncSchedulerService;

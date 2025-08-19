const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const DataSyncService = require('../services/sync/DataSyncService');
const SyncSchedulerService = require('../services/sync/SyncSchedulerService');
const RealTimeSyncService = require('../services/sync/RealTimeSyncService');
const SyncMonitorService = require('../services/sync/SyncMonitorService');

const router = express.Router();

// 初始化服务实例
const dataSyncService = new DataSyncService();
const schedulerService = new SyncSchedulerService();
const realtimeSyncService = new RealTimeSyncService();
const monitorService = new SyncMonitorService();

// 中间件：验证请求
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

// 中间件：错误处理
const errorHandler = (err, req, res, next) => {
  console.error('Sync API Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
};

// 路由：创建同步任务
router.post(
  '/jobs',
  [
    body('name').isString().notEmpty().withMessage('Job name is required'),
    body('sourceConfig').isObject().withMessage('Source configuration is required'),
    body('targetConfig').isObject().withMessage('Target configuration is required'),
    body('syncMode').isIn(['full', 'incremental', 'realtime']).withMessage('Invalid sync mode'),
    body('schedule').optional().isString().withMessage('Schedule must be a valid cron expression'),
    body('priority')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('Priority must be between 1 and 10'),
    body('retryConfig').optional().isObject().withMessage('Retry configuration must be an object'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const jobConfig = {
        ...req.body,
        priority: req.body.priority || 5,
        retryConfig: req.body.retryConfig || {
          maxRetries: 3,
          backoffStrategy: 'exponential',
          initialDelay: 1000,
        },
      };

      const jobId = await dataSyncService.createSyncJob(jobConfig);

      res.status(201).json({
        success: true,
        message: 'Sync job created successfully',
        data: { jobId },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：获取同步任务列表
router.get(
  '/jobs',
  [
    query('status')
      .optional()
      .isIn(['inactive', 'running', 'paused', 'completed', 'failed', 'cancelled']),
    query('syncMode').optional().isIn(['full', 'incremental', 'realtime']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { status, syncMode, limit = 20, offset = 0 } = req.query;

      // 获取所有任务
      const jobIds = await dataSyncService.redis.hkeys('sync_jobs');
      const jobs = [];

      for (const jobId of jobIds) {
        const job = await dataSyncService.getSyncJob(jobId);
        if (job) {
          // 应用过滤器
          if (status && job.status !== status) continue;
          if (syncMode && job.syncMode !== syncMode) continue;

          jobs.push({
            id: job.id,
            name: job.name,
            status: job.status,
            syncMode: job.syncMode,
            schedule: job.schedule,
            priority: job.priority,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
          });
        }
      }

      // 分页
      const paginatedJobs = jobs.slice(offset, offset + parseInt(limit));

      res.json({
        success: true,
        data: {
          jobs: paginatedJobs,
          total: jobs.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：获取同步任务详情
router.get(
  '/jobs/:id',
  [param('id').isString().notEmpty().withMessage('Job ID is required')],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const job = await dataSyncService.getSyncJob(id);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Sync job not found',
        });
      }

      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：更新同步任务
router.put(
  '/jobs/:id',
  [
    param('id').isString().notEmpty().withMessage('Job ID is required'),
    body('name').optional().isString().notEmpty(),
    body('sourceConfig').optional().isObject(),
    body('targetConfig').optional().isObject(),
    body('syncMode').optional().isIn(['full', 'incremental', 'realtime']),
    body('schedule').optional().isString(),
    body('priority').optional().isInt({ min: 1, max: 10 }),
    body('retryConfig').optional().isObject(),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const job = await dataSyncService.getSyncJob(id);
      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Sync job not found',
        });
      }

      // 更新任务配置
      const updatedJob = { ...job, ...updates, updatedAt: new Date().toISOString() };
      await dataSyncService.redis.hset('sync_jobs', id, JSON.stringify(updatedJob));

      // 如果调度表达式发生变化，重新设置调度器
      if (updates.schedule && updates.schedule !== job.schedule) {
        await dataSyncService.setupScheduler(id, updatedJob);
      }

      res.json({
        success: true,
        message: 'Sync job updated successfully',
        data: updatedJob,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：删除同步任务
router.delete(
  '/jobs/:id',
  [param('id').isString().notEmpty().withMessage('Job ID is required')],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const job = await dataSyncService.getSyncJob(id);
      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Sync job not found',
        });
      }

      // 取消任务
      await dataSyncService.cancelSync(id);

      // 从Redis删除
      await dataSyncService.redis.hdel('sync_jobs', id);

      res.json({
        success: true,
        message: 'Sync job deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：启动同步任务
router.post(
  '/jobs/:id/start',
  [param('id').isString().notEmpty().withMessage('Job ID is required')],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const executionId = await dataSyncService.startSync(id);

      res.json({
        success: true,
        message: 'Sync job started successfully',
        data: { executionId },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：暂停同步任务
router.post(
  '/jobs/:id/pause',
  [param('id').isString().notEmpty().withMessage('Job ID is required')],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await dataSyncService.pauseSync(id);

      res.json({
        success: true,
        message: 'Sync job paused successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：恢复同步任务
router.post(
  '/jobs/:id/resume',
  [param('id').isString().notEmpty().withMessage('Job ID is required')],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await dataSyncService.resumeSync(id);

      res.json({
        success: true,
        message: 'Sync job resumed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：取消同步任务
router.post(
  '/jobs/:id/cancel',
  [param('id').isString().notEmpty().withMessage('Job ID is required')],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await dataSyncService.cancelSync(id);

      res.json({
        success: true,
        message: 'Sync job cancelled successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：获取同步状态
router.get(
  '/jobs/:id/status',
  [param('id').isString().notEmpty().withMessage('Job ID is required')],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const status = await dataSyncService.getSyncStatus(id);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：获取执行历史
router.get(
  '/jobs/:id/executions',
  [
    param('id').isString().notEmpty().withMessage('Job ID is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      const executions = await dataSyncService.getJobExecutions(id, parseInt(limit));
      const paginatedExecutions = executions.slice(offset, offset + parseInt(limit));

      res.json({
        success: true,
        data: {
          executions: paginatedExecutions,
          total: executions.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：获取同步日志
router.get(
  '/jobs/:id/logs',
  [
    param('id').isString().notEmpty().withMessage('Job ID is required'),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('offset').optional().isInt({ min: 0 }),
    query('level').optional().isIn(['debug', 'info', 'warn', 'error']),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { limit = 100, offset = 0, level } = req.query;

      const logs = await dataSyncService.getSyncLogs(id, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        level,
      });

      res.json({
        success: true,
        data: {
          logs,
          total: logs.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：创建定时任务
router.post(
  '/scheduled-tasks',
  [
    body('name').isString().notEmpty().withMessage('Task name is required'),
    body('schedule').isString().notEmpty().withMessage('Schedule is required'),
    body('jobType')
      .isIn(['data_sync', 'data_cleanup', 'report_generation'])
      .withMessage('Invalid job type'),
    body('priority').isInt({ min: 1, max: 10 }).withMessage('Priority must be between 1 and 10'),
    body('config').optional().isObject().withMessage('Task configuration must be an object'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const taskConfig = {
        ...req.body,
        config: req.body.config || {},
      };

      const taskId = await schedulerService.createScheduledTask(taskConfig);

      res.status(201).json({
        success: true,
        message: 'Scheduled task created successfully',
        data: { taskId },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：获取定时任务列表
router.get('/scheduled-tasks', async (req, res, next) => {
  try {
    const tasks = await schedulerService.getAllScheduledTasks();

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    next(error);
  }
});

// 路由：获取定时任务状态
router.get(
  '/scheduled-tasks/:id/status',
  [param('id').isString().notEmpty().withMessage('Task ID is required')],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const status = await schedulerService.getTaskStatus(id);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：手动触发定时任务
router.post(
  '/scheduled-tasks/:id/trigger',
  [param('id').isString().notEmpty().withMessage('Task ID is required')],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await schedulerService.triggerTask(id);

      res.json({
        success: true,
        message: 'Task triggered successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：启动实时同步
router.post(
  '/realtime-syncs',
  [
    body('name').isString().notEmpty().withMessage('Sync name is required'),
    body('sourceConfig').isObject().withMessage('Source configuration is required'),
    body('targetConfig').isObject().withMessage('Target configuration is required'),
    body('syncMode').isIn(['polling', 'streaming', 'webhook']).withMessage('Invalid sync mode'),
    body('interval')
      .optional()
      .isInt({ min: 1000 })
      .withMessage('Interval must be at least 1000ms'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const syncConfig = req.body;
      const syncId = await realtimeSyncService.startRealtimeSync(syncConfig);

      res.status(201).json({
        success: true,
        message: 'Realtime sync started successfully',
        data: { syncId },
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：获取实时同步列表
router.get('/realtime-syncs', async (req, res, next) => {
  try {
    const syncs = await realtimeSyncService.getAllRealtimeSyncs();

    res.json({
      success: true,
      data: syncs,
    });
  } catch (error) {
    next(error);
  }
});

// 路由：获取实时同步状态
router.get(
  '/realtime-syncs/:id/status',
  [param('id').isString().notEmpty().withMessage('Sync ID is required')],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const status = await realtimeSyncService.getRealtimeSyncStatus(id);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：停止实时同步
router.post(
  '/realtime-syncs/:id/stop',
  [param('id').isString().notEmpty().withMessage('Sync ID is required')],
  validateRequest,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await realtimeSyncService.stopRealtimeSync(id);

      res.json({
        success: true,
        message: 'Realtime sync stopped successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：获取监控仪表盘数据
router.get('/dashboard', async (req, res, next) => {
  try {
    const dashboardData = await monitorService.getDashboardData();

    res.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    next(error);
  }
});

// 路由：获取监控指标
router.get(
  '/metrics',
  [
    query('startTime').optional().isISO8601().withMessage('Start time must be ISO 8601 format'),
    query('endTime').optional().isISO8601().withMessage('End time must be ISO 8601 format'),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { startTime, endTime, limit = 100 } = req.query;
      const metrics = await monitorService.getMetrics({
        startTime,
        endTime,
        limit: parseInt(limit),
      });

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：获取告警列表
router.get(
  '/alerts',
  [query('limit').optional().isInt({ min: 1, max: 100 })],
  validateRequest,
  async (req, res, next) => {
    try {
      const { limit = 10 } = req.query;
      const alerts = await monitorService.getRecentAlerts(parseInt(limit));

      res.json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 路由：获取调度器统计信息
router.get('/scheduler/stats', async (req, res, next) => {
  try {
    const stats = await schedulerService.getSchedulerStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

// 路由：获取实时同步服务统计信息
router.get('/realtime-syncs/stats', async (req, res, next) => {
  try {
    const stats = await realtimeSyncService.getServiceStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

// 路由：获取监控服务状态
router.get('/monitor/status', async (req, res, next) => {
  try {
    const status = await monitorService.getServiceStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

// 错误处理中间件
router.use(errorHandler);

module.exports = router;

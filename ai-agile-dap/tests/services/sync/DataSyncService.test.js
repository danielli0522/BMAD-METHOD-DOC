const { describe, it, beforeEach, afterEach, expect, jest } = require('@jest/globals');
const DataSyncService = require('../../../src/services/sync/DataSyncService');

// Mock Redis
jest.mock('ioredis', () => {
  const Redis = jest.fn().mockImplementation(() => ({
    hset: jest.fn().mockResolvedValue(1),
    hget: jest.fn().mockResolvedValue(null),
    hkeys: jest.fn().mockResolvedValue([]),
    hgetall: jest.fn().mockResolvedValue({}),
    lrange: jest.fn().mockResolvedValue([]),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
  return Redis;
});

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({
    start: jest.fn(),
    stop: jest.fn(),
  }),
  validate: jest.fn().mockReturnValue(true),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-123'),
}));

describe('DataSyncService', () => {
  let dataSyncService;
  let mockRedis;

  beforeEach(() => {
    dataSyncService = new DataSyncService();
    mockRedis = dataSyncService.redis;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize the service successfully', async () => {
      await dataSyncService.initialize();

      expect(dataSyncService.isInitialized).toBe(true);
      expect(mockRedis.hset).toHaveBeenCalled();
    });

    it('should throw error if initialization fails', async () => {
      mockRedis.hset.mockRejectedValue(new Error('Redis connection failed'));

      await expect(dataSyncService.initialize()).rejects.toThrow('Redis connection failed');
    });
  });

  describe('createSyncJob', () => {
    beforeEach(async () => {
      await dataSyncService.initialize();
    });

    it('should create a sync job with valid configuration', async () => {
      const jobConfig = {
        name: 'Test Sync Job',
        sourceConfig: { type: 'mysql', host: 'localhost' },
        targetConfig: { type: 'postgresql', host: 'localhost' },
        syncMode: 'full',
        schedule: '0 0 * * *',
        priority: 5,
      };

      const jobId = await dataSyncService.createSyncJob(jobConfig);

      expect(jobId).toBe('test-uuid-123');
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'sync_jobs',
        'test-uuid-123',
        expect.stringContaining('Test Sync Job')
      );
    });

    it('should throw error for invalid job configuration', async () => {
      const invalidConfig = {
        name: '', // Invalid: empty name
        sourceConfig: { type: 'mysql' },
        targetConfig: { type: 'postgresql' },
        syncMode: 'invalid_mode', // Invalid: unsupported mode
      };

      await expect(dataSyncService.createSyncJob(invalidConfig)).rejects.toThrow();
    });

    it('should use provided job ID if available', async () => {
      const jobConfig = {
        id: 'custom-job-id',
        name: 'Test Sync Job',
        sourceConfig: { type: 'mysql' },
        targetConfig: { type: 'postgresql' },
        syncMode: 'full',
      };

      const jobId = await dataSyncService.createSyncJob(jobConfig);

      expect(jobId).toBe('custom-job-id');
    });
  });

  describe('startSync', () => {
    beforeEach(async () => {
      await dataSyncService.initialize();
    });

    it('should start a sync job successfully', async () => {
      const mockJob = {
        id: 'test-job-id',
        name: 'Test Job',
        status: 'inactive',
        sourceConfig: { type: 'mysql' },
        targetConfig: { type: 'postgresql' },
        syncMode: 'full',
      };

      mockRedis.hget.mockResolvedValue(JSON.stringify(mockJob));

      const executionId = await dataSyncService.startSync('test-job-id');

      expect(executionId).toBe('test-uuid-123');
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'sync_executions',
        'test-uuid-123',
        expect.stringContaining('running')
      );
    });

    it('should throw error if job not found', async () => {
      mockRedis.hget.mockResolvedValue(null);

      await expect(dataSyncService.startSync('non-existent-job')).rejects.toThrow(
        'Sync job non-existent-job not found'
      );
    });

    it('should throw error if job is already running', async () => {
      const mockJob = {
        id: 'test-job-id',
        status: 'running',
      };

      mockRedis.hget.mockResolvedValue(JSON.stringify(mockJob));

      await expect(dataSyncService.startSync('test-job-id')).rejects.toThrow(
        'Sync job test-job-id is already running'
      );
    });
  });

  describe('pauseSync', () => {
    beforeEach(async () => {
      await dataSyncService.initialize();
    });

    it('should pause a running sync job', async () => {
      const mockJob = {
        id: 'test-job-id',
        status: 'running',
      };

      mockRedis.hget.mockResolvedValue(JSON.stringify(mockJob));

      await dataSyncService.pauseSync('test-job-id');

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'sync_jobs',
        'test-job-id',
        expect.stringContaining('paused')
      );
    });

    it('should throw error if job is not running', async () => {
      const mockJob = {
        id: 'test-job-id',
        status: 'paused',
      };

      mockRedis.hget.mockResolvedValue(JSON.stringify(mockJob));

      await expect(dataSyncService.pauseSync('test-job-id')).rejects.toThrow(
        'Sync job test-job-id is not running'
      );
    });
  });

  describe('resumeSync', () => {
    beforeEach(async () => {
      await dataSyncService.initialize();
    });

    it('should resume a paused sync job', async () => {
      const mockJob = {
        id: 'test-job-id',
        status: 'paused',
        schedule: '0 0 * * *',
      };

      mockRedis.hget.mockResolvedValue(JSON.stringify(mockJob));

      await dataSyncService.resumeSync('test-job-id');

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'sync_jobs',
        'test-job-id',
        expect.stringContaining('running')
      );
    });

    it('should throw error if job is not paused', async () => {
      const mockJob = {
        id: 'test-job-id',
        status: 'running',
      };

      mockRedis.hget.mockResolvedValue(JSON.stringify(mockJob));

      await expect(dataSyncService.resumeSync('test-job-id')).rejects.toThrow(
        'Sync job test-job-id is not paused'
      );
    });
  });

  describe('cancelSync', () => {
    beforeEach(async () => {
      await dataSyncService.initialize();
    });

    it('should cancel a sync job', async () => {
      const mockJob = {
        id: 'test-job-id',
        status: 'running',
      };

      mockRedis.hget.mockResolvedValue(JSON.stringify(mockJob));

      await dataSyncService.cancelSync('test-job-id');

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'sync_jobs',
        'test-job-id',
        expect.stringContaining('cancelled')
      );
    });
  });

  describe('getSyncStatus', () => {
    beforeEach(async () => {
      await dataSyncService.initialize();
    });

    it('should return sync status for a job', async () => {
      const mockJob = {
        id: 'test-job-id',
        name: 'Test Job',
        status: 'running',
        schedule: '0 0 * * *',
      };

      mockRedis.hget.mockResolvedValue(JSON.stringify(mockJob));
      mockRedis.hkeys.mockResolvedValue([]);

      const status = await dataSyncService.getSyncStatus('test-job-id');

      expect(status).toEqual({
        jobId: 'test-job-id',
        status: 'running',
        lastExecution: undefined,
        nextScheduledRun: expect.any(Date),
        metrics: expect.any(Object),
      });
    });

    it('should throw error if job not found', async () => {
      mockRedis.hget.mockResolvedValue(null);

      await expect(dataSyncService.getSyncStatus('non-existent-job')).rejects.toThrow(
        'Sync job non-existent-job not found'
      );
    });
  });

  describe('getSyncLogs', () => {
    beforeEach(async () => {
      await dataSyncService.initialize();
    });

    it('should return sync logs for a job', async () => {
      const mockLogs = [
        JSON.stringify({ level: 'info', message: 'Test log 1', createdAt: '2024-01-01T00:00:00Z' }),
        JSON.stringify({
          level: 'error',
          message: 'Test log 2',
          createdAt: '2024-01-01T00:01:00Z',
        }),
      ];

      mockRedis.hkeys.mockResolvedValue(['execution-1', 'execution-2']);
      mockRedis.lrange.mockResolvedValue(mockLogs);

      const logs = await dataSyncService.getSyncLogs('test-job-id', { limit: 10 });

      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe('error'); // Should be sorted by timestamp desc
      expect(logs[1].level).toBe('info');
    });

    it('should filter logs by level', async () => {
      const mockLogs = [
        JSON.stringify({ level: 'info', message: 'Test log 1', createdAt: '2024-01-01T00:00:00Z' }),
        JSON.stringify({
          level: 'error',
          message: 'Test log 2',
          createdAt: '2024-01-01T00:01:00Z',
        }),
      ];

      mockRedis.hkeys.mockResolvedValue(['execution-1']);
      mockRedis.lrange.mockResolvedValue(mockLogs);

      const logs = await dataSyncService.getSyncLogs('test-job-id', { level: 'error' });

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
    });
  });

  describe('validateJobConfig', () => {
    it('should validate job configuration correctly', () => {
      const validConfig = {
        name: 'Test Job',
        sourceConfig: { type: 'mysql' },
        targetConfig: { type: 'postgresql' },
        syncMode: 'full',
      };

      expect(() => dataSyncService.validateJobConfig(validConfig)).not.toThrow();
    });

    it('should throw error for missing name', () => {
      const invalidConfig = {
        sourceConfig: { type: 'mysql' },
        targetConfig: { type: 'postgresql' },
        syncMode: 'full',
      };

      expect(() => dataSyncService.validateJobConfig(invalidConfig)).toThrow(
        'Job name is required'
      );
    });

    it('should throw error for missing source config', () => {
      const invalidConfig = {
        name: 'Test Job',
        targetConfig: { type: 'postgresql' },
        syncMode: 'full',
      };

      expect(() => dataSyncService.validateJobConfig(invalidConfig)).toThrow(
        'Source configuration is required'
      );
    });

    it('should throw error for missing target config', () => {
      const invalidConfig = {
        name: 'Test Job',
        sourceConfig: { type: 'mysql' },
        syncMode: 'full',
      };

      expect(() => dataSyncService.validateJobConfig(invalidConfig)).toThrow(
        'Target configuration is required'
      );
    });

    it('should throw error for invalid sync mode', () => {
      const invalidConfig = {
        name: 'Test Job',
        sourceConfig: { type: 'mysql' },
        targetConfig: { type: 'postgresql' },
        syncMode: 'invalid_mode',
      };

      expect(() => dataSyncService.validateJobConfig(invalidConfig)).toThrow('Invalid sync mode');
    });
  });

  describe('getJobMetrics', () => {
    beforeEach(async () => {
      await dataSyncService.initialize();
    });

    it('should return metrics for a job with executions', async () => {
      const mockExecutions = [
        {
          id: 'execution-1',
          jobId: 'test-job-id',
          status: 'completed',
          startedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T00:01:00Z',
          recordsProcessed: 100,
          recordsFailed: 5,
        },
        {
          id: 'execution-2',
          jobId: 'test-job-id',
          status: 'completed',
          startedAt: '2024-01-01T00:02:00Z',
          completedAt: '2024-01-01T00:03:00Z',
          recordsProcessed: 200,
          recordsFailed: 10,
        },
      ];

      mockRedis.hkeys.mockResolvedValue(['execution-1', 'execution-2']);
      mockRedis.hget
        .mockResolvedValueOnce(JSON.stringify(mockExecutions[0]))
        .mockResolvedValueOnce(JSON.stringify(mockExecutions[1]));

      const metrics = await dataSyncService.getJobMetrics('test-job-id');

      expect(metrics).toEqual({
        totalExecutions: 2,
        successRate: 100,
        averageDuration: 60000, // 1 minute average
        totalRecordsProcessed: 300,
        totalRecordsFailed: 15,
      });
    });

    it('should return default metrics for job without executions', async () => {
      mockRedis.hkeys.mockResolvedValue([]);

      const metrics = await dataSyncService.getJobMetrics('test-job-id');

      expect(metrics).toEqual({
        totalExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        totalRecordsProcessed: 0,
        totalRecordsFailed: 0,
      });
    });
  });

  describe('close', () => {
    beforeEach(async () => {
      await dataSyncService.initialize();
    });

    it('should close the service properly', async () => {
      await dataSyncService.close();

      expect(dataSyncService.isInitialized).toBe(false);
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});

/**
 * ConnectionPoolManager 单元测试
 */

const ConnectionPoolManager = require('../../../src/services/datasource/managers/ConnectionPoolManager');

// Mock mysql2/promise
jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(() => ({
    getConnection: jest.fn(() =>
      Promise.resolve({
        execute: jest.fn(() => Promise.resolve([{ test: 1 }])),
        release: jest.fn(),
      })
    ),
    end: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    pool: {
      allConnections: [],
      freeConnections: [],
      usedConnections: [],
    },
  })),
}));

describe('ConnectionPoolManager', () => {
  let poolManager;
  let mockPool;

  beforeEach(() => {
    poolManager = new ConnectionPoolManager();
    mockPool = require('mysql2/promise').createPool();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // 清理所有连接池
    const poolIds = Array.from(poolManager.pools.keys());
    for (const poolId of poolIds) {
      await poolManager.closePool(poolId);
    }
  });

  describe('createMySQLPool', () => {
    const validConfig = {
      id: 'test-pool',
      host: 'localhost',
      port: 3306,
      database: 'test_db',
      user: 'test_user',
      password: 'test_password',
    };

    test('should create MySQL pool with valid configuration', async () => {
      const result = await poolManager.createMySQLPool(validConfig);

      expect(result).toHaveProperty('poolId');
      expect(result).toHaveProperty('pool');
      expect(result).toHaveProperty('status', 'active');
      expect(poolManager.pools.has(result.poolId)).toBe(true);
    });

    test('should throw error for invalid configuration', async () => {
      const invalidConfig = {
        host: 'localhost',
        // missing required fields
      };

      await expect(poolManager.createMySQLPool(invalidConfig)).rejects.toThrow(
        'Failed to create MySQL pool'
      );
    });

    test('should encrypt sensitive data', async () => {
      const result = await poolManager.createMySQLPool(validConfig);
      const storedConfig = poolManager.poolConfigs.get(result.poolId);

      expect(storedConfig.password).not.toBe(validConfig.password);
      expect(storedConfig.password).toContain(':');
    });

    test('should set up pool monitoring', async () => {
      const result = await poolManager.createMySQLPool(validConfig);

      expect(mockPool.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should initialize pool statistics', async () => {
      const result = await poolManager.createMySQLPool(validConfig);
      const stats = poolManager.poolStats.get(result.poolId);

      expect(stats).toHaveProperty('created');
      expect(stats).toHaveProperty('totalConnections', 0);
      expect(stats).toHaveProperty('activeConnections', 0);
      expect(stats).toHaveProperty('errors', 0);
    });
  });

  describe('getConnection', () => {
    let poolId;

    beforeEach(async () => {
      const config = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };
      const result = await poolManager.createMySQLPool(config);
      poolId = result.poolId;
    });

    test('should get connection from pool', async () => {
      const connection = await poolManager.getConnection(poolId);

      expect(connection).toBeDefined();
      expect(mockPool.getConnection).toHaveBeenCalled();
    });

    test('should update statistics when getting connection', async () => {
      await poolManager.getConnection(poolId);

      const stats = poolManager.poolStats.get(poolId);
      expect(stats.totalConnections).toBe(1);
      expect(stats.activeConnections).toBe(1);
    });

    test('should throw error for non-existent pool', async () => {
      await expect(poolManager.getConnection('non-existent')).rejects.toThrow(
        'Pool not found: non-existent'
      );
    });
  });

  describe('releaseConnection', () => {
    let poolId;
    let connection;

    beforeEach(async () => {
      const config = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };
      const result = await poolManager.createMySQLPool(config);
      poolId = result.poolId;
      connection = await poolManager.getConnection(poolId);
    });

    test('should release connection and update statistics', () => {
      poolManager.releaseConnection(poolId, connection);

      expect(connection.release).toHaveBeenCalled();

      const stats = poolManager.poolStats.get(poolId);
      expect(stats.activeConnections).toBe(0);
    });
  });

  describe('getPoolStatus', () => {
    let poolId;

    beforeEach(async () => {
      const config = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };
      const result = await poolManager.createMySQLPool(config);
      poolId = result.poolId;
    });

    test('should return pool status', () => {
      const status = poolManager.getPoolStatus(poolId);

      expect(status).toHaveProperty('poolId', poolId);
      expect(status).toHaveProperty('status', 'active');
      expect(status).toHaveProperty('stats');
      expect(status.stats).toHaveProperty('poolSize');
      expect(status.stats).toHaveProperty('freeConnections');
      expect(status.stats).toHaveProperty('usedConnections');
    });

    test('should return null for non-existent pool', () => {
      const status = poolManager.getPoolStatus('non-existent');
      expect(status).toBeNull();
    });
  });

  describe('closePool', () => {
    let poolId;

    beforeEach(async () => {
      const config = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };
      const result = await poolManager.createMySQLPool(config);
      poolId = result.poolId;
    });

    test('should close pool and clean up resources', async () => {
      await poolManager.closePool(poolId);

      expect(mockPool.end).toHaveBeenCalled();
      expect(poolManager.pools.has(poolId)).toBe(false);
      expect(poolManager.poolConfigs.has(poolId)).toBe(false);
      expect(poolManager.poolStats.has(poolId)).toBe(false);
    });
  });

  describe('getAllPoolStatus', () => {
    test('should return status for all pools', async () => {
      const config1 = {
        id: 'pool1',
        host: 'localhost',
        database: 'test_db1',
        user: 'test_user',
        password: 'test_password',
      };
      const config2 = {
        id: 'pool2',
        host: 'localhost',
        database: 'test_db2',
        user: 'test_user',
        password: 'test_password',
      };

      await poolManager.createMySQLPool(config1);
      await poolManager.createMySQLPool(config2);

      const allStatus = poolManager.getAllPoolStatus();

      expect(allStatus).toHaveLength(2);
      expect(allStatus[0]).toHaveProperty('poolId');
      expect(allStatus[1]).toHaveProperty('poolId');
    });

    test('should return empty array when no pools exist', () => {
      const allStatus = poolManager.getAllPoolStatus();
      expect(allStatus).toHaveLength(0);
    });
  });

  describe('encryption/decryption', () => {
    test('should encrypt and decrypt text correctly', () => {
      const originalText = 'test-password-123';
      const encrypted = poolManager.encrypt(originalText);
      const decrypted = poolManager.decrypt(encrypted);

      expect(encrypted).not.toBe(originalText);
      expect(encrypted).toContain(':');
      expect(decrypted).toBe(originalText);
    });
  });

  describe('configuration validation', () => {
    test('should validate required fields', () => {
      const invalidConfigs = [
        { host: 'localhost' }, // missing database, user, password
        { database: 'test' }, // missing host, user, password
        { host: 'localhost', database: 'test' }, // missing user, password
        { host: 'localhost', database: 'test', user: 'test' }, // missing password
      ];

      for (const config of invalidConfigs) {
        expect(() => poolManager.validateConfig(config)).toThrow();
      }
    });

    test('should validate port number', () => {
      const configWithInvalidPort = {
        host: 'localhost',
        port: 99999, // invalid port
        database: 'test',
        user: 'test',
        password: 'test',
      };

      expect(() => poolManager.validateConfig(configWithInvalidPort)).toThrow(
        'Invalid port number'
      );
    });
  });

  describe('event emission', () => {
    test('should emit pool-created event', async () => {
      const eventSpy = jest.fn();
      poolManager.on('pool-created', eventSpy);

      const config = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      await poolManager.createMySQLPool(config);

      expect(eventSpy).toHaveBeenCalledWith({
        poolId: expect.any(String),
        config: expect.any(Object),
      });
    });

    test('should emit connection-acquired event', async () => {
      const eventSpy = jest.fn();
      poolManager.on('connection-acquired', eventSpy);

      const config = {
        host: 'localhost',
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      const result = await poolManager.createMySQLPool(config);
      await poolManager.getConnection(result.poolId);

      expect(eventSpy).toHaveBeenCalledWith({
        poolId: result.poolId,
      });
    });
  });
});

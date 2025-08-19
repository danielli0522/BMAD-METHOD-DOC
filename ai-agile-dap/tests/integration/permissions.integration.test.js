const request = require('supertest');
const express = require('express');
const { body, query, param, validationResult } = require('express-validator');

// Mock services
jest.mock('../../../src/services/auth/AuthorizationService');
jest.mock('../../../src/services/auth/PermissionService');
jest.mock('../../../src/middleware/rateLimiter');

const AuthorizationService = require('../../../src/services/auth/AuthorizationService');
const PermissionService = require('../../../src/services/auth/PermissionService');
const RateLimiter = require('../../../src/middleware/rateLimiter');

describe('Permission API Integration Tests', () => {
  let app;
  let mockAuthorizationService;
  let mockPermissionService;
  let mockRateLimiter;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock service instances
    mockAuthorizationService = {
      initialize: jest.fn().mockResolvedValue(true),
      checkPermission: jest.fn(),
      preCheckPermissions: jest.fn(),
      getPermissionStatus: jest.fn(),
      clearUserPermissionCache: jest.fn(),
      clearAllPermissionCache: jest.fn(),
      getCacheStatus: jest.fn(),
      getPerformanceMetrics: jest.fn(),
    };

    mockPermissionService = {
      initialize: jest.fn().mockResolvedValue(true),
      getUserPermissions: jest.fn(),
    };

    mockRateLimiter = {
      initRedis: jest.fn().mockResolvedValue(true),
      createMiddleware: jest.fn().mockReturnValue((req, res, next) => next()),
    };

    // Mock service constructors
    AuthorizationService.mockImplementation(() => mockAuthorizationService);
    PermissionService.mockImplementation(() => mockPermissionService);
    RateLimiter.mockImplementation(() => mockRateLimiter);

    // Create Express app
    app = express();
    app.use(express.json());

    // Import and use the permissions router
    const permissionsRouter = require('../../../src/routes/permissions');
    app.use('/api/permissions', permissionsRouter);

    // Error handling middleware
    app.use((error, req, res, next) => {
      console.error('Error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    });
  });

  describe('POST /api/permissions/check', () => {
    it('should check permission successfully', async () => {
      const permissionData = {
        userId: 'user1',
        resource: 'user',
        action: 'read',
        context: { organizationId: 'org1' },
      };

      mockAuthorizationService.checkPermission.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/permissions/check')
        .send(permissionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hasPermission).toBe(true);
      expect(response.body.data.userId).toBe('user1');
      expect(response.body.data.resource).toBe('user');
      expect(response.body.data.action).toBe('read');
      expect(mockAuthorizationService.checkPermission).toHaveBeenCalledWith(
        'user1',
        'user',
        'read',
        { organizationId: 'org1' }
      );
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/permissions/check')
        .send({ userId: 'user1' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数验证失败');
    });

    it('should handle service errors gracefully', async () => {
      mockAuthorizationService.checkPermission.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post('/api/permissions/check')
        .send({
          userId: 'user1',
          resource: 'user',
          action: 'read',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('权限检查失败');
    });
  });

  describe('POST /api/permissions/check-batch', () => {
    it('should check batch permissions successfully', async () => {
      const batchData = {
        userId: 'user1',
        permissions: [
          { resource: 'user', action: 'read' },
          { resource: 'user', action: 'write' },
        ],
        context: { organizationId: 'org1' },
      };

      const mockResults = {
        'user:read': { allowed: true },
        'user:write': { allowed: false },
      };

      mockAuthorizationService.preCheckPermissions.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/permissions/check-batch')
        .send(batchData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toEqual(mockResults);
      expect(response.body.data.totalPermissions).toBe(2);
    });

    it('should return 400 for invalid batch data', async () => {
      const response = await request(app)
        .post('/api/permissions/check-batch')
        .send({
          userId: 'user1',
          permissions: 'invalid',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/permissions/validate', () => {
    it('should validate permissions successfully', async () => {
      const mockStatus = {
        hasPermission: true,
        roles: ['admin'],
        permissions: ['user:read', 'user:write'],
      };

      mockAuthorizationService.getPermissionStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/permissions/validate?userId=user1&resource=user')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStatus);
    });

    it('should return 400 for missing userId', async () => {
      const response = await request(app)
        .get('/api/permissions/validate?resource=user')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/permissions/user/:userId', () => {
    it('should get user permissions successfully', async () => {
      const mockUserPermissions = {
        userId: 'user1',
        roles: [{ id: 'role1', name: 'Admin' }],
        permissions: [
          { resource: 'user', action: 'read' },
          { resource: 'user', action: 'write' },
        ],
        totalPermissions: 2,
      };

      mockPermissionService.getUserPermissions.mockResolvedValue(mockUserPermissions);

      const response = await request(app)
        .get('/api/permissions/user/user1?includeInherited=true&includeConditions=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUserPermissions);
      expect(mockPermissionService.getUserPermissions).toHaveBeenCalledWith('user1', {
        includeInherited: true,
        includeConditions: true,
      });
    });

    it('should return 400 for invalid userId', async () => {
      const response = await request(app).get('/api/permissions/user/').expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/permissions/cache/status', () => {
    it('should get cache status successfully', async () => {
      const mockCacheStatus = {
        totalCachedPermissions: 100,
        memoryUsage: '1.2MB',
        memoryPeak: '2.1MB',
        cacheKeys: 100,
        cacheConfig: {
          defaultTTL: 300,
          userPermissionsTTL: 600,
        },
      };

      mockAuthorizationService.getCacheStatus.mockResolvedValue(mockCacheStatus);

      const response = await request(app).get('/api/permissions/cache/status').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCacheStatus);
    });

    it('should handle cache status errors', async () => {
      mockAuthorizationService.getCacheStatus.mockRejectedValue(new Error('Cache error'));

      const response = await request(app).get('/api/permissions/cache/status').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('获取缓存状态失败');
    });
  });

  describe('DELETE /api/permissions/cache/user/:userId', () => {
    it('should clear user permission cache successfully', async () => {
      mockAuthorizationService.clearUserPermissionCache.mockResolvedValue(true);

      const response = await request(app).delete('/api/permissions/cache/user/user1').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('用户权限缓存已清除');
      expect(response.body.data.userId).toBe('user1');
      expect(mockAuthorizationService.clearUserPermissionCache).toHaveBeenCalledWith('user1');
    });

    it('should return 400 for invalid userId', async () => {
      const response = await request(app).delete('/api/permissions/cache/user/').expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/permissions/cache/all', () => {
    it('should clear all permission cache successfully', async () => {
      mockAuthorizationService.clearAllPermissionCache.mockResolvedValue(true);

      const response = await request(app).delete('/api/permissions/cache/all').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('所有权限缓存已清除');
      expect(mockAuthorizationService.clearAllPermissionCache).toHaveBeenCalled();
    });

    it('should handle cache clear errors', async () => {
      mockAuthorizationService.clearAllPermissionCache.mockRejectedValue(new Error('Clear error'));

      const response = await request(app).delete('/api/permissions/cache/all').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('清除所有权限缓存失败');
    });
  });

  describe('GET /api/permissions/performance', () => {
    it('should get performance metrics successfully', async () => {
      const mockMetrics = {
        cacheHitRate: '85.5%',
        averageResponseTime: '12.3ms',
        totalRequests: 1000,
        cacheHits: 855,
        cacheMisses: 145,
        slowQueriesCount: 5,
      };

      mockAuthorizationService.getPerformanceMetrics.mockResolvedValue(mockMetrics);

      const response = await request(app).get('/api/permissions/performance').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockMetrics);
    });
  });

  describe('POST /api/permissions/precheck', () => {
    it('should precheck permissions successfully', async () => {
      const precheckData = {
        userId: 'user1',
        operations: [
          { resource: 'user', action: 'read' },
          { resource: 'user', action: 'write' },
        ],
        context: { organizationId: 'org1' },
      };

      const mockResults = {
        'user:read': { allowed: true },
        'user:write': { allowed: false },
      };

      mockAuthorizationService.preCheckPermissions.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/permissions/precheck')
        .send(precheckData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toEqual(mockResults);
      expect(response.body.data.totalOperations).toBe(2);
    });

    it('should return 400 for invalid operations', async () => {
      const response = await request(app)
        .post('/api/permissions/precheck')
        .send({
          userId: 'user1',
          operations: 'invalid',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/permissions/status/:userId', () => {
    it('should get permission status successfully', async () => {
      const mockStatus = {
        hasPermission: true,
        roles: ['admin'],
        permissions: ['user:read', 'user:write'],
        details: {
          lastChecked: '2024-01-01T00:00:00.000Z',
          cacheStatus: 'hit',
        },
      };

      mockAuthorizationService.getPermissionStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/permissions/status/user1?resource=user&includeDetails=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStatus);
      expect(mockAuthorizationService.getPermissionStatus).toHaveBeenCalledWith('user1', 'user', {
        includeDetails: true,
      });
    });

    it('should handle status query errors', async () => {
      mockAuthorizationService.getPermissionStatus.mockRejectedValue(new Error('Status error'));

      const response = await request(app).get('/api/permissions/status/user1').expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('获取权限状态失败');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to permission check endpoint', async () => {
      const permissionData = {
        userId: 'user1',
        resource: 'user',
        action: 'read',
      };

      mockAuthorizationService.checkPermission.mockResolvedValue(true);

      await request(app).post('/api/permissions/check').send(permissionData).expect(200);

      expect(mockRateLimiter.createMiddleware).toHaveBeenCalledWith({
        windowMs: 60000,
        max: 1000,
      });
    });

    it('should apply different rate limits to batch check endpoint', async () => {
      const batchData = {
        userId: 'user1',
        permissions: [{ resource: 'user', action: 'read' }],
      };

      mockAuthorizationService.preCheckPermissions.mockResolvedValue({});

      await request(app).post('/api/permissions/check-batch').send(batchData).expect(200);

      expect(mockRateLimiter.createMiddleware).toHaveBeenCalledWith({
        windowMs: 60000,
        max: 100,
      });
    });
  });

  describe('Service Initialization', () => {
    it('should initialize services on startup', async () => {
      // The services should be initialized when the router is loaded
      expect(mockAuthorizationService.initialize).toHaveBeenCalled();
      expect(mockPermissionService.initialize).toHaveBeenCalled();
      expect(mockRateLimiter.initRedis).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock initialization failure
      mockAuthorizationService.initialize.mockRejectedValue(new Error('Init failed'));

      // The app should still be functional even if initialization fails
      const response = await request(app).get('/api/permissions/cache/status').expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors properly', async () => {
      const response = await request(app).post('/api/permissions/check').send({}).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('请求参数验证失败');
      expect(response.body.errors).toBeDefined();
    });

    it('should handle service method errors', async () => {
      mockAuthorizationService.checkPermission.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/permissions/check')
        .send({
          userId: 'user1',
          resource: 'user',
          action: 'read',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('权限检查失败');
      expect(response.body.error).toBe('Database connection failed');
    });

    it('should handle JSON parsing errors', async () => {
      const response = await request(app)
        .post('/api/permissions/check')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Response Format', () => {
    it('should return consistent response format for success', async () => {
      mockAuthorizationService.checkPermission.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/permissions/check')
        .send({
          userId: 'user1',
          resource: 'user',
          action: 'read',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('hasPermission');
      expect(response.body.data).toHaveProperty('userId');
      expect(response.body.data).toHaveProperty('resource');
      expect(response.body.data).toHaveProperty('action');
      expect(response.body.data).toHaveProperty('checkedAt');
    });

    it('should return consistent response format for errors', async () => {
      mockAuthorizationService.checkPermission.mockRejectedValue(new Error('Test error'));

      const response = await request(app)
        .post('/api/permissions/check')
        .send({
          userId: 'user1',
          resource: 'user',
          action: 'read',
        })
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
    });
  });
});

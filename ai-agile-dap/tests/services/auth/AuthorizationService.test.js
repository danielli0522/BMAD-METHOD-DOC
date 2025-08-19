/**
 * AuthorizationService 单元测试
 * Task 8: 权限控制系统单元测试
 */

const AuthorizationService = require('../../../src/services/auth/AuthorizationService');

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    keys: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
    on: jest.fn()
  }))
}));

describe('AuthorizationService', () => {
  let authService;
  let mockRedisClient;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();
    
    // 创建mock Redis客户端
    const redis = require('redis');
    mockRedisClient = redis.createClient();
    
    // 创建服务实例
    authService = new AuthorizationService();
    authService.redisClient = mockRedisClient;
  });

  afterEach(async () => {
    if (authService) {
      await authService.close();
    }
  });

  describe('checkPermission', () => {
    const mockUser = {
      id: 'user1',
      email: 'user1@example.com',
      role: 'user',
      organizationId: 'org1'
    };

    beforeEach(() => {
      // Mock getUserRoles
      jest.spyOn(authService, 'getUserRoles').mockResolvedValue([
        { id: 'user', name: 'User', description: '普通用户' }
      ]);
      
      // Mock getRolePermissions
      jest.spyOn(authService, 'getRolePermissions').mockResolvedValue([
        { resource: 'query', action: 'read', conditions: { time_limit: { business_hours: true } } }
      ]);
    });

    test('应该成功检查权限并返回允许结果', async () => {
      // 模拟缓存未命中
      mockRedisClient.get.mockResolvedValue(null);
      
      // Mock checkTimeCondition返回true
      jest.spyOn(authService, 'checkTimeCondition').mockReturnValue(true);

      const result = await authService.checkPermission(mockUser, 'query', 'read');

      expect(result).toEqual({
        allowed: true,
        reason: 'CONDITIONAL_PERMISSION_GRANTED',
        permission: {
          resource: 'query',
          action: 'read',
          conditions: { time_limit: { business_hours: true } }
        },
        conditions: { time_limit: { business_hours: true } }
      });

      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });

    test('应该从缓存返回权限检查结果', async () => {
      const cachedResult = {
        allowed: true,
        reason: 'CACHED_RESULT'
      };
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await authService.checkPermission(mockUser, 'query', 'read');

      expect(result).toEqual(cachedResult);
      expect(authService.getUserRoles).not.toHaveBeenCalled();
      expect(mockRedisClient.setEx).not.toHaveBeenCalled();
    });

    test('应该拒绝没有权限的操作', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      
      // Mock没有匹配权限
      jest.spyOn(authService, 'getRolePermissions').mockResolvedValue([]);

      const result = await authService.checkPermission(mockUser, 'admin', 'manage');

      expect(result).toEqual({
        allowed: false,
        reason: 'NO_PERMISSION',
        message: 'No permission found for admin:manage'
      });
    });

    test('应该处理条件不满足的情况', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      
      // Mock checkTimeCondition返回false
      jest.spyOn(authService, 'checkTimeCondition').mockReturnValue(false);

      const result = await authService.checkPermission(mockUser, 'query', 'read');

      expect(result).toEqual({
        allowed: false,
        reason: 'CONDITIONS_NOT_MET',
        message: 'Permission conditions not satisfied'
      });
    });
  });

  describe('preCheckPermissions', () => {
    const operations = [
      { resource: 'query', action: 'read' },
      { resource: 'report', action: 'write' }
    ];

    beforeEach(() => {
      jest.spyOn(authService, 'getUserById').mockResolvedValue({
        id: 'user1',
        email: 'user1@example.com'
      });
    });

    test('应该批量检查权限', async () => {
      jest.spyOn(authService, 'checkPermission')
        .mockResolvedValueOnce({ allowed: true, reason: 'GRANTED' })
        .mockResolvedValueOnce({ allowed: false, reason: 'DENIED' });

      const results = await authService.preCheckPermissions('user1', operations);

      expect(results).toEqual({
        'query:read': { allowed: true, reason: 'GRANTED' },
        'report:write': { allowed: false, reason: 'DENIED' }
      });

      expect(authService.checkPermission).toHaveBeenCalledTimes(2);
    });

    test('应该处理用户不存在的情况', async () => {
      jest.spyOn(authService, 'getUserById').mockResolvedValue(null);

      const results = await authService.preCheckPermissions('nonexistent', operations);

      expect(results).toEqual({
        'query:read': { allowed: false, reason: 'USER_NOT_FOUND' },
        'report:write': { allowed: false, reason: 'USER_NOT_FOUND' }
      });
    });
  });

  describe('getPermissionStatus', () => {
    beforeEach(() => {
      jest.spyOn(authService, 'getUserById').mockResolvedValue({
        id: 'user1',
        email: 'user1@example.com'
      });
      
      jest.spyOn(authService, 'getUserRoles').mockResolvedValue([
        { id: 'user', name: 'User', description: '普通用户' }
      ]);
      
      jest.spyOn(authService, 'getRolePermissions').mockResolvedValue([
        { resource: 'query', action: 'read', conditions: {} },
        { resource: 'query', action: 'write', conditions: { own_only: true } },
        { resource: 'report', action: 'read', conditions: {} }
      ]);
    });

    test('应该返回用户完整权限状态', async () => {
      const status = await authService.getPermissionStatus('user1');

      expect(status).toMatchObject({
        userId: 'user1',
        roles: expect.arrayContaining([
          expect.objectContaining({
            id: 'user',
            name: 'User'
          })
        ]),
        permissions: {
          query: expect.arrayContaining([
            { action: 'read', conditions: {}, granted: true },
            { action: 'write', conditions: { own_only: true }, granted: true }
          ]),
          report: expect.arrayContaining([
            { action: 'read', conditions: {}, granted: true }
          ])
        },
        summary: {
          totalRoles: 1,
          totalPermissions: 3,
          resourcesCount: 2
        }
      });

      expect(status.lastUpdated).toBeDefined();
    });
  });
});
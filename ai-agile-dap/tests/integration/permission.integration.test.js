/**
 * 权限系统集成测试
 * Task 8: 权限控制系统完整集成测试
 */

const request = require('supertest');
const express = require('express');
const permissionRoutes = require('../../src/routes/permissions');
const permissionGroupRoutes = require('../../src/routes/permissionGroups');
const { requireAuth } = require('../../src/middleware/auth');

// Mock认证中间件
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    req.user = {
      id: 'testuser1',
      email: 'test@example.com',
      role: 'admin',
      organizationId: 'org1'
    };
    next();
  }
}));

// Mock服务
jest.mock('../../src/services/auth/AuthorizationService');
jest.mock('../../src/services/auth/PermissionGroupService');

describe('权限系统集成测试', () => {
  let app;
  let authService;
  let groupService;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/permissions', permissionRoutes);
    app.use('/api/permission-groups', permissionGroupRoutes);

    // 获取mock实例
    const AuthorizationService = require('../../src/services/auth/AuthorizationService');
    const PermissionGroupService = require('../../src/services/auth/PermissionGroupService');
    
    authService = new AuthorizationService();
    groupService = new PermissionGroupService();

    jest.clearAllMocks();
  });

  describe('权限检查API集成测试', () => {
    describe('POST /api/permissions/check', () => {
      test('应该成功检查单个权限', async () => {
        const mockResult = {
          allowed: true,
          reason: 'PERMISSION_GRANTED',
          resource: 'query',
          action: 'read'
        };

        authService.checkPermission = jest.fn().mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/permissions/check')
          .send({
            resource: 'query',
            action: 'read',
            context: { organizationId: 'org1' }
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          result: {
            allowed: true,
            reason: 'PERMISSION_GRANTED',
            resource: 'query',
            action: 'read',
            userId: 'testuser1'
          }
        });

        expect(authService.checkPermission).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'testuser1' }),
          'query',
          'read',
          { organizationId: 'org1' }
        );
      });

      test('应该处理权限被拒绝的情况', async () => {
        const mockResult = {
          allowed: false,
          reason: 'NO_PERMISSION'
        };

        authService.checkPermission = jest.fn().mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/permissions/check')
          .send({
            resource: 'admin',
            action: 'manage'
          });

        expect(response.status).toBe(200);
        expect(response.body.result.allowed).toBe(false);
        expect(response.body.result.reason).toBe('NO_PERMISSION');
      });

      test('应该验证必需参数', async () => {
        const response = await request(app)
          .post('/api/permissions/check')
          .send({
            resource: 'query'
            // 缺少action参数
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('INVALID_REQUEST');
      });

      test('应该处理服务错误', async () => {
        authService.checkPermission = jest.fn().mockRejectedValue(new Error('Service error'));

        const response = await request(app)
          .post('/api/permissions/check')
          .send({
            resource: 'query',
            action: 'read'
          });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('PERMISSION_CHECK_FAILED');
      });
    });

    describe('POST /api/permissions/pre-check', () => {
      test('应该批量检查多个权限', async () => {
        const mockResults = {
          'query:read': { allowed: true, reason: 'GRANTED' },
          'report:write': { allowed: false, reason: 'DENIED' }
        };

        authService.preCheckPermissions = jest.fn().mockResolvedValue(mockResults);

        const response = await request(app)
          .post('/api/permissions/pre-check')
          .send({
            operations: [
              { resource: 'query', action: 'read' },
              { resource: 'report', action: 'write' }
            ]
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          summary: {
            totalOperations: 2,
            allowed: 1,
            denied: 1,
            userId: 'testuser1'
          },
          results: mockResults
        });
      });

      test('应该验证operations参数格式', async () => {
        const response = await request(app)
          .post('/api/permissions/pre-check')
          .send({
            operations: [
              { resource: 'query' } // 缺少action
            ]
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('INVALID_OPERATION');
      });
    });

    describe('GET /api/permissions/status', () => {
      test('应该返回用户权限状态', async () => {
        const mockStatus = {
          userId: 'testuser1',
          roles: [{ id: 'admin', name: 'Administrator' }],
          permissions: {
            query: [{ action: 'read', granted: true }],
            report: [{ action: 'write', granted: true }]
          },
          summary: {
            totalRoles: 1,
            totalPermissions: 2,
            resourcesCount: 2
          }
        };

        authService.getPermissionStatus = jest.fn().mockResolvedValue(mockStatus);

        const response = await request(app)
          .get('/api/permissions/status');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          permissionStatus: mockStatus
        });
      });

      test('应该支持特定资源查询', async () => {
        const mockStatus = {
          userId: 'testuser1',
          resource: 'query',
          permissions: [{ action: 'read', granted: true }]
        };

        authService.getPermissionStatus = jest.fn().mockResolvedValue(mockStatus);

        const response = await request(app)
          .get('/api/permissions/status?resource=query');

        expect(response.status).toBe(200);
        expect(authService.getPermissionStatus).toHaveBeenCalledWith('testuser1', 'query');
      });
    });
  });

  describe('权限组管理API集成测试', () => {
    describe('POST /api/permission-groups', () => {
      test('应该成功创建权限组', async () => {
        const mockGroup = {
          id: 'group1',
          name: 'Test Group',
          description: 'A test group',
          organizationId: 'org1',
          permissions: [{ resource: 'query', action: 'read' }],
          createdAt: '2024-01-01T00:00:00.000Z'
        };

        groupService.createPermissionGroup = jest.fn().mockResolvedValue(mockGroup);

        const response = await request(app)
          .post('/api/permission-groups')
          .send({
            name: 'Test Group',
            description: 'A test group',
            permissions: [{ resource: 'query', action: 'read' }]
          });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          message: '权限组创建成功',
          data: mockGroup
        });

        expect(groupService.createPermissionGroup).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Group',
            organizationId: 'org1'
          })
        );
      });

      test('应该处理创建失败的情况', async () => {
        groupService.createPermissionGroup = jest.fn()
          .mockRejectedValue(new Error('权限组名称已存在'));

        const response = await request(app)
          .post('/api/permission-groups')
          .send({
            name: 'Duplicate Group'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('CREATE_GROUP_FAILED');
        expect(response.body.message).toBe('权限组名称已存在');
      });
    });

    describe('GET /api/permission-groups/:groupId/permissions', () => {
      test('应该返回权限组的完整权限', async () => {
        const mockGroup = {
          id: 'group1',
          name: 'Test Group',
          permissions: [{ resource: 'query', action: 'read' }]
        };

        const mockCompletePermissions = [
          { resource: 'query', action: 'read' },
          { resource: 'report', action: 'read' } // 继承的权限
        ];

        groupService.getGroupById = jest.fn().mockResolvedValue(mockGroup);
        groupService.getGroupCompletePermissions = jest.fn()
          .mockResolvedValue(mockCompletePermissions);

        const response = await request(app)
          .get('/api/permission-groups/group1/permissions');

        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({
          groupId: 'group1',
          groupName: 'Test Group',
          directPermissions: [{ resource: 'query', action: 'read' }],
          inheritedPermissions: [{ resource: 'report', action: 'read' }],
          completePermissions: mockCompletePermissions,
          permissionCount: 2
        });
      });

      test('应该处理权限组不存在的情况', async () => {
        groupService.getGroupById = jest.fn().mockResolvedValue(null);

        const response = await request(app)
          .get('/api/permission-groups/nonexistent/permissions');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('GROUP_NOT_FOUND');
      });
    });

    describe('POST /api/permission-groups/:groupId/users/:userId', () => {
      test('应该成功为用户分配权限组', async () => {
        const mockAssignment = {
          userId: 'user1',
          groupId: 'group1',
          groupName: 'Test Group',
          assignedBy: 'testuser1',
          assignedAt: '2024-01-01T00:00:00.000Z'
        };

        groupService.assignGroupToUser = jest.fn().mockResolvedValue(mockAssignment);

        const response = await request(app)
          .post('/api/permission-groups/group1/users/user1');

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          message: '权限组分配成功',
          data: mockAssignment
        });

        expect(groupService.assignGroupToUser).toHaveBeenCalledWith(
          'user1',
          'group1',
          'testuser1'
        );
      });
    });

    describe('GET /api/permission-groups/users/:userId/permissions', () => {
      test('应该返回用户的完整权限信息', async () => {
        const mockUserGroups = [
          {
            id: 'group1',
            name: 'Group 1',
            assignedAt: '2024-01-01T00:00:00.000Z'
          }
        ];

        const mockCompletePermissions = [
          { resource: 'query', action: 'read' },
          { resource: 'report', action: 'write' }
        ];

        groupService.getUserGroups = jest.fn().mockResolvedValue(mockUserGroups);
        groupService.getUserCompletePermissions = jest.fn()
          .mockResolvedValue(mockCompletePermissions);

        const response = await request(app)
          .get('/api/permission-groups/users/user1/permissions');

        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({
          userId: 'user1',
          userGroups: [
            {
              id: 'group1',
              name: 'Group 1',
              assignedAt: '2024-01-01T00:00:00.000Z'
            }
          ],
          completePermissions: mockCompletePermissions,
          summary: {
            groupCount: 1,
            permissionCount: 2
          }
        });
      });
    });
  });

  describe('权限系统端到端测试', () => {
    test('完整权限检查流程：创建组→分配用户→检查权限', async () => {
      // 1. 创建权限组
      const mockGroup = {
        id: 'e2e-group',
        name: 'E2E Test Group',
        permissions: [{ resource: 'query', action: 'read' }]
      };

      groupService.createPermissionGroup = jest.fn().mockResolvedValue(mockGroup);

      const createResponse = await request(app)
        .post('/api/permission-groups')
        .send({
          name: 'E2E Test Group',
          permissions: [{ resource: 'query', action: 'read' }]
        });

      expect(createResponse.status).toBe(201);

      // 2. 为用户分配权限组
      const mockAssignment = {
        userId: 'e2e-user',
        groupId: 'e2e-group',
        assignedBy: 'testuser1'
      };

      groupService.assignGroupToUser = jest.fn().mockResolvedValue(mockAssignment);

      const assignResponse = await request(app)
        .post('/api/permission-groups/e2e-group/users/e2e-user');

      expect(assignResponse.status).toBe(201);

      // 3. 检查用户权限
      const mockPermissionCheck = {
        allowed: true,
        reason: 'GROUP_PERMISSION_GRANTED'
      };

      authService.checkPermission = jest.fn().mockResolvedValue(mockPermissionCheck);

      const checkResponse = await request(app)
        .post('/api/permissions/check')
        .send({
          resource: 'query',
          action: 'read'
        });

      expect(checkResponse.status).toBe(200);
      expect(checkResponse.body.result.allowed).toBe(true);

      // 验证整个流程的调用
      expect(groupService.createPermissionGroup).toHaveBeenCalled();
      expect(groupService.assignGroupToUser).toHaveBeenCalled();
      expect(authService.checkPermission).toHaveBeenCalled();
    });

    test('权限缓存和性能测试', async () => {
      // Mock缓存命中场景
      authService.checkPermission = jest.fn()
        .mockResolvedValueOnce({ allowed: true, reason: 'CACHE_MISS', duration: 100 })
        .mockResolvedValueOnce({ allowed: true, reason: 'CACHE_HIT', duration: 5 });

      // 第一次调用（缓存未命中）
      const firstResponse = await request(app)
        .post('/api/permissions/check')
        .send({
          resource: 'query',
          action: 'read'
        });

      expect(firstResponse.status).toBe(200);
      expect(firstResponse.body.result.reason).toBe('CACHE_MISS');

      // 第二次调用（缓存命中）
      const secondResponse = await request(app)
        .post('/api/permissions/check')
        .send({
          resource: 'query',
          action: 'read'
        });

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.result.reason).toBe('CACHE_HIT');

      expect(authService.checkPermission).toHaveBeenCalledTimes(2);
    });
  });
});
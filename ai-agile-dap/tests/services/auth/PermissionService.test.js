const PermissionService = require('../../../src/services/auth/PermissionService');

// Mock Redis
jest.mock('ioredis');

describe('PermissionService', () => {
  let permissionService;
  let mockRedis;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock Redis instance
    mockRedis = {
      hset: jest.fn(),
      hget: jest.fn(),
      hgetall: jest.fn(),
      hdel: jest.fn(),
      quit: jest.fn(),
    };

    // Mock Redis constructor
    const Redis = require('ioredis');
    Redis.mockImplementation(() => mockRedis);

    permissionService = new PermissionService();
    await permissionService.initialize();
  });

  afterEach(async () => {
    if (permissionService) {
      await permissionService.close();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(permissionService.isInitialized).toBe(true);
      expect(mockRedis.hset).toHaveBeenCalled();
    });

    it('should initialize predefined permissions', async () => {
      // Check that predefined permissions were set
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'permissions',
        expect.any(String),
        expect.stringContaining('"resource":"user"')
      );
    });
  });

  describe('getUserPermissions', () => {
    beforeEach(() => {
      // Mock user roles
      mockRedis.hgetall.mockResolvedValue({
        role1: JSON.stringify({ id: 'role1', name: 'Admin' }),
        role2: JSON.stringify({ id: 'role2', name: 'User' }),
      });

      // Mock role permissions
      mockRedis.hgetall
        .mockResolvedValueOnce({
          role1: JSON.stringify({ id: 'role1', name: 'Admin' }),
          role2: JSON.stringify({ id: 'role2', name: 'User' }),
        })
        .mockResolvedValueOnce({
          'user:read': JSON.stringify({
            id: 'user:read',
            roleId: 'role1',
            resource: 'user',
            action: 'read',
          }),
          'user:write': JSON.stringify({
            id: 'user:write',
            roleId: 'role1',
            resource: 'user',
            action: 'write',
          }),
        })
        .mockResolvedValueOnce({
          'query:read': JSON.stringify({
            id: 'query:read',
            roleId: 'role2',
            resource: 'query',
            action: 'read',
          }),
        });
    });

    it('should get user permissions with inheritance', async () => {
      const result = await permissionService.getUserPermissions('user1', {
        includeInherited: true,
        includeConditions: true,
      });

      expect(result).toHaveProperty('userId', 'user1');
      expect(result).toHaveProperty('roles');
      expect(result).toHaveProperty('permissions');
      expect(result).toHaveProperty('totalPermissions');
      expect(result.includeInherited).toBe(true);
      expect(result.includeConditions).toBe(true);
    });

    it('should get user permissions without inheritance', async () => {
      const result = await permissionService.getUserPermissions('user1', {
        includeInherited: false,
        includeConditions: false,
      });

      expect(result.includeInherited).toBe(false);
      expect(result.includeConditions).toBe(false);
    });
  });

  describe('getUserRoles', () => {
    it('should get user roles successfully', async () => {
      const mockRoles = {
        role1: JSON.stringify({ id: 'role1', name: 'Admin' }),
        role2: JSON.stringify({ id: 'role2', name: 'User' }),
      };

      mockRedis.hgetall.mockResolvedValue(mockRoles);

      const result = await permissionService.getUserRoles('user1');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 'role1');
      expect(result[0]).toHaveProperty('name', 'Admin');
      expect(result[1]).toHaveProperty('id', 'role2');
      expect(result[1]).toHaveProperty('name', 'User');
    });

    it('should return empty array when no roles found', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      const result = await permissionService.getUserRoles('user1');

      expect(result).toEqual([]);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.hgetall.mockRejectedValue(new Error('Redis error'));

      const result = await permissionService.getUserRoles('user1');

      expect(result).toEqual([]);
    });
  });

  describe('getRolePermissions', () => {
    it('should get role permissions successfully', async () => {
      const mockPermissions = {
        'user:read': JSON.stringify({
          id: 'user:read',
          roleId: 'role1',
          resource: 'user',
          action: 'read',
        }),
        'user:write': JSON.stringify({
          id: 'user:write',
          roleId: 'role1',
          resource: 'user',
          action: 'write',
        }),
      };

      mockRedis.hgetall.mockResolvedValue(mockPermissions);

      const result = await permissionService.getRolePermissions('role1');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 'user:read');
      expect(result[0]).toHaveProperty('resource', 'user');
      expect(result[0]).toHaveProperty('action', 'read');
      expect(result[1]).toHaveProperty('id', 'user:write');
    });
  });

  describe('createPermission', () => {
    it('should create permission successfully', async () => {
      const permissionData = {
        resource: 'test',
        action: 'read',
        description: 'Test permission',
      };

      mockRedis.hset.mockResolvedValue(1);

      const result = await permissionService.createPermission(permissionData);

      expect(result).toBeDefined();
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'permissions',
        expect.any(String),
        expect.stringContaining('"resource":"test"')
      );
    });

    it('should handle creation errors', async () => {
      const permissionData = {
        resource: 'test',
        action: 'read',
      };

      mockRedis.hset.mockRejectedValue(new Error('Creation failed'));

      await expect(permissionService.createPermission(permissionData)).rejects.toThrow(
        'Creation failed'
      );
    });
  });

  describe('updatePermission', () => {
    it('should update permission successfully', async () => {
      const existingPermission = {
        id: 'perm1',
        resource: 'test',
        action: 'read',
        description: 'Old description',
      };

      mockRedis.hget.mockResolvedValue(JSON.stringify(existingPermission));
      mockRedis.hset.mockResolvedValue(1);

      const updateData = { description: 'New description' };
      const result = await permissionService.updatePermission('perm1', updateData);

      expect(result).toBe(true);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'permissions',
        'perm1',
        expect.stringContaining('"description":"New description"')
      );
    });

    it('should throw error when permission not found', async () => {
      mockRedis.hget.mockResolvedValue(null);

      await expect(permissionService.updatePermission('nonexistent', {})).rejects.toThrow(
        'Permission not found'
      );
    });
  });

  describe('deletePermission', () => {
    it('should delete permission successfully', async () => {
      mockRedis.hdel.mockResolvedValue(1);

      const result = await permissionService.deletePermission('perm1');

      expect(result).toBe(true);
      expect(mockRedis.hdel).toHaveBeenCalledWith('permissions', 'perm1');
    });

    it('should return false when permission not found', async () => {
      mockRedis.hdel.mockResolvedValue(0);

      const result = await permissionService.deletePermission('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('assignPermissionToRole', () => {
    it('should assign permission to role successfully', async () => {
      const permission = {
        id: 'perm1',
        resource: 'test',
        action: 'read',
      };

      mockRedis.hget.mockResolvedValue(JSON.stringify(permission));
      mockRedis.hset.mockResolvedValue(1);

      const conditions = { timeLimit: { startTime: '09:00', endTime: '18:00' } };
      const result = await permissionService.assignPermissionToRole('role1', 'perm1', conditions);

      expect(result).toBe(true);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'role_permissions:role1',
        'perm1',
        expect.stringContaining('"roleId":"role1"')
      );
    });

    it('should throw error when permission not found', async () => {
      mockRedis.hget.mockResolvedValue(null);

      await expect(
        permissionService.assignPermissionToRole('role1', 'nonexistent')
      ).rejects.toThrow('Permission not found');
    });
  });

  describe('removePermissionFromRole', () => {
    it('should remove permission from role successfully', async () => {
      mockRedis.hdel.mockResolvedValue(1);

      const result = await permissionService.removePermissionFromRole('role1', 'perm1');

      expect(result).toBe(true);
      expect(mockRedis.hdel).toHaveBeenCalledWith('role_permissions:role1', 'perm1');
    });

    it('should return false when permission not found in role', async () => {
      mockRedis.hdel.mockResolvedValue(0);

      const result = await permissionService.removePermissionFromRole('role1', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getAllPermissions', () => {
    it('should get all permissions successfully', async () => {
      const mockPermissions = {
        perm1: JSON.stringify({ id: 'perm1', resource: 'user', action: 'read' }),
        perm2: JSON.stringify({ id: 'perm2', resource: 'user', action: 'write' }),
      };

      mockRedis.hgetall.mockResolvedValue(mockPermissions);

      const result = await permissionService.getAllPermissions();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 'perm1');
      expect(result[1]).toHaveProperty('id', 'perm2');
    });

    it('should return empty array when no permissions found', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      const result = await permissionService.getAllPermissions();

      expect(result).toEqual([]);
    });
  });

  describe('searchPermissions', () => {
    beforeEach(() => {
      const mockPermissions = [
        { id: 'perm1', resource: 'user', action: 'read', description: 'Read user data' },
        { id: 'perm2', resource: 'user', action: 'write', description: 'Write user data' },
        { id: 'perm3', resource: 'query', action: 'execute', description: 'Execute queries' },
      ];

      mockRedis.hgetall.mockResolvedValue({
        perm1: JSON.stringify(mockPermissions[0]),
        perm2: JSON.stringify(mockPermissions[1]),
        perm3: JSON.stringify(mockPermissions[2]),
      });
    });

    it('should search permissions by keyword', async () => {
      const result = await permissionService.searchPermissions('user');

      expect(result).toHaveLength(2);
      expect(result[0].resource).toBe('user');
      expect(result[1].resource).toBe('user');
    });

    it('should filter by resource', async () => {
      const result = await permissionService.searchPermissions('', { resource: 'user' });

      expect(result).toHaveLength(2);
      expect(result.every(perm => perm.resource === 'user')).toBe(true);
    });

    it('should filter by action', async () => {
      const result = await permissionService.searchPermissions('', { action: 'read' });

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('read');
    });

    it('should return empty array when no matches found', async () => {
      const result = await permissionService.searchPermissions('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('getPermissionConditions', () => {
    it('should get permission conditions successfully', async () => {
      const conditions = {
        timeLimit: { startTime: '09:00', endTime: '18:00' },
        ipWhitelist: ['192.168.1.1'],
      };

      mockRedis.hget.mockResolvedValue(JSON.stringify(conditions));

      const result = await permissionService.getPermissionConditions('user', 'read');

      expect(result).toEqual(conditions);
    });

    it('should return empty object when no conditions found', async () => {
      mockRedis.hget.mockResolvedValue(null);

      const result = await permissionService.getPermissionConditions('user', 'read');

      expect(result).toEqual({});
    });
  });

  describe('getInheritedPermissions', () => {
    beforeEach(() => {
      // Mock roles with inheritance
      mockRedis.hget
        .mockResolvedValueOnce(
          JSON.stringify({
            id: 'role1',
            inherits: ['role2'],
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            id: 'role2',
            inherits: [],
          })
        );

      // Mock role permissions
      mockRedis.hgetall.mockResolvedValueOnce({
        'user:read': JSON.stringify({
          id: 'user:read',
          roleId: 'role2',
          resource: 'user',
          action: 'read',
        }),
      });
    });

    it('should get inherited permissions successfully', async () => {
      const roles = [{ id: 'role1' }];
      const result = await permissionService.getInheritedPermissions(roles);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('inheritedFrom', 'role2');
    });

    it('should handle roles without inheritance', async () => {
      const roles = [{ id: 'role2' }];
      const result = await permissionService.getInheritedPermissions(roles);

      expect(result).toHaveLength(0);
    });
  });

  describe('Error handling', () => {
    it('should handle Redis connection errors during initialization', async () => {
      const Redis = require('ioredis');
      Redis.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const service = new PermissionService();
      await expect(service.initialize()).rejects.toThrow('Connection failed');
    });

    it('should handle JSON parsing errors', async () => {
      mockRedis.hgetall.mockResolvedValue({
        role1: 'invalid json',
      });

      const result = await permissionService.getUserRoles('user1');

      expect(result).toEqual([]);
    });
  });

  describe('Service lifecycle', () => {
    it('should close service properly', async () => {
      await permissionService.close();

      expect(mockRedis.quit).toHaveBeenCalled();
      expect(permissionService.isInitialized).toBe(false);
    });

    it('should not initialize twice', async () => {
      const initialCallCount = mockRedis.hset.mock.calls.length;

      await permissionService.initialize();

      expect(mockRedis.hset.mock.calls.length).toBe(initialCallCount);
    });
  });
});

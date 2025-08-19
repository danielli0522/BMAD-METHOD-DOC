/**
 * PermissionGroupService 单元测试
 * Task 8: 权限组和继承功能单元测试
 */

const PermissionGroupService = require('../../../src/services/auth/PermissionGroupService');

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    keys: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
    multi: jest.fn(() => ({
      setEx: jest.fn(),
      exec: jest.fn()
    }))
  }))
}));

describe('PermissionGroupService', () => {
  let groupService;
  let mockRedisClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const redis = require('redis');
    mockRedisClient = redis.createClient();
    
    groupService = new PermissionGroupService();
    groupService.redisClient = mockRedisClient;
  });

  afterEach(async () => {
    if (groupService) {
      await groupService.close();
    }
  });

  describe('createPermissionGroup', () => {
    const groupData = {
      name: 'Test Group',
      description: 'A test permission group',
      organizationId: 'org1',
      permissions: [
        { resource: 'query', action: 'read' }
      ]
    };

    beforeEach(() => {
      jest.spyOn(groupService, 'isGroupNameExists').mockResolvedValue(false);
      jest.spyOn(groupService, 'saveGroup').mockResolvedValue(true);
      jest.spyOn(groupService, 'clearGroupCache').mockResolvedValue(true);
    });

    test('应该成功创建权限组', async () => {
      const result = await groupService.createPermissionGroup(groupData);

      expect(result).toMatchObject({
        name: 'Test Group',
        description: 'A test permission group',
        organizationId: 'org1',
        permissions: [{ resource: 'query', action: 'read' }],
        isActive: true
      });

      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(groupService.saveGroup).toHaveBeenCalledWith(result);
      expect(groupService.clearGroupCache).toHaveBeenCalledWith('org1');
    });

    test('应该检查组名唯一性', async () => {
      jest.spyOn(groupService, 'isGroupNameExists').mockResolvedValue(true);

      await expect(groupService.createPermissionGroup(groupData))
        .rejects.toThrow('权限组名称已存在');

      expect(groupService.saveGroup).not.toHaveBeenCalled();
    });

    test('应该验证父组存在性', async () => {
      const groupWithParent = {
        ...groupData,
        parentGroupId: 'parent1'
      };

      jest.spyOn(groupService, 'getGroupById').mockResolvedValue(null);

      await expect(groupService.createPermissionGroup(groupWithParent))
        .rejects.toThrow('父权限组不存在');
    });

    test('应该检查循环继承', async () => {
      const groupWithParent = {
        ...groupData,
        parentGroupId: 'parent1'
      };

      jest.spyOn(groupService, 'getGroupById').mockResolvedValue({
        id: 'parent1',
        name: 'Parent Group'
      });
      
      jest.spyOn(groupService, 'hasCircularInheritance').mockResolvedValue(true);

      await expect(groupService.createPermissionGroup(groupWithParent))
        .rejects.toThrow('检测到循环继承，无法创建权限组');
    });
  });

  describe('getGroupCompletePermissions', () => {
    beforeEach(() => {
      // Mock组层级结构
      jest.spyOn(groupService, 'getGroupById')
        .mockImplementation(async (groupId) => {
          const groups = {
            'child': {
              id: 'child',
              name: 'Child Group',
              parentGroupId: 'parent',
              permissions: [{ resource: 'query', action: 'read' }],
              isActive: true
            },
            'parent': {
              id: 'parent',
              name: 'Parent Group',
              parentGroupId: null,
              permissions: [{ resource: 'report', action: 'write' }],
              isActive: true
            }
          };
          return groups[groupId] || null;
        });
    });

    test('应该返回包含继承权限的完整权限列表', async () => {
      const permissions = await groupService.getGroupCompletePermissions('child');

      expect(permissions).toEqual(
        expect.arrayContaining([
          { resource: 'report', action: 'write' }, // 从父组继承
          { resource: 'query', action: 'read' }    // 自己的权限
        ])
      );
    });

    test('应该处理循环继承', async () => {
      // Mock循环继承情况
      jest.spyOn(groupService, 'getGroupById')
        .mockImplementation(async (groupId) => {
          const groups = {
            'group1': {
              id: 'group1',
              parentGroupId: 'group2',
              permissions: [{ resource: 'query', action: 'read' }],
              isActive: true
            },
            'group2': {
              id: 'group2',
              parentGroupId: 'group1',  // 循环引用
              permissions: [{ resource: 'report', action: 'write' }],
              isActive: true
            }
          };
          return groups[groupId] || null;
        });

      const permissions = await groupService.getGroupCompletePermissions('group1');

      // 应该只返回group1自己的权限，避免循环
      expect(permissions).toEqual([
        { resource: 'query', action: 'read' }
      ]);
    });

    test('应该处理不存在或非活跃的组', async () => {
      const permissions = await groupService.getGroupCompletePermissions('nonexistent');

      expect(permissions).toEqual([]);
    });
  });

  describe('assignGroupToUser', () => {
    const mockGroup = {
      id: 'group1',
      name: 'Test Group',
      organizationId: 'org1'
    };

    beforeEach(() => {
      jest.spyOn(groupService, 'getGroupById').mockResolvedValue(mockGroup);
      jest.spyOn(groupService, 'saveUserGroupAssignment').mockResolvedValue(true);
      jest.spyOn(groupService, 'clearUserPermissionCache').mockResolvedValue(true);
    });

    test('应该成功为用户分配权限组', async () => {
      const result = await groupService.assignGroupToUser('user1', 'group1', 'admin1');

      expect(result).toMatchObject({
        userId: 'user1',
        groupId: 'group1',
        groupName: 'Test Group',
        organizationId: 'org1',
        assignedBy: 'admin1',
        isActive: true
      });

      expect(result.assignedAt).toBeDefined();
      expect(groupService.saveUserGroupAssignment).toHaveBeenCalledWith(result);
      expect(groupService.clearUserPermissionCache).toHaveBeenCalledWith('user1');
    });

    test('应该处理权限组不存在的情况', async () => {
      jest.spyOn(groupService, 'getGroupById').mockResolvedValue(null);

      await expect(groupService.assignGroupToUser('user1', 'nonexistent', 'admin1'))
        .rejects.toThrow('权限组不存在');
    });
  });

  describe('getUserCompletePermissions', () => {
    beforeEach(() => {
      jest.spyOn(groupService, 'getUserGroups').mockResolvedValue([
        {
          id: 'group1',
          name: 'Group 1',
          permissions: [{ resource: 'query', action: 'read' }]
        }
      ]);
      
      jest.spyOn(groupService, 'getGroupCompletePermissions').mockResolvedValue([
        { resource: 'query', action: 'read' },
        { resource: 'report', action: 'read' }
      ]);
      
      jest.spyOn(groupService, 'getUserDirectPermissions').mockResolvedValue([
        { resource: 'user', action: 'read' }
      ]);
    });

    test('应该返回用户的完整权限（组权限+直接权限）', async () => {
      jest.spyOn(groupService, 'deduplicateAndSortPermissions').mockImplementation(perms => perms);

      const permissions = await groupService.getUserCompletePermissions('user1');

      expect(permissions).toEqual(
        expect.arrayContaining([
          { resource: 'query', action: 'read' },
          { resource: 'report', action: 'read' },
          { resource: 'user', action: 'read' }
        ])
      );
    });
  });

  describe('buildGroupHierarchy', () => {
    test('应该构建正确的组层级结构', () => {
      const groups = [
        { id: 'root1', name: 'Root 1', parentGroupId: null },
        { id: 'child1', name: 'Child 1', parentGroupId: 'root1' },
        { id: 'child2', name: 'Child 2', parentGroupId: 'root1' },
        { id: 'root2', name: 'Root 2', parentGroupId: null }
      ];

      const hierarchy = groupService.buildGroupHierarchy(groups);

      expect(hierarchy).toHaveLength(2); // 两个根节点
      
      const root1 = hierarchy.find(node => node.id === 'root1');
      expect(root1.children).toHaveLength(2);
      expect(root1.children.map(c => c.id)).toEqual(['child1', 'child2']);

      const root2 = hierarchy.find(node => node.id === 'root2');
      expect(root2.children).toHaveLength(0);
    });

    test('应该处理孤儿节点', () => {
      const groups = [
        { id: 'child1', name: 'Child 1', parentGroupId: 'nonexistent' },
        { id: 'root1', name: 'Root 1', parentGroupId: null }
      ];

      const hierarchy = groupService.buildGroupHierarchy(groups);

      expect(hierarchy).toHaveLength(2); // 孤儿节点被当作根节点
      expect(hierarchy.map(n => n.id)).toEqual(['child1', 'root1']);
    });
  });

  describe('deduplicateAndSortPermissions', () => {
    test('应该去重并按优先级排序权限', () => {
      const permissions = [
        { resource: 'query', action: 'read', priority: 1 },
        { resource: 'query', action: 'read', priority: 3 }, // 重复，但优先级更高
        { resource: 'report', action: 'write', priority: 2 }
      ];

      const result = groupService.deduplicateAndSortPermissions(permissions);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ resource: 'query', action: 'read', priority: 3 });
      expect(result[1]).toEqual({ resource: 'report', action: 'write', priority: 2 });
    });

    test('应该处理没有优先级的权限', () => {
      const permissions = [
        { resource: 'query', action: 'read' },
        { resource: 'report', action: 'write' }
      ];

      const result = groupService.deduplicateAndSortPermissions(permissions);

      expect(result).toHaveLength(2);
    });
  });

  describe('hasCircularInheritance', () => {
    beforeEach(() => {
      jest.spyOn(groupService, 'getGroupById')
        .mockImplementation(async (groupId) => {
          const groups = {
            'group1': { id: 'group1', parentGroupId: 'group2' },
            'group2': { id: 'group2', parentGroupId: 'group3' },
            'group3': { id: 'group3', parentGroupId: 'group1' }, // 循环
            'group4': { id: 'group4', parentGroupId: null }
          };
          return groups[groupId] || null;
        });
    });

    test('应该检测到循环继承', async () => {
      const hasCircular = await groupService.hasCircularInheritance('group1', 'group2');

      expect(hasCircular).toBe(true);
    });

    test('应该检测直接自循环', async () => {
      const hasCircular = await groupService.hasCircularInheritance('group1', 'group1');

      expect(hasCircular).toBe(true);
    });

    test('应该通过正常的继承链', async () => {
      const hasCircular = await groupService.hasCircularInheritance('group1', 'group4');

      expect(hasCircular).toBe(false);
    });
  });
});
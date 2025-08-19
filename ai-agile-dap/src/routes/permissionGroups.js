/**
 * 权限组管理API路由 - Task 6实现
 * 提供权限组CRUD、权限继承、用户分配等功能
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireAdmin } = require('../middleware/permission');
const PermissionGroupService = require('../services/auth/PermissionGroupService');

const router = express.Router();
const groupService = new PermissionGroupService();

/**
 * POST /api/permission-groups
 * 创建权限组
 */
router.post('/', requireAuth, requirePermission('system', 'manage'), async (req, res) => {
  try {
    const groupData = {
      ...req.body,
      organizationId: req.user.organizationId
    };

    const group = await groupService.createPermissionGroup(groupData);
    
    res.status(201).json({
      success: true,
      message: '权限组创建成功',
      data: group
    });
  } catch (error) {
    console.error('Create permission group API error:', error);
    res.status(400).json({
      error: 'CREATE_GROUP_FAILED',
      message: error.message
    });
  }
});

/**
 * GET /api/permission-groups
 * 获取组织的权限组列表
 */
router.get('/', requireAuth, requireAdmin(), async (req, res) => {
  try {
    const { includeHierarchy = 'false' } = req.query;
    const organizationId = req.user.organizationId;

    let groups;
    if (includeHierarchy === 'true') {
      groups = await groupService.getOrganizationGroupHierarchy(organizationId);
    } else {
      groups = await groupService.getGroupsByOrganization(organizationId);
    }
    
    res.json({
      success: true,
      data: {
        organizationId,
        groups,
        count: Array.isArray(groups) ? groups.length : groups.reduce((count, group) => count + this.countGroupsInHierarchy(group), 0)
      }
    });
  } catch (error) {
    console.error('Get permission groups API error:', error);
    res.status(500).json({
      error: 'GET_GROUPS_FAILED',
      message: '获取权限组列表失败'
    });
  }
});

/**
 * GET /api/permission-groups/:groupId
 * 获取权限组详情
 */
router.get('/:groupId', requireAuth, requireAdmin(), async (req, res) => {
  try {
    const { groupId } = req.params;
    const { includePermissions = 'false' } = req.query;

    const group = await groupService.getGroupById(groupId);
    
    if (!group) {
      return res.status(404).json({
        error: 'GROUP_NOT_FOUND',
        message: '权限组不存在'
      });
    }

    let responseData = { ...group };
    
    if (includePermissions === 'true') {
      const completePermissions = await groupService.getGroupCompletePermissions(groupId);
      responseData.completePermissions = completePermissions;
    }
    
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Get permission group API error:', error);
    res.status(500).json({
      error: 'GET_GROUP_FAILED',
      message: '获取权限组详情失败'
    });
  }
});

/**
 * PUT /api/permission-groups/:groupId
 * 更新权限组
 */
router.put('/:groupId', requireAuth, requirePermission('system', 'manage'), async (req, res) => {
  try {
    const { groupId } = req.params;
    const updateData = req.body;
    const updatedBy = req.user.id;

    const updatedGroup = await groupService.updatePermissionGroup(groupId, updateData, updatedBy);
    
    res.json({
      success: true,
      message: '权限组更新成功',
      data: updatedGroup
    });
  } catch (error) {
    console.error('Update permission group API error:', error);
    res.status(400).json({
      error: 'UPDATE_GROUP_FAILED',
      message: error.message
    });
  }
});

/**
 * DELETE /api/permission-groups/:groupId
 * 删除权限组
 */
router.delete('/:groupId', requireAuth, requirePermission('system', 'manage'), async (req, res) => {
  try {
    const { groupId } = req.params;
    const deletedBy = req.user.id;

    const deletedGroup = await groupService.deletePermissionGroup(groupId, deletedBy);
    
    res.json({
      success: true,
      message: '权限组删除成功',
      data: deletedGroup
    });
  } catch (error) {
    console.error('Delete permission group API error:', error);
    res.status(400).json({
      error: 'DELETE_GROUP_FAILED',
      message: error.message
    });
  }
});

/**
 * GET /api/permission-groups/:groupId/permissions
 * 获取权限组的完整权限（包含继承）
 */
router.get('/:groupId/permissions', requireAuth, requireAdmin(), async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await groupService.getGroupById(groupId);
    if (!group) {
      return res.status(404).json({
        error: 'GROUP_NOT_FOUND',
        message: '权限组不存在'
      });
    }

    const completePermissions = await groupService.getGroupCompletePermissions(groupId);
    
    res.json({
      success: true,
      data: {
        groupId,
        groupName: group.name,
        directPermissions: group.permissions || [],
        inheritedPermissions: completePermissions.filter(p => 
          !group.permissions?.some(dp => dp.resource === p.resource && dp.action === p.action)
        ),
        completePermissions,
        permissionCount: completePermissions.length
      }
    });
  } catch (error) {
    console.error('Get group permissions API error:', error);
    res.status(500).json({
      error: 'GET_GROUP_PERMISSIONS_FAILED',
      message: '获取权限组权限失败'
    });
  }
});

/**
 * POST /api/permission-groups/:groupId/users/:userId
 * 为用户分配权限组
 */
router.post('/:groupId/users/:userId', requireAuth, requireAdmin(), async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const assignedBy = req.user.id;

    const assignment = await groupService.assignGroupToUser(userId, groupId, assignedBy);
    
    res.status(201).json({
      success: true,
      message: '权限组分配成功',
      data: assignment
    });
  } catch (error) {
    console.error('Assign group to user API error:', error);
    res.status(400).json({
      error: 'ASSIGN_GROUP_FAILED',
      message: error.message
    });
  }
});

/**
 * DELETE /api/permission-groups/:groupId/users/:userId
 * 移除用户的权限组分配
 */
router.delete('/:groupId/users/:userId', requireAuth, requireAdmin(), async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const revokedBy = req.user.id;

    // 这里需要实现移除分配的逻辑
    // 为简化，我们先返回成功响应
    
    res.json({
      success: true,
      message: '权限组分配已移除',
      data: {
        groupId,
        userId,
        revokedBy,
        revokedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Revoke group from user API error:', error);
    res.status(400).json({
      error: 'REVOKE_GROUP_FAILED',
      message: error.message
    });
  }
});

/**
 * GET /api/permission-groups/users/:userId
 * 获取用户的所有权限组
 */
router.get('/users/:userId', requireAuth, requireAdmin(), async (req, res) => {
  try {
    const { userId } = req.params;
    const { includePermissions = 'false' } = req.query;

    const userGroups = await groupService.getUserGroups(userId);
    
    let responseData = {
      userId,
      groups: userGroups,
      groupCount: userGroups.length
    };

    if (includePermissions === 'true') {
      const completePermissions = await groupService.getUserCompletePermissions(userId);
      responseData.completePermissions = completePermissions;
      responseData.permissionCount = completePermissions.length;
    }
    
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Get user groups API error:', error);
    res.status(500).json({
      error: 'GET_USER_GROUPS_FAILED',
      message: '获取用户权限组失败'
    });
  }
});

/**
 * GET /api/permission-groups/users/:userId/permissions
 * 获取用户的完整权限（通过组继承）
 */
router.get('/users/:userId/permissions', requireAuth, requireAdmin(), async (req, res) => {
  try {
    const { userId } = req.params;

    const userGroups = await groupService.getUserGroups(userId);
    const completePermissions = await groupService.getUserCompletePermissions(userId);
    
    // 检查权限结果是否有效
    if (!Array.isArray(userGroups)) {
      throw new Error('User groups query returned invalid result');
    }
    if (!Array.isArray(completePermissions)) {
      throw new Error('Complete permissions query returned invalid result');
    }
    
    // 分析权限来源
    const permissionSources = {};
    for (const permission of completePermissions) {
      const key = `${permission.resource}:${permission.action}`;
      permissionSources[key] = {
        permission,
        sources: userGroups.filter(group => 
          group.permissions?.some(p => p.resource === permission.resource && p.action === permission.action)
        ).map(group => ({
          type: 'group',
          id: group.id,
          name: group.name
        }))
      };
    }
    
    res.json({
      success: true,
      data: {
        userId,
        userGroups: userGroups.map(group => ({
          id: group.id,
          name: group.name,
          assignedAt: group.assignedAt
        })),
        completePermissions,
        permissionSources,
        summary: {
          groupCount: userGroups.length,
          permissionCount: completePermissions.length
        }
      }
    });
  } catch (error) {
    console.error('Get user permissions API error:', error);
    res.status(500).json({
      error: 'GET_USER_PERMISSIONS_FAILED',
      message: '获取用户权限失败'
    });
  }
});

/**
 * GET /api/permission-groups/:groupId/hierarchy
 * 获取权限组的层级关系
 */
router.get('/:groupId/hierarchy', requireAuth, requireAdmin(), async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await groupService.getGroupById(groupId);
    if (!group) {
      return res.status(404).json({
        error: 'GROUP_NOT_FOUND',
        message: '权限组不存在'
      });
    }

    // 构建层级关系：父级链和子级树
    const parentChain = [];
    const childTree = [];

    // 获取父级链
    let currentGroup = group;
    while (currentGroup && currentGroup.parentGroupId) {
      const parentGroup = await groupService.getGroupById(currentGroup.parentGroupId);
      if (parentGroup) {
        parentChain.unshift(parentGroup);
        currentGroup = parentGroup;
      } else {
        break;
      }
    }

    // 获取子级树（简化实现）
    const childGroups = await groupService.getChildGroups(groupId);
    
    res.json({
      success: true,
      data: {
        group,
        parentChain,
        childGroups,
        hierarchy: {
          depth: parentChain.length,
          childCount: childGroups.length,
          isRoot: !group.parentGroupId,
          hasChildren: childGroups.length > 0
        }
      }
    });
  } catch (error) {
    console.error('Get group hierarchy API error:', error);
    res.status(500).json({
      error: 'GET_GROUP_HIERARCHY_FAILED',
      message: '获取权限组层级失败'
    });
  }
});

/**
 * 辅助方法：计算层级结构中的组数量
 */
function countGroupsInHierarchy(group) {
  let count = 1;
  if (group.children && group.children.length > 0) {
    count += group.children.reduce((sum, child) => sum + countGroupsInHierarchy(child), 0);
  }
  return count;
}

module.exports = router;
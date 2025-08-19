/**
 * 角色管理API路由
 * 实现角色的CRUD操作和权限分配功能
 */

const express = require('express');
const router = express.Router();
const RoleService = require('../services/auth/RoleService');
const authMiddleware = require('../middleware/auth');

// 初始化服务
const roleService = new RoleService();

/**
 * 获取所有角色
 * GET /api/roles
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { query, limit = 10, offset = 0 } = req.query;

    const result = await roleService.searchRoles(query, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      data: result.roles,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.offset + result.limit < result.total,
      },
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get roles',
      message: error.message,
    });
  }
});

/**
 * 获取角色详情
 * GET /api/roles/:id
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const role = await roleService.getRole(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        error: 'Role not found',
        message: `Role with ID '${id}' not found`,
      });
    }

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get role',
      message: error.message,
    });
  }
});

/**
 * 创建角色
 * POST /api/roles
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const roleData = req.body;

    // 验证必需字段
    if (!roleData.id || !roleData.name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Role ID and name are required',
      });
    }

    const role = await roleService.createRole(roleData);

    res.status(201).json({
      success: true,
      data: role,
      message: 'Role created successfully',
    });
  } catch (error) {
    console.error('Create role error:', error);

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: 'Role already exists',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create role',
      message: error.message,
    });
  }
});

/**
 * 更新角色
 * PUT /api/roles/:id
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const role = await roleService.updateRole(id, updateData);

    res.json({
      success: true,
      data: role,
      message: 'Role updated successfully',
    });
  } catch (error) {
    console.error('Update role error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Role not found',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update role',
      message: error.message,
    });
  }
});

/**
 * 删除角色
 * DELETE /api/roles/:id
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await roleService.deleteRole(id);

    res.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    console.error('Delete role error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Role not found',
        message: error.message,
      });
    }

    if (error.message.includes('inherited by')) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete role',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete role',
      message: error.message,
    });
  }
});

/**
 * 获取角色权限
 * GET /api/roles/:id/permissions
 */
router.get('/:id/permissions', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const permissions = await roleService.getRolePermissions(id);

    res.json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    console.error('Get role permissions error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Role not found',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to get role permissions',
      message: error.message,
    });
  }
});

/**
 * 为角色分配权限
 * POST /api/roles/:id/permissions
 */
router.post('/:id/permissions', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const permissionData = req.body;

    // 验证必需字段
    if (!permissionData.resource || !permissionData.action) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Resource and action are required',
      });
    }

    const permission = await roleService.assignPermissionToRole(id, permissionData);

    res.status(201).json({
      success: true,
      data: permission,
      message: 'Permission assigned successfully',
    });
  } catch (error) {
    console.error('Assign permission error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Role not found',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to assign permission',
      message: error.message,
    });
  }
});

/**
 * 从角色移除权限
 * DELETE /api/roles/:id/permissions
 */
router.delete('/:id/permissions', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { resource, action } = req.body;

    if (!resource || !action) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Resource and action are required',
      });
    }

    await roleService.removePermissionFromRole(id, resource, action);

    res.json({
      success: true,
      message: 'Permission removed successfully',
    });
  } catch (error) {
    console.error('Remove permission error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Role not found',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to remove permission',
      message: error.message,
    });
  }
});

/**
 * 添加角色继承
 * POST /api/roles/:id/inherits
 */
router.post('/:id/inherits', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { inheritedRoleId } = req.body;

    if (!inheritedRoleId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Inherited role ID is required',
      });
    }

    const role = await roleService.addRoleInheritance(id, inheritedRoleId);

    res.json({
      success: true,
      data: role,
      message: 'Role inheritance added successfully',
    });
  } catch (error) {
    console.error('Add role inheritance error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Role not found',
        message: error.message,
      });
    }

    if (error.message.includes('Circular inheritance')) {
      return res.status(400).json({
        success: false,
        error: 'Circular inheritance',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to add role inheritance',
      message: error.message,
    });
  }
});

/**
 * 移除角色继承
 * DELETE /api/roles/:id/inherits
 */
router.delete('/:id/inherits', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { inheritedRoleId } = req.body;

    if (!inheritedRoleId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Inherited role ID is required',
      });
    }

    const role = await roleService.removeRoleInheritance(id, inheritedRoleId);

    res.json({
      success: true,
      data: role,
      message: 'Role inheritance removed successfully',
    });
  } catch (error) {
    console.error('Remove role inheritance error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Role not found',
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to remove role inheritance',
      message: error.message,
    });
  }
});

/**
 * 获取角色统计信息
 * GET /api/roles/stats/overview
 */
router.get('/stats/overview', authMiddleware, async (req, res) => {
  try {
    const stats = await roleService.getRoleStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get role stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get role stats',
      message: error.message,
    });
  }
});

/**
 * 验证角色配置
 * POST /api/roles/validate
 */
router.post('/validate', authMiddleware, async (req, res) => {
  try {
    const validation = await roleService.validateRoleConfiguration();

    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    console.error('Validate role configuration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate role configuration',
      message: error.message,
    });
  }
});

module.exports = router;

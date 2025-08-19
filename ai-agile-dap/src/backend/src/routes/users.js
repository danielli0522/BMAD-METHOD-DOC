/**
 * 用户管理路由
 * 处理用户CRUD操作
 */

const express = require('express');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * 模拟用户数据
 */
const mockUsers = [
  {
    id: 1,
    email: 'admin@ai-agile-dap.com',
    name: '系统管理员',
    role: 'admin',
    status: 'active',
    createdAt: new Date('2024-08-01'),
    updatedAt: new Date()
  },
  {
    id: 2,
    email: 'user@ai-agile-dap.com',
    name: '普通用户',
    role: 'user',
    status: 'active',
    createdAt: new Date('2024-08-15'),
    updatedAt: new Date()
  }
];

/**
 * GET /api/users
 * 获取用户列表
 */
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, role, status } = req.query;
  
  let filteredUsers = [...mockUsers];
  
  // 搜索过滤
  if (search) {
    filteredUsers = filteredUsers.filter(user => 
      user.name.includes(search) || user.email.includes(search)
    );
  }
  
  // 角色过滤
  if (role) {
    filteredUsers = filteredUsers.filter(user => user.role === role);
  }
  
  // 状态过滤
  if (status) {
    filteredUsers = filteredUsers.filter(user => user.status === status);
  }
  
  // 分页
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + parseInt(limit);
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    message: '获取用户列表成功',
    data: {
      users: paginatedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredUsers.length,
        totalPages: Math.ceil(filteredUsers.length / limit)
      }
    }
  });
}));

/**
 * GET /api/users/:id
 * 获取用户详情
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const user = mockUsers.find(u => u.id === parseInt(id));
  if (!user) {
    throw new NotFoundError('用户不存在');
  }
  
  res.json({
    success: true,
    message: '获取用户详情成功',
    data: {
      user
    }
  });
}));

/**
 * PUT /api/users/:id
 * 更新用户信息
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, role, status } = req.body;
  
  const userIndex = mockUsers.findIndex(u => u.id === parseInt(id));
  if (userIndex === -1) {
    throw new NotFoundError('用户不存在');
  }
  
  // 验证邮箱唯一性
  if (email) {
    const existingUser = mockUsers.find(u => u.email === email && u.id !== parseInt(id));
    if (existingUser) {
      throw new ValidationError('该邮箱已被其他用户使用');
    }
  }
  
  // 更新用户信息
  const updatedUser = {
    ...mockUsers[userIndex],
    ...(name && { name }),
    ...(email && { email }),
    ...(role && { role }),
    ...(status && { status }),
    updatedAt: new Date()
  };
  
  mockUsers[userIndex] = updatedUser;
  
  logger.logBusiness('USER_UPDATE', {
    userId: parseInt(id),
    updatedFields: { name, email, role, status }
  });
  
  res.json({
    success: true,
    message: '用户信息更新成功',
    data: {
      user: updatedUser
    }
  });
}));

/**
 * DELETE /api/users/:id
 * 删除用户
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const userIndex = mockUsers.findIndex(u => u.id === parseInt(id));
  if (userIndex === -1) {
    throw new NotFoundError('用户不存在');
  }
  
  // 防止删除管理员
  if (mockUsers[userIndex].role === 'admin') {
    throw new ValidationError('不能删除管理员用户');
  }
  
  const deletedUser = mockUsers[userIndex];
  mockUsers.splice(userIndex, 1);
  
  logger.logBusiness('USER_DELETE', {
    userId: parseInt(id),
    deletedUser: deletedUser.email
  });
  
  res.json({
    success: true,
    message: '用户删除成功'
  });
}));

/**
 * GET /api/users/stats/summary
 * 获取用户统计信息
 */
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const stats = {
    total: mockUsers.length,
    active: mockUsers.filter(u => u.status === 'active').length,
    inactive: mockUsers.filter(u => u.status === 'inactive').length,
    admins: mockUsers.filter(u => u.role === 'admin').length,
    users: mockUsers.filter(u => u.role === 'user').length,
    newThisMonth: mockUsers.filter(u => {
      const now = new Date();
      const userDate = new Date(u.createdAt);
      return userDate.getMonth() === now.getMonth() && 
             userDate.getFullYear() === now.getFullYear();
    }).length
  };
  
  res.json({
    success: true,
    message: '获取用户统计成功',
    data: {
      stats
    }
  });
}));

module.exports = router;
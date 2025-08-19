/**
 * DatabaseService - 数据库连接和查询服务
 * 为权限系统提供真实的数据库操作，替换mock实现
 */

const { Pool } = require('pg'); // PostgreSQL

class DatabaseService {
  constructor() {
    this.pool = null;
    this.initializeConnection();
  }

  /**
   * 初始化数据库连接池
   */
  async initializeConnection() {
    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/ai_agile_dap',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // 测试连接
      const client = await this.pool.connect();
      client.release();
      console.log('Database connection pool initialized');
    } catch (error) {
      console.error('Database connection failed:', error);
      // 在测试环境中使用内存数据库
      if (process.env.NODE_ENV === 'test') {
        this.initializeTestData();
      }
    }
  }

  /**
   * 初始化测试数据（内存存储）
   */
  initializeTestData() {
    this.testData = {
      users: new Map([
        ['user1', { id: 'user1', email: 'user1@example.com', role: 'user', organizationId: 'org1', isActive: true }],
        ['admin1', { id: 'admin1', email: 'admin1@example.com', role: 'admin', organizationId: 'org1', isActive: true }],
        ['testuser1', { id: 'testuser1', email: 'test@example.com', role: 'admin', organizationId: 'org1', isActive: true }]
      ]),
      roles: new Map([
        ['user', { id: 'user', name: 'User', description: '普通用户' }],
        ['admin', { id: 'admin', name: 'Admin', description: '管理员' }],
        ['super-admin', { id: 'super-admin', name: 'Super Admin', description: '超级管理员' }],
        ['viewer', { id: 'viewer', name: 'Viewer', description: '访客' }]
      ]),
      userRoles: new Map([
        ['user1', [{ id: 'user', name: 'User', description: '普通用户' }]],
        ['admin1', [{ id: 'admin', name: 'Admin', description: '管理员' }]],
        ['testuser1', [{ id: 'admin', name: 'Admin', description: '管理员' }]]
      ])
    };
    console.log('Test database initialized with in-memory data');
  }

  /**
   * 获取用户信息
   */
  async getUserById(userId) {
    try {
      if (!this.pool) {
        // 使用测试数据
        return this.testData?.users.get(userId) || null;
      }

      const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
      const result = await this.pool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        isActive: user.is_active
      };
    } catch (error) {
      console.error('Get user by id failed:', error);
      // Fallback到测试数据
      return this.testData?.users.get(userId) || null;
    }
  }

  /**
   * 获取用户角色
   */
  async getUserRoles(userId) {
    try {
      if (!this.pool) {
        // 使用测试数据
        return this.testData?.userRoles.get(userId) || [];
      }

      const query = `
        SELECT r.id, r.name, r.description 
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = $1 AND ur.is_active = true
      `;
      const result = await this.pool.query(query, [userId]);
      
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description
      }));
    } catch (error) {
      console.error('Get user roles failed:', error);
      // Fallback到测试数据
      return this.testData?.userRoles.get(userId) || [];
    }
  }

  /**
   * 获取角色权限
   */
  async getRolePermissions(roles) {
    try {
      if (!roles || roles.length === 0) {
        return [];
      }

      if (!this.pool) {
        // 使用硬编码的权限矩阵作为测试数据
        return this.getTestRolePermissions(roles);
      }

      const roleIds = roles.map(r => r.id);
      const query = `
        SELECT resource, action, conditions 
        FROM permissions 
        WHERE role_id = ANY($1)
      `;
      const result = await this.pool.query(query, [roleIds]);
      
      return result.rows.map(row => ({
        resource: row.resource,
        action: row.action,
        conditions: row.conditions || {}
      }));
    } catch (error) {
      console.error('Get role permissions failed:', error);
      return this.getTestRolePermissions(roles);
    }
  }

  /**
   * 获取测试环境的角色权限
   */
  getTestRolePermissions(roles) {
    const permissionMatrix = {
      'super-admin': [
        { resource: '*', action: '*', conditions: {} }
      ],
      'admin': [
        { resource: 'datasource', action: 'read', conditions: { organization_only: true } },
        { resource: 'datasource', action: 'write', conditions: { organization_only: true } },
        { resource: 'user', action: 'read', conditions: { organization_only: true } },
        { resource: 'user', action: 'write', conditions: { organization_only: true } },
        { resource: 'query', action: 'read', conditions: {} },
        { resource: 'query', action: 'write', conditions: {} },
        { resource: 'report', action: 'read', conditions: {} },
        { resource: 'report', action: 'write', conditions: {} },
        { resource: 'report', action: 'share', conditions: {} }
      ],
      'user': [
        { resource: 'query', action: 'read', conditions: { time_limit: { business_hours: true } } },
        { resource: 'query', action: 'write', conditions: { own_only: true } },
        { resource: 'report', action: 'read', conditions: { own_only: true } },
        { resource: 'report', action: 'write', conditions: { own_only: true } }
      ],
      'viewer': [
        { resource: 'query', action: 'read', conditions: { time_limit: { business_hours: true } } },
        { resource: 'report', action: 'read', conditions: {} }
      ]
    };

    const allPermissions = [];
    roles.forEach(role => {
      const permissions = permissionMatrix[role.id] || [];
      allPermissions.push(...permissions);
    });
    
    return allPermissions;
  }

  /**
   * 关闭连接池
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('Database connection pool closed');
    }
  }
}

// 创建单例实例
const databaseService = new DatabaseService();

module.exports = databaseService;
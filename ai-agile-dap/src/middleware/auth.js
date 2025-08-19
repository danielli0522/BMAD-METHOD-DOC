/**
 * JWT认证中间件
 * 用于保护需要认证的路由
 */

const AuthenticationService = require('../services/auth/AuthenticationService');

class AuthMiddleware {
  constructor() {
    this.authService = new AuthenticationService();
  }

  /**
   * JWT认证中间件
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   * @param {Function} next - Express下一个中间件
   */
  async authenticate(req, res, next) {
    try {
      // 从请求头获取token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Access token required',
          code: 'MISSING_TOKEN',
        });
      }

      const token = authHeader.substring(7); // 移除 'Bearer ' 前缀

      // 验证token
      const result = await this.authService.verifyToken(token);
      if (!result.valid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
          code: 'INVALID_TOKEN',
        });
      }

      // 将用户信息添加到请求对象
      req.user = result.user;
      req.token = token;
      next();
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_ERROR',
      });
    }
  }

  /**
   * 可选认证中间件（不强制要求认证）
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   * @param {Function} next - Express下一个中间件
   */
  async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const result = await this.authService.verifyToken(token);
        if (result.valid) {
          req.user = result.user;
          req.token = token;
        }
      }
      next();
    } catch (error) {
      // 可选认证失败不影响请求继续
      next();
    }
  }

  /**
   * 角色验证中间件
   * @param {Array} allowedRoles - 允许的角色列表
   * @returns {Function} 中间件函数
   */
  requireRole(allowedRoles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      next();
    };
  }

  /**
   * 管理员权限中间件
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   * @param {Function} next - Express下一个中间件
   */
  requireAdmin(req, res, next) {
    return this.requireRole(['admin'])(req, res, next);
  }

  /**
   * 用户或管理员权限中间件
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   * @param {Function} next - Express下一个中间件
   */
  requireUserOrAdmin(req, res, next) {
    return this.requireRole(['user', 'admin'])(req, res, next);
  }

  /**
   * 刷新token中间件
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   * @param {Function} next - Express下一个中间件
   */
  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token required',
          code: 'MISSING_REFRESH_TOKEN',
        });
      }

      const result = await this.authService.refreshToken(refreshToken);
      if (!result.success) {
        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token',
          code: 'INVALID_REFRESH_TOKEN',
        });
      }

      // 将新的tokens添加到响应对象
      res.locals.newTokens = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      };

      next();
    } catch (error) {
      console.error('Refresh token middleware error:', error);
      return res.status(401).json({
        success: false,
        error: 'Token refresh failed',
        code: 'REFRESH_FAILED',
      });
    }
  }

  /**
   * 获取当前用户中间件
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   * @param {Function} next - Express下一个中间件
   */
  async getCurrentUser(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'NOT_AUTHENTICATED',
        });
      }

      // 获取最新的用户信息
      const user = await this.authService.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      req.currentUser = user;
      next();
    } catch (error) {
      console.error('Get current user middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get user information',
        code: 'USER_INFO_ERROR',
      });
    }
  }
}

// 创建中间件实例
const authMiddleware = new AuthMiddleware();

module.exports = authMiddleware;

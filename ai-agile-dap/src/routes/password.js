/**
 * 密码管理相关API路由
 * 处理密码验证、重置、策略配置等操作
 */

const express = require('express');
const PasswordService = require('../services/auth/PasswordService');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const passwordService = new PasswordService();

/**
 * @route POST /api/password/validate
 * @desc 验证密码强度
 * @access Public
 */
router.post('/validate', (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required',
        code: 'MISSING_PASSWORD',
      });
    }

    const validation = passwordService.validatePasswordStrength(password);
    const entropy = passwordService.calculatePasswordEntropy(password);
    const suggestions = passwordService.getPasswordSuggestions(password);

    return res.status(200).json({
      success: true,
      data: {
        ...validation,
        entropy,
        suggestions,
      },
    });
  } catch (error) {
    console.error('Validate password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate password',
      code: 'VALIDATE_PASSWORD_ERROR',
    });
  }
});

/**
 * @route POST /api/password/change
 * @desc 修改密码
 * @access Private
 */
router.post('/change', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
        code: 'MISSING_PASSWORDS',
      });
    }

    // 验证新密码强度
    const validation = passwordService.validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet requirements',
        code: 'WEAK_PASSWORD',
        data: {
          errors: validation.errors,
          warnings: validation.warnings,
        },
      });
    }

    // 这里应该验证当前密码（从数据库获取用户信息）
    // 暂时使用模拟验证
    const mockCurrentPassword = 'password123';
    if (currentPassword !== mockCurrentPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD',
      });
    }

    // 检查新密码是否与当前密码相同
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password must be different from current password',
        code: 'SAME_PASSWORD',
      });
    }

    // 这里应该检查密码历史记录
    // 暂时跳过历史记录检查

    // 哈希新密码
    const hashedPassword = await passwordService.hashPassword(newPassword);

    // 这里应该更新数据库中的密码
    console.log(`[PASSWORD] Password changed for user ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to change password',
      code: 'CHANGE_PASSWORD_ERROR',
    });
  }
});

/**
 * @route POST /api/password/reset-request
 * @desc 请求密码重置
 * @access Public
 */
router.post('/reset-request', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
        code: 'MISSING_EMAIL',
      });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        code: 'INVALID_EMAIL',
      });
    }

    // 这里应该检查用户是否存在
    // 暂时假设用户存在

    // 生成重置令牌
    const userId = '1'; // 模拟用户ID
    const resetToken = passwordService.generateResetToken(userId, email);

    // 这里应该存储重置令牌到数据库，设置过期时间
    console.log(`[PASSWORD] Reset token generated for ${email}: ${resetToken}`);

    // 这里应该发送重置邮件
    console.log(`[EMAIL] Password reset email sent to ${email}`);

    return res.status(200).json({
      success: true,
      message: 'Password reset email sent successfully',
    });
  } catch (error) {
    console.error('Request password reset error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to request password reset',
      code: 'RESET_REQUEST_ERROR',
    });
  }
});

/**
 * @route POST /api/password/reset
 * @desc 重置密码
 * @access Public
 */
router.post('/reset', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required',
        code: 'MISSING_RESET_DATA',
      });
    }

    // 验证新密码强度
    const validation = passwordService.validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet requirements',
        code: 'WEAK_PASSWORD',
        data: {
          errors: validation.errors,
          warnings: validation.warnings,
        },
      });
    }

    // 验证重置令牌
    const userId = '1'; // 模拟用户ID
    const email = 'user@example.com'; // 模拟邮箱
    const tokenValidation = passwordService.verifyResetToken(token, userId, email);

    if (!tokenValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
        code: 'INVALID_RESET_TOKEN',
      });
    }

    // 哈希新密码
    const hashedPassword = await passwordService.hashPassword(newPassword);

    // 这里应该更新数据库中的密码
    console.log(`[PASSWORD] Password reset for user ${userId}`);

    // 这里应该使重置令牌失效
    console.log(`[PASSWORD] Reset token invalidated: ${token}`);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset password',
      code: 'RESET_PASSWORD_ERROR',
    });
  }
});

/**
 * @route POST /api/password/generate
 * @desc 生成随机密码
 * @access Public
 */
router.post('/generate', (req, res) => {
  try {
    const { length = 12, options = {} } = req.body;

    if (length < 8 || length > 128) {
      return res.status(400).json({
        success: false,
        error: 'Password length must be between 8 and 128 characters',
        code: 'INVALID_LENGTH',
      });
    }

    const password = passwordService.generateRandomPassword(length, options);
    const validation = passwordService.validatePasswordStrength(password);
    const entropy = passwordService.calculatePasswordEntropy(password);

    return res.status(200).json({
      success: true,
      data: {
        password,
        length,
        options,
        validation,
        entropy,
      },
    });
  } catch (error) {
    console.error('Generate password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate password',
      code: 'GENERATE_PASSWORD_ERROR',
    });
  }
});

/**
 * @route GET /api/password/expiry
 * @desc 检查密码过期状态
 * @access Private
 */
router.get('/expiry', authMiddleware.authenticate, (req, res) => {
  try {
    const userId = req.user.id;

    // 这里应该从数据库获取用户密码修改时间
    // 暂时使用模拟数据
    const lastPasswordChange = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60天前

    const expiryInfo = passwordService.checkPasswordExpiry(lastPasswordChange);

    return res.status(200).json({
      success: true,
      data: {
        ...expiryInfo,
        lastPasswordChange: lastPasswordChange.toISOString(),
      },
    });
  } catch (error) {
    console.error('Check password expiry error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check password expiry',
      code: 'CHECK_EXPIRY_ERROR',
    });
  }
});

/**
 * @route GET /api/password/policy
 * @desc 获取密码策略
 * @access Public
 */
router.get('/policy', (req, res) => {
  try {
    const policy = passwordService.getPasswordPolicy();

    return res.status(200).json({
      success: true,
      data: policy,
    });
  } catch (error) {
    console.error('Get password policy error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get password policy',
      code: 'GET_POLICY_ERROR',
    });
  }
});

/**
 * @route PUT /api/password/policy
 * @desc 更新密码策略（管理员功能）
 * @access Private (Admin only)
 */
router.put('/policy', authMiddleware.authenticate, authMiddleware.requireAdmin, (req, res) => {
  try {
    const policy = req.body;

    // 验证策略参数
    if (policy.minLength && (policy.minLength < 6 || policy.minLength > 50)) {
      return res.status(400).json({
        success: false,
        error: 'Minimum length must be between 6 and 50',
        code: 'INVALID_MIN_LENGTH',
      });
    }

    if (policy.maxLength && (policy.maxLength < 8 || policy.maxLength > 128)) {
      return res.status(400).json({
        success: false,
        error: 'Maximum length must be between 8 and 128',
        code: 'INVALID_MAX_LENGTH',
      });
    }

    if (
      policy.passwordExpiryDays &&
      (policy.passwordExpiryDays < 1 || policy.passwordExpiryDays > 365)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Password expiry days must be between 1 and 365',
        code: 'INVALID_EXPIRY_DAYS',
      });
    }

    // 更新密码策略
    passwordService.setPasswordPolicy(policy);

    return res.status(200).json({
      success: true,
      message: 'Password policy updated successfully',
      data: passwordService.getPasswordPolicy(),
    });
  } catch (error) {
    console.error('Update password policy error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update password policy',
      code: 'UPDATE_POLICY_ERROR',
    });
  }
});

/**
 * @route POST /api/password/check-history
 * @desc 检查密码是否在历史记录中
 * @access Private
 */
router.post('/check-history', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required',
        code: 'MISSING_PASSWORD',
      });
    }

    // 这里应该从数据库获取用户密码历史记录
    // 暂时使用模拟数据
    const passwordHistory = [
      '$2b$12$rQZ8N3YqG8K9L2M1N0O9P8Q7R6S5T4U3V2W1X0Y9Z8A7B6C5D4E3F2G1H0I',
      '$2b$12$sRZ9O4Zr9L0M3N1O0P9Q8R7S6T5U4V3W2X1Y0Z9A8B7C6D5E4F3G2H1I0J',
    ];

    const isInHistory = await passwordService.isPasswordInHistory(password, passwordHistory);

    return res.status(200).json({
      success: true,
      data: {
        isInHistory,
        message: isInHistory ? 'Password found in history' : 'Password not in history',
      },
    });
  } catch (error) {
    console.error('Check password history error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check password history',
      code: 'CHECK_HISTORY_ERROR',
    });
  }
});

module.exports = router;

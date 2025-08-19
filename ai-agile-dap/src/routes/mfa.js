/**
 * MFA相关API路由
 * 处理多因素认证的设置、验证等操作
 */

const express = require('express');
const MFAService = require('../services/auth/MFAService');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const mfaService = new MFAService();

/**
 * @route POST /api/mfa/setup
 * @desc 设置MFA（TOTP）
 * @access Private
 */
router.post('/setup', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email } = req.user;

    // 检查用户是否已经启用MFA
    const existingConfig = await mfaService.getUserMFAConfig(userId);
    if (existingConfig && existingConfig.enabled) {
      return res.status(400).json({
        success: false,
        error: 'MFA is already enabled for this user',
        code: 'MFA_ALREADY_ENABLED',
      });
    }

    // 设置TOTP
    const setupResult = await mfaService.setupTOTP(userId, email);

    return res.status(200).json({
      success: true,
      message: 'MFA setup initiated',
      data: {
        qrCode: setupResult.qrCode,
        secret: setupResult.secret,
        recoveryCodes: setupResult.recoveryCodes,
        setupInstructions: setupResult.setupInstructions,
      },
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to setup MFA',
      code: 'MFA_SETUP_ERROR',
    });
  }
});

/**
 * @route POST /api/mfa/verify-setup
 * @desc 验证MFA设置
 * @access Private
 */
router.post('/verify-setup', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Verification code is required',
        code: 'MISSING_CODE',
      });
    }

    // 验证TOTP代码
    const result = await mfaService.verifyMFACode(userId, code, 'totp');

    if (result.success) {
      // 启用MFA
      await mfaService.enableMFA(userId, {
        type: 'totp',
        enabled: true,
      });

      return res.status(200).json({
        success: true,
        message: 'MFA setup completed successfully',
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code',
        code: 'INVALID_CODE',
      });
    }
  } catch (error) {
    console.error('MFA verify setup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify MFA setup',
      code: 'MFA_VERIFY_ERROR',
    });
  }
});

/**
 * @route POST /api/mfa/verify
 * @desc 验证MFA代码
 * @access Private
 */
router.post('/verify', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code, type = 'totp' } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Verification code is required',
        code: 'MISSING_CODE',
      });
    }

    // 验证MFA代码
    const result = await mfaService.verifyMFACode(userId, code, type);

    return res.status(200).json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error('MFA verify error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify MFA code',
      code: 'MFA_VERIFY_ERROR',
    });
  }
});

/**
 * @route POST /api/mfa/send-sms
 * @desc 发送短信验证码
 * @access Private
 */
router.post('/send-sms', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
        code: 'MISSING_PHONE',
      });
    }

    // 验证手机号格式
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format',
        code: 'INVALID_PHONE',
      });
    }

    // 发送短信验证码
    const result = await mfaService.sendSMSCode(userId, phoneNumber);

    return res.status(200).json({
      success: true,
      message: 'SMS code sent successfully',
      data: {
        expiresIn: result.expiresIn,
      },
    });
  } catch (error) {
    console.error('Send SMS error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send SMS code',
      code: 'SMS_SEND_ERROR',
    });
  }
});

/**
 * @route POST /api/mfa/verify-sms
 * @desc 验证短信验证码
 * @access Private
 */
router.post('/verify-sms', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'SMS code is required',
        code: 'MISSING_SMS_CODE',
      });
    }

    // 验证短信验证码
    const result = await mfaService.verifyMFACode(userId, code, 'sms');

    return res.status(200).json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error('Verify SMS error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify SMS code',
      code: 'SMS_VERIFY_ERROR',
    });
  }
});

/**
 * @route POST /api/mfa/verify-recovery
 * @desc 验证恢复码
 * @access Private
 */
router.post('/verify-recovery', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Recovery code is required',
        code: 'MISSING_RECOVERY_CODE',
      });
    }

    // 验证恢复码
    const result = await mfaService.verifyMFACode(userId, code, 'recovery');

    return res.status(200).json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error('Verify recovery code error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify recovery code',
      code: 'RECOVERY_VERIFY_ERROR',
    });
  }
});

/**
 * @route GET /api/mfa/status
 * @desc 获取MFA状态
 * @access Private
 */
router.get('/status', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // 获取用户MFA配置
    const mfaConfig = await mfaService.getUserMFAConfig(userId);

    return res.status(200).json({
      success: true,
      data: {
        enabled: mfaConfig ? mfaConfig.enabled : false,
        totpEnabled: mfaConfig ? !!mfaConfig.totpSecret : false,
        smsEnabled: mfaConfig ? mfaConfig.smsEnabled : false,
        recoveryCodesCount: mfaConfig ? (mfaConfig.recoveryCodes || []).length : 0,
        createdAt: mfaConfig ? mfaConfig.createdAt : null,
      },
    });
  } catch (error) {
    console.error('Get MFA status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get MFA status',
      code: 'MFA_STATUS_ERROR',
    });
  }
});

/**
 * @route POST /api/mfa/disable
 * @desc 禁用MFA
 * @access Private
 */
router.post('/disable', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    // 验证用户身份（需要提供MFA代码或恢复码）
    if (code) {
      const result = await mfaService.verifyMFACode(userId, code, 'totp');
      if (!result.success) {
        // 尝试恢复码
        const recoveryResult = await mfaService.verifyMFACode(userId, code, 'recovery');
        if (!recoveryResult.success) {
          return res.status(400).json({
            success: false,
            error: 'Invalid verification code',
            code: 'INVALID_CODE',
          });
        }
      }
    }

    // 禁用MFA
    await mfaService.disableMFA(userId);

    return res.status(200).json({
      success: true,
      message: 'MFA disabled successfully',
    });
  } catch (error) {
    console.error('Disable MFA error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to disable MFA',
      code: 'MFA_DISABLE_ERROR',
    });
  }
});

/**
 * @route POST /api/mfa/regenerate-recovery-codes
 * @desc 重新生成恢复码
 * @access Private
 */
router.post('/regenerate-recovery-codes', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    // 验证用户身份
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Verification code is required',
        code: 'MISSING_CODE',
      });
    }

    const result = await mfaService.verifyMFACode(userId, code, 'totp');
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code',
        code: 'INVALID_CODE',
      });
    }

    // 生成新的恢复码
    const recoveryCodes = mfaService.generateRecoveryCodes();

    // 更新恢复码（这里应该更新数据库）
    await mfaService.updateRecoveryCodes(userId, recoveryCodes);

    return res.status(200).json({
      success: true,
      message: 'Recovery codes regenerated successfully',
      data: {
        recoveryCodes,
      },
    });
  } catch (error) {
    console.error('Regenerate recovery codes error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to regenerate recovery codes',
      code: 'RECOVERY_CODES_ERROR',
    });
  }
});

module.exports = router;

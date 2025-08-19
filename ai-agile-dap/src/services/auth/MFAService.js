/**
 * 多因素认证服务
 * 实现TOTP（Time-based OTP）和短信验证
 */

const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

class MFAService {
  constructor() {
    this.issuer = 'AI-Agile-DAP';
    this.algorithm = 'sha1';
    this.digits = 6;
    this.period = 30; // 30秒有效期
  }

  /**
   * 生成TOTP密钥
   * @param {string} userId - 用户ID
   * @param {string} email - 用户邮箱
   * @returns {Object} TOTP配置信息
   */
  generateTOTPSecret(userId, email) {
    try {
      const secret = speakeasy.generateSecret({
        name: `${this.issuer}:${email}`,
        issuer: this.issuer,
        length: 32,
      });

      return {
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url,
        qrCode: null, // 将在下面生成
      };
    } catch (error) {
      console.error('Generate TOTP secret error:', error);
      throw new Error('Failed to generate TOTP secret');
    }
  }

  /**
   * 生成QR码（用于TOTP设置）
   * @param {string} otpauthUrl - OTP认证URL
   * @returns {Promise<string>} QR码数据URL
   */
  async generateQRCode(otpauthUrl) {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      return qrCodeDataUrl;
    } catch (error) {
      console.error('Generate QR code error:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * 验证TOTP代码
   * @param {string} secret - TOTP密钥
   * @param {string} token - 用户输入的TOTP代码
   * @param {number} window - 时间窗口（默认1，即前后30秒）
   * @returns {boolean} 验证结果
   */
  verifyTOTP(secret, token, window = 1) {
    try {
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: window,
        algorithm: this.algorithm,
        digits: this.digits,
        period: this.period,
      });

      return verified;
    } catch (error) {
      console.error('Verify TOTP error:', error);
      return false;
    }
  }

  /**
   * 生成备用恢复码
   * @param {number} count - 生成数量（默认10个）
   * @returns {Array<string>} 恢复码列表
   */
  generateRecoveryCodes(count = 10) {
    try {
      const codes = [];
      for (let i = 0; i < count; i++) {
        // 生成8位随机字符串，包含数字和大写字母
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        codes.push(code);
      }
      return codes;
    } catch (error) {
      console.error('Generate recovery codes error:', error);
      throw new Error('Failed to generate recovery codes');
    }
  }

  /**
   * 验证恢复码
   * @param {Array<string>} storedCodes - 存储的恢复码
   * @param {string} inputCode - 用户输入的恢复码
   * @returns {Object} 验证结果
   */
  verifyRecoveryCode(storedCodes, inputCode) {
    try {
      const normalizedInput = inputCode.toUpperCase().replace(/\s/g, '');
      const index = storedCodes.findIndex(code => code === normalizedInput);

      if (index === -1) {
        return {
          valid: false,
          remainingCodes: storedCodes,
        };
      }

      // 移除已使用的恢复码
      const remainingCodes = [...storedCodes];
      remainingCodes.splice(index, 1);

      return {
        valid: true,
        remainingCodes,
        usedCode: storedCodes[index],
      };
    } catch (error) {
      console.error('Verify recovery code error:', error);
      return {
        valid: false,
        remainingCodes: storedCodes,
      };
    }
  }

  /**
   * 设置MFA（TOTP）
   * @param {string} userId - 用户ID
   * @param {string} email - 用户邮箱
   * @returns {Promise<Object>} MFA设置信息
   */
  async setupTOTP(userId, email) {
    try {
      // 生成TOTP密钥
      const totpConfig = this.generateTOTPSecret(userId, email);

      // 生成QR码
      const qrCode = await this.generateQRCode(totpConfig.otpauthUrl);

      // 生成恢复码
      const recoveryCodes = this.generateRecoveryCodes();

      return {
        success: true,
        secret: totpConfig.secret,
        qrCode,
        recoveryCodes,
        setupInstructions: [
          '1. 使用Google Authenticator、Microsoft Authenticator或其他TOTP应用扫描QR码',
          '2. 输入应用显示的6位验证码进行验证',
          '3. 保存恢复码以备不时之需',
        ],
      };
    } catch (error) {
      console.error('Setup TOTP error:', error);
      throw new Error('Failed to setup TOTP');
    }
  }

  /**
   * 验证MFA代码
   * @param {string} userId - 用户ID
   * @param {string} code - 验证码
   * @param {string} mfaType - MFA类型（totp/sms）
   * @returns {Promise<Object>} 验证结果
   */
  async verifyMFACode(userId, code, mfaType = 'totp') {
    try {
      // 获取用户MFA配置（这里应该从数据库获取）
      const mfaConfig = await this.getUserMFAConfig(userId);

      if (!mfaConfig || !mfaConfig.enabled) {
        throw new Error('MFA not enabled for user');
      }

      let isValid = false;

      if (mfaType === 'totp' && mfaConfig.totpSecret) {
        // 验证TOTP
        isValid = this.verifyTOTP(mfaConfig.totpSecret, code);
      } else if (mfaType === 'sms' && mfaConfig.smsEnabled) {
        // 验证短信验证码
        isValid = await this.verifySMSCode(userId, code);
      } else if (mfaType === 'recovery') {
        // 验证恢复码
        const result = this.verifyRecoveryCode(mfaConfig.recoveryCodes || [], code);
        isValid = result.valid;

        if (isValid) {
          // 更新恢复码列表
          await this.updateRecoveryCodes(userId, result.remainingCodes);
        }
      } else {
        throw new Error('Invalid MFA type or configuration');
      }

      return {
        success: isValid,
        message: isValid ? 'MFA verification successful' : 'Invalid MFA code',
      };
    } catch (error) {
      console.error('Verify MFA code error:', error);
      throw error;
    }
  }

  /**
   * 发送短信验证码
   * @param {string} userId - 用户ID
   * @param {string} phoneNumber - 手机号码
   * @returns {Promise<Object>} 发送结果
   */
  async sendSMSCode(userId, phoneNumber) {
    try {
      // 生成6位数字验证码
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // 存储验证码（这里应该存储到Redis，设置5分钟过期）
      await this.storeSMSCode(userId, code);

      // 这里应该调用短信服务发送验证码
      // 暂时模拟发送成功
      console.log(`[SMS] Sending code ${code} to ${phoneNumber} for user ${userId}`);

      return {
        success: true,
        message: 'SMS code sent successfully',
        expiresIn: 300, // 5分钟
      };
    } catch (error) {
      console.error('Send SMS code error:', error);
      throw new Error('Failed to send SMS code');
    }
  }

  /**
   * 验证短信验证码
   * @param {string} userId - 用户ID
   * @param {string} code - 验证码
   * @returns {Promise<boolean>} 验证结果
   */
  async verifySMSCode(userId, code) {
    try {
      // 从存储中获取验证码
      const storedCode = await this.getStoredSMSCode(userId);

      if (!storedCode) {
        return false;
      }

      // 验证码匹配
      const isValid = storedCode === code;

      if (isValid) {
        // 验证成功后删除存储的验证码
        await this.removeStoredSMSCode(userId);
      }

      return isValid;
    } catch (error) {
      console.error('Verify SMS code error:', error);
      return false;
    }
  }

  /**
   * 存储短信验证码（模拟实现）
   * @param {string} userId - 用户ID
   * @param {string} code - 验证码
   */
  async storeSMSCode(userId, code) {
    // 这里应该存储到Redis，设置5分钟过期
    // 暂时使用内存存储（仅用于开发）
    if (!this.smsCodes) {
      this.smsCodes = new Map();
    }
    this.smsCodes.set(userId, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5分钟后过期
    });
  }

  /**
   * 获取存储的短信验证码（模拟实现）
   * @param {string} userId - 用户ID
   * @returns {string|null} 验证码
   */
  async getStoredSMSCode(userId) {
    if (!this.smsCodes) {
      return null;
    }

    const stored = this.smsCodes.get(userId);
    if (!stored) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > stored.expiresAt) {
      this.smsCodes.delete(userId);
      return null;
    }

    return stored.code;
  }

  /**
   * 删除存储的短信验证码（模拟实现）
   * @param {string} userId - 用户ID
   */
  async removeStoredSMSCode(userId) {
    if (this.smsCodes) {
      this.smsCodes.delete(userId);
    }
  }

  /**
   * 获取用户MFA配置（模拟实现）
   * @param {string} userId - 用户ID
   * @returns {Promise<Object|null>} MFA配置
   */
  async getUserMFAConfig(userId) {
    // 模拟MFA配置数据
    const mockMFAConfigs = {
      1: {
        enabled: true,
        totpSecret: 'JBSWY3DPEHPK3PXP',
        smsEnabled: false,
        phoneNumber: null,
        recoveryCodes: ['ABCD1234', 'EFGH5678', 'IJKL9012'],
        createdAt: new Date().toISOString(),
      },
      2: {
        enabled: false,
        totpSecret: null,
        smsEnabled: false,
        phoneNumber: null,
        recoveryCodes: [],
        createdAt: null,
      },
    };

    return mockMFAConfigs[userId] || null;
  }

  /**
   * 更新恢复码列表（模拟实现）
   * @param {string} userId - 用户ID
   * @param {Array<string>} recoveryCodes - 新的恢复码列表
   */
  async updateRecoveryCodes(userId, recoveryCodes) {
    // 这里应该更新数据库中的恢复码
    console.log(`[MFA] Updated recovery codes for user ${userId}:`, recoveryCodes);
  }

  /**
   * 启用MFA
   * @param {string} userId - 用户ID
   * @param {Object} config - MFA配置
   * @returns {Promise<Object>} 启用结果
   */
  async enableMFA(userId, config) {
    try {
      // 这里应该更新数据库中的MFA配置
      console.log(`[MFA] Enabling MFA for user ${userId}:`, config);

      return {
        success: true,
        message: 'MFA enabled successfully',
      };
    } catch (error) {
      console.error('Enable MFA error:', error);
      throw new Error('Failed to enable MFA');
    }
  }

  /**
   * 禁用MFA
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 禁用结果
   */
  async disableMFA(userId) {
    try {
      // 这里应该更新数据库中的MFA配置
      console.log(`[MFA] Disabling MFA for user ${userId}`);

      return {
        success: true,
        message: 'MFA disabled successfully',
      };
    } catch (error) {
      console.error('Disable MFA error:', error);
      throw new Error('Failed to disable MFA');
    }
  }
}

module.exports = MFAService;

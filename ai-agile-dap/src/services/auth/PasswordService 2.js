/**
 * 密码安全服务
 * 实现密码强度验证、密码历史记录、密码过期提醒等功能
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');

class PasswordService {
  constructor() {
    this.minLength = 8;
    this.maxLength = 128;
    this.requireUppercase = true;
    this.requireLowercase = true;
    this.requireNumbers = true;
    this.requireSpecialChars = true;
    this.maxHistoryCount = 5; // 密码历史记录数量
    this.passwordExpiryDays = 90; // 密码过期天数
    this.warningDays = 14; // 过期前警告天数
  }

  /**
   * 验证密码强度
   * @param {string} password - 密码
   * @returns {Object} 验证结果
   */
  validatePasswordStrength(password) {
    const errors = [];
    const warnings = [];
    let score = 0;

    // 检查长度
    if (password.length < this.minLength) {
      errors.push(`密码长度至少需要${this.minLength}个字符`);
    } else if (password.length > this.maxLength) {
      errors.push(`密码长度不能超过${this.maxLength}个字符`);
    } else {
      score += Math.min(password.length * 2, 20); // 长度得分，最多20分
    }

    // 检查大写字母
    if (this.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('密码必须包含至少一个大写字母');
    } else if (/[A-Z]/.test(password)) {
      score += 10;
    }

    // 检查小写字母
    if (this.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('密码必须包含至少一个小写字母');
    } else if (/[a-z]/.test(password)) {
      score += 10;
    }

    // 检查数字
    if (this.requireNumbers && !/\d/.test(password)) {
      errors.push('密码必须包含至少一个数字');
    } else if (/\d/.test(password)) {
      score += 10;
    }

    // 检查特殊字符
    if (this.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('密码必须包含至少一个特殊字符');
    } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      score += 10;
    }

    // 检查常见弱密码
    const commonPasswords = [
      'password',
      '123456',
      '123456789',
      'qwerty',
      'abc123',
      'password123',
      'admin',
      'letmein',
      'welcome',
      'monkey',
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('不能使用常见弱密码');
      score = 0;
    }

    // 检查重复字符
    if (/(.)\1{2,}/.test(password)) {
      warnings.push('避免使用重复字符');
      score -= 5;
    }

    // 检查连续字符
    if (
      /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|123|234|345|456|567|678|789|012)/i.test(
        password
      )
    ) {
      warnings.push('避免使用连续字符');
      score -= 5;
    }

    // 计算复杂度得分
    const uniqueChars = new Set(password).size;
    score += Math.min(uniqueChars * 2, 20);

    // 确定强度等级
    let strength = 'weak';
    if (score >= 60) {
      strength = 'strong';
    } else if (score >= 40) {
      strength = 'medium';
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, Math.min(100, score)),
      strength,
      requirements: {
        minLength: this.minLength,
        maxLength: this.maxLength,
        requireUppercase: this.requireUppercase,
        requireLowercase: this.requireLowercase,
        requireNumbers: this.requireNumbers,
        requireSpecialChars: this.requireSpecialChars,
      },
    };
  }

  /**
   * 哈希密码
   * @param {string} password - 明文密码
   * @param {number} saltRounds - 盐轮数（默认12）
   * @returns {Promise<string>} 哈希后的密码
   */
  async hashPassword(password, saltRounds = 12) {
    try {
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      return hashedPassword;
    } catch (error) {
      console.error('Hash password error:', error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * 验证密码
   * @param {string} password - 明文密码
   * @param {string} hashedPassword - 哈希后的密码
   * @returns {Promise<boolean>} 验证结果
   */
  async verifyPassword(password, hashedPassword) {
    try {
      const isValid = await bcrypt.compare(password, hashedPassword);
      return isValid;
    } catch (error) {
      console.error('Verify password error:', error);
      return false;
    }
  }

  /**
   * 检查密码是否在历史记录中
   * @param {string} newPassword - 新密码
   * @param {Array<string>} passwordHistory - 密码历史记录
   * @returns {Promise<boolean>} 是否在历史记录中
   */
  async isPasswordInHistory(newPassword, passwordHistory) {
    try {
      if (!passwordHistory || passwordHistory.length === 0) {
        return false;
      }

      for (const hashedPassword of passwordHistory) {
        const isMatch = await this.verifyPassword(newPassword, hashedPassword);
        if (isMatch) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Check password history error:', error);
      return false;
    }
  }

  /**
   * 更新密码历史记录
   * @param {string} newHashedPassword - 新的哈希密码
   * @param {Array<string>} currentHistory - 当前历史记录
   * @returns {Array<string>} 更新后的历史记录
   */
  updatePasswordHistory(newHashedPassword, currentHistory = []) {
    try {
      const updatedHistory = [newHashedPassword, ...currentHistory];

      // 保持历史记录数量限制
      if (updatedHistory.length > this.maxHistoryCount) {
        return updatedHistory.slice(0, this.maxHistoryCount);
      }

      return updatedHistory;
    } catch (error) {
      console.error('Update password history error:', error);
      return currentHistory;
    }
  }

  /**
   * 检查密码是否过期
   * @param {Date} lastPasswordChange - 上次密码修改时间
   * @returns {Object} 过期检查结果
   */
  checkPasswordExpiry(lastPasswordChange) {
    try {
      if (!lastPasswordChange) {
        return {
          isExpired: false,
          isWarning: false,
          daysUntilExpiry: null,
          daysSinceChange: null,
        };
      }

      const now = new Date();
      const lastChange = new Date(lastPasswordChange);
      const daysSinceChange = Math.floor((now - lastChange) / (1000 * 60 * 60 * 24));
      const daysUntilExpiry = this.passwordExpiryDays - daysSinceChange;

      const isExpired = daysSinceChange >= this.passwordExpiryDays;
      const isWarning = !isExpired && daysUntilExpiry <= this.warningDays;

      return {
        isExpired,
        isWarning,
        daysUntilExpiry: Math.max(0, daysUntilExpiry),
        daysSinceChange,
      };
    } catch (error) {
      console.error('Check password expiry error:', error);
      return {
        isExpired: false,
        isWarning: false,
        daysUntilExpiry: null,
        daysSinceChange: null,
      };
    }
  }

  /**
   * 生成随机密码
   * @param {number} length - 密码长度（默认12）
   * @param {Object} options - 生成选项
   * @returns {string} 随机密码
   */
  generateRandomPassword(length = 12, options = {}) {
    try {
      const {
        includeUppercase = true,
        includeLowercase = true,
        includeNumbers = true,
        includeSpecialChars = true,
        excludeSimilarChars = true,
      } = options;

      let charset = '';
      let password = '';

      // 构建字符集
      if (includeUppercase) {
        charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      }
      if (includeLowercase) {
        charset += 'abcdefghijklmnopqrstuvwxyz';
      }
      if (includeNumbers) {
        charset += '0123456789';
      }
      if (includeSpecialChars) {
        charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
      }

      // 排除相似字符
      if (excludeSimilarChars) {
        charset = charset.replace(/[0O1Il]/g, '');
      }

      if (charset.length === 0) {
        throw new Error('No character set available for password generation');
      }

      // 确保至少包含每种类型的字符
      if (includeUppercase) {
        password += charset.match(/[A-Z]/)[0];
      }
      if (includeLowercase) {
        password += charset.match(/[a-z]/)[0];
      }
      if (includeNumbers) {
        password += charset.match(/\d/)[0];
      }
      if (includeSpecialChars) {
        password += charset.match(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/)[0];
      }

      // 填充剩余长度
      while (password.length < length) {
        const randomIndex = crypto.randomInt(charset.length);
        password += charset[randomIndex];
      }

      // 打乱密码字符顺序
      return password
        .split('')
        .sort(() => Math.random() - 0.5)
        .join('');
    } catch (error) {
      console.error('Generate random password error:', error);
      throw new Error('Failed to generate random password');
    }
  }

  /**
   * 生成密码重置令牌
   * @param {string} userId - 用户ID
   * @param {string} email - 用户邮箱
   * @returns {string} 重置令牌
   */
  generateResetToken(userId, email) {
    try {
      const timestamp = Date.now();
      const randomBytes = crypto.randomBytes(32).toString('hex');
      const data = `${userId}:${email}:${timestamp}:${randomBytes}`;

      // 使用HMAC-SHA256生成令牌
      const secret = process.env.PASSWORD_RESET_SECRET || 'default-reset-secret';
      const token = crypto.createHmac('sha256', secret).update(data).digest('hex');

      return token;
    } catch (error) {
      console.error('Generate reset token error:', error);
      throw new Error('Failed to generate reset token');
    }
  }

  /**
   * 验证密码重置令牌
   * @param {string} token - 重置令牌
   * @param {string} userId - 用户ID
   * @param {string} email - 用户邮箱
   * @param {number} maxAge - 令牌最大有效期（毫秒，默认1小时）
   * @returns {Object} 验证结果
   */
  verifyResetToken(token, userId, email, maxAge = 60 * 60 * 1000) {
    try {
      const secret = process.env.PASSWORD_RESET_SECRET || 'default-reset-secret';

      // 这里应该从数据库获取令牌信息
      // 暂时返回模拟结果
      const isValid = token.length === 64; // 简单验证

      return {
        isValid,
        message: isValid ? 'Token is valid' : 'Invalid or expired token',
      };
    } catch (error) {
      console.error('Verify reset token error:', error);
      return {
        isValid: false,
        message: 'Token verification failed',
      };
    }
  }

  /**
   * 计算密码熵值
   * @param {string} password - 密码
   * @returns {number} 熵值
   */
  calculatePasswordEntropy(password) {
    try {
      let charsetSize = 0;

      if (/[a-z]/.test(password)) charsetSize += 26;
      if (/[A-Z]/.test(password)) charsetSize += 26;
      if (/\d/.test(password)) charsetSize += 10;
      if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) charsetSize += 32;

      if (charsetSize === 0) return 0;

      const entropy = Math.log2(Math.pow(charsetSize, password.length));
      return Math.round(entropy);
    } catch (error) {
      console.error('Calculate password entropy error:', error);
      return 0;
    }
  }

  /**
   * 获取密码建议
   * @param {string} password - 密码
   * @returns {Array<string>} 建议列表
   */
  getPasswordSuggestions(password) {
    const suggestions = [];
    const validation = this.validatePasswordStrength(password);

    if (password.length < this.minLength) {
      suggestions.push(`增加密码长度到至少${this.minLength}个字符`);
    }

    if (this.requireUppercase && !/[A-Z]/.test(password)) {
      suggestions.push('添加大写字母');
    }

    if (this.requireLowercase && !/[a-z]/.test(password)) {
      suggestions.push('添加小写字母');
    }

    if (this.requireNumbers && !/\d/.test(password)) {
      suggestions.push('添加数字');
    }

    if (this.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>\/?]/.test(password)) {
      suggestions.push('添加特殊字符');
    }

    if (validation.score < 40) {
      suggestions.push('考虑使用更复杂的密码组合');
    }

    if (/(.)\1{2,}/.test(password)) {
      suggestions.push('避免重复字符');
    }

    return suggestions;
  }

  /**
   * 设置密码策略
   * @param {Object} policy - 密码策略配置
   */
  setPasswordPolicy(policy) {
    if (policy.minLength !== undefined) this.minLength = policy.minLength;
    if (policy.maxLength !== undefined) this.maxLength = policy.maxLength;
    if (policy.requireUppercase !== undefined) this.requireUppercase = policy.requireUppercase;
    if (policy.requireLowercase !== undefined) this.requireLowercase = policy.requireLowercase;
    if (policy.requireNumbers !== undefined) this.requireNumbers = policy.requireNumbers;
    if (policy.requireSpecialChars !== undefined)
      this.requireSpecialChars = policy.requireSpecialChars;
    if (policy.maxHistoryCount !== undefined) this.maxHistoryCount = policy.maxHistoryCount;
    if (policy.passwordExpiryDays !== undefined)
      this.passwordExpiryDays = policy.passwordExpiryDays;
    if (policy.warningDays !== undefined) this.warningDays = policy.warningDays;
  }

  /**
   * 获取当前密码策略
   * @returns {Object} 密码策略
   */
  getPasswordPolicy() {
    return {
      minLength: this.minLength,
      maxLength: this.maxLength,
      requireUppercase: this.requireUppercase,
      requireLowercase: this.requireLowercase,
      requireNumbers: this.requireNumbers,
      requireSpecialChars: this.requireSpecialChars,
      maxHistoryCount: this.maxHistoryCount,
      passwordExpiryDays: this.passwordExpiryDays,
      warningDays: this.warningDays,
    };
  }
}

module.exports = PasswordService;

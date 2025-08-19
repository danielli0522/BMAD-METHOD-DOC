/**
 * DynamicPermissionService - 动态权限控制服务
 * 实现基于时间、地理位置、设备等上下文的动态权限控制
 */

const geoip = require('geoip-lite');
const crypto = require('crypto');

class DynamicPermissionService {
  constructor() {
    this.rules = new Map();
    this.deviceFingerprints = new Map();
  }

  /**
   * 添加时间限制规则
   */
  addTimeRule(ruleId, config) {
    const rule = {
      id: ruleId,
      type: 'time',
      config: {
        startTime: config.startTime, // HH:mm 格式
        endTime: config.endTime, // HH:mm 格式
        daysOfWeek: config.daysOfWeek || [0, 1, 2, 3, 4, 5, 6], // 0=周日
        timezone: config.timezone || 'UTC',
      },
    };

    this.rules.set(ruleId, rule);
    return rule;
  }

  /**
   * 添加地理位置规则
   */
  addLocationRule(ruleId, config) {
    const rule = {
      id: ruleId,
      type: 'location',
      config: {
        allowedCountries: config.allowedCountries || [],
        allowedRegions: config.allowedRegions || [],
        allowedCities: config.allowedCities || [],
        blockedIPs: config.blockedIPs || [],
        allowedIPs: config.allowedIPs || [],
      },
    };

    this.rules.set(ruleId, rule);
    return rule;
  }

  /**
   * 添加设备指纹规则
   */
  addDeviceRule(ruleId, config) {
    const rule = {
      id: ruleId,
      type: 'device',
      config: {
        allowedDevices: config.allowedDevices || [],
        blockedDevices: config.blockedDevices || [],
        requireDeviceVerification: config.requireDeviceVerification || false,
      },
    };

    this.rules.set(ruleId, rule);
    return rule;
  }

  /**
   * 检查时间限制
   */
  checkTimeRestriction(ruleId, context = {}) {
    const rule = this.rules.get(ruleId);
    if (!rule || rule.type !== 'time') {
      return true; // 没有规则限制
    }

    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', {
      hour12: false,
      timeZone: rule.config.timezone,
    });
    const currentDay = now.getDay();

    // 检查星期几
    if (!rule.config.daysOfWeek.includes(currentDay)) {
      return false;
    }

    // 检查时间范围
    if (currentTime < rule.config.startTime || currentTime > rule.config.endTime) {
      return false;
    }

    return true;
  }

  /**
   * 检查地理位置限制
   */
  checkLocationRestriction(ruleId, clientIp, context = {}) {
    const rule = this.rules.get(ruleId);
    if (!rule || rule.type !== 'location') {
      return true; // 没有规则限制
    }

    // 检查IP白名单/黑名单
    if (rule.config.blockedIPs.includes(clientIp)) {
      return false;
    }

    if (rule.config.allowedIPs.length > 0 && !rule.config.allowedIPs.includes(clientIp)) {
      return false;
    }

    // 获取地理位置信息
    const geo = geoip.lookup(clientIp);
    if (!geo) {
      return false; // 无法获取地理位置信息
    }

    // 检查国家
    if (
      rule.config.allowedCountries.length > 0 &&
      !rule.config.allowedCountries.includes(geo.country)
    ) {
      return false;
    }

    // 检查地区
    if (rule.config.allowedRegions.length > 0 && !rule.config.allowedRegions.includes(geo.region)) {
      return false;
    }

    // 检查城市
    if (rule.config.allowedCities.length > 0 && !rule.config.allowedCities.includes(geo.city)) {
      return false;
    }

    return true;
  }

  /**
   * 生成设备指纹
   */
  generateDeviceFingerprint(userAgent, additionalData = {}) {
    const fingerprintData = {
      userAgent,
      screenResolution: additionalData.screenResolution,
      timezone: additionalData.timezone,
      language: additionalData.language,
      platform: additionalData.platform,
    };

    const fingerprintString = JSON.stringify(fingerprintData);
    return crypto.createHash('sha256').update(fingerprintString).digest('hex');
  }

  /**
   * 检查设备限制
   */
  checkDeviceRestriction(ruleId, deviceFingerprint, context = {}) {
    const rule = this.rules.get(ruleId);
    if (!rule || rule.type !== 'device') {
      return true; // 没有规则限制
    }

    // 检查设备黑名单
    if (rule.config.blockedDevices.includes(deviceFingerprint)) {
      return false;
    }

    // 检查设备白名单
    if (
      rule.config.allowedDevices.length > 0 &&
      !rule.config.allowedDevices.includes(deviceFingerprint)
    ) {
      return false;
    }

    return true;
  }

  /**
   * 评估动态权限规则
   */
  evaluateDynamicRules(ruleIds, context = {}) {
    const results = {
      allowed: true,
      failedRules: [],
      details: {},
    };

    for (const ruleId of ruleIds) {
      const rule = this.rules.get(ruleId);
      if (!rule) {
        continue;
      }

      let ruleResult = true;

      switch (rule.type) {
        case 'time':
          ruleResult = this.checkTimeRestriction(ruleId, context);
          break;
        case 'location':
          ruleResult = this.checkLocationRestriction(ruleId, context.clientIp, context);
          break;
        case 'device':
          ruleResult = this.checkDeviceRestriction(ruleId, context.deviceFingerprint, context);
          break;
      }

      results.details[ruleId] = {
        type: rule.type,
        passed: ruleResult,
        config: rule.config,
      };

      if (!ruleResult) {
        results.allowed = false;
        results.failedRules.push(ruleId);
      }
    }

    return results;
  }

  /**
   * 创建上下文权限评估器
   */
  createContextEvaluator() {
    return {
      /**
       * 评估权限上下文
       */
      evaluate: (permission, context) => {
        const dynamicRules = permission.conditions?.dynamicRules || [];

        if (dynamicRules.length === 0) {
          return { allowed: true };
        }

        return this.evaluateDynamicRules(dynamicRules, context);
      },

      /**
       * 检查权限是否受动态规则影响
       */
      hasDynamicRules: permission => {
        return permission.conditions?.dynamicRules?.length > 0;
      },

      /**
       * 获取权限的动态规则
       */
      getDynamicRules: permission => {
        return permission.conditions?.dynamicRules || [];
      },
    };
  }

  /**
   * 添加动态权限规则引擎
   */
  addDynamicRuleEngine(engineConfig) {
    this.ruleEngine = {
      /**
       * 规则优先级
       */
      priorities: engineConfig.priorities || {
        time: 1,
        location: 2,
        device: 3,
      },

      /**
       * 规则组合逻辑
       */
      combinationLogic: engineConfig.combinationLogic || 'AND', // AND, OR

      /**
       * 评估规则组合
       */
      evaluate: (rules, context) => {
        const results = [];

        // 按优先级排序规则
        const sortedRules = rules.sort((a, b) => {
          const priorityA = this.ruleEngine.priorities[a.type] || 999;
          const priorityB = this.ruleEngine.priorities[b.type] || 999;
          return priorityA - priorityB;
        });

        for (const rule of sortedRules) {
          const result = this.evaluateDynamicRules([rule.id], context);
          results.push({
            rule,
            result: result.allowed,
          });
        }

        // 根据组合逻辑计算最终结果
        if (this.ruleEngine.combinationLogic === 'OR') {
          return results.some(r => r.result);
        } else {
          return results.every(r => r.result);
        }
      },
    };
  }

  /**
   * 获取规则统计信息
   */
  getRuleStats() {
    const stats = {
      total: this.rules.size,
      byType: {
        time: 0,
        location: 0,
        device: 0,
      },
    };

    for (const rule of this.rules.values()) {
      stats.byType[rule.type]++;
    }

    return stats;
  }

  /**
   * 删除规则
   */
  removeRule(ruleId) {
    return this.rules.delete(ruleId);
  }

  /**
   * 获取规则
   */
  getRule(ruleId) {
    return this.rules.get(ruleId);
  }

  /**
   * 获取所有规则
   */
  getAllRules() {
    return Array.from(this.rules.values());
  }

  /**
   * 验证规则配置
   */
  validateRule(rule) {
    const errors = [];

    if (!rule.id) {
      errors.push('Rule ID is required');
    }

    if (!rule.type) {
      errors.push('Rule type is required');
    }

    if (!rule.config) {
      errors.push('Rule configuration is required');
    }

    // 验证特定类型的配置
    switch (rule.type) {
      case 'time':
        if (!rule.config.startTime || !rule.config.endTime) {
          errors.push('Time rule requires startTime and endTime');
        }
        break;
      case 'location':
        if (!rule.config.allowedCountries && !rule.config.allowedIPs) {
          errors.push('Location rule requires at least one location restriction');
        }
        break;
      case 'device':
        if (!rule.config.allowedDevices && !rule.config.blockedDevices) {
          errors.push('Device rule requires at least one device restriction');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = DynamicPermissionService;

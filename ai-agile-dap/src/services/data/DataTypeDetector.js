/**
 * 数据类型检测服务
 * 提供智能数据类型识别和转换建议功能
 */

class DataTypeDetector {
  constructor() {
    this.supportedTypes = ['string', 'number', 'boolean', 'date', 'email', 'phone', 'url', 'json'];
    this.typePatterns = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^[\+]?[\d\s\-\(\)]{10,}$/,
      url: /^https?:\/\/.+/,
      date: /^\d{4}-\d{2}-\d{2}/,
      boolean: /^(true|false|yes|no|1|0|y|n)$/i,
      json: /^\{.*\}$|^\[.*\]$/,
    };
  }

  /**
   * 检测数据类型
   * @param {Array} columnData - 列数据
   * @returns {Promise<Object>} 类型检测结果
   */
  async detectDataType(columnData) {
    try {
      if (!columnData || columnData.length === 0) {
        throw new Error('列数据为空');
      }

      const nonNullData = columnData.filter(v => v !== null && v !== undefined && v !== '');

      if (nonNullData.length === 0) {
        return {
          success: true,
          data: {
            detectedType: 'unknown',
            confidence: 0,
            sampleValues: [],
            suggestions: [],
          },
          message: '数据类型检测完成',
        };
      }

      // 分析数据类型
      const analysis = this.analyzeDataType(nonNullData);

      // 生成转换建议
      const suggestions = this.generateConversionSuggestions(analysis);

      return {
        success: true,
        data: {
          detectedType: analysis.detectedType,
          confidence: analysis.confidence,
          sampleValues: analysis.sampleValues,
          suggestions,
          analysis: analysis,
        },
        message: '数据类型检测完成',
      };
    } catch (error) {
      console.error('数据类型检测失败:', error);
      return {
        success: false,
        error: 'TYPE_DETECTION_FAILED',
        message: '数据类型检测失败',
        details: error.message,
      };
    }
  }

  /**
   * 分析数据类型
   * @private
   */
  analyzeDataType(data) {
    const sampleSize = Math.min(100, data.length);
    const sampleData = data.slice(0, sampleSize);

    const typeScores = {};
    const sampleValues = [];

    // 初始化类型分数
    for (const type of this.supportedTypes) {
      typeScores[type] = 0;
    }

    // 分析每个样本值
    for (const value of sampleData) {
      const valueType = this.classifyValue(value);
      typeScores[valueType]++;
      sampleValues.push({ value, detectedType: valueType });
    }

    // 计算置信度
    const totalSamples = sampleData.length;
    const confidence = {};

    for (const [type, count] of Object.entries(typeScores)) {
      confidence[type] = count / totalSamples;
    }

    // 确定主要类型
    const detectedType = Object.entries(confidence).reduce((a, b) =>
      confidence[a[0]] > confidence[b[1]] ? a : b
    )[0];

    return {
      detectedType,
      confidence: confidence[detectedType],
      typeScores,
      sampleValues,
      totalSamples,
    };
  }

  /**
   * 分类单个值
   * @private
   */
  classifyValue(value) {
    const strValue = String(value).trim();

    // 检查特殊类型
    if (this.typePatterns.email.test(strValue)) {
      return 'email';
    }

    if (this.typePatterns.phone.test(strValue)) {
      return 'phone';
    }

    if (this.typePatterns.url.test(strValue)) {
      return 'url';
    }

    if (this.typePatterns.boolean.test(strValue)) {
      return 'boolean';
    }

    if (this.typePatterns.json.test(strValue)) {
      try {
        JSON.parse(strValue);
        return 'json';
      } catch {
        // 不是有效的JSON
      }
    }

    if (this.typePatterns.date.test(strValue)) {
      const date = new Date(strValue);
      if (!isNaN(date.getTime())) {
        return 'date';
      }
    }

    // 检查数字
    if (!isNaN(Number(strValue)) && isFinite(Number(strValue))) {
      return 'number';
    }

    // 默认为字符串
    return 'string';
  }

  /**
   * 生成转换建议
   * @private
   */
  generateConversionSuggestions(analysis) {
    const suggestions = [];
    const { detectedType, confidence, typeScores } = analysis;

    // 如果置信度较低，提供建议
    if (confidence < 0.8) {
      const alternativeTypes = Object.entries(typeScores)
        .filter(([type, count]) => count > 0 && type !== detectedType)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2);

      for (const [type, count] of alternativeTypes) {
        suggestions.push({
          type: 'alternative_type',
          description: `考虑将数据类型转换为 ${type}`,
          confidence: count / analysis.totalSamples,
          reason: `检测到 ${count} 个值符合 ${type} 类型`,
        });
      }
    }

    // 根据检测到的类型提供具体建议
    switch (detectedType) {
      case 'string':
        if (typeScores.email > 0) {
          suggestions.push({
            type: 'validation',
            description: '建议添加邮箱格式验证',
            action: 'add_email_validation',
          });
        }
        if (typeScores.phone > 0) {
          suggestions.push({
            type: 'validation',
            description: '建议添加电话号码格式验证',
            action: 'add_phone_validation',
          });
        }
        break;

      case 'number':
        suggestions.push({
          type: 'optimization',
          description: '建议使用数值类型存储以提高性能',
          action: 'use_numeric_type',
        });
        break;

      case 'date':
        suggestions.push({
          type: 'standardization',
          description: '建议统一日期格式为 ISO 8601',
          action: 'standardize_date_format',
        });
        break;

      case 'boolean':
        suggestions.push({
          type: 'standardization',
          description: '建议统一布尔值格式',
          action: 'standardize_boolean_format',
        });
        break;
    }

    return suggestions;
  }

  /**
   * 提供数据类型转换建议
   * @param {Array} columnData - 列数据
   * @param {string} detectedType - 检测到的类型
   * @returns {Array} 转换建议
   */
  suggestConversions(columnData, detectedType) {
    const suggestions = [];

    switch (detectedType) {
      case 'string':
        // 检查是否可以转换为其他类型
        const emailCount = columnData.filter(v => this.typePatterns.email.test(v)).length;
        const phoneCount = columnData.filter(v => this.typePatterns.phone.test(v)).length;
        const urlCount = columnData.filter(v => this.typePatterns.url.test(v)).length;

        if (emailCount > columnData.length * 0.8) {
          suggestions.push({
            type: 'email',
            description: '大部分值为邮箱格式，建议转换为邮箱类型',
            conversionRate: emailCount / columnData.length,
          });
        }

        if (phoneCount > columnData.length * 0.8) {
          suggestions.push({
            type: 'phone',
            description: '大部分值为电话号码格式，建议转换为电话类型',
            conversionRate: phoneCount / columnData.length,
          });
        }

        if (urlCount > columnData.length * 0.8) {
          suggestions.push({
            type: 'url',
            description: '大部分值为URL格式，建议转换为URL类型',
            conversionRate: urlCount / columnData.length,
          });
        }
        break;

      case 'number':
        // 检查数值范围，建议合适的数值类型
        const numbers = columnData.map(v => Number(v)).filter(n => !isNaN(n));
        if (numbers.length > 0) {
          const min = Math.min(...numbers);
          const max = Math.max(...numbers);

          if (min >= 0 && max <= 255) {
            suggestions.push({
              type: 'tinyint',
              description: '数值范围适合使用 TINYINT 类型',
              range: { min, max },
            });
          } else if (min >= -32768 && max <= 32767) {
            suggestions.push({
              type: 'smallint',
              description: '数值范围适合使用 SMALLINT 类型',
              range: { min, max },
            });
          } else if (min >= -2147483648 && max <= 2147483647) {
            suggestions.push({
              type: 'int',
              description: '数值范围适合使用 INT 类型',
              range: { min, max },
            });
          } else {
            suggestions.push({
              type: 'bigint',
              description: '数值范围较大，建议使用 BIGINT 类型',
              range: { min, max },
            });
          }
        }
        break;

      case 'date':
        suggestions.push({
          type: 'date_format',
          description: '建议使用标准日期格式 YYYY-MM-DD',
          action: 'standardize_date_format',
        });
        break;
    }

    return suggestions;
  }

  /**
   * 验证数据类型
   * @param {Array} columnData - 列数据
   * @param {string} expectedType - 期望的数据类型
   * @returns {Object} 验证结果
   */
  validateDataType(columnData, expectedType) {
    const validation = {
      expectedType,
      validCount: 0,
      invalidCount: 0,
      invalidValues: [],
      isValid: false,
    };

    for (const value of columnData) {
      if (value === null || value === undefined || value === '') {
        continue;
      }

      let isValid = false;
      switch (expectedType) {
        case 'email':
          isValid = this.typePatterns.email.test(value);
          break;
        case 'phone':
          isValid = this.typePatterns.phone.test(value);
          break;
        case 'url':
          isValid = this.typePatterns.url.test(value);
          break;
        case 'date':
          isValid = !isNaN(new Date(value).getTime());
          break;
        case 'number':
          isValid = !isNaN(Number(value)) && isFinite(Number(value));
          break;
        case 'boolean':
          isValid = this.typePatterns.boolean.test(value);
          break;
        case 'json':
          try {
            JSON.parse(value);
            isValid = true;
          } catch {
            isValid = false;
          }
          break;
        default:
          isValid = true;
      }

      if (isValid) {
        validation.validCount++;
      } else {
        validation.invalidCount++;
        validation.invalidValues.push(value);
      }
    }

    validation.isValid = validation.invalidCount === 0;
    validation.validityRate =
      validation.validCount / (validation.validCount + validation.invalidCount);

    return validation;
  }

  /**
   * 获取服务状态
   */
  getServiceStatus() {
    return {
      service: 'DataTypeDetector',
      status: 'running',
      version: '1.0.0',
      supportedTypes: this.supportedTypes,
      typePatterns: Object.keys(this.typePatterns),
    };
  }
}

module.exports = DataTypeDetector;

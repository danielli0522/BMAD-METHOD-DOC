/**
 * 数据质量分析服务
 * 提供数据质量评估和问题检测功能
 */

class DataQualityAnalyzer {
  constructor() {
    this.qualityMetrics = ['completeness', 'accuracy', 'consistency', 'timeliness', 'validity'];
    this.thresholds = {
      completeness: 0.95,
      accuracy: 0.9,
      consistency: 0.85,
      timeliness: 0.8,
      validity: 0.9,
    };
  }

  /**
   * 分析数据质量
   * @param {Array} sampleData - 样本数据
   * @returns {Promise<Object>} 质量分析结果
   */
  async analyzeDataQuality(sampleData) {
    try {
      if (!sampleData || sampleData.length === 0) {
        throw new Error('样本数据为空');
      }

      const columns = Object.keys(sampleData[0]);
      const qualityReport = {
        overallScore: 0,
        metrics: {},
        issues: [],
        recommendations: [],
        analyzedAt: new Date(),
      };

      // 分析每个列的质量
      for (const column of columns) {
        const columnData = sampleData.map(row => row[column]);
        const columnQuality = this.analyzeColumnQuality(column, columnData);
        qualityReport.metrics[column] = columnQuality;
      }

      // 计算整体质量分数
      qualityReport.overallScore = this.calculateOverallScore(qualityReport.metrics);

      // 识别问题
      qualityReport.issues = this.identifyIssues(qualityReport.metrics);

      // 生成建议
      qualityReport.recommendations = this.generateRecommendations(qualityReport.issues);

      return {
        success: true,
        data: qualityReport,
        message: '数据质量分析完成',
      };
    } catch (error) {
      console.error('数据质量分析失败:', error);
      return {
        success: false,
        error: 'QUALITY_ANALYSIS_FAILED',
        message: '数据质量分析失败',
        details: error.message,
      };
    }
  }

  /**
   * 分析单列数据质量
   * @private
   */
  analyzeColumnQuality(columnName, columnData) {
    const quality = {
      column: columnName,
      completeness: this.calculateCompleteness(columnData),
      accuracy: this.calculateAccuracy(columnData),
      consistency: this.calculateConsistency(columnData),
      timeliness: this.calculateTimeliness(columnData),
      validity: this.calculateValidity(columnData),
      dataType: this.detectDataType(columnData),
      statistics: this.calculateStatistics(columnData),
    };

    // 计算综合分数
    quality.score = this.calculateColumnScore(quality);

    return quality;
  }

  /**
   * 计算完整性
   * @private
   */
  calculateCompleteness(columnData) {
    const nonNullCount = columnData.filter(
      value => value !== null && value !== undefined && value !== ''
    ).length;

    return {
      score: nonNullCount / columnData.length,
      nonNullCount,
      totalCount: columnData.length,
      nullCount: columnData.length - nonNullCount,
    };
  }

  /**
   * 计算准确性
   * @private
   */
  calculateAccuracy(columnData) {
    // 基于数据类型的准确性检查
    const dataType = this.detectDataType(columnData);
    let validCount = 0;

    for (const value of columnData) {
      if (value === null || value === undefined || value === '') {
        continue;
      }

      let isValid = true;
      switch (dataType) {
        case 'email':
          isValid = this.isValidEmail(value);
          break;
        case 'date':
          isValid = this.isValidDate(value);
          break;
        case 'number':
          isValid = this.isValidNumber(value);
          break;
        case 'phone':
          isValid = this.isValidPhone(value);
          break;
        default:
          isValid = true;
      }

      if (isValid) {
        validCount++;
      }
    }

    return {
      score: validCount / columnData.length,
      validCount,
      invalidCount: columnData.length - validCount,
    };
  }

  /**
   * 计算一致性
   * @private
   */
  calculateConsistency(columnData) {
    const dataType = this.detectDataType(columnData);
    const nonNullData = columnData.filter(v => v !== null && v !== undefined && v !== '');

    if (nonNullData.length === 0) {
      return { score: 1, consistentCount: 0, inconsistentCount: 0 };
    }

    let consistentCount = 0;
    for (const value of nonNullData) {
      let isConsistent = true;

      switch (dataType) {
        case 'email':
          isConsistent = this.isValidEmail(value);
          break;
        case 'date':
          isConsistent = this.isValidDate(value);
          break;
        case 'number':
          isConsistent = this.isValidNumber(value);
          break;
        case 'phone':
          isConsistent = this.isValidPhone(value);
          break;
        default:
          isConsistent = true;
      }

      if (isConsistent) {
        consistentCount++;
      }
    }

    return {
      score: consistentCount / nonNullData.length,
      consistentCount,
      inconsistentCount: nonNullData.length - consistentCount,
    };
  }

  /**
   * 计算时效性
   * @private
   */
  calculateTimeliness(columnData) {
    const dataType = this.detectDataType(columnData);

    if (dataType !== 'date') {
      return { score: 1, reason: 'Not a date column' };
    }

    const now = new Date();
    const validDates = columnData
      .filter(v => v !== null && v !== undefined && v !== '')
      .map(v => new Date(v))
      .filter(d => !isNaN(d.getTime()));

    if (validDates.length === 0) {
      return { score: 0, reason: 'No valid dates found' };
    }

    // 检查日期是否在合理范围内（过去30年内）
    const thirtyYearsAgo = new Date(now.getFullYear() - 30, 0, 1);
    const futureLimit = new Date(now.getFullYear() + 1, 11, 31);

    const timelyCount = validDates.filter(
      date => date >= thirtyYearsAgo && date <= futureLimit
    ).length;

    return {
      score: timelyCount / validDates.length,
      timelyCount,
      untimelyCount: validDates.length - timelyCount,
    };
  }

  /**
   * 计算有效性
   * @private
   */
  calculateValidity(columnData) {
    const dataType = this.detectDataType(columnData);
    const nonNullData = columnData.filter(v => v !== null && v !== undefined && v !== '');

    if (nonNullData.length === 0) {
      return { score: 1, validCount: 0, invalidCount: 0 };
    }

    let validCount = 0;
    for (const value of nonNullData) {
      let isValid = true;

      switch (dataType) {
        case 'email':
          isValid = this.isValidEmail(value);
          break;
        case 'date':
          isValid = this.isValidDate(value);
          break;
        case 'number':
          isValid = this.isValidNumber(value);
          break;
        case 'phone':
          isValid = this.isValidPhone(value);
          break;
        default:
          isValid = true;
      }

      if (isValid) {
        validCount++;
      }
    }

    return {
      score: validCount / nonNullData.length,
      validCount,
      invalidCount: nonNullData.length - validCount,
    };
  }

  /**
   * 检测数据类型
   * @private
   */
  detectDataType(columnData) {
    const nonNullData = columnData.filter(v => v !== null && v !== undefined && v !== '');

    if (nonNullData.length === 0) {
      return 'unknown';
    }

    const sampleValues = nonNullData.slice(0, Math.min(100, nonNullData.length));

    // 检查是否为邮箱
    if (sampleValues.every(v => this.isValidEmail(v))) {
      return 'email';
    }

    // 检查是否为日期
    if (sampleValues.every(v => this.isValidDate(v))) {
      return 'date';
    }

    // 检查是否为数字
    if (sampleValues.every(v => this.isValidNumber(v))) {
      return 'number';
    }

    // 检查是否为电话
    if (sampleValues.every(v => this.isValidPhone(v))) {
      return 'phone';
    }

    return 'string';
  }

  /**
   * 计算统计信息
   * @private
   */
  calculateStatistics(columnData) {
    const nonNullData = columnData.filter(v => v !== null && v !== undefined && v !== '');

    if (nonNullData.length === 0) {
      return { count: 0, uniqueCount: 0 };
    }

    const uniqueValues = new Set(nonNullData);
    const dataType = this.detectDataType(columnData);

    const stats = {
      count: nonNullData.length,
      uniqueCount: uniqueValues.size,
      dataType,
    };

    if (dataType === 'number') {
      const numbers = nonNullData.map(v => Number(v));
      stats.min = Math.min(...numbers);
      stats.max = Math.max(...numbers);
      stats.mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
      stats.median = this.calculateMedian(numbers);
    } else if (dataType === 'date') {
      const dates = nonNullData.map(v => new Date(v));
      stats.min = new Date(Math.min(...dates));
      stats.max = new Date(Math.max(...dates));
    } else if (dataType === 'string') {
      const lengths = nonNullData.map(v => String(v).length);
      stats.minLength = Math.min(...lengths);
      stats.maxLength = Math.max(...lengths);
      stats.avgLength = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
    }

    return stats;
  }

  /**
   * 计算列质量分数
   * @private
   */
  calculateColumnScore(quality) {
    const weights = {
      completeness: 0.25,
      accuracy: 0.25,
      consistency: 0.2,
      timeliness: 0.15,
      validity: 0.15,
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [metric, weight] of Object.entries(weights)) {
      if (quality[metric] && typeof quality[metric].score === 'number') {
        totalScore += quality[metric].score * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * 计算整体质量分数
   * @private
   */
  calculateOverallScore(metrics) {
    const columnScores = Object.values(metrics).map(m => m.score);
    return columnScores.reduce((sum, score) => sum + score, 0) / columnScores.length;
  }

  /**
   * 识别问题
   * @private
   */
  identifyIssues(metrics) {
    const issues = [];

    for (const [columnName, quality] of Object.entries(metrics)) {
      // 检查完整性
      if (quality.completeness.score < this.thresholds.completeness) {
        issues.push({
          column: columnName,
          type: 'completeness',
          severity: 'high',
          description: `列 ${columnName} 的完整性较低 (${(quality.completeness.score * 100).toFixed(1)}%)`,
          details: quality.completeness,
        });
      }

      // 检查准确性
      if (quality.accuracy.score < this.thresholds.accuracy) {
        issues.push({
          column: columnName,
          type: 'accuracy',
          severity: 'medium',
          description: `列 ${columnName} 的准确性较低 (${(quality.accuracy.score * 100).toFixed(1)}%)`,
          details: quality.accuracy,
        });
      }

      // 检查一致性
      if (quality.consistency.score < this.thresholds.consistency) {
        issues.push({
          column: columnName,
          type: 'consistency',
          severity: 'medium',
          description: `列 ${columnName} 的一致性较低 (${(quality.consistency.score * 100).toFixed(1)}%)`,
          details: quality.consistency,
        });
      }
    }

    return issues;
  }

  /**
   * 生成建议
   * @private
   */
  generateRecommendations(issues) {
    const recommendations = [];

    for (const issue of issues) {
      switch (issue.type) {
        case 'completeness':
          recommendations.push({
            type: 'completeness',
            priority: 'high',
            description: `建议清理列 ${issue.column} 的空值数据`,
            action: 'data_cleaning',
          });
          break;
        case 'accuracy':
          recommendations.push({
            type: 'accuracy',
            priority: 'medium',
            description: `建议验证列 ${issue.column} 的数据格式`,
            action: 'data_validation',
          });
          break;
        case 'consistency':
          recommendations.push({
            type: 'consistency',
            priority: 'medium',
            description: `建议统一列 ${issue.column} 的数据格式`,
            action: 'data_standardization',
          });
          break;
      }
    }

    return recommendations;
  }

  /**
   * 验证邮箱格式
   * @private
   */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * 验证日期格式
   * @private
   */
  isValidDate(date) {
    return !isNaN(Date.parse(date));
  }

  /**
   * 验证数字格式
   * @private
   */
  isValidNumber(value) {
    return !isNaN(Number(value)) && isFinite(Number(value));
  }

  /**
   * 验证电话格式
   * @private
   */
  isValidPhone(phone) {
    return /^[\+]?[\d\s\-\(\)]{10,}$/.test(phone);
  }

  /**
   * 计算中位数
   * @private
   */
  calculateMedian(numbers) {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  /**
   * 获取服务状态
   */
  getServiceStatus() {
    return {
      service: 'DataQualityAnalyzer',
      status: 'running',
      version: '1.0.0',
      qualityMetrics: this.qualityMetrics,
      thresholds: this.thresholds,
    };
  }
}

module.exports = DataQualityAnalyzer;

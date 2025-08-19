/**
 * 数据关系检测服务
 * 提供数据间关系发现和关联分析功能
 */

class DataRelationshipDetector {
  constructor() {
    this.relationshipTypes = ['correlation', 'dependency', 'similarity'];
    this.correlationThreshold = 0.7;
  }

  /**
   * 检测数据关系
   * @param {Array} sampleData - 样本数据
   * @returns {Promise<Object>} 关系检测结果
   */
  async detectRelationships(sampleData) {
    try {
      if (!sampleData || sampleData.length === 0) {
        throw new Error('样本数据为空');
      }

      const columns = Object.keys(sampleData[0]);
      const relationships = {
        correlations: [],
        dependencies: [],
        similarities: [],
        summary: {
          totalRelationships: 0,
          strongRelationships: 0,
          moderateRelationships: 0,
        },
        detectedAt: new Date(),
      };

      // 检测数值列之间的相关性
      const numericColumns = this.getNumericColumns(sampleData, columns);
      if (numericColumns.length > 1) {
        relationships.correlations = this.detectCorrelations(sampleData, numericColumns);
      }

      // 检测依赖关系
      relationships.dependencies = this.detectDependencies(sampleData, columns);

      // 检测相似性
      relationships.similarities = this.detectSimilarities(sampleData, columns);

      // 生成摘要
      relationships.summary = this.generateSummary(relationships);

      return {
        success: true,
        data: relationships,
        message: '数据关系发现完成',
      };
    } catch (error) {
      console.error('数据关系检测失败:', error);
      return {
        success: false,
        error: 'RELATIONSHIP_DETECTION_FAILED',
        message: '数据关系发现失败',
        details: error.message,
      };
    }
  }

  /**
   * 获取数值列
   * @private
   */
  getNumericColumns(sampleData, columns) {
    const numericColumns = [];

    for (const column of columns) {
      const values = sampleData.map(row => row[column]).filter(v => v !== null && v !== undefined);
      const numericValues = values.filter(v => !isNaN(Number(v)) && isFinite(Number(v)));

      if (numericValues.length > values.length * 0.8) {
        numericColumns.push(column);
      }
    }

    return numericColumns;
  }

  /**
   * 检测相关性
   * @private
   */
  detectCorrelations(sampleData, numericColumns) {
    const correlations = [];

    for (let i = 0; i < numericColumns.length; i++) {
      for (let j = i + 1; j < numericColumns.length; j++) {
        const col1 = numericColumns[i];
        const col2 = numericColumns[j];

        const values1 = sampleData.map(row => Number(row[col1])).filter(v => !isNaN(v));
        const values2 = sampleData.map(row => Number(row[col2])).filter(v => !isNaN(v));

        if (values1.length === values2.length && values1.length > 1) {
          const correlation = this.calculateCorrelation(values1, values2);

          if (Math.abs(correlation) >= this.correlationThreshold) {
            correlations.push({
              column1: col1,
              column2: col2,
              correlation: correlation,
              strength: this.getCorrelationStrength(correlation),
              type: correlation > 0 ? 'positive' : 'negative',
              description: `${col1} 与 ${col2} 存在${this.getCorrelationStrength(correlation)}${correlation > 0 ? '正' : '负'}相关关系`,
            });
          }
        }
      }
    }

    return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }

  /**
   * 计算皮尔逊相关系数
   * @private
   */
  calculateCorrelation(x, y) {
    const n = x.length;
    if (n !== y.length || n === 0) return 0;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * 获取相关性强度
   * @private
   */
  getCorrelationStrength(correlation) {
    const absCorr = Math.abs(correlation);
    if (absCorr >= 0.8) return '强';
    if (absCorr >= 0.6) return '中等';
    return '弱';
  }

  /**
   * 检测依赖关系
   * @private
   */
  detectDependencies(sampleData, columns) {
    const dependencies = [];

    for (let i = 0; i < columns.length; i++) {
      for (let j = 0; j < columns.length; j++) {
        if (i === j) continue;

        const col1 = columns[i];
        const col2 = columns[j];

        const dependency = this.analyzeDependency(sampleData, col1, col2);
        if (dependency.strength > 0.7) {
          dependencies.push({
            dependent: col1,
            independent: col2,
            strength: dependency.strength,
            description: `${col1} 依赖于 ${col2}`,
          });
        }
      }
    }

    return dependencies.sort((a, b) => b.strength - a.strength);
  }

  /**
   * 分析依赖关系
   * @private
   */
  analyzeDependency(sampleData, col1, col2) {
    const values1 = sampleData.map(row => row[col1]);
    const values2 = sampleData.map(row => row[col2]);

    const uniqueValues2 = [...new Set(values2)];
    let conditionalEntropy = 0;

    for (const val2 of uniqueValues2) {
      const filteredValues1 = values1.filter((_, index) => values2[index] === val2);
      const uniqueValues1 = [...new Set(filteredValues1)];

      let entropy = 0;
      for (const val1 of uniqueValues1) {
        const count = filteredValues1.filter(v => v === val1).length;
        const prob = count / filteredValues1.length;
        if (prob > 0) {
          entropy -= prob * Math.log2(prob);
        }
      }

      const prob2 = filteredValues1.length / values1.length;
      conditionalEntropy += prob2 * entropy;
    }

    const strength = Math.max(0, 1 - conditionalEntropy / Math.log2(uniqueValues2.length));

    return {
      strength,
    };
  }

  /**
   * 检测相似性
   * @private
   */
  detectSimilarities(sampleData, columns) {
    const similarities = [];

    for (let i = 0; i < columns.length; i++) {
      for (let j = i + 1; j < columns.length; j++) {
        const col1 = columns[i];
        const col2 = columns[j];

        const similarity = this.calculateSimilarity(sampleData, col1, col2);

        if (similarity.score >= 0.8) {
          similarities.push({
            column1: col1,
            column2: col2,
            similarity: similarity.score,
            description: `${col1} 与 ${col2} 具有相似性`,
          });
        }
      }
    }

    return similarities.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * 计算相似性
   * @private
   */
  calculateSimilarity(sampleData, col1, col2) {
    const values1 = sampleData.map(row => row[col1]);
    const values2 = sampleData.map(row => row[col2]);

    const unique1 = [...new Set(values1)];
    const unique2 = [...new Set(values2)];

    const intersection = unique1.filter(v => unique2.includes(v));
    const union = [...new Set([...unique1, ...unique2])];

    const jaccardSimilarity = intersection.length / union.length;

    return {
      score: jaccardSimilarity,
    };
  }

  /**
   * 生成摘要
   * @private
   */
  generateSummary(relationships) {
    const allRelationships = [
      ...relationships.correlations,
      ...relationships.dependencies,
      ...relationships.similarities,
    ];

    const strongCount = allRelationships.filter(
      r => r.strength > 0.8 || r.correlation > 0.8 || r.similarity > 0.8
    ).length;

    const moderateCount = allRelationships.filter(r => {
      const strength = r.strength || Math.abs(r.correlation) || r.similarity;
      return strength > 0.5 && strength <= 0.8;
    }).length;

    return {
      totalRelationships: allRelationships.length,
      strongRelationships: strongCount,
      moderateRelationships: moderateCount,
    };
  }

  /**
   * 获取服务状态
   */
  getServiceStatus() {
    return {
      service: 'DataRelationshipDetector',
      status: 'running',
      version: '1.0.0',
      relationshipTypes: this.relationshipTypes,
      correlationThreshold: this.correlationThreshold,
    };
  }
}

module.exports = DataRelationshipDetector;

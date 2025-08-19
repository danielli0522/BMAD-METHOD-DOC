/**
 * 数据探索报告生成服务
 * 提供综合数据探索报告生成功能
 */

class DataExplorationReporter {
  constructor() {
    this.reportTemplates = {
      summary: this.generateSummaryTemplate(),
      detailed: this.generateDetailedTemplate(),
      executive: this.generateExecutiveTemplate(),
    };
  }

  /**
   * 生成探索报告
   * @param {Object} explorationData - 探索数据
   * @returns {Promise<Object>} 报告生成结果
   */
  async generateExplorationReport(explorationData) {
    try {
      if (!explorationData) {
        throw new Error('探索数据为空');
      }

      const { sampleData, qualityAnalysis, relationshipAnalysis, typeAnalysis, datasourceInfo } =
        explorationData;

      const report = {
        metadata: this.generateMetadata(datasourceInfo),
        summary: this.generateSummary(sampleData, qualityAnalysis, relationshipAnalysis),
        dataQuality: this.generateQualitySection(qualityAnalysis),
        relationships: this.generateRelationshipSection(relationshipAnalysis),
        dataTypes: this.generateTypeSection(typeAnalysis),
        recommendations: this.generateRecommendations(explorationData),
        insights: this.generateInsights(explorationData),
        generatedAt: new Date(),
      };

      return {
        success: true,
        data: report,
        message: '数据探索报告生成完成',
      };
    } catch (error) {
      console.error('生成探索报告失败:', error);
      return {
        success: false,
        error: 'REPORT_GENERATION_FAILED',
        message: '数据探索报告生成失败',
        details: error.message,
      };
    }
  }

  /**
   * 生成元数据
   * @private
   */
  generateMetadata(datasourceInfo) {
    return {
      datasourceId: datasourceInfo?.datasourceId || 'unknown',
      datasourceType: datasourceInfo?.type || 'unknown',
      totalRows: datasourceInfo?.totalRows || 0,
      sampleSize: datasourceInfo?.sampleSize || 0,
      columns: datasourceInfo?.columns || [],
      analysisDate: new Date(),
    };
  }

  /**
   * 生成摘要
   * @private
   */
  generateSummary(sampleData, qualityAnalysis, relationshipAnalysis) {
    const totalRows = sampleData?.length || 0;
    const columns = sampleData?.[0] ? Object.keys(sampleData[0]) : [];
    const overallQuality = qualityAnalysis?.overallScore || 0;
    const totalRelationships = relationshipAnalysis?.summary?.totalRelationships || 0;

    return {
      overview: {
        totalRows,
        totalColumns: columns.length,
        sampleSize: totalRows,
        dataTypes: this.getDataTypesSummary(sampleData),
      },
      quality: {
        overallScore: overallQuality,
        qualityLevel: this.getQualityLevel(overallQuality),
        issuesCount: qualityAnalysis?.issues?.length || 0,
      },
      relationships: {
        totalRelationships,
        strongRelationships: relationshipAnalysis?.summary?.strongRelationships || 0,
        moderateRelationships: relationshipAnalysis?.summary?.moderateRelationships || 0,
      },
      keyFindings: this.generateKeyFindings(sampleData, qualityAnalysis, relationshipAnalysis),
    };
  }

  /**
   * 生成质量分析部分
   * @private
   */
  generateQualitySection(qualityAnalysis) {
    if (!qualityAnalysis) {
      return { error: '质量分析数据不可用' };
    }

    return {
      overallScore: qualityAnalysis.overallScore,
      qualityLevel: this.getQualityLevel(qualityAnalysis.overallScore),
      metrics: this.formatQualityMetrics(qualityAnalysis.metrics),
      issues: this.formatQualityIssues(qualityAnalysis.issues),
      recommendations: this.formatQualityRecommendations(qualityAnalysis.recommendations),
    };
  }

  /**
   * 生成关系分析部分
   * @private
   */
  generateRelationshipSection(relationshipAnalysis) {
    if (!relationshipAnalysis) {
      return { error: '关系分析数据不可用' };
    }

    return {
      summary: relationshipAnalysis.summary,
      correlations: this.formatCorrelations(relationshipAnalysis.correlations),
      dependencies: this.formatDependencies(relationshipAnalysis.dependencies),
      similarities: this.formatSimilarities(relationshipAnalysis.similarities),
    };
  }

  /**
   * 生成类型分析部分
   * @private
   */
  generateTypeSection(typeAnalysis) {
    if (!typeAnalysis) {
      return { error: '类型分析数据不可用' };
    }

    return {
      detectedTypes: typeAnalysis.detectedTypes,
      typeDistribution: typeAnalysis.typeDistribution,
      conversionSuggestions: typeAnalysis.conversionSuggestions,
    };
  }

  /**
   * 生成建议
   * @private
   */
  generateRecommendations(explorationData) {
    const recommendations = [];

    // 基于质量分析的建议
    if (explorationData.qualityAnalysis) {
      const qualityIssues = explorationData.qualityAnalysis.issues || [];
      for (const issue of qualityIssues) {
        recommendations.push({
          type: 'quality',
          priority: issue.severity === 'high' ? 'high' : 'medium',
          description: issue.description,
          action: this.getQualityAction(issue.type),
        });
      }
    }

    // 基于关系分析的建议
    if (explorationData.relationshipAnalysis) {
      const correlations = explorationData.relationshipAnalysis.correlations || [];
      for (const corr of correlations.slice(0, 3)) {
        recommendations.push({
          type: 'relationship',
          priority: 'medium',
          description: `考虑利用 ${corr.column1} 和 ${corr.column2} 之间的${corr.strength}相关性进行特征工程`,
          action: 'feature_engineering',
        });
      }
    }

    // 基于类型分析的建议
    if (explorationData.typeAnalysis) {
      const typeSuggestions = explorationData.typeAnalysis.conversionSuggestions || [];
      for (const suggestion of typeSuggestions.slice(0, 3)) {
        recommendations.push({
          type: 'data_type',
          priority: 'low',
          description: suggestion.description,
          action: 'data_type_conversion',
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * 生成洞察
   * @private
   */
  generateInsights(explorationData) {
    const insights = [];

    // 数据质量洞察
    if (explorationData.qualityAnalysis) {
      const overallScore = explorationData.qualityAnalysis.overallScore;
      if (overallScore < 0.7) {
        insights.push({
          type: 'quality_warning',
          title: '数据质量需要关注',
          description: `整体数据质量分数为 ${(overallScore * 100).toFixed(1)}%，建议进行数据清理`,
          impact: 'high',
        });
      } else if (overallScore > 0.9) {
        insights.push({
          type: 'quality_excellent',
          title: '数据质量优秀',
          description: `整体数据质量分数为 ${(overallScore * 100).toFixed(1)}%，数据质量良好`,
          impact: 'positive',
        });
      }
    }

    // 关系洞察
    if (explorationData.relationshipAnalysis) {
      const strongRelationships =
        explorationData.relationshipAnalysis.summary?.strongRelationships || 0;
      if (strongRelationships > 0) {
        insights.push({
          type: 'relationship_opportunity',
          title: '发现强相关关系',
          description: `检测到 ${strongRelationships} 个强相关关系，可用于特征工程和模型优化`,
          impact: 'medium',
        });
      }
    }

    // 数据类型洞察
    if (explorationData.typeAnalysis) {
      const typeDistribution = explorationData.typeAnalysis.typeDistribution || {};
      const stringCount = typeDistribution.string || 0;
      const numericCount = typeDistribution.numeric || 0;

      if (stringCount > numericCount * 2) {
        insights.push({
          type: 'data_type_insight',
          title: '文本数据占主导',
          description: '数据集中文本类型数据较多，建议考虑文本挖掘和NLP技术',
          impact: 'medium',
        });
      }
    }

    return insights;
  }

  /**
   * 获取数据类型摘要
   * @private
   */
  getDataTypesSummary(sampleData) {
    if (!sampleData || sampleData.length === 0) {
      return {};
    }

    const columns = Object.keys(sampleData[0]);
    const typeCounts = {};

    for (const column of columns) {
      const values = sampleData.map(row => row[column]).filter(v => v !== null && v !== undefined);
      const type = this.detectColumnType(values);
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }

    return typeCounts;
  }

  /**
   * 检测列类型
   * @private
   */
  detectColumnType(values) {
    if (values.length === 0) return 'unknown';

    const numericCount = values.filter(v => !isNaN(Number(v)) && isFinite(Number(v))).length;
    const dateCount = values.filter(v => !isNaN(new Date(v).getTime())).length;
    const emailCount = values.filter(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)).length;

    if (numericCount / values.length > 0.8) return 'numeric';
    if (dateCount / values.length > 0.8) return 'date';
    if (emailCount / values.length > 0.8) return 'email';

    return 'string';
  }

  /**
   * 获取质量等级
   * @private
   */
  getQualityLevel(score) {
    if (score >= 0.9) return 'excellent';
    if (score >= 0.8) return 'good';
    if (score >= 0.7) return 'fair';
    if (score >= 0.6) return 'poor';
    return 'very_poor';
  }

  /**
   * 生成关键发现
   * @private
   */
  generateKeyFindings(sampleData, qualityAnalysis, relationshipAnalysis) {
    const findings = [];

    // 数据规模发现
    if (sampleData) {
      findings.push({
        type: 'scale',
        description: `数据集包含 ${sampleData.length} 行数据，${Object.keys(sampleData[0] || {}).length} 个字段`,
      });
    }

    // 质量发现
    if (qualityAnalysis) {
      const qualityLevel = this.getQualityLevel(qualityAnalysis.overallScore);
      findings.push({
        type: 'quality',
        description: `数据质量等级为 ${qualityLevel}，整体分数 ${(qualityAnalysis.overallScore * 100).toFixed(1)}%`,
      });
    }

    // 关系发现
    if (relationshipAnalysis) {
      const strongCount = relationshipAnalysis.summary?.strongRelationships || 0;
      if (strongCount > 0) {
        findings.push({
          type: 'relationship',
          description: `发现 ${strongCount} 个强相关关系，可用于数据建模`,
        });
      }
    }

    return findings;
  }

  /**
   * 格式化质量指标
   * @private
   */
  formatQualityMetrics(metrics) {
    if (!metrics) return {};

    const formatted = {};
    for (const [column, quality] of Object.entries(metrics)) {
      formatted[column] = {
        score: quality.score,
        completeness: quality.completeness?.score || 0,
        accuracy: quality.accuracy?.score || 0,
        consistency: quality.consistency?.score || 0,
        dataType: quality.dataType || 'unknown',
      };
    }
    return formatted;
  }

  /**
   * 格式化质量问题
   * @private
   */
  formatQualityIssues(issues) {
    if (!issues) return [];

    return issues.map(issue => ({
      column: issue.column,
      type: issue.type,
      severity: issue.severity,
      description: issue.description,
      details: issue.details,
    }));
  }

  /**
   * 格式化质量建议
   * @private
   */
  formatQualityRecommendations(recommendations) {
    if (!recommendations) return [];

    return recommendations.map(rec => ({
      type: rec.type,
      priority: rec.priority,
      description: rec.description,
      action: rec.action,
    }));
  }

  /**
   * 格式化相关性
   * @private
   */
  formatCorrelations(correlations) {
    if (!correlations) return [];

    return correlations.map(corr => ({
      column1: corr.column1,
      column2: corr.column2,
      correlation: corr.correlation,
      strength: corr.strength,
      type: corr.type,
      description: corr.description,
    }));
  }

  /**
   * 格式化依赖关系
   * @private
   */
  formatDependencies(dependencies) {
    if (!dependencies) return [];

    return dependencies.map(dep => ({
      dependent: dep.dependent,
      independent: dep.independent,
      strength: dep.strength,
      description: dep.description,
    }));
  }

  /**
   * 格式化相似性
   * @private
   */
  formatSimilarities(similarities) {
    if (!similarities) return [];

    return similarities.map(sim => ({
      column1: sim.column1,
      column2: sim.column2,
      similarity: sim.similarity,
      description: sim.description,
    }));
  }

  /**
   * 获取质量改进行动
   * @private
   */
  getQualityAction(issueType) {
    const actions = {
      completeness: 'data_cleaning',
      accuracy: 'data_validation',
      consistency: 'data_standardization',
      timeliness: 'data_refresh',
      validity: 'data_validation',
    };
    return actions[issueType] || 'general_improvement';
  }

  /**
   * 生成摘要模板
   * @private
   */
  generateSummaryTemplate() {
    return {
      sections: ['overview', 'quality', 'relationships', 'keyFindings'],
      maxLength: 1000,
    };
  }

  /**
   * 生成详细模板
   * @private
   */
  generateDetailedTemplate() {
    return {
      sections: [
        'metadata',
        'summary',
        'dataQuality',
        'relationships',
        'dataTypes',
        'recommendations',
        'insights',
      ],
      maxLength: 5000,
    };
  }

  /**
   * 生成执行摘要模板
   * @private
   */
  generateExecutiveTemplate() {
    return {
      sections: ['summary', 'keyFindings', 'recommendations'],
      maxLength: 500,
    };
  }

  /**
   * 获取服务状态
   */
  getServiceStatus() {
    return {
      service: 'DataExplorationReporter',
      status: 'running',
      version: '1.0.0',
      reportTemplates: Object.keys(this.reportTemplates),
    };
  }
}

module.exports = DataExplorationReporter;

const DataSamplingService = require('./DataSamplingService');
const DataQualityAnalyzer = require('./DataQualityAnalyzer');
const DataTypeDetector = require('./DataTypeDetector');
const DataRelationshipDetector = require('./DataRelationshipDetector');
const DataExplorationReporter = require('./DataExplorationReporter');

/**
 * 数据预览核心服务
 * 提供AI驱动的数据预览和探索功能
 */
class DataPreviewService {
  constructor() {
    this.samplingService = new DataSamplingService();
    this.qualityAnalyzer = new DataQualityAnalyzer();
    this.typeDetector = new DataTypeDetector();
    this.relationshipDetector = new DataRelationshipDetector();
    this.explorationReporter = new DataExplorationReporter();
  }

  /**
   * 生成数据样本
   * @param {string} datasourceId - 数据源ID
   * @param {Object} options - 采样选项
   * @returns {Promise<DataSample>} 数据样本
   */
  async generateSample(datasourceId, options = {}) {
    try {
      const defaultOptions = {
        sampleSize: 1000,
        samplingMethod: 'stratified',
        includeMetadata: true,
        ...options,
      };

      const sample = await this.samplingService.generateSample(datasourceId, defaultOptions);

      // 缓存样本结果
      await this.cacheSample(datasourceId, sample);

      return {
        success: true,
        data: sample,
        message: '数据样本生成成功',
      };
    } catch (error) {
      console.error('生成数据样本失败:', error);
      return {
        success: false,
        error: 'SAMPLE_GENERATION_FAILED',
        message: '数据样本生成失败',
        details: error.message,
      };
    }
  }

  /**
   * 分析数据质量
   * @param {DataSample} sample - 数据样本
   * @returns {Promise<DataQualityReport>} 数据质量报告
   */
  async analyzeDataQuality(sample) {
    try {
      const qualityReport = await this.qualityAnalyzer.analyzeDataQuality(sample.data || sample);

      return {
        success: true,
        data: qualityReport.data,
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
   * 发现数据关系
   * @param {DataSample} sample - 数据样本
   * @returns {Promise<RelationshipMap>} 关系图谱
   */
  async detectRelationships(sample) {
    try {
      const relationships = await this.relationshipDetector.detectRelationships(
        sample.data || sample
      );

      return {
        success: true,
        data: relationships.data,
        message: '数据关系发现完成',
      };
    } catch (error) {
      console.error('数据关系发现失败:', error);
      return {
        success: false,
        error: 'RELATIONSHIP_DETECTION_FAILED',
        message: '数据关系发现失败',
        details: error.message,
      };
    }
  }

  /**
   * 生成数据探索报告
   * @param {string} datasourceId - 数据源ID
   * @returns {Promise<ExplorationReport>} 探索报告
   */
  async generateExplorationReport(datasourceId) {
    try {
      // 获取或生成数据样本
      let sample = await this.getCachedSample(datasourceId);
      if (!sample) {
        const sampleResult = await this.generateSample(datasourceId);
        if (!sampleResult.success) {
          throw new Error('无法生成数据样本');
        }
        sample = sampleResult.data;
      }

      // 并行执行分析任务
      const [qualityReport, relationships] = await Promise.all([
        this.analyzeDataQuality(sample),
        this.detectRelationships(sample),
      ]);

      // 生成综合报告
      const report = await this.explorationReporter.generateExplorationReport({
        datasourceId,
        sampleData: sample.data || sample,
        qualityAnalysis: qualityReport.data,
        relationshipAnalysis: relationships.data,
        datasourceInfo: {
          datasourceId,
          totalRows: sample.totalRows || sample.data?.length || 0,
          sampleSize: sample.sampleSize || sample.data?.length || 0,
          columns: sample.columns || [],
        },
      });

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
        message: '探索报告生成失败',
        details: error.message,
      };
    }
  }

  /**
   * 获取数据预览
   * @param {string} datasourceId - 数据源ID
   * @param {Object} options - 预览选项
   * @returns {Promise<DataPreview>} 数据预览
   */
  async getDataPreview(datasourceId, options = {}) {
    try {
      const defaultOptions = {
        page: 1,
        pageSize: 50,
        includeStatistics: true,
        includeQualityScore: true,
        ...options,
      };

      // 获取数据样本
      let sample = await this.getCachedSample(datasourceId);
      if (!sample) {
        const sampleResult = await this.generateSample(datasourceId, {
          sampleSize: defaultOptions.pageSize * 3,
        });
        if (!sampleResult.success) {
          throw new Error('无法生成数据样本');
        }
        sample = sampleResult.data;
      }

      // 分页处理
      const startIndex = (defaultOptions.page - 1) * defaultOptions.pageSize;
      const endIndex = startIndex + defaultOptions.pageSize;
      const paginatedData = sample.data.slice(startIndex, endIndex);

      // 生成预览信息
      const preview = {
        datasourceId,
        totalRows: sample.totalRows,
        totalColumns: sample.totalColumns,
        currentPage: defaultOptions.page,
        pageSize: defaultOptions.pageSize,
        totalPages: Math.ceil(sample.data.length / defaultOptions.pageSize),
        data: paginatedData,
        columns: sample.columns,
      };

      // 添加统计信息
      if (defaultOptions.includeStatistics) {
        preview.statistics = sample.statistics;
      }

      // 添加质量评分
      if (defaultOptions.includeQualityScore) {
        const qualityResult = await this.analyzeDataQuality(sample);
        if (qualityResult.success) {
          preview.qualityScore = qualityResult.data.overallScore;
        }
      }

      return {
        success: true,
        data: preview,
        message: '数据预览获取成功',
      };
    } catch (error) {
      console.error('获取数据预览失败:', error);
      return {
        success: false,
        error: 'PREVIEW_LOADING_FAILED',
        message: '数据预览获取失败',
        details: error.message,
      };
    }
  }

  /**
   * 获取数据统计信息
   * @param {string} datasourceId - 数据源ID
   * @returns {Promise<DataStatistics>} 统计信息
   */
  async getDataStatistics(datasourceId) {
    try {
      let sample = await this.getCachedSample(datasourceId);
      if (!sample) {
        const sampleResult = await this.generateSample(datasourceId, {
          sampleSize: 5000,
        });
        if (!sampleResult.success) {
          throw new Error('无法生成数据样本');
        }
        sample = sampleResult.data;
      }

      return {
        success: true,
        data: sample.statistics,
        message: '统计信息获取成功',
      };
    } catch (error) {
      console.error('获取统计信息失败:', error);
      return {
        success: false,
        error: 'STATISTICS_LOADING_FAILED',
        message: '统计信息获取失败',
        details: error.message,
      };
    }
  }

  /**
   * 缓存数据样本
   * @param {string} datasourceId - 数据源ID
   * @param {DataSample} sample - 数据样本
   */
  async cacheSample(datasourceId, sample) {
    try {
      const cacheKey = `data_sample:${datasourceId}`;
      const cacheData = {
        ...sample,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30分钟过期
      };

      // 这里应该使用Redis或其他缓存服务
      // 暂时使用内存缓存
      if (!this.sampleCache) {
        this.sampleCache = new Map();
      }
      this.sampleCache.set(cacheKey, cacheData);

      console.log(`数据样本已缓存: ${datasourceId}`);
    } catch (error) {
      console.error('缓存数据样本失败:', error);
    }
  }

  /**
   * 获取缓存的数据样本
   * @param {string} datasourceId - 数据源ID
   * @returns {DataSample|null} 数据样本
   */
  async getCachedSample(datasourceId) {
    try {
      const cacheKey = `data_sample:${datasourceId}`;

      if (!this.sampleCache) {
        return null;
      }

      const cachedData = this.sampleCache.get(cacheKey);
      if (!cachedData) {
        return null;
      }

      // 检查是否过期
      if (new Date() > new Date(cachedData.expiresAt)) {
        this.sampleCache.delete(cacheKey);
        return null;
      }

      return cachedData;
    } catch (error) {
      console.error('获取缓存样本失败:', error);
      return null;
    }
  }

  /**
   * 清除缓存
   * @param {string} datasourceId - 数据源ID
   */
  async clearCache(datasourceId) {
    try {
      if (datasourceId) {
        const cacheKey = `data_sample:${datasourceId}`;
        if (this.sampleCache) {
          this.sampleCache.delete(cacheKey);
        }
      } else {
        // 清除所有缓存
        if (this.sampleCache) {
          this.sampleCache.clear();
        }
      }

      console.log(`缓存已清除: ${datasourceId || 'all'}`);
    } catch (error) {
      console.error('清除缓存失败:', error);
    }
  }

  /**
   * 获取服务状态
   * @returns {Object} 服务状态信息
   */
  getServiceStatus() {
    return {
      service: 'DataPreviewService',
      status: 'running',
      version: '1.0.0',
      cacheSize: this.sampleCache ? this.sampleCache.size : 0,
      components: {
        samplingService: this.samplingService.getServiceStatus(),
        qualityAnalyzer: this.qualityAnalyzer.getServiceStatus(),
        typeDetector: this.typeDetector.getServiceStatus(),
        relationshipDetector: this.relationshipDetector.getServiceStatus(),
        explorationReporter: this.explorationReporter.getServiceStatus(),
      },
    };
  }
}

module.exports = DataPreviewService;

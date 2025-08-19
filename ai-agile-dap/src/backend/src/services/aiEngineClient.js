/**
 * AI引擎客户端服务
 * 实现高可用的AI引擎通信和错误处理
 */

const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

class AIEngineClient {
  constructor() {
    this.baseClient = axios.create({
      baseURL: config.aiEngine.url,
      timeout: config.aiEngine.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Agile-DAP-Backend/1.0.0'
      }
    });

    // 设置请求拦截器
    this.baseClient.interceptors.request.use(
      (config) => {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        config.headers['X-Request-ID'] = requestId;
        
        logger.info('🚀 AI引擎请求发送', {
          requestId,
          url: config.url,
          method: config.method.toUpperCase(),
          dataSize: JSON.stringify(config.data).length
        });
        
        return config;
      },
      (error) => {
        logger.error('❌ AI引擎请求配置错误', error);
        return Promise.reject(error);
      }
    );

    // 设置响应拦截器
    this.baseClient.interceptors.response.use(
      (response) => {
        const requestId = response.config.headers['X-Request-ID'];
        logger.info('✅ AI引擎响应成功', {
          requestId,
          status: response.status,
          responseTime: response.headers['x-response-time'],
          dataSize: JSON.stringify(response.data).length
        });
        return response;
      },
      (error) => {
        const requestId = error.config?.headers?.['X-Request-ID'] || 'unknown';
        logger.error('❌ AI引擎响应错误', {
          requestId,
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );

    // 简单的重试机制
    this.retryCount = 0;
    this.maxRetries = config.aiEngine.retries || 3;
    this.failureCount = 0;
    this.lastFailureTime = null;
  }

  /**
   * 核心请求方法
   */
  async _makeRequest(method, url, data = null) {
    const config = {
      method,
      url,
      data
    };

    return await this.baseClient.request(config);
  }

  /**
   * 带重试机制的请求方法
   */
  async _makeRequestWithRetry(method, url, data = null, retryCount = 0) {
    try {
      const response = await this._makeRequest(method, url, data);
      
      // 请求成功，重置失败计数
      this.failureCount = 0;
      this.lastFailureTime = null;
      
      return response;
      
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      // 判断是否需要重试
      if (retryCount < this.maxRetries && this._shouldRetry(error)) {
        const delay = this._getRetryDelay(retryCount);
        
        logger.warn(`AI引擎请求失败，${delay}ms后重试 (${retryCount + 1}/${this.maxRetries})`, {
          error: error.message,
          retryCount: retryCount + 1
        });
        
        await this._sleep(delay);
        return this._makeRequestWithRetry(method, url, data, retryCount + 1);
      }
      
      // 重试次数用尽或不应重试的错误
      throw error;
    }
  }

  /**
   * 判断是否应该重试
   */
  _shouldRetry(error) {
    // 网络错误应该重试
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    
    // 5xx服务器错误应该重试
    if (error.response?.status >= 500) {
      return true;
    }
    
    // 429 (Too Many Requests) 应该重试
    if (error.response?.status === 429) {
      return true;
    }
    
    return false;
  }

  /**
   * 计算重试延迟（指数退避）
   */
  _getRetryDelay(retryCount) {
    const baseDelay = 1000; // 1秒
    const maxDelay = 10000; // 最大10秒
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    
    // 添加随机抖动，避免惊群效应
    const jitter = Math.random() * 0.1 * delay;
    return Math.floor(delay + jitter);
  }

  /**
   * 等待函数
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 处理自然语言查询
   * @param {string} naturalQuery - 自然语言查询
   * @param {Object} context - 查询上下文
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} - AI引擎响应
   */
  async processQuery(naturalQuery, context = {}, options = {}) {
    const startTime = Date.now();
    
    try {
      // 参数验证
      if (!naturalQuery || typeof naturalQuery !== 'string') {
        throw new Error('自然语言查询不能为空');
      }

      if (naturalQuery.trim().length === 0) {
        throw new Error('自然语言查询内容不能为空');
      }

      if (naturalQuery.length > 1000) {
        throw new Error('查询内容过长，请控制在1000字符以内');
      }

      // 构建请求数据
      const requestData = {
        natural_query: naturalQuery.trim(),
        context: {
          user_id: context.userId || 1,
          database_schema: context.database || 'default',
          session_id: context.sessionId || null,
          ...context
        },
        options: {
          include_sql: true,
          include_chart: true,
          max_results: 100,
          ...options
        }
      };

      // 发送请求（带重试机制）
      const response = await this._makeRequestWithRetry('post', '/api/ai/query', requestData);
      const processingTime = Date.now() - startTime;

      // 验证响应格式
      this._validateResponse(response.data);

      // 记录性能指标
      logger.logPerformance('AI_ENGINE_QUERY', processingTime, {
        queryLength: naturalQuery.length,
        hasContext: Object.keys(context).length > 0,
        confidence: response.data.data?.confidence_score || 0
      });

      return {
        success: true,
        data: response.data,
        meta: {
          processingTime,
          requestId: response.config.headers['X-Request-ID']
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      // 记录错误
      logger.error('AI引擎查询失败', {
        error: error.message,
        naturalQuery: naturalQuery?.substring(0, 100),
        processingTime,
        stack: error.stack
      });

      // 分类错误类型
      const errorType = this._classifyError(error);

      return {
        success: false,
        error: {
          type: errorType,
          message: error.message,
          details: this._getErrorDetails(error),
          suggestions: this._getErrorSuggestions(errorType)
        },
        meta: {
          processingTime,
          requestId: error.config?.headers?.['X-Request-ID'] || null
        }
      };
    }
  }

  /**
   * 验证AI引擎响应格式
   */
  _validateResponse(responseData) {
    if (!responseData) {
      throw new Error('AI引擎返回空响应');
    }

    if (typeof responseData !== 'object') {
      throw new Error('AI引擎响应格式无效');
    }

    if (!responseData.hasOwnProperty('success')) {
      throw new Error('AI引擎响应缺少success字段');
    }

    if (responseData.success && !responseData.data) {
      throw new Error('AI引擎成功响应缺少data字段');
    }

    if (!responseData.success && !responseData.error) {
      throw new Error('AI引擎错误响应缺少error字段');
    }
  }

  /**
   * 错误分类
   */
  _classifyError(error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return 'CONNECTION_ERROR';
    }

    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    }

    if (error.response?.status === 400) {
      return 'INVALID_QUERY';
    }

    if (error.response?.status === 429) {
      return 'RATE_LIMIT_ERROR';
    }

    if (error.response?.status >= 500) {
      return 'AI_PROCESSING_ERROR';
    }

    if (this.failureCount >= 5 && this.lastFailureTime && (Date.now() - this.lastFailureTime) < 60000) {
      return 'SERVICE_DEGRADED';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * 获取错误详情
   */
  _getErrorDetails(error) {
    if (error.response?.data?.error) {
      return error.response.data.error.details || error.response.data.error.message;
    }

    return error.message;
  }

  /**
   * 获取错误建议
   */
  _getErrorSuggestions(errorType) {
    const suggestions = {
      CONNECTION_ERROR: [
        '请检查AI引擎服务是否启动',
        '确认网络连接正常',
        '联系系统管理员'
      ],
      TIMEOUT_ERROR: [
        '请简化查询内容',
        '稍后再试',
        '检查网络连接'
      ],
      INVALID_QUERY: [
        '请使用更简单的语言描述',
        '明确指定时间范围和分析对象',
        '参考查询示例'
      ],
      RATE_LIMIT_ERROR: [
        '请稍后再试',
        '减少查询频率',
        '联系管理员提升限额'
      ],
      AI_PROCESSING_ERROR: [
        '系统正在处理中，请稍后重试',
        '尝试重新表述查询',
        '联系技术支持'
      ],
      SERVICE_DEGRADED: [
        'AI引擎服务性能下降',
        '请稍后重试',
        '可能是高峰期，请耐心等待'
      ]
    };

    return suggestions[errorType] || [
      '请检查查询内容',
      '稍后重试',
      '如问题持续，请联系技术支持'
    ];
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const response = await this._makeRequest('get', '/health');
      return {
        success: true,
        status: response.data.status,
        timestamp: response.data.timestamp
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus() {
    const health = await this.healthCheck();
    
    return {
      health,
      client: {
        failureCount: this.failureCount,
        lastFailureTime: this.lastFailureTime,
        isDegraded: this.failureCount >= 5 && this.lastFailureTime && (Date.now() - this.lastFailureTime) < 60000,
        maxRetries: this.maxRetries
      }
    };
  }
}

// 创建单例实例
const aiEngineClient = new AIEngineClient();

module.exports = aiEngineClient;
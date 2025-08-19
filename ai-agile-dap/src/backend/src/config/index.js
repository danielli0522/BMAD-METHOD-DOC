/**
 * 后端服务配置管理
 * Sprint 1 生产级配置
 */

const dotenv = require('dotenv');
dotenv.config();

const config = {
  // 基础配置
  app: {
    name: 'AI-Agile-DAP Backend',
    version: '1.0.0',
    port: process.env.PORT || 8000,
    env: process.env.NODE_ENV || 'development'
  },

  // 数据库配置
  database: {
    url: process.env.DATABASE_URL || 'mysql://dev_user:dev_password@localhost:3306/ai_agile_dap_dev',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    username: process.env.DB_USERNAME || 'dev_user',
    password: process.env.DB_PASSWORD || 'dev_password',
    database: process.env.DB_NAME || 'ai_agile_dap_dev',
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },

  // Redis配置
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: process.env.REDIS_DB || 0,
    keyPrefix: 'ai-agile-dap:',
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_jwt_secret_key_12345',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },

  // AI引擎配置
  aiEngine: {
    url: process.env.AI_ENGINE_URL || 'http://127.0.0.1:8002',
    timeout: process.env.AI_ENGINE_TIMEOUT || 30000,
    retries: process.env.AI_ENGINE_RETRIES || 3
  },

  // 安全配置
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000'
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
    enableConsole: process.env.ENABLE_CONSOLE_LOG !== 'false',
    enableFile: process.env.ENABLE_FILE_LOG === 'true',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log'
  },

  // 文件上传配置
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'image/*,application/pdf').split(','),
    uploadPath: process.env.UPLOAD_PATH || './uploads'
  }
};

// 验证必需的环境变量
const requiredEnvVars = [];

if (config.app.env === 'production') {
  requiredEnvVars.push(
    'JWT_SECRET',
    'DATABASE_URL'
  );
}

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  throw new Error(`缺少必需的环境变量: ${missingEnvVars.join(', ')}`);
}

module.exports = config;
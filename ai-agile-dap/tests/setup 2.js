/**
 * Jest测试环境设置
 */

// 设置环境变量
process.env.NODE_ENV = 'test';
process.env.DB_ENCRYPTION_KEY = 'test-encryption-key-for-testing';
process.env.CONFIG_ENCRYPTION_KEY = 'test-config-encryption-key';
process.env.DATASOURCE_CONFIG_FILE = './tests/fixtures/test-datasources.json';
process.env.UPLOAD_DIR = './tests/fixtures/uploads/';

// 全局测试超时
jest.setTimeout(30000);

// 抑制控制台输出（可选）
if (process.env.SUPPRESS_LOGS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// 全局测试钩子
beforeAll(async () => {
  // 创建测试目录
  const fs = require('fs').promises;
  const path = require('path');

  const testDirs = ['./tests/fixtures', './tests/fixtures/uploads', './config'];

  for (const dir of testDirs) {
    await fs.mkdir(dir, { recursive: true });
  }
});

afterAll(async () => {
  // 清理测试文件（可选）
  if (process.env.CLEANUP_AFTER_TESTS === 'true') {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      await fs.rmdir('./tests/fixtures', { recursive: true });
    } catch (error) {
      // 忽略清理错误
    }
  }
});

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
});

/**
 * Jest测试配置
 */

module.exports = {
  // 测试环境
  testEnvironment: 'node',

  // 测试文件匹配模式
  testMatch: ['**/tests/**/*.test.js', '**/tests/**/*.spec.js'],

  // 覆盖率收集
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],

  // 覆盖率收集范围
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!**/node_modules/**',
    '!**/coverage/**',
  ],

  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // 模块路径映射
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },

  // 忽略的路径
  testPathIgnorePatterns: ['/node_modules/', '/coverage/', '/dist/'],

  // 清除模拟
  clearMocks: true,
  restoreMocks: true,

  // 超时设置
  testTimeout: 30000,

  // 详细输出
  verbose: true,

  // 错误处理
  errorOnDeprecated: true,

  // 检测未处理的Promise拒绝
  detectOpenHandles: true,
  detectLeaks: true,
};

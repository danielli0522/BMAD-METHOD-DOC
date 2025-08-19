/**
 * 数据源适配器工厂
 * 负责创建和管理不同类型的数据源适配器
 */

const MySQLAdapter = require('./MySQLAdapter');
const PostgreSQLAdapter = require('./PostgreSQLAdapter');

class AdapterFactory {
  constructor() {
    this.adapters = new Map();
    this.supportedTypes = ['mysql', 'postgresql', 'file'];
  }

  /**
   * 创建数据源适配器
   * @param {string} type - 数据源类型
   * @returns {Object} 适配器实例
   */
  createAdapter(type) {
    const normalizedType = type.toLowerCase();

    if (!this.supportedTypes.includes(normalizedType)) {
      throw new Error(`Unsupported data source type: ${type}`);
    }

    // 检查是否已存在适配器实例
    if (this.adapters.has(normalizedType)) {
      return this.adapters.get(normalizedType);
    }

    // 创建新的适配器实例
    let adapter;
    switch (normalizedType) {
      case 'mysql':
        adapter = new MySQLAdapter();
        break;
      case 'postgresql':
        adapter = new PostgreSQLAdapter();
        break;
      case 'file':
        // 文件适配器将在Task 3和4中实现
        throw new Error('File adapter not implemented yet');
      default:
        throw new Error(`Adapter not implemented for type: ${type}`);
    }

    // 缓存适配器实例
    this.adapters.set(normalizedType, adapter);
    return adapter;
  }

  /**
   * 获取已存在的适配器
   * @param {string} type - 数据源类型
   * @returns {Object|null} 适配器实例
   */
  getAdapter(type) {
    return this.adapters.get(type.toLowerCase()) || null;
  }

  /**
   * 获取支持的数据源类型
   * @returns {Array} 支持的类型列表
   */
  getSupportedTypes() {
    return [...this.supportedTypes];
  }

  /**
   * 检查是否支持指定类型
   * @param {string} type - 数据源类型
   * @returns {boolean} 是否支持
   */
  isSupported(type) {
    return this.supportedTypes.includes(type.toLowerCase());
  }

  /**
   * 注册新的适配器类型
   * @param {string} type - 数据源类型
   * @param {Function} adapterClass - 适配器类
   */
  registerAdapter(type, adapterClass) {
    const normalizedType = type.toLowerCase();

    if (!this.supportedTypes.includes(normalizedType)) {
      this.supportedTypes.push(normalizedType);
    }

    // 创建适配器实例
    const adapter = new adapterClass();
    this.adapters.set(normalizedType, adapter);
  }

  /**
   * 移除适配器
   * @param {string} type - 数据源类型
   */
  removeAdapter(type) {
    const normalizedType = type.toLowerCase();
    this.adapters.delete(normalizedType);

    const index = this.supportedTypes.indexOf(normalizedType);
    if (index > -1) {
      this.supportedTypes.splice(index, 1);
    }
  }

  /**
   * 清空所有适配器
   */
  clearAdapters() {
    this.adapters.clear();
  }

  /**
   * 获取适配器统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      supportedTypes: this.supportedTypes.length,
      loadedAdapters: this.adapters.size,
      types: this.supportedTypes,
      loadedTypes: Array.from(this.adapters.keys()),
    };
  }
}

// 创建单例实例
const adapterFactory = new AdapterFactory();

module.exports = adapterFactory;

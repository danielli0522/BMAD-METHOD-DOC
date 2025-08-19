/**
 * CSV文件处理器
 * 负责CSV文件的解析、数据类型识别、质量检测和批处理
 */

const fs = require('fs').promises;
const path = require('path');
const { createReadStream } = require('fs');
const csv = require('csv-parser');
const { Transform } = require('stream');

class CSVProcessor {
  constructor() {
    this.supportedExtensions = ['.csv', '.tsv', '.txt'];
    this.maxFileSize = 100 * 1024 * 1024; // 100MB
    this.previewRows = 100;
    this.batchSize = 1000;
    this.defaultOptions = {
      delimiter: ',',
      quote: '"',
      escape: '"',
      skipEmptyLines: true,
      skipLinesWithError: false,
    };
  }

  /**
   * 验证CSV文件
   * @param {string} filePath - 文件路径
   * @param {Object} options - 验证选项
   * @returns {Promise<Object>} 验证结果
   */
  async validateFile(filePath, options = {}) {
    try {
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      const extension = path.extname(filePath).toLowerCase();

      // 检查文件扩展名
      if (!this.supportedExtensions.includes(extension)) {
        return {
          valid: false,
          error: `Unsupported file extension: ${extension}`,
          code: 'INVALID_EXTENSION',
        };
      }

      // 检查文件大小
      if (fileSize > this.maxFileSize) {
        return {
          valid: false,
          error: `File size exceeds limit: ${fileSize} bytes`,
          code: 'FILE_TOO_LARGE',
        };
      }

      // 检查文件是否可读
      try {
        await fs.access(filePath, fs.constants.R_OK);
      } catch (error) {
        return {
          valid: false,
          error: 'File is not readable',
          code: 'FILE_NOT_READABLE',
        };
      }

      // 检测CSV格式和分隔符
      const formatInfo = await this.detectFormat(filePath);

      return {
        valid: true,
        fileSize,
        extension,
        formatInfo,
        message: 'File validation successful',
      };
    } catch (error) {
      return {
        valid: false,
        error: `File validation failed: ${error.message}`,
        code: 'VALIDATION_ERROR',
      };
    }
  }

  /**
   * 检测CSV格式
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} 格式信息
   */
  async detectFormat(filePath) {
    return new Promise((resolve, reject) => {
      const sampleSize = 1024; // 读取前1KB来检测格式
      const buffer = Buffer.alloc(sampleSize);

      fs.open(filePath, 'r')
        .then(async fileHandle => {
          try {
            const { bytesRead } = await fileHandle.read(buffer, 0, sampleSize, 0);
            const sample = buffer.slice(0, bytesRead).toString('utf8');

            // 检测分隔符
            const delimiter = this.detectDelimiter(sample);

            // 检测引号字符
            const quote = this.detectQuote(sample);

            // 检测编码
            const encoding = this.detectEncoding(buffer.slice(0, bytesRead));

            // 估算行数和列数
            const lines = sample.split('\n').filter(line => line.trim());
            const estimatedColumns = lines.length > 0 ? lines[0].split(delimiter).length : 0;

            resolve({
              delimiter,
              quote,
              encoding,
              estimatedColumns,
              sampleLines: lines.length,
            });
          } catch (error) {
            reject(error);
          } finally {
            await fileHandle.close();
          }
        })
        .catch(reject);
    });
  }

  /**
   * 解析CSV文件
   * @param {string} filePath - 文件路径
   * @param {Object} options - 解析选项
   * @returns {Promise<Object>} 解析结果
   */
  async parseFile(filePath, options = {}) {
    try {
      // 验证文件
      const validation = await this.validateFile(filePath);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          code: validation.code,
        };
      }

      const parseOptions = {
        ...this.defaultOptions,
        ...validation.formatInfo,
        ...options,
      };

      const data = [];
      let headers = null;
      let rowCount = 0;

      return new Promise((resolve, reject) => {
        const stream = createReadStream(filePath).pipe(
          csv({
            separator: parseOptions.delimiter,
            quote: parseOptions.quote,
            escape: parseOptions.escape,
            skipEmptyLines: parseOptions.skipEmptyLines,
            skipLinesWithError: parseOptions.skipLinesWithError,
            maxRows: options.maxRows,
          })
        );

        stream.on('headers', headerList => {
          headers = headerList;
        });

        stream.on('data', row => {
          data.push(row);
          rowCount++;

          // 如果设置了最大行数限制
          if (options.maxRows && rowCount >= options.maxRows) {
            stream.destroy();
          }
        });

        stream.on('end', () => {
          resolve({
            success: true,
            data: {
              headers,
              rows: data,
              rowCount,
              columnCount: headers ? headers.length : 0,
            },
            metadata: {
              fileName: path.basename(filePath),
              fileSize: validation.fileSize,
              formatInfo: validation.formatInfo,
              parsedAt: new Date().toISOString(),
            },
          });
        });

        stream.on('error', error => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        });
      });
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse CSV file: ${error.message}`,
        code: 'PARSE_ERROR',
      };
    }
  }

  /**
   * 获取CSV文件预览
   * @param {string} filePath - 文件路径
   * @param {Object} options - 预览选项
   * @returns {Promise<Object>} 预览数据
   */
  async getPreview(filePath, options = {}) {
    const previewOptions = {
      maxRows: options.previewRows || this.previewRows,
      ...options,
    };

    const result = await this.parseFile(filePath, previewOptions);

    if (result.success) {
      result.data.isPreview = true;
      result.data.previewRows = previewOptions.maxRows;
    }

    return result;
  }

  /**
   * 批量处理CSV文件
   * @param {string} filePath - 文件路径
   * @param {Function} processor - 处理函数
   * @param {Object} options - 处理选项
   * @returns {Promise<Object>} 处理结果
   */
  async processBatch(filePath, processor, options = {}) {
    try {
      const validation = await this.validateFile(filePath);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      const batchSize = options.batchSize || this.batchSize;
      const parseOptions = {
        ...this.defaultOptions,
        ...validation.formatInfo,
        ...options,
      };

      let batch = [];
      let headers = null;
      let batchIndex = 0;
      let totalProcessed = 0;
      const results = [];

      return new Promise((resolve, reject) => {
        const stream = createReadStream(filePath).pipe(
          csv({
            separator: parseOptions.delimiter,
            quote: parseOptions.quote,
            escape: parseOptions.escape,
            skipEmptyLines: parseOptions.skipEmptyLines,
          })
        );

        stream.on('headers', headerList => {
          headers = headerList;
        });

        stream.on('data', async row => {
          batch.push(row);

          if (batch.length >= batchSize) {
            // 暂停流处理
            stream.pause();

            try {
              const batchResult = await processor(batch, {
                batchIndex,
                headers,
                startRow: totalProcessed,
                endRow: totalProcessed + batch.length - 1,
              });

              results.push(batchResult);
              totalProcessed += batch.length;
              batchIndex++;
              batch = [];

              // 恢复流处理
              stream.resume();
            } catch (error) {
              results.push({
                error: error.message,
                batchIndex,
                startRow: totalProcessed,
                endRow: totalProcessed + batch.length - 1,
              });
              batch = [];
              stream.resume();
            }
          }
        });

        stream.on('end', async () => {
          // 处理最后一批数据
          if (batch.length > 0) {
            try {
              const batchResult = await processor(batch, {
                batchIndex,
                headers,
                startRow: totalProcessed,
                endRow: totalProcessed + batch.length - 1,
              });

              results.push(batchResult);
              totalProcessed += batch.length;
            } catch (error) {
              results.push({
                error: error.message,
                batchIndex,
                startRow: totalProcessed,
                endRow: totalProcessed + batch.length - 1,
              });
            }
          }

          resolve({
            success: true,
            processedRows: totalProcessed,
            batchCount: results.length,
            results,
          });
        });

        stream.on('error', error => {
          reject(new Error(`Batch processing failed: ${error.message}`));
        });
      });
    } catch (error) {
      return {
        success: false,
        error: `Batch processing failed: ${error.message}`,
      };
    }
  }

  /**
   * 分析CSV数据类型和质量
   * @param {string} filePath - 文件路径
   * @param {Object} options - 分析选项
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeDataQuality(filePath, options = {}) {
    try {
      const sampleSize = options.sampleSize || 1000;
      const preview = await this.getPreview(filePath, {
        previewRows: sampleSize,
      });

      if (!preview.success) {
        return preview;
      }

      const { headers, rows } = preview.data;
      const analysis = {
        columns: {},
        overall: {
          totalRows: rows.length,
          totalColumns: headers.length,
          completeness: 0,
          consistency: 0,
          quality: 0,
        },
      };

      // 分析每一列
      for (const header of headers) {
        const columnData = rows.map(row => row[header]);
        analysis.columns[header] = this.analyzeColumn(columnData, header);
      }

      // 计算整体质量指标
      const columnAnalyses = Object.values(analysis.columns);
      analysis.overall.completeness =
        columnAnalyses.reduce((sum, col) => sum + col.completeness, 0) / columnAnalyses.length;
      analysis.overall.consistency =
        columnAnalyses.reduce((sum, col) => sum + col.consistency, 0) / columnAnalyses.length;
      analysis.overall.quality = (analysis.overall.completeness + analysis.overall.consistency) / 2;

      return {
        success: true,
        analysis,
        metadata: {
          fileName: path.basename(filePath),
          analyzedAt: new Date().toISOString(),
          sampleSize,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Data quality analysis failed: ${error.message}`,
      };
    }
  }

  /**
   * 分析单列数据
   * @private
   */
  analyzeColumn(columnData, columnName) {
    const totalCount = columnData.length;
    const nonNullData = columnData.filter(
      value => value !== null && value !== undefined && value !== ''
    );
    const nullCount = totalCount - nonNullData.length;

    if (nonNullData.length === 0) {
      return {
        name: columnName,
        type: 'UNKNOWN',
        confidence: 0,
        nullCount,
        completeness: 0,
        consistency: 0,
        uniqueValues: 0,
        issues: ['All values are null or empty'],
      };
    }

    // 数据类型分析
    const typeAnalysis = this.detectDataType(nonNullData);

    // 唯一值分析
    const uniqueValues = new Set(nonNullData).size;
    const uniquenessRatio = uniqueValues / nonNullData.length;

    // 数据质量指标
    const completeness = nonNullData.length / totalCount;
    const consistency = typeAnalysis.confidence;

    // 问题检测
    const issues = this.detectDataIssues(nonNullData, typeAnalysis.type);

    return {
      name: columnName,
      type: typeAnalysis.type,
      confidence: typeAnalysis.confidence,
      nullCount,
      completeness: Math.round(completeness * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      uniqueValues,
      uniquenessRatio: Math.round(uniquenessRatio * 100) / 100,
      sampleSize: nonNullData.length,
      distribution: typeAnalysis.distribution,
      issues,
      statistics: this.calculateStatistics(nonNullData, typeAnalysis.type),
    };
  }

  /**
   * 检测数据类型
   * @private
   */
  detectDataType(data) {
    const types = {
      integer: 0,
      float: 0,
      date: 0,
      datetime: 0,
      boolean: 0,
      email: 0,
      url: 0,
      phone: 0,
      string: 0,
    };

    for (const value of data) {
      const str = value.toString().trim();

      if (this.isInteger(str)) {
        types.integer++;
      } else if (this.isFloat(str)) {
        types.float++;
      } else if (this.isDate(str)) {
        types.date++;
      } else if (this.isDateTime(str)) {
        types.datetime++;
      } else if (this.isBoolean(str)) {
        types.boolean++;
      } else if (this.isEmail(str)) {
        types.email++;
      } else if (this.isURL(str)) {
        types.url++;
      } else if (this.isPhone(str)) {
        types.phone++;
      } else {
        types.string++;
      }
    }

    // 确定主要类型
    const maxType = Object.keys(types).reduce((a, b) => (types[a] > types[b] ? a : b));
    const confidence = types[maxType] / data.length;

    return {
      type: maxType.toUpperCase(),
      confidence: Math.round(confidence * 100) / 100,
      distribution: types,
    };
  }

  /**
   * 检测数据问题
   * @private
   */
  detectDataIssues(data, dataType) {
    const issues = [];

    // 检查空值比例
    const nullCount = data.filter(v => v === null || v === undefined || v === '').length;
    if (nullCount / data.length > 0.5) {
      issues.push('High null value ratio (>50%)');
    }

    // 检查数据格式一致性
    if (dataType === 'DATE' || dataType === 'DATETIME') {
      const formats = new Set();
      for (const value of data) {
        if (value) {
          formats.add(this.detectDateFormat(value.toString()));
        }
      }
      if (formats.size > 2) {
        issues.push('Inconsistent date formats');
      }
    }

    // 检查异常值
    if (dataType === 'INTEGER' || dataType === 'FLOAT') {
      const numbers = data.map(v => parseFloat(v)).filter(n => !isNaN(n));
      const outliers = this.detectOutliers(numbers);
      if (outliers.length > numbers.length * 0.1) {
        issues.push('High outlier ratio (>10%)');
      }
    }

    // 检查重复值
    const uniqueValues = new Set(data).size;
    if (uniqueValues / data.length < 0.1) {
      issues.push('Low data diversity (<10% unique values)');
    }

    return issues;
  }

  /**
   * 计算统计信息
   * @private
   */
  calculateStatistics(data, dataType) {
    const stats = {
      count: data.length,
      uniqueCount: new Set(data).size,
    };

    if (dataType === 'INTEGER' || dataType === 'FLOAT') {
      const numbers = data.map(v => parseFloat(v)).filter(n => !isNaN(n));
      if (numbers.length > 0) {
        stats.min = Math.min(...numbers);
        stats.max = Math.max(...numbers);
        stats.mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
        stats.median = this.calculateMedian(numbers);
        stats.stdDev = this.calculateStandardDeviation(numbers, stats.mean);
      }
    } else if (dataType === 'STRING') {
      const lengths = data.map(v => v.toString().length);
      stats.minLength = Math.min(...lengths);
      stats.maxLength = Math.max(...lengths);
      stats.avgLength = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
    }

    return stats;
  }

  /**
   * 检测分隔符
   * @private
   */
  detectDelimiter(sample) {
    const delimiters = [',', ';', '\t', '|'];
    const counts = delimiters.map(delimiter => ({
      delimiter,
      count: (sample.match(new RegExp(delimiter, 'g')) || []).length,
    }));

    const maxCount = Math.max(...counts.map(c => c.count));
    const detected = counts.find(c => c.count === maxCount);

    return detected && detected.count > 0 ? detected.delimiter : ',';
  }

  /**
   * 检测引号字符
   * @private
   */
  detectQuote(sample) {
    const quotes = ['"', "'"];
    for (const quote of quotes) {
      if (sample.includes(quote)) {
        return quote;
      }
    }
    return '"';
  }

  /**
   * 检测编码
   * @private
   */
  detectEncoding(buffer) {
    // 简化的编码检测，实际应用中可以使用更复杂的算法
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return 'utf8';
    }
    return 'utf8';
  }

  // 数据类型检测辅助方法
  isInteger(str) {
    return /^-?\d+$/.test(str);
  }

  isFloat(str) {
    return /^-?\d*\.\d+$/.test(str) && !isNaN(parseFloat(str));
  }

  isDate(str) {
    const datePatterns = [/^\d{4}-\d{2}-\d{2}$/, /^\d{2}\/\d{2}\/\d{4}$/, /^\d{2}-\d{2}-\d{4}$/];
    return datePatterns.some(pattern => pattern.test(str)) && !isNaN(Date.parse(str));
  }

  isDateTime(str) {
    const datetimePatterns = [
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    ];
    return datetimePatterns.some(pattern => pattern.test(str)) && !isNaN(Date.parse(str));
  }

  isBoolean(str) {
    const booleanValues = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'];
    return booleanValues.includes(str.toLowerCase());
  }

  isEmail(str) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  }

  isURL(str) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  isPhone(str) {
    return /^[\+]?[\d\s\-\(\)]{10,}$/.test(str);
  }

  detectDateFormat(str) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return 'YYYY-MM-DD';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return 'MM/DD/YYYY';
    if (/^\d{2}-\d{2}-\d{4}$/.test(str)) return 'MM-DD-YYYY';
    return 'UNKNOWN';
  }

  detectOutliers(numbers) {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return numbers.filter(n => n < lowerBound || n > upperBound);
  }

  calculateMedian(numbers) {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  calculateStandardDeviation(numbers, mean) {
    const variance = numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
    return Math.sqrt(variance);
  }

  /**
   * 获取支持的文件扩展名
   * @returns {Array} 支持的扩展名列表
   */
  getSupportedExtensions() {
    return [...this.supportedExtensions];
  }

  /**
   * 获取处理器统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      supportedExtensions: this.supportedExtensions,
      maxFileSize: this.maxFileSize,
      previewRows: this.previewRows,
      batchSize: this.batchSize,
      defaultOptions: this.defaultOptions,
    };
  }
}

module.exports = CSVProcessor;

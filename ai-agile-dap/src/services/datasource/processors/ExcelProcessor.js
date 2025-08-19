/**
 * Excel文件处理器
 * 负责Excel文件的解析、数据预览、格式验证和大文件处理
 */

const XLSX = require('xlsx');
const fs = require('fs').promises;
const path = require('path');
const stream = require('stream');

class ExcelProcessor {
  constructor() {
    this.supportedExtensions = ['.xlsx', '.xls', '.xlsm'];
    this.maxFileSize = 100 * 1024 * 1024; // 100MB
    this.previewRows = 100; // 预览行数
    this.batchSize = 1000; // 批处理大小
  }

  /**
   * 验证Excel文件
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

      // 尝试读取Excel文件头部
      try {
        const workbook = XLSX.readFile(filePath, {
          cellDates: true,
          cellNF: false,
          cellText: false,
          sheetRows: 1, // 只读取第一行来验证格式
        });

        const sheetNames = workbook.SheetNames;
        if (sheetNames.length === 0) {
          return {
            valid: false,
            error: 'No worksheets found in Excel file',
            code: 'NO_WORKSHEETS',
          };
        }

        return {
          valid: true,
          fileSize,
          extension,
          sheetCount: sheetNames.length,
          sheetNames,
          message: 'File validation successful',
        };
      } catch (error) {
        return {
          valid: false,
          error: `Invalid Excel file format: ${error.message}`,
          code: 'INVALID_FORMAT',
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: `File validation failed: ${error.message}`,
        code: 'VALIDATION_ERROR',
      };
    }
  }

  /**
   * 解析Excel文件
   * @param {string} filePath - 文件路径
   * @param {Object} options - 解析选项
   * @returns {Promise<Object>} 解析结果
   */
  async parseFile(filePath, options = {}) {
    try {
      // 首先验证文件
      const validation = await this.validateFile(filePath);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          code: validation.code,
        };
      }

      const parseOptions = {
        cellDates: true,
        cellNF: false,
        cellText: false,
        raw: false,
        sheetRows: options.maxRows || undefined,
        ...options.xlsxOptions,
      };

      const workbook = XLSX.readFile(filePath, parseOptions);
      const sheets = {};

      // 解析所有工作表或指定工作表
      const sheetsToProcess = options.sheetNames || workbook.SheetNames;

      for (const sheetName of sheetsToProcess) {
        if (workbook.Sheets[sheetName]) {
          const sheetData = this.parseSheet(workbook.Sheets[sheetName], {
            ...options,
            sheetName,
          });
          sheets[sheetName] = sheetData;
        }
      }

      return {
        success: true,
        data: sheets,
        metadata: {
          fileName: path.basename(filePath),
          fileSize: validation.fileSize,
          sheetCount: Object.keys(sheets).length,
          totalRows: Object.values(sheets).reduce((sum, sheet) => sum + sheet.rowCount, 0),
          parsedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse Excel file: ${error.message}`,
        code: 'PARSE_ERROR',
      };
    }
  }

  /**
   * 获取Excel文件预览
   * @param {string} filePath - 文件路径
   * @param {Object} options - 预览选项
   * @returns {Promise<Object>} 预览数据
   */
  async getPreview(filePath, options = {}) {
    const previewOptions = {
      maxRows: options.previewRows || this.previewRows,
      includeHeaders: options.includeHeaders !== false,
      sheetNames: options.sheetNames || undefined,
    };

    const result = await this.parseFile(filePath, previewOptions);

    if (result.success) {
      // 为每个工作表添加预览标记
      for (const sheetName in result.data) {
        result.data[sheetName].isPreview = true;
        result.data[sheetName].previewRows = previewOptions.maxRows;
      }
    }

    return result;
  }

  /**
   * 批量处理Excel文件
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
      const workbook = XLSX.readFile(filePath, { cellDates: true });
      const sheetName = options.sheetName || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        throw new Error(`Sheet not found: ${sheetName}`);
      }

      // 获取工作表范围
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      const totalRows = range.e.r + 1;

      let processedRows = 0;
      const results = [];

      // 分批处理
      for (let startRow = range.s.r; startRow <= range.e.r; startRow += batchSize) {
        const endRow = Math.min(startRow + batchSize - 1, range.e.r);

        // 创建批次范围
        const batchRange = {
          s: { c: range.s.c, r: startRow },
          e: { c: range.e.c, r: endRow },
        };

        // 提取批次数据
        const batchData = this.extractRangeData(worksheet, batchRange);

        // 调用处理函数
        try {
          const batchResult = await processor(batchData, {
            batchIndex: Math.floor(startRow / batchSize),
            startRow,
            endRow,
            totalRows,
          });

          results.push(batchResult);
          processedRows += batchData.length;
        } catch (error) {
          console.error(`Batch processing error at rows ${startRow}-${endRow}:`, error);
          results.push({
            error: error.message,
            startRow,
            endRow,
          });
        }
      }

      return {
        success: true,
        processedRows,
        totalRows,
        batchCount: results.length,
        results,
      };
    } catch (error) {
      return {
        success: false,
        error: `Batch processing failed: ${error.message}`,
      };
    }
  }

  /**
   * 分析Excel文件数据类型
   * @param {string} filePath - 文件路径
   * @param {Object} options - 分析选项
   * @returns {Promise<Object>} 数据类型分析结果
   */
  async analyzeDataTypes(filePath, options = {}) {
    try {
      const preview = await this.getPreview(filePath, {
        previewRows: options.sampleSize || 1000,
      });

      if (!preview.success) {
        return preview;
      }

      const analysis = {};

      for (const sheetName in preview.data) {
        const sheetData = preview.data[sheetName];
        const columnAnalysis = {};

        if (sheetData.headers && sheetData.data.length > 0) {
          for (const header of sheetData.headers) {
            const columnData = sheetData.data.map(row => row[header]);
            columnAnalysis[header] = this.analyzeColumnDataType(columnData);
          }
        }

        analysis[sheetName] = {
          columns: columnAnalysis,
          rowCount: sheetData.rowCount,
          columnCount: sheetData.headers ? sheetData.headers.length : 0,
        };
      }

      return {
        success: true,
        analysis,
        metadata: {
          fileName: path.basename(filePath),
          analyzedAt: new Date().toISOString(),
          sampleSize: options.sampleSize || 1000,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Data type analysis failed: ${error.message}`,
      };
    }
  }

  /**
   * 解析工作表
   * @private
   */
  parseSheet(worksheet, options = {}) {
    try {
      // 转换为JSON格式
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, // 使用数组格式
        raw: false,
        defval: null,
      });

      if (jsonData.length === 0) {
        return {
          headers: [],
          data: [],
          rowCount: 0,
          columnCount: 0,
        };
      }

      // 提取标题行
      const headers = jsonData[0] || [];
      const dataRows = jsonData.slice(1);

      // 转换为对象格式
      const data = dataRows.map(row => {
        const rowObj = {};
        headers.forEach((header, index) => {
          rowObj[header] = row[index] || null;
        });
        return rowObj;
      });

      return {
        headers,
        data,
        rowCount: dataRows.length,
        columnCount: headers.length,
        sheetName: options.sheetName,
      };
    } catch (error) {
      throw new Error(`Failed to parse sheet: ${error.message}`);
    }
  }

  /**
   * 提取指定范围的数据
   * @private
   */
  extractRangeData(worksheet, range) {
    const data = [];

    for (let row = range.s.r; row <= range.e.r; row++) {
      const rowData = [];
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        rowData.push(cell ? cell.v : null);
      }
      data.push(rowData);
    }

    return data;
  }

  /**
   * 分析列数据类型
   * @private
   */
  analyzeColumnDataType(columnData) {
    const nonNullData = columnData.filter(
      value => value !== null && value !== undefined && value !== ''
    );

    if (nonNullData.length === 0) {
      return {
        type: 'UNKNOWN',
        confidence: 0,
        nullCount: columnData.length,
      };
    }

    const types = {
      number: 0,
      date: 0,
      boolean: 0,
      string: 0,
    };

    for (const value of nonNullData) {
      if (typeof value === 'number') {
        types.number++;
      } else if (value instanceof Date) {
        types.date++;
      } else if (typeof value === 'boolean') {
        types.boolean++;
      } else if (typeof value === 'string') {
        // 尝试解析为数字
        if (!isNaN(parseFloat(value)) && isFinite(value)) {
          types.number++;
        } else if (this.isDateString(value)) {
          types.date++;
        } else if (this.isBooleanString(value)) {
          types.boolean++;
        } else {
          types.string++;
        }
      } else {
        types.string++;
      }
    }

    // 确定主要类型
    const maxType = Object.keys(types).reduce((a, b) => (types[a] > types[b] ? a : b));
    const confidence = types[maxType] / nonNullData.length;

    return {
      type: maxType.toUpperCase(),
      confidence: Math.round(confidence * 100) / 100,
      nullCount: columnData.length - nonNullData.length,
      sampleSize: nonNullData.length,
      distribution: types,
    };
  }

  /**
   * 检查是否为日期字符串
   * @private
   */
  isDateString(value) {
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
      /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
      /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, // YYYY-MM-DD HH:MM:SS
    ];

    return datePatterns.some(pattern => pattern.test(value)) && !isNaN(Date.parse(value));
  }

  /**
   * 检查是否为布尔字符串
   * @private
   */
  isBooleanString(value) {
    const booleanValues = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'];
    return booleanValues.includes(value.toString().toLowerCase());
  }

  /**
   * 获取支持的文件扩展名
   * @returns {Array} 支持的扩展名列表
   */
  getSupportedExtensions() {
    return [...this.supportedExtensions];
  }

  /**
   * 设置最大文件大小
   * @param {number} size - 文件大小（字节）
   */
  setMaxFileSize(size) {
    this.maxFileSize = size;
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
    };
  }
}

module.exports = ExcelProcessor;

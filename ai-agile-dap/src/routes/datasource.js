/**
 * 数据源管理API路由
 * 提供数据源的CRUD操作、连接测试和数据预览功能
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const DataSourceService = require('../services/datasource/DataSourceService');

const router = express.Router();
const dataSourceService = new DataSourceService();

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.UPLOAD_DIR || './uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.csv', '.xlsx', '.xls', '.tsv', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`), false);
    }
  },
});

/**
 * @route GET /api/datasources
 * @desc 获取所有数据源配置
 */
router.get('/', async (req, res) => {
  try {
    const result = await dataSourceService.getAllDataSources();

    if (result.success) {
      res.json({
        success: true,
        data: result.dataSources,
        count: result.dataSources.length,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * @route POST /api/datasources
 * @desc 创建新的数据源配置
 */
router.post('/', async (req, res) => {
  try {
    const config = req.body;
    const result = await dataSourceService.createDataSource(config);

    if (result.success) {
      res.status(201).json({
        success: true,
        configId: result.configId,
        message: result.message,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * @route GET /api/datasources/:id
 * @desc 获取指定数据源配置
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dataSourceService.getDataSource(id);

    if (result.success) {
      res.json({
        success: true,
        data: result.dataSource,
      });
    } else {
      const status = result.code === 'CONFIG_NOT_FOUND' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * @route PUT /api/datasources/:id
 * @desc 更新数据源配置
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const result = await dataSourceService.updateDataSource(id, updates);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
      });
    } else {
      const status = result.code === 'CONFIG_NOT_FOUND' ? 404 : 400;
      res.status(status).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * @route DELETE /api/datasources/:id
 * @desc 删除数据源配置
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dataSourceService.deleteDataSource(id);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
      });
    } else {
      const status = result.code === 'CONFIG_NOT_FOUND' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * @route POST /api/datasources/:id/connect
 * @desc 连接到数据源
 */
router.post('/:id/connect', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dataSourceService.connect(id);

    if (result.success) {
      res.json({
        success: true,
        connectionId: result.connectionId,
        message: result.message,
      });
    } else {
      const status = result.code === 'CONFIG_NOT_FOUND' ? 404 : 400;
      res.status(status).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * @route POST /api/datasources/:id/disconnect
 * @desc 断开数据源连接
 */
router.post('/:id/disconnect', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dataSourceService.disconnect(id);

    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * @route POST /api/datasources/:id/test
 * @desc 测试数据源连接
 */
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dataSourceService.testConnection(id);

    res.json({
      success: result.success,
      responseTime: result.responseTime,
      message: result.message || result.error,
      details: result.success
        ? {
            version: result.version,
            database: result.database,
            user: result.user,
          }
        : undefined,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * @route POST /api/datasources/test-config
 * @desc 测试数据源配置（无需保存）
 */
router.post('/test-config', async (req, res) => {
  try {
    const config = req.body;
    const result = await dataSourceService.testConnectionConfig(config);

    res.json({
      success: result.success,
      responseTime: result.responseTime,
      message: result.message || result.error,
      details: result.success
        ? {
            version: result.version,
            database: result.database,
            user: result.user,
          }
        : undefined,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * @route GET /api/datasources/:id/metadata
 * @desc 获取数据源元数据
 */
router.get('/:id/metadata', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dataSourceService.getMetadata(id);

    if (result.success) {
      res.json({
        success: true,
        metadata: result.metadata,
      });
    } else {
      const status =
        result.code === 'CONFIG_NOT_FOUND' ? 404 : result.code === 'NOT_CONNECTED' ? 400 : 500;
      res.status(status).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * @route POST /api/datasources/:id/query
 * @desc 执行数据库查询
 */
router.post('/:id/query', async (req, res) => {
  try {
    const { id } = req.params;
    const { query, params = [] } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
        code: 'MISSING_QUERY',
      });
    }

    const result = await dataSourceService.executeQuery(id, query, params);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        fields: result.fields,
        rowCount: result.rowCount,
        executionTime: result.executionTime,
      });
    } else {
      const status =
        result.code === 'CONFIG_NOT_FOUND' ? 404 : result.code === 'NOT_CONNECTED' ? 400 : 500;
      res.status(status).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * @route GET /api/datasources/:id/preview
 * @desc 获取文件数据预览
 */
router.get('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows = 100, sheet } = req.query;

    const options = {
      previewRows: parseInt(rows),
      sheetNames: sheet ? [sheet] : undefined,
    };

    const result = await dataSourceService.getFilePreview(id, options);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        metadata: result.metadata,
      });
    } else {
      const status =
        result.code === 'CONFIG_NOT_FOUND'
          ? 404
          : result.code === 'OPERATION_NOT_SUPPORTED'
            ? 400
            : 500;
      res.status(status).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * @route GET /api/datasources/:id/analyze
 * @desc 分析文件数据质量
 */
router.get('/:id/analyze', async (req, res) => {
  try {
    const { id } = req.params;
    const { sampleSize = 1000 } = req.query;

    const options = {
      sampleSize: parseInt(sampleSize),
    };

    const result = await dataSourceService.analyzeFileData(id, options);

    if (result.success) {
      res.json({
        success: true,
        analysis: result.analysis,
        metadata: result.metadata,
      });
    } else {
      const status =
        result.code === 'CONFIG_NOT_FOUND'
          ? 404
          : result.code === 'OPERATION_NOT_SUPPORTED'
            ? 400
            : 500;
      res.status(status).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * @route POST /api/datasources/upload
 * @desc 上传文件并创建数据源
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        code: 'NO_FILE',
      });
    }

    const { name, description } = req.body;

    const config = {
      name: name || req.file.originalname,
      type: 'file',
      description: description || `Uploaded file: ${req.file.originalname}`,
      path: req.file.path,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    };

    const result = await dataSourceService.createDataSource(config);

    if (result.success) {
      res.status(201).json({
        success: true,
        configId: result.configId,
        message: result.message,
        file: {
          originalName: req.file.originalname,
          size: req.file.size,
          path: req.file.path,
        },
      });
    } else {
      // 如果创建失败，删除上传的文件
      const fs = require('fs').promises;
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete uploaded file:', unlinkError);
      }

      res.status(400).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }
  } catch (error) {
    // 删除上传的文件
    if (req.file) {
      const fs = require('fs').promises;
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete uploaded file:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * @route GET /api/datasources/status
 * @desc 获取数据源服务状态
 */
router.get('/status', (req, res) => {
  try {
    const status = dataSourceService.getStatus();
    res.json({
      success: true,
      status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

// 错误处理中间件
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size exceeds limit (100MB)',
        code: 'FILE_TOO_LARGE',
      });
    }
  }

  res.status(500).json({
    success: false,
    error: error.message,
    code: 'INTERNAL_ERROR',
  });
});

module.exports = router;

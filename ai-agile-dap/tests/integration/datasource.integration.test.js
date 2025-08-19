/**
 * 数据源服务集成测试
 * 测试完整的数据源管理流程
 */

const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const datasourceRouter = require('../../src/routes/datasource');

// 创建测试应用
const app = express();
app.use(express.json());
app.use('/api/datasources', datasourceRouter);

// 错误处理中间件
app.use((error, req, res, next) => {
  res.status(500).json({
    success: false,
    error: error.message,
    code: 'INTERNAL_ERROR',
  });
});

describe('DataSource Integration Tests', () => {
  let testConfigId;
  let testFilePath;

  beforeAll(async () => {
    // 创建测试目录
    const testDir = path.join(__dirname, '../fixtures');
    await fs.mkdir(testDir, { recursive: true });

    // 创建测试CSV文件
    testFilePath = path.join(testDir, 'test-data.csv');
    const csvContent = `name,age,city
John Doe,30,New York
Jane Smith,25,Los Angeles
Bob Johnson,35,Chicago`;

    await fs.writeFile(testFilePath, csvContent);
  });

  afterAll(async () => {
    // 清理测试文件
    try {
      await fs.unlink(testFilePath);
    } catch (error) {
      // 忽略删除错误
    }
  });

  describe('Service Status', () => {
    test('GET /api/datasources/status should return service status', async () => {
      const response = await request(app).get('/api/datasources/status').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toHaveProperty('initialized');
      expect(response.body.status).toHaveProperty('activeConnections');
      expect(response.body.status).toHaveProperty('supportedTypes');
    });
  });

  describe('Data Source CRUD Operations', () => {
    test('POST /api/datasources should create MySQL data source', async () => {
      const config = {
        name: 'Test MySQL Database',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
        description: 'Test MySQL database for integration testing',
      };

      const response = await request(app).post('/api/datasources').send(config).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.configId).toBeDefined();
      expect(response.body.message).toContain('successfully');

      testConfigId = response.body.configId;
    });

    test('GET /api/datasources should list all data sources', async () => {
      const response = await request(app).get('/api/datasources').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.count).toBeGreaterThan(0);

      const testDataSource = response.body.data.find(ds => ds.id === testConfigId);
      expect(testDataSource).toBeDefined();
      expect(testDataSource.name).toBe('Test MySQL Database');
    });

    test('GET /api/datasources/:id should get specific data source', async () => {
      const response = await request(app).get(`/api/datasources/${testConfigId}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testConfigId);
      expect(response.body.data.name).toBe('Test MySQL Database');
      expect(response.body.data.type).toBe('mysql');
    });

    test('PUT /api/datasources/:id should update data source', async () => {
      const updates = {
        name: 'Updated Test MySQL Database',
        description: 'Updated description',
      };

      const response = await request(app)
        .put(`/api/datasources/${testConfigId}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('successfully');

      // Verify the update
      const getResponse = await request(app).get(`/api/datasources/${testConfigId}`).expect(200);

      expect(getResponse.body.data.name).toBe('Updated Test MySQL Database');
    });
  });

  describe('Connection Testing', () => {
    test('POST /api/datasources/test-config should test MySQL config', async () => {
      const config = {
        name: 'Test Config',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      };

      const response = await request(app).post('/api/datasources/test-config').send(config);

      expect(response.body.success).toBeDefined();
      expect(response.body.responseTime).toBeDefined();
      expect(response.body.message).toBeDefined();
    });

    test('POST /api/datasources/:id/test should test saved data source', async () => {
      const response = await request(app).post(`/api/datasources/${testConfigId}/test`);

      expect(response.body.success).toBeDefined();
      expect(response.body.responseTime).toBeDefined();
      expect(response.body.message).toBeDefined();
    });

    test('POST /api/datasources/test-config should reject invalid config', async () => {
      const invalidConfig = {
        name: 'Invalid Config',
        type: 'mysql',
        // missing required fields
      };

      const response = await request(app)
        .post('/api/datasources/test-config')
        .send(invalidConfig)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_CONFIG');
    });
  });

  describe('File Data Source Operations', () => {
    let fileConfigId;

    test('POST /api/datasources should create file data source', async () => {
      const config = {
        name: 'Test CSV File',
        type: 'file',
        path: testFilePath,
        description: 'Test CSV file for integration testing',
      };

      const response = await request(app).post('/api/datasources').send(config).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.configId).toBeDefined();

      fileConfigId = response.body.configId;
    });

    test('GET /api/datasources/:id/metadata should get file metadata', async () => {
      const response = await request(app)
        .get(`/api/datasources/${fileConfigId}/metadata`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.metadata).toHaveProperty('type', 'csv');
      expect(response.body.metadata).toHaveProperty('fileName');
      expect(response.body.metadata).toHaveProperty('fileSize');
    });

    test('GET /api/datasources/:id/preview should get file preview', async () => {
      const response = await request(app)
        .get(`/api/datasources/${fileConfigId}/preview?rows=10`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('headers');
      expect(response.body.data).toHaveProperty('rows');
      expect(response.body.data.headers).toEqual(['name', 'age', 'city']);
      expect(response.body.data.rows).toHaveLength(3);
    });

    test('GET /api/datasources/:id/analyze should analyze file data', async () => {
      const response = await request(app)
        .get(`/api/datasources/${fileConfigId}/analyze?sampleSize=100`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.analysis).toBeDefined();
      expect(response.body.analysis.overall).toHaveProperty('completeness');
      expect(response.body.analysis.overall).toHaveProperty('quality');
    });

    test('DELETE /api/datasources/:id should delete file data source', async () => {
      const response = await request(app).delete(`/api/datasources/${fileConfigId}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('successfully');

      // Verify deletion
      await request(app).get(`/api/datasources/${fileConfigId}`).expect(404);
    });
  });

  describe('Connection Management', () => {
    test('POST /api/datasources/:id/connect should connect to data source', async () => {
      const response = await request(app).post(`/api/datasources/${testConfigId}/connect`);

      expect(response.body.success).toBeDefined();
      expect(response.body.message).toBeDefined();

      if (response.body.success) {
        expect(response.body.connectionId).toBeDefined();
      }
    });

    test('GET /api/datasources/:id/metadata should get database metadata', async () => {
      const response = await request(app).get(`/api/datasources/${testConfigId}/metadata`);

      expect(response.body.success).toBeDefined();

      if (response.body.success) {
        expect(response.body.metadata).toHaveProperty('type');
        expect(response.body.metadata).toHaveProperty('tables');
        expect(response.body.metadata).toHaveProperty('schemas');
      }
    });

    test('POST /api/datasources/:id/query should execute query', async () => {
      const queryData = {
        query: 'SELECT 1 as test_column',
        params: [],
      };

      const response = await request(app)
        .post(`/api/datasources/${testConfigId}/query`)
        .send(queryData);

      expect(response.body.success).toBeDefined();

      if (response.body.success) {
        expect(response.body.data).toBeDefined();
        expect(response.body.fields).toBeDefined();
        expect(response.body.rowCount).toBeDefined();
        expect(response.body.executionTime).toBeDefined();
      }
    });

    test('POST /api/datasources/:id/disconnect should disconnect from data source', async () => {
      const response = await request(app).post(`/api/datasources/${testConfigId}/disconnect`);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('GET /api/datasources/non-existent should return 404', async () => {
      await request(app).get('/api/datasources/non-existent-id').expect(404);
    });

    test('PUT /api/datasources/non-existent should return 404', async () => {
      await request(app)
        .put('/api/datasources/non-existent-id')
        .send({ name: 'Updated Name' })
        .expect(404);
    });

    test('DELETE /api/datasources/non-existent should return 404', async () => {
      await request(app).delete('/api/datasources/non-existent-id').expect(404);
    });

    test('POST /api/datasources should reject invalid data source type', async () => {
      const config = {
        name: 'Invalid Data Source',
        type: 'unsupported-type',
        host: 'localhost',
      };

      const response = await request(app).post('/api/datasources').send(config).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_CONFIG');
    });

    test('POST /api/datasources/:id/query should reject missing query', async () => {
      const response = await request(app)
        .post(`/api/datasources/${testConfigId}/query`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_QUERY');
    });

    test('GET /api/datasources/:id/preview should reject non-file data source', async () => {
      const response = await request(app)
        .get(`/api/datasources/${testConfigId}/preview`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('OPERATION_NOT_SUPPORTED');
    });
  });

  describe('Cleanup', () => {
    test('DELETE /api/datasources/:id should delete test data source', async () => {
      const response = await request(app).delete(`/api/datasources/${testConfigId}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('successfully');

      // Verify deletion
      await request(app).get(`/api/datasources/${testConfigId}`).expect(404);
    });
  });
});

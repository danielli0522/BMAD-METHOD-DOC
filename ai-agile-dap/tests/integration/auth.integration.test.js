/**
 * 认证系统集成测试
 */

const request = require('supertest');
const express = require('express');
const authRoutes = require('../../src/routes/auth');
const mfaRoutes = require('../../src/routes/mfa');
const passwordRoutes = require('../../src/routes/password');
const sessionsRoutes = require('../../src/routes/sessions');
const auditRoutes = require('../../src/routes/audit');

// 创建测试应用
const app = express();
app.use(express.json());

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/mfa', mfaRoutes);
app.use('/api/password', passwordRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/audit', auditRoutes);

describe('Authentication System Integration Tests', () => {
  let authToken;
  let refreshToken;

  describe('Authentication Flow', () => {
    test('should complete full authentication flow', async () => {
      // 1. 用户登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.accessToken).toBeDefined();
      expect(loginResponse.body.data.refreshToken).toBeDefined();
      expect(loginResponse.body.data.user).toBeDefined();

      authToken = loginResponse.body.data.accessToken;
      refreshToken = loginResponse.body.data.refreshToken;

      // 2. 验证token
      const verifyResponse = await request(app)
        .post('/api/auth/verify')
        .send({
          token: authToken,
        })
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.data.valid).toBe(true);

      // 3. 获取当前用户信息
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(meResponse.body.success).toBe(true);
      expect(meResponse.body.data.user).toBeDefined();

      // 4. 刷新token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: refreshToken,
        })
        .expect(200);

      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data.accessToken).toBeDefined();
      expect(refreshResponse.body.data.refreshToken).toBeDefined();

      // 5. 用户注销
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          refreshToken: refreshToken,
        })
        .expect(200);

      expect(logoutResponse.body.success).toBe(true);
    });

    test('should handle invalid login credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });

    test('should handle missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email and password are required');
    });
  });

  describe('MFA Integration', () => {
    beforeEach(async () => {
      // 登录获取token
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'admin@example.com',
        password: 'password123',
      });

      authToken = loginResponse.body.data.accessToken;
    });

    test('should setup MFA successfully', async () => {
      const response = await request(app)
        .post('/api/mfa/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.qrCode).toBeDefined();
      expect(response.body.data.recoveryCodes).toBeDefined();
    });

    test('should verify MFA code', async () => {
      const response = await request(app)
        .post('/api/mfa/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: '123456',
          type: 'totp',
        })
        .expect(200);

      expect(response.body.success).toBeDefined();
    });

    test('should get MFA status', async () => {
      const response = await request(app)
        .get('/api/mfa/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBeDefined();
    });
  });

  describe('Password Management Integration', () => {
    beforeEach(async () => {
      // 登录获取token
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'admin@example.com',
        password: 'password123',
      });

      authToken = loginResponse.body.data.accessToken;
    });

    test('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/password/validate')
        .send({
          password: 'StrongPassword123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.score).toBeGreaterThan(60);
    });

    test('should reject weak password', async () => {
      const response = await request(app)
        .post('/api/password/validate')
        .send({
          password: '123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.errors.length).toBeGreaterThan(0);
    });

    test('should generate random password', async () => {
      const response = await request(app)
        .post('/api/password/generate')
        .send({
          length: 12,
          options: {
            includeUppercase: true,
            includeLowercase: true,
            includeNumbers: true,
            includeSpecialChars: true,
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.password).toBeDefined();
      expect(response.body.data.password.length).toBe(12);
    });

    test('should get password policy', async () => {
      const response = await request(app).get('/api/password/policy').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.minLength).toBeDefined();
      expect(response.body.data.requireUppercase).toBeDefined();
    });

    test('should check password expiry', async () => {
      const response = await request(app)
        .get('/api/password/expiry')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isExpired).toBeDefined();
      expect(response.body.data.isWarning).toBeDefined();
    });
  });

  describe('Session Management Integration', () => {
    beforeEach(async () => {
      // 登录获取token
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'admin@example.com',
        password: 'password123',
      });

      authToken = loginResponse.body.data.accessToken;
    });

    test('should get active sessions', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.sessions)).toBe(true);
    });

    test('should get session statistics', async () => {
      const response = await request(app)
        .get('/api/sessions/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalActive).toBeDefined();
      expect(response.body.data.maxAllowed).toBeDefined();
    });

    test('should detect suspicious login', async () => {
      const response = await request(app)
        .post('/api/sessions/detect-suspicious')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isSuspicious).toBeDefined();
    });
  });

  describe('Audit System Integration', () => {
    beforeEach(async () => {
      // 登录获取token
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'admin@example.com',
        password: 'password123',
      });

      authToken = loginResponse.body.data.accessToken;
    });

    test('should query audit logs', async () => {
      const response = await request(app)
        .get('/api/audit/logs')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.logs)).toBe(true);
    });

    test('should get audit statistics', async () => {
      const response = await request(app)
        .get('/api/audit/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalEvents).toBeDefined();
    });

    test('should get event types', async () => {
      const response = await request(app)
        .get('/api/audit/events')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.eventTypes).toBeDefined();
      expect(response.body.data.logLevels).toBeDefined();
    });

    test('should generate audit report', async () => {
      const response = await request(app)
        .get('/api/audit/reports?reportType=summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('summary');
    });
  });

  describe('Security Integration', () => {
    test('should handle unauthorized access', async () => {
      const response = await request(app).get('/api/auth/me').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
    });

    test('should handle invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    test('should handle missing token in protected routes', async () => {
      const response = await request(app).get('/api/sessions').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle missing required fields', async () => {
      const response = await request(app).post('/api/auth/login').send({}).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email and password are required');
    });

    test('should handle invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email format');
    });
  });

  describe('Rate Limiting and Security', () => {
    test('should handle multiple failed login attempts', async () => {
      // 尝试多次失败登录
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'admin@example.com',
            password: 'wrongpassword',
          })
          .expect(401);
      }
    });

    test('should validate password complexity requirements', async () => {
      const weakPasswords = ['123', 'password', 'abc123', 'qwerty'];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/password/validate')
          .send({ password })
          .expect(200);

        expect(response.body.data.isValid).toBe(false);
      }
    });
  });
});

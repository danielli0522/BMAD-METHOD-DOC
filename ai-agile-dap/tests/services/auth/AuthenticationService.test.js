/**
 * JWT认证服务单元测试
 */

const AuthenticationService = require('../../../src/services/auth/AuthenticationService');

describe('AuthenticationService', () => {
  let authService;

  beforeEach(() => {
    authService = new AuthenticationService();
  });

  afterEach(async () => {
    if (authService) {
      await authService.close();
    }
  });

  describe('authenticate', () => {
    test('should authenticate valid user credentials', async () => {
      const email = 'admin@example.com';
      const password = 'password123';

      const result = await authService.authenticate(email, password);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(email);
      expect(result.expiresIn).toBe(15 * 60);
    });

    test('should reject invalid credentials', async () => {
      const email = 'admin@example.com';
      const password = 'wrongpassword';

      await expect(authService.authenticate(email, password)).rejects.toThrow(
        'Invalid credentials'
      );
    });

    test('should reject non-existent user', async () => {
      const email = 'nonexistent@example.com';
      const password = 'password123';

      await expect(authService.authenticate(email, password)).rejects.toThrow(
        'Invalid credentials'
      );
    });
  });

  describe('refreshToken', () => {
    test('should refresh valid token', async () => {
      // First authenticate to get tokens
      const email = 'admin@example.com';
      const password = 'password123';
      const authResult = await authService.authenticate(email, password);

      const result = await authService.refreshToken(authResult.refreshToken);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.accessToken).not.toBe(authResult.accessToken);
      expect(result.refreshToken).not.toBe(authResult.refreshToken);
    });

    test('should reject invalid refresh token', async () => {
      const invalidToken = 'invalid.refresh.token';

      await expect(authService.refreshToken(invalidToken)).rejects.toThrow('Token refresh failed');
    });

    test('should reject blacklisted token', async () => {
      // First authenticate to get tokens
      const email = 'admin@example.com';
      const password = 'password123';
      const authResult = await authService.authenticate(email, password);

      // Blacklist the token
      await authService.blacklistToken(authResult.refreshToken);

      await expect(authService.refreshToken(authResult.refreshToken)).rejects.toThrow(
        'Token refresh failed'
      );
    });
  });

  describe('verifyToken', () => {
    test('should verify valid access token', async () => {
      // First authenticate to get token
      const email = 'admin@example.com';
      const password = 'password123';
      const authResult = await authService.authenticate(email, password);

      const result = await authService.verifyToken(authResult.accessToken);

      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(email);
      expect(result.payload).toBeDefined();
    });

    test('should reject invalid token', async () => {
      const invalidToken = 'invalid.token.here';

      const result = await authService.verifyToken(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject blacklisted token', async () => {
      // First authenticate to get token
      const email = 'admin@example.com';
      const password = 'password123';
      const authResult = await authService.authenticate(email, password);

      // Blacklist the token
      await authService.blacklistToken(authResult.accessToken);

      const result = await authService.verifyToken(authResult.accessToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token is blacklisted');
    });
  });

  describe('logout', () => {
    test('should logout user successfully', async () => {
      // First authenticate to get tokens
      const email = 'admin@example.com';
      const password = 'password123';
      const authResult = await authService.authenticate(email, password);

      const userId = authResult.user.id;
      const accessToken = authResult.accessToken;
      const refreshToken = authResult.refreshToken;

      await expect(authService.logout(userId, accessToken, refreshToken)).resolves.not.toThrow();
    });

    test('should handle logout with missing tokens', async () => {
      const userId = '1';

      await expect(authService.logout(userId, null, null)).resolves.not.toThrow();
    });
  });

  describe('generateAccessToken', () => {
    test('should generate valid access token', () => {
      const user = {
        id: '1',
        email: 'admin@example.com',
        role: 'admin',
        organizationId: 'org1',
      };

      const token = authService.generateAccessToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });
  });

  describe('generateRefreshToken', () => {
    test('should generate valid refresh token', () => {
      const userId = '1';

      const token = authService.generateRefreshToken(userId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });
  });

  describe('blacklistToken', () => {
    test('should blacklist token successfully', async () => {
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      await expect(authService.blacklistToken(token)).resolves.not.toThrow();
    });

    test('should handle invalid token gracefully', async () => {
      const invalidToken = 'invalid.token';

      await expect(authService.blacklistToken(invalidToken)).resolves.not.toThrow();
    });
  });

  describe('isTokenBlacklisted', () => {
    test('should return false for non-blacklisted token', async () => {
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const result = await authService.isTokenBlacklisted(token);

      expect(result).toBe(false);
    });

    test('should return true for blacklisted token', async () => {
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      // Blacklist the token
      await authService.blacklistToken(token);

      const result = await authService.isTokenBlacklisted(token);

      expect(result).toBe(true);
    });
  });

  describe('validateUserCredentials', () => {
    test('should validate correct credentials', async () => {
      const email = 'admin@example.com';
      const password = 'password123';

      const result = await authService.validateUserCredentials(email, password);

      expect(result).toBeDefined();
      expect(result.email).toBe(email);
      expect(result.role).toBe('admin');
    });

    test('should reject incorrect password', async () => {
      const email = 'admin@example.com';
      const password = 'wrongpassword';

      const result = await authService.validateUserCredentials(email, password);

      expect(result).toBeNull();
    });

    test('should reject non-existent user', async () => {
      const email = 'nonexistent@example.com';
      const password = 'password123';

      const result = await authService.validateUserCredentials(email, password);

      expect(result).toBeNull();
    });
  });

  describe('getUserById', () => {
    test('should return user for valid ID', async () => {
      const userId = '1';

      const result = await authService.getUserById(userId);

      expect(result).toBeDefined();
      expect(result.id).toBe(userId);
      expect(result.email).toBe('admin@example.com');
    });

    test('should return null for invalid ID', async () => {
      const userId = '999';

      const result = await authService.getUserById(userId);

      expect(result).toBeNull();
    });
  });

  describe('logAuthEvent', () => {
    test('should log authentication event', async () => {
      const userId = '1';
      const event = 'LOGIN';
      const details = { email: 'admin@example.com', success: true };

      await expect(authService.logAuthEvent(userId, event, details)).resolves.not.toThrow();
    });

    test('should log failed authentication event', async () => {
      const userId = null;
      const event = 'LOGIN_FAILED';
      const details = { email: 'admin@example.com', error: 'Invalid password' };

      await expect(authService.logAuthEvent(userId, event, details)).resolves.not.toThrow();
    });
  });
});

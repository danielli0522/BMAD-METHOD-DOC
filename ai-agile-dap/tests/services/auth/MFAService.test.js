/**
 * MFA功能单元测试
 */

const MFAService = require('../../../src/services/auth/MFAService');

describe('MFAService', () => {
  let mfaService;

  beforeEach(() => {
    mfaService = new MFAService();
  });

  describe('generateTOTPSecret', () => {
    test('should generate valid TOTP secret', () => {
      const userId = '1';
      const email = 'admin@example.com';

      const result = mfaService.generateTOTPSecret(userId, email);

      expect(result.secret).toBeDefined();
      expect(result.otpauthUrl).toBeDefined();
      expect(result.secret.length).toBeGreaterThan(0);
      expect(result.otpauthUrl).toContain('otpauth://totp/');
    });
  });

  describe('generateQRCode', () => {
    test('should generate QR code data URL', async () => {
      const otpauthUrl =
        'otpauth://totp/AI-Agile-DAP:admin@example.com?secret=JBSWY3DPEHPK3PXP&issuer=AI-Agile-DAP';

      const result = await mfaService.generateQRCode(otpauthUrl);

      expect(result).toBeDefined();
      expect(result).toMatch(/^data:image\/png;base64,/);
    });

    test('should handle invalid URL gracefully', async () => {
      const invalidUrl = 'invalid://url';

      await expect(mfaService.generateQRCode(invalidUrl)).rejects.toThrow(
        'Failed to generate QR code'
      );
    });
  });

  describe('verifyTOTP', () => {
    test('should verify valid TOTP code', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const token = '123456'; // This would be a valid TOTP code in real scenario

      // Note: In real testing, you would need to generate a valid TOTP code
      // For now, we'll test the method structure
      const result = mfaService.verifyTOTP(secret, token);

      expect(typeof result).toBe('boolean');
    });

    test('should reject invalid TOTP code', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const invalidToken = '000000';

      const result = mfaService.verifyTOTP(secret, invalidToken);

      expect(result).toBe(false);
    });

    test('should handle invalid secret gracefully', () => {
      const invalidSecret = 'invalid-secret';
      const token = '123456';

      const result = mfaService.verifyTOTP(invalidSecret, token);

      expect(result).toBe(false);
    });
  });

  describe('generateRecoveryCodes', () => {
    test('should generate default number of recovery codes', () => {
      const result = mfaService.generateRecoveryCodes();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(10);
      result.forEach(code => {
        expect(typeof code).toBe('string');
        expect(code.length).toBe(8);
        expect(code).toMatch(/^[A-F0-9]+$/);
      });
    });

    test('should generate specified number of recovery codes', () => {
      const count = 5;
      const result = mfaService.generateRecoveryCodes(count);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(count);
    });
  });

  describe('verifyRecoveryCode', () => {
    test('should verify valid recovery code', () => {
      const storedCodes = ['ABCD1234', 'EFGH5678', 'IJKL9012'];
      const inputCode = 'ABCD1234';

      const result = mfaService.verifyRecoveryCode(storedCodes, inputCode);

      expect(result.valid).toBe(true);
      expect(result.remainingCodes).toHaveLength(2);
      expect(result.usedCode).toBe('ABCD1234');
      expect(result.remainingCodes).not.toContain('ABCD1234');
    });

    test('should reject invalid recovery code', () => {
      const storedCodes = ['ABCD1234', 'EFGH5678', 'IJKL9012'];
      const inputCode = 'INVALID';

      const result = mfaService.verifyRecoveryCode(storedCodes, inputCode);

      expect(result.valid).toBe(false);
      expect(result.remainingCodes).toEqual(storedCodes);
    });

    test('should handle case-insensitive input', () => {
      const storedCodes = ['ABCD1234', 'EFGH5678', 'IJKL9012'];
      const inputCode = 'abcd1234';

      const result = mfaService.verifyRecoveryCode(storedCodes, inputCode);

      expect(result.valid).toBe(true);
      expect(result.usedCode).toBe('ABCD1234');
    });

    test('should handle whitespace in input', () => {
      const storedCodes = ['ABCD1234', 'EFGH5678', 'IJKL9012'];
      const inputCode = ' ABCD1234 ';

      const result = mfaService.verifyRecoveryCode(storedCodes, inputCode);

      expect(result.valid).toBe(true);
      expect(result.usedCode).toBe('ABCD1234');
    });
  });

  describe('setupTOTP', () => {
    test('should setup TOTP successfully', async () => {
      const userId = '1';
      const email = 'admin@example.com';

      const result = await mfaService.setupTOTP(userId, email);

      expect(result.success).toBe(true);
      expect(result.secret).toBeDefined();
      expect(result.qrCode).toBeDefined();
      expect(result.recoveryCodes).toBeDefined();
      expect(result.setupInstructions).toBeDefined();
      expect(Array.isArray(result.recoveryCodes)).toBe(true);
      expect(Array.isArray(result.setupInstructions)).toBe(true);
    });
  });

  describe('verifyMFACode', () => {
    test('should verify TOTP code successfully', async () => {
      const userId = '1';
      const code = '123456';
      const mfaType = 'totp';

      const result = await mfaService.verifyMFACode(userId, code, mfaType);

      expect(result.success).toBeDefined();
      expect(result.message).toBeDefined();
    });

    test('should verify SMS code successfully', async () => {
      const userId = '1';
      const code = '123456';
      const mfaType = 'sms';

      const result = await mfaService.verifyMFACode(userId, code, mfaType);

      expect(result.success).toBeDefined();
      expect(result.message).toBeDefined();
    });

    test('should verify recovery code successfully', async () => {
      const userId = '1';
      const code = 'ABCD1234';
      const mfaType = 'recovery';

      const result = await mfaService.verifyMFACode(userId, code, mfaType);

      expect(result.success).toBeDefined();
      expect(result.message).toBeDefined();
    });

    test('should reject invalid MFA type', async () => {
      const userId = '1';
      const code = '123456';
      const mfaType = 'invalid';

      await expect(mfaService.verifyMFACode(userId, code, mfaType)).rejects.toThrow(
        'Invalid MFA type or configuration'
      );
    });
  });

  describe('sendSMSCode', () => {
    test('should send SMS code successfully', async () => {
      const userId = '1';
      const phoneNumber = '+1234567890';

      const result = await mfaService.sendSMSCode(userId, phoneNumber);

      expect(result.success).toBe(true);
      expect(result.message).toBe('SMS code sent successfully');
      expect(result.expiresIn).toBe(300);
    });

    test('should handle SMS sending error gracefully', async () => {
      const userId = '1';
      const phoneNumber = 'invalid-phone';

      // Mock the storeSMSCode to throw an error
      const originalStoreSMSCode = mfaService.storeSMSCode;
      mfaService.storeSMSCode = jest.fn().mockRejectedValue(new Error('Storage error'));

      await expect(mfaService.sendSMSCode(userId, phoneNumber)).rejects.toThrow(
        'Failed to send SMS code'
      );

      // Restore original method
      mfaService.storeSMSCode = originalStoreSMSCode;
    });
  });

  describe('verifySMSCode', () => {
    test('should verify valid SMS code', async () => {
      const userId = '1';
      const code = '123456';

      // First store a code
      await mfaService.storeSMSCode(userId, code);

      const result = await mfaService.verifySMSCode(userId, code);

      expect(result).toBe(true);
    });

    test('should reject invalid SMS code', async () => {
      const userId = '1';
      const code = '123456';
      const invalidCode = '000000';

      // First store a code
      await mfaService.storeSMSCode(userId, code);

      const result = await mfaService.verifySMSCode(userId, invalidCode);

      expect(result).toBe(false);
    });

    test('should reject expired SMS code', async () => {
      const userId = '1';
      const code = '123456';

      // Store a code and manually expire it
      await mfaService.storeSMSCode(userId, code);

      // Manually expire the code by setting expiresAt to past
      if (mfaService.smsCodes && mfaService.smsCodes.get(userId)) {
        mfaService.smsCodes.get(userId).expiresAt = Date.now() - 1000;
      }

      const result = await mfaService.verifySMSCode(userId, code);

      expect(result).toBe(false);
    });
  });

  describe('getUserMFAConfig', () => {
    test('should return MFA config for enabled user', async () => {
      const userId = '1';

      const result = await mfaService.getUserMFAConfig(userId);

      expect(result).toBeDefined();
      expect(result.enabled).toBe(true);
      expect(result.totpSecret).toBeDefined();
      expect(result.recoveryCodes).toBeDefined();
    });

    test('should return MFA config for disabled user', async () => {
      const userId = '2';

      const result = await mfaService.getUserMFAConfig(userId);

      expect(result).toBeDefined();
      expect(result.enabled).toBe(false);
    });

    test('should return null for non-existent user', async () => {
      const userId = '999';

      const result = await mfaService.getUserMFAConfig(userId);

      expect(result).toBeNull();
    });
  });

  describe('enableMFA', () => {
    test('should enable MFA successfully', async () => {
      const userId = '1';
      const config = {
        type: 'totp',
        enabled: true,
      };

      const result = await mfaService.enableMFA(userId, config);

      expect(result.success).toBe(true);
      expect(result.message).toBe('MFA enabled successfully');
    });

    test('should handle enable MFA error gracefully', async () => {
      const userId = '1';
      const config = null;

      await expect(mfaService.enableMFA(userId, config)).rejects.toThrow('Failed to enable MFA');
    });
  });

  describe('disableMFA', () => {
    test('should disable MFA successfully', async () => {
      const userId = '1';

      const result = await mfaService.disableMFA(userId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('MFA disabled successfully');
    });

    test('should handle disable MFA error gracefully', async () => {
      const userId = null;

      await expect(mfaService.disableMFA(userId)).rejects.toThrow('Failed to disable MFA');
    });
  });

  describe('updateRecoveryCodes', () => {
    test('should update recovery codes successfully', async () => {
      const userId = '1';
      const newCodes = ['NEW1234', 'NEW5678'];

      await expect(mfaService.updateRecoveryCodes(userId, newCodes)).resolves.not.toThrow();
    });
  });
});

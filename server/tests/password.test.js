const {
  hashPassword,
  comparePassword,
  validatePasswordStrength
} = require('../src/utils/password');

describe('Password Security & Cryptography (Phase 3)', () => {
  const plainPassword = 'SuperSecurePassword123!';

  describe('Password Hashing & Comparison', () => {
    it('should hash a password and verify it matches the plaintext', async () => {
      const hash = await hashPassword(plainPassword);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(plainPassword);
      expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);

      const isValid = await comparePassword(plainPassword, hash);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password against the hash', async () => {
      const hash = await hashPassword(plainPassword);
      const isWrongValid = await comparePassword('WrongPassword123!', hash);

      expect(isWrongValid).toBe(false);
    });

    it('should handle empty or null inputs safely without throwing unhandled exceptions', async () => {
      const isNullValid = await comparePassword(null, 'somehash');
      expect(isNullValid).toBe(false);

      const isUndefinedValid = await comparePassword('password', undefined);
      expect(isUndefinedValid).toBe(false);

      await expect(hashPassword(null)).rejects.toThrow();
    });
  });

  describe('Password Strength Policy Validation (PRD Section 18.1)', () => {
    it('should accept passwords that satisfy all strength requirements', () => {
      expect(validatePasswordStrength('ValidP@ssw0rd')).toBe(true);
      expect(validatePasswordStrength('Str0ng!Security')).toBe(true);
      expect(validatePasswordStrength('IoT_Def3nder#2026')).toBe(true);
    });

    it('should reject passwords shorter than 8 characters', () => {
      expect(validatePasswordStrength('P@ss1')).toBe(false);
    });

    it('should reject passwords without uppercase characters', () => {
      expect(validatePasswordStrength('password123!@#')).toBe(false);
    });

    it('should reject passwords without lowercase characters', () => {
      expect(validatePasswordStrength('PASSWORD123!@#')).toBe(false);
    });

    it('should reject passwords without numeric digits', () => {
      expect(validatePasswordStrength('Password!@#XYZ')).toBe(false);
    });

    it('should reject passwords without special characters', () => {
      expect(validatePasswordStrength('Password123456')).toBe(false);
    });
  });
});

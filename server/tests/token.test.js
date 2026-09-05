const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiryDate
} = require('../src/utils/token');

describe('Token Utilities & HS256 JWT Security (Phase 3)', () => {
  const dummyUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: new mongoose.Types.ObjectId(),
    role: 'security_analyst'
  };

  describe('Access Token Generation & Verification', () => {
    it('should generate a valid HS256 JWT containing required claims', () => {
      const token = generateAccessToken(dummyUser);
      expect(typeof token).toBe('string');

      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(dummyUser._id.toString());
      expect(decoded.organizationId).toBe(dummyUser.organizationId.toString());
      expect(decoded.role).toBe('security_analyst');
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    it('should throw an error with TOKEN_EXPIRED code when token is expired', () => {
      // Create an already-expired token
      const expiredToken = jwt.sign(
        {
          userId: dummyUser._id.toString(),
          organizationId: dummyUser.organizationId.toString(),
          role: dummyUser.role
        },
        config.jwt.secret,
        { algorithm: 'HS256', expiresIn: '-1s' }
      );

      expect(() => verifyAccessToken(expiredToken)).toThrow('Access token has expired');
      try {
        verifyAccessToken(expiredToken);
      } catch (err) {
        expect(err.code).toBe('TOKEN_EXPIRED');
        expect(err.statusCode).toBe(401);
      }
    });

    it('should throw an error with INVALID_TOKEN when signature is tampered', () => {
      const token = generateAccessToken(dummyUser);
      const tamperedToken = token.slice(0, -5) + 'abcde';

      expect(() => verifyAccessToken(tamperedToken)).toThrow('Invalid access token');
      try {
        verifyAccessToken(tamperedToken);
      } catch (err) {
        expect(err.code).toBe('INVALID_TOKEN');
        expect(err.statusCode).toBe(401);
      }
    });
  });

  describe('Refresh Token Generation & SHA-256 Hashing', () => {
    it('should generate an 80-character hex cryptographically random token', () => {
      const token1 = generateRefreshToken();
      const token2 = generateRefreshToken();

      expect(typeof token1).toBe('string');
      expect(token1.length).toBe(80); // 40 bytes = 80 hex characters
      expect(token1).not.toBe(token2);
    });

    it('should consistently compute SHA-256 hash of token', () => {
      const rawToken = 'my_sample_refresh_token_string';
      const hash1 = hashToken(rawToken);
      const hash2 = hashToken(rawToken);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // 256 bits = 64 hex characters
    });

    it('should compute future expiry date for refresh token', () => {
      const expiry = getRefreshTokenExpiryDate(7);
      const now = new Date();
      const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeGreaterThan(6.9);
      expect(diffDays).toBeLessThan(7.1);
    });
  });
});

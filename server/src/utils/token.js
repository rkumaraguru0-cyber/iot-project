const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');

/**
 * Generates an HS256 JWT access token with 15-minute expiry
 * @param {Object} user - User document or payload containing _id, organizationId, role
 * @returns {string} Signed JWT string
 */
const generateAccessToken = (user) => {
  const payload = {
    userId: user._id ? user._id.toString() : user.userId,
    organizationId: user.organizationId ? user.organizationId.toString() : user.organizationId,
    role: user.role
  };

  return jwt.sign(payload, config.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: config.jwt.accessExpiry || '15m'
  });
};

/**
 * Verifies an HS256 JWT access token
 * @param {string} token - Bearer JWT
 * @returns {Object} Decoded payload
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256']
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const err = new Error('Access token has expired');
      err.code = 'TOKEN_EXPIRED';
      err.statusCode = 401;
      throw err;
    }
    const err = new Error('Invalid access token');
    err.code = 'INVALID_TOKEN';
    err.statusCode = 401;
    throw err;
  }
};

/**
 * Generates a cryptographically random opaque refresh token
 * @returns {string} 80-character hex string (40 bytes)
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

/**
 * Computes SHA-256 hash of a raw token for secure database storage
 * @param {string} rawToken
 * @returns {string} SHA-256 hex digest
 */
const hashToken = (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new Error('Raw token is required for hashing');
  }
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

/**
 * Calculates the expiration Date for a refresh token (default 7 days)
 * @param {number} [days]
 * @returns {Date}
 */
const getRefreshTokenExpiryDate = (days = config.jwt.refreshExpiryDays || 7) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt;
};

module.exports = {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiryDate
};

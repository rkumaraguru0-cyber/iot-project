const bcrypt = require('bcryptjs');

const BCRYPT_SALT_ROUNDS = 12;

// Password requirement regex: min 8 characters, at least 1 uppercase, 1 lowercase, 1 digit, and 1 special character
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;

/**
 * Hashes a plaintext password using bcrypt with cost factor 12
 * @param {string} plaintextPassword
 * @returns {Promise<string>}
 */
const hashPassword = async (plaintextPassword) => {
  if (!plaintextPassword || typeof plaintextPassword !== 'string') {
    throw new Error('Plaintext password is required for hashing');
  }
  return bcrypt.hash(plaintextPassword, BCRYPT_SALT_ROUNDS);
};

/**
 * Compares a plaintext password against a bcrypt hash
 * @param {string} plaintextPassword
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
const comparePassword = async (plaintextPassword, hash) => {
  if (!plaintextPassword || !hash) {
    return false;
  }
  return bcrypt.compare(plaintextPassword, hash);
};

/**
 * Validates password strength according to PRD Section 18.1
 * @param {string} password
 * @returns {boolean}
 */
const validatePasswordStrength = (password) => {
  if (!password || typeof password !== 'string') {
    return false;
  }
  return PASSWORD_REGEX.test(password);
};

module.exports = {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  PASSWORD_REGEX
};

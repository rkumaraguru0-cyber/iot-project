const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  loginSchema,
  registerSchema
} = require('../validators/auth.validator');

const router = express.Router();

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user credentials & issue JWT tokens
 * @access  Public (Rate Limited)
 */
router.post('/login', authLimiter, validate(loginSchema), authController.login);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Rotate and issue new access token from refresh token cookie
 * @access  Public (Requires httpOnly cookie)
 */
router.post('/refresh', authController.refreshToken);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Revoke refresh tokens and clear auth cookie
 * @access  Authenticated
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   POST /api/v1/auth/register
 * @desc    Initial platform bootstrap (creates first organization & admin)
 * @access  Public (Only works if 0 orgs exist)
 */
router.post('/register', authLimiter, validate(registerSchema), authController.register);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Retrieve currently authenticated user identity and organization context
 * @access  Authenticated
 */
router.get('/me', authenticate, authController.getMe);

module.exports = router;

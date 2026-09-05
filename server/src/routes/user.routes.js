const express = require('express');
const userController = require('../controllers/user.controller');
const authenticate = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const {
  inviteUserSchema,
  updateUserSchema,
  updateProfileSchema,
  changePasswordSchema,
  listUsersQuerySchema
} = require('../validators/user.validator');

const router = express.Router();

// Self-service profile routes (available to any authenticated user)
router.get('/me', authenticate, userController.getMe);
router.patch('/me', authenticate, validate(updateProfileSchema), userController.updateProfile);
router.patch('/me/password', authenticate, validate(changePasswordSchema), userController.changePassword);

// Organization-scoped user administration routes
router.use(authenticate, orgScope);

/**
 * @route   GET /api/v1/users
 * @desc    List users in organization
 * @access  viewer+
 */
router.get(
  '/',
  requireRole('viewer'),
  validate(listUsersQuerySchema, 'query'),
  userController.listUsers
);

/**
 * @route   POST /api/v1/users/invite
 * @desc    Invite new user to organization
 * @access  org_admin
 */
router.post(
  '/invite',
  requireRole('org_admin'),
  validate(inviteUserSchema),
  userController.inviteUser
);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user details
 * @access  viewer+
 */
router.get(
  '/:id',
  requireRole('viewer'),
  userController.getUserById
);

/**
 * @route   PATCH /api/v1/users/:id
 * @desc    Update user role or active status
 * @access  org_admin
 */
router.patch(
  '/:id',
  requireRole('org_admin'),
  validate(updateUserSchema),
  userController.updateUser
);

module.exports = router;

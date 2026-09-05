const express = require('express');
const securityEventController = require('../controllers/securityEvent.controller');
const authenticate = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const {
  querySecurityEventsSchema,
  updateSecurityEventStatusSchema
} = require('../validators/securityEvent.validator');

const router = express.Router();

// Enforce authentication and tenant scoping on all security event routes
router.use(authenticate, orgScope);

/**
 * @route   GET /api/v1/security-events
 * @desc    List security events for organization with pagination & filters
 * @access  viewer+
 */
router.get(
  '/',
  requireRole('viewer'),
  validate(querySecurityEventsSchema, 'query'),
  securityEventController.listSecurityEvents
);

/**
 * @route   GET /api/v1/security-events/:id
 * @desc    Get single security event by ID or eventId
 * @access  viewer+
 */
router.get(
  '/:id',
  requireRole('viewer'),
  securityEventController.getSecurityEventById
);

/**
 * @route   PATCH /api/v1/security-events/:id/status
 * @desc    Update security event status (operator+ for ack, security_analyst+ for resolve/dismiss)
 * @access  operator+
 */
router.patch(
  '/:id/status',
  requireRole('operator'),
  validate(updateSecurityEventStatusSchema),
  securityEventController.updateEventStatus
);

module.exports = router;

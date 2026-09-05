const express = require('express');
const deviceController = require('../controllers/device.controller');
const authenticate = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const {
  registerDeviceSchema,
  updateDeviceSchema,
  listDevicesQuerySchema
} = require('../validators/device.validator');

const router = express.Router();

// Enforce authentication and tenant scoping on all device routes
router.use(authenticate, orgScope);

/**
 * @route   POST /api/v1/devices
 * @desc    Register a new IoT device and issue initial API key
 * @access  security_analyst+
 */
router.post(
  '/',
  requireRole('security_analyst'),
  validate(registerDeviceSchema),
  deviceController.registerDevice
);

/**
 * @route   GET /api/v1/devices
 * @desc    List devices in organization with pagination, filter, sort, search
 * @access  viewer+
 */
router.get(
  '/',
  requireRole('viewer'),
  validate(listDevicesQuerySchema, 'query'),
  deviceController.listDevices
);

/**
 * @route   GET /api/v1/devices/stats
 * @desc    Get aggregate device statistics (status, health, risk)
 * @access  viewer+
 */
router.get(
  '/stats',
  requireRole('viewer'),
  deviceController.getDeviceStats
);

/**
 * @route   GET /api/v1/devices/:id
 * @desc    Get full device details
 * @access  viewer+
 */
router.get(
  '/:id',
  requireRole('viewer'),
  deviceController.getDeviceById
);

/**
 * @route   PATCH /api/v1/devices/:id
 * @desc    Update device metadata (security_analyst+) or state (operator+)
 * @access  operator+ (Route level; field-level permissions verified in service)
 */
router.patch(
  '/:id',
  requireRole('operator'),
  validate(updateDeviceSchema),
  deviceController.updateDevice
);

/**
 * @route   POST /api/v1/devices/:id/regenerate-key
 * @desc    Regenerate device API key (invalidating the previous one)
 * @access  security_analyst+
 */
router.post(
  '/:id/regenerate-key',
  requireRole('security_analyst'),
  deviceController.regenerateApiKey
);

/**
 * @route   GET /api/v1/devices/:id/risk
 * @desc    Get device risk score breakdown
 * @access  viewer+
 */
router.get(
  '/:id/risk',
  requireRole('viewer'),
  deviceController.getDeviceRisk
);

module.exports = router;

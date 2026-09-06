const express = require('express');
const router = express.Router();
const firmwareController = require('../controllers/firmware.controller');
const authenticate = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { Device } = require('../models');
const { hashToken } = require('../utils/token');
const {
  createFirmwareVersionSchema,
  queryFirmwareVersionsSchema,
  updateFirmwareVersionSchema,
  createDeploymentsSchema,
  queryDeploymentsSchema,
  updateDeploymentStatusSchema
} = require('../validators/firmware.validator');

/**
 * Dual authentication middleware for status endpoint:
 * Accepts either User JWT Bearer token OR Device X-Device-API-Key header.
 */
const authenticateUserOrDevice = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const rawApiKey = req.headers['x-device-api-key'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticate(req, res, (err) => {
      if (err) return next(err);
      req.isDeviceAuth = false;
      next();
    });
  }

  if (rawApiKey) {
    try {
      const apiKeyHash = hashToken(rawApiKey.trim());
      const device = await Device.findOne({ apiKeyHash });

      if (!device) {
        return res.status(401).json({
          error: {
            code: 'INVALID_DEVICE_CREDENTIALS',
            message: 'Invalid device API key'
          }
        });
      }

      if (device.status === 'decommissioned') {
        return res.status(403).json({
          error: {
            code: 'DEVICE_DECOMMISSIONED',
            message: 'Decommissioned devices cannot perform deployment operations'
          }
        });
      }

      req.device = device;
      req.organizationId = device.organizationId.toString();
      req.isDeviceAuth = true;
      return next();
    } catch (err) {
      return next(err);
    }
  }

  return res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Provide Bearer token or X-Device-API-Key header.'
    }
  });
};

// ==========================================
// Firmware Version Endpoints (4 APIs)
// ==========================================

router.post(
  '/versions',
  authenticate,
  orgScope,
  requireRole('security_analyst'),
  validate(createFirmwareVersionSchema),
  firmwareController.createFirmwareVersion
);

router.get(
  '/versions',
  authenticate,
  orgScope,
  requireRole('viewer'),
  validate(queryFirmwareVersionsSchema, 'query'),
  firmwareController.listFirmwareVersions
);

router.get(
  '/versions/:id',
  authenticate,
  orgScope,
  requireRole('viewer'),
  firmwareController.getFirmwareVersionById
);

router.patch(
  '/versions/:id',
  authenticate,
  orgScope,
  requireRole('security_analyst'),
  validate(updateFirmwareVersionSchema),
  firmwareController.updateFirmwareVersion
);

// ==========================================
// OTA Deployment Endpoints (4 APIs)
// ==========================================

router.post(
  '/deployments',
  authenticate,
  orgScope,
  requireRole('security_analyst'),
  validate(createDeploymentsSchema),
  firmwareController.createDeployments
);

router.get(
  '/deployments',
  authenticate,
  orgScope,
  requireRole('viewer'),
  validate(queryDeploymentsSchema, 'query'),
  firmwareController.listDeployments
);

router.get(
  '/deployments/:id',
  authenticate,
  orgScope,
  requireRole('viewer'),
  firmwareController.getDeploymentById
);

router.patch(
  '/deployments/:id/status',
  authenticateUserOrDevice,
  validate(updateDeploymentStatusSchema),
  firmwareController.updateDeploymentStatus
);

module.exports = router;

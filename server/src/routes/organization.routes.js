const express = require('express');
const organizationController = require('../controllers/organization.controller');
const authenticate = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const {
  updateOrgSettingsSchema,
  createOrgSchema
} = require('../validators/organization.validator');

const router = express.Router();

/**
 * @route   GET /api/v1/organizations/current
 * @desc    Get current organization profile and settings
 * @access  viewer+
 */
router.get(
  '/current',
  authenticate,
  orgScope,
  requireRole('viewer'),
  organizationController.getCurrentOrganization
);

/**
 * @route   PATCH /api/v1/organizations/current
 * @desc    Update organization settings (SLA, auto-quarantine, alerts)
 * @access  org_admin
 */
router.patch(
  '/current',
  authenticate,
  orgScope,
  requireRole('org_admin'),
  validate(updateOrgSettingsSchema),
  organizationController.updateCurrentOrganization
);

/**
 * @route   POST /api/v1/organizations
 * @desc    Create new organization (platform administrator operation)
 * @access  super_admin
 */
router.post(
  '/',
  authenticate,
  requireRole('super_admin'),
  validate(createOrgSchema),
  organizationController.createOrganization
);

module.exports = router;

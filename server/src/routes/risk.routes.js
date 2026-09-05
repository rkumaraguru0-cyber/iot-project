const express = require('express');
const riskController = require('../controllers/risk.controller');
const authenticate = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// Enforce authentication and tenant scoping on all risk routes
router.use(authenticate, orgScope);

/**
 * @route   GET /api/v1/risk/summary
 * @desc    Get organization fleet risk aggregation summary
 * @access  viewer+
 */
router.get(
  '/summary',
  requireRole('viewer'),
  riskController.getFleetRiskSummary
);

module.exports = router;

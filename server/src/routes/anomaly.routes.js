const express = require('express');
const anomalyController = require('../controllers/anomaly.controller');
const authenticate = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { listAnomaliesQuerySchema } = require('../validators/anomalyRule.validator');

const router = express.Router();

// Enforce authentication and tenant scoping on all anomaly routes
router.use(authenticate, orgScope);

/**
 * @route   GET /api/v1/anomalies
 * @desc    List anomaly detection logs for organization with pagination & filters
 * @access  viewer+
 */
router.get(
  '/',
  requireRole('viewer'),
  validate(listAnomaliesQuerySchema, 'query'),
  anomalyController.getAnomalies
);

module.exports = router;

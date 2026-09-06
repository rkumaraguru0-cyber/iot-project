const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authenticate = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const { requireRole } = require('../middleware/rbac');

router.get(
  '/summary',
  authenticate,
  orgScope,
  requireRole('viewer'),
  dashboardController.getSummary
);

router.get(
  '/trends',
  authenticate,
  orgScope,
  requireRole('viewer'),
  dashboardController.getTrends
);

module.exports = router;

const express = require('express');
const anomalyRuleController = require('../controllers/anomalyRule.controller');
const authenticate = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const {
  createAnomalyRuleSchema,
  updateAnomalyRuleSchema,
  dryRunTestSchema,
  listRulesQuerySchema
} = require('../validators/anomalyRule.validator');

const router = express.Router();

// Enforce authentication and tenant scoping on all rules routes
router.use(authenticate, orgScope);

/**
 * @route   GET /api/v1/rules
 * @desc    List rules accessible to organization (System + Tenant)
 * @access  viewer+
 */
router.get(
  '/',
  requireRole('viewer'),
  validate(listRulesQuerySchema, 'query'),
  anomalyRuleController.listRules
);

/**
 * @route   POST /api/v1/rules/test
 * @desc    Dry-run evaluate a rule against sample telemetry (no persistence)
 * @access  operator+
 */
router.post(
  '/test',
  requireRole('operator'),
  validate(dryRunTestSchema),
  anomalyRuleController.testRule
);

/**
 * @route   GET /api/v1/rules/:id
 * @desc    Get rule by ID
 * @access  viewer+
 */
router.get(
  '/:id',
  requireRole('viewer'),
  anomalyRuleController.getRuleById
);

/**
 * @route   POST /api/v1/rules
 * @desc    Create custom tenant rule
 * @access  security_analyst+
 */
router.post(
  '/',
  requireRole('security_analyst'),
  validate(createAnomalyRuleSchema),
  anomalyRuleController.createRule
);

/**
 * @route   PATCH /api/v1/rules/:id
 * @desc    Update custom tenant rule (System rules are immutable)
 * @access  security_analyst+
 */
router.patch(
  '/:id',
  requireRole('security_analyst'),
  validate(updateAnomalyRuleSchema),
  anomalyRuleController.updateRule
);

/**
 * @route   DELETE /api/v1/rules/:id
 * @desc    Soft-delete custom tenant rule (System rules cannot be deleted)
 * @access  org_admin+
 */
router.delete(
  '/:id',
  requireRole('org_admin'),
  anomalyRuleController.deleteRule
);

module.exports = router;

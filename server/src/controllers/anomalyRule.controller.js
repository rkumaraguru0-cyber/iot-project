const anomalyService = require('../services/anomaly.service');
const logger = require('../utils/logger');

class AnomalyRuleController {
  /**
   * List all rules accessible to organization (System + Tenant)
   * GET /api/v1/rules
   */
  async listRules(req, res, next) {
    try {
      const result = await anomalyService.listRules(req.organizationId, req.query);
      res.status(200).json({
        rules: result.rules,
        total: result.total
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single rule by ID
   * GET /api/v1/rules/:id
   */
  async getRuleById(req, res, next) {
    try {
      const rule = await anomalyService.getRuleById(req.params.id, req.organizationId);
      res.status(200).json({ rule });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create custom tenant rule
   * POST /api/v1/rules
   */
  async createRule(req, res, next) {
    try {
      const newRule = await anomalyService.createTenantRule(req.organizationId, req.body, req.user);
      logger.info(`Tenant rule created: ${newRule.ruleId} by user ${req.user.email}`);
      res.status(201).json({
        message: 'Rule created successfully',
        rule: newRule
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update tenant rule
   * PATCH /api/v1/rules/:id
   */
  async updateRule(req, res, next) {
    try {
      const updated = await anomalyService.updateTenantRule(req.params.id, req.organizationId, req.body);
      logger.info(`Tenant rule updated: ${updated.ruleId} by user ${req.user.email}`);
      res.status(200).json({
        message: 'Rule updated successfully',
        rule: updated
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Soft-delete tenant rule
   * DELETE /api/v1/rules/:id
   */
  async deleteRule(req, res, next) {
    try {
      const result = await anomalyService.deleteTenantRule(req.params.id, req.organizationId);
      logger.info(`Tenant rule deleted: ${result.ruleId} by user ${req.user.email}`);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Dry-run rule evaluation against sample telemetry
   * POST /api/v1/rules/test
   */
  async testRule(req, res, next) {
    try {
      const result = anomalyService.dryRunEvaluateRule(req.body.rule, req.body.telemetry);
      res.status(200).json({
        evaluation: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AnomalyRuleController();

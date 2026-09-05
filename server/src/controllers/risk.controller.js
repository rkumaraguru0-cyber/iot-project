const riskService = require('../services/risk.service');

class RiskController {
  /**
   * Get device risk posture breakdown
   * GET /api/v1/devices/:id/risk
   */
  async getDeviceRisk(req, res, next) {
    try {
      const result = await riskService.getDeviceRisk(req.params.id, req.organizationId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get organization fleet risk summary
   * GET /api/v1/risk/summary
   */
  async getFleetRiskSummary(req, res, next) {
    try {
      const summary = await riskService.getFleetRiskSummary(req.organizationId);
      res.status(200).json({ summary });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RiskController();

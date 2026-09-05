const anomalyService = require('../services/anomaly.service');

class AnomalyController {
  /**
   * List anomaly detection logs for organization with pagination and filters
   * GET /api/v1/anomalies
   */
  async getAnomalies(req, res, next) {
    try {
      const result = await anomalyService.getAnomalies(req.organizationId, req.query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get anomaly logs for a specific device
   * GET /api/v1/devices/:id/anomalies
   */
  async getDeviceAnomalies(req, res, next) {
    try {
      const result = await anomalyService.getDeviceAnomalies(req.params.id, req.organizationId, req.query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AnomalyController();

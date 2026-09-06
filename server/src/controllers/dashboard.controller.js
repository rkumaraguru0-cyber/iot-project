const dashboardService = require('../services/dashboard.service');

/**
 * Get consolidated dashboard summary metrics (W1–W6, W8, W9)
 */
const getSummary = async (req, res, next) => {
  try {
    const result = await dashboardService.getSummary(req.organizationId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get multi-day anomaly trend data (W7)
 */
const getTrends = async (req, res, next) => {
  try {
    const days = req.query.days ? parseInt(req.query.days, 10) : 7;
    const result = await dashboardService.getTrends(req.organizationId, days);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSummary,
  getTrends
};

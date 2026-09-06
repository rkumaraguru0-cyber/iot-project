const mongoose = require('mongoose');
const { AuditLog } = require('../models');

class AuditLogService {
  /**
   * Retrieves paginated and filtered audit trail records for an organization.
   * Read-only, append-only persistence.
   *
   * @param {string} organizationId
   * @param {Object} queryParams
   * @returns {Promise<{ logs: Array, total: number, page: number, limit: number, totalPages: number }>}
   */
  async listAuditLogs(organizationId, queryParams = {}) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const filter = { organizationId: orgObjectId };

    if (queryParams.action) {
      filter.action = queryParams.action.trim();
    }

    if (queryParams.actor) {
      if (mongoose.Types.ObjectId.isValid(queryParams.actor)) {
        filter.actor = new mongoose.Types.ObjectId(queryParams.actor);
      } else {
        filter.actor = queryParams.actor.trim();
      }
    }

    if (queryParams.targetType) {
      filter.targetType = queryParams.targetType.trim();
    }

    if (queryParams.from || queryParams.to) {
      filter.timestamp = {};
      if (queryParams.from) {
        filter.timestamp.$gte = new Date(queryParams.from);
      }
      if (queryParams.to) {
        filter.timestamp.$lte = new Date(queryParams.to);
      }
    }

    if (queryParams.search) {
      const escaped = queryParams.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { action: { $regex: escaped, $options: 'i' } },
        { actorName: { $regex: escaped, $options: 'i' } },
        { targetType: { $regex: escaped, $options: 'i' } }
      ];
    }

    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter)
    ]);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}

module.exports = new AuditLogService();

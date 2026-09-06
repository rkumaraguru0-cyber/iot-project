const auditLogService = require('../services/auditLog.service');

/**
 * List paginated and filtered audit log entries for the organization
 */
const listAuditLogs = async (req, res, next) => {
  try {
    const result = await auditLogService.listAuditLogs(req.organizationId, req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listAuditLogs
};

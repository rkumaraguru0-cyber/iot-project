const { AuditLog } = require('../models');

/**
 * Creates an audit log entry for security-relevant actions
 * @param {Object} params
 * @param {string} params.action - e.g. 'device.registered', 'user.invited'
 * @param {string} params.actor - userId or 'system'
 * @param {string} [params.actorName] - display name of actor
 * @param {string} [params.actorIp] - IP address of actor
 * @param {string} params.targetType - e.g. 'device', 'user', 'organization'
 * @param {string|Object} params.targetId - ID of the target entity
 * @param {string|Object} params.organizationId - org context
 * @param {Object} [params.details] - before/after or contextual details
 */
const logAuditEvent = async ({
  action,
  actor,
  actorName = null,
  actorIp = null,
  targetType,
  targetId,
  organizationId,
  details = {}
}) => {
  try {
    await AuditLog.create({
      action,
      actor,
      actorName,
      actorIp,
      targetType,
      targetId,
      organizationId,
      details,
      timestamp: new Date()
    });
  } catch (error) {
    // Audit logging failures should not break the primary operation
    // Log to application logger but do not throw
    const logger = require('../utils/logger');
    logger.error('Failed to create audit log entry', {
      action,
      targetType,
      targetId,
      error: error.message
    });
  }
};

module.exports = { logAuditEvent };

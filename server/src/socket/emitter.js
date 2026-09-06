const { getSocketServer } = require('./index');
const logger = require('../utils/logger');

/**
 * Emits a newly detected critical/high security event to the tenant room.
 *
 * @param {string} orgId
 * @param {Object} data
 * @param {string} data.eventId
 * @param {string} data.severity
 * @param {string} data.category
 * @param {string|Object} data.deviceId
 * @param {string} [data.deviceName]
 * @param {string} data.explanation
 */
const emitSecurityEventNew = (orgId, data) => {
  const io = getSocketServer();
  if (!io || !orgId) return;

  const payload = {
    eventId: data.eventId,
    severity: data.severity,
    category: data.category,
    deviceId: typeof data.deviceId === 'object' && data.deviceId?._id
      ? data.deviceId._id.toString()
      : (data.deviceId ? data.deviceId.toString() : ''),
    deviceName: data.deviceName || 'IoT Device',
    explanation: data.explanation || ''
  };

  io.to(`org:${orgId.toString()}`).emit('security-event:new', payload);
  logger.debug(`[Socket.IO Emitter] Emitted 'security-event:new' to org:${orgId} for ${payload.eventId}`);
};

/**
 * Emits a new incident creation event to the tenant room.
 *
 * @param {string} orgId
 * @param {Object} data
 * @param {string} data.incidentId
 * @param {string} data.title
 * @param {string} data.severity
 * @param {string|Object} data.deviceId
 * @param {string} [data.deviceName]
 */
const emitIncidentNew = (orgId, data) => {
  const io = getSocketServer();
  if (!io || !orgId) return;

  const payload = {
    incidentId: data.incidentId,
    title: data.title,
    severity: data.severity,
    deviceId: typeof data.deviceId === 'object' && data.deviceId?._id
      ? data.deviceId._id.toString()
      : (data.deviceId ? data.deviceId.toString() : ''),
    deviceName: data.deviceName || 'IoT Device'
  };

  io.to(`org:${orgId.toString()}`).emit('incident:new', payload);
  logger.debug(`[Socket.IO Emitter] Emitted 'incident:new' to org:${orgId} for ${payload.incidentId}`);
};

/**
 * Emits an incident status or severity update to both the tenant room and specific incident room.
 *
 * @param {string} orgId
 * @param {string} incidentId
 * @param {Object} data
 * @param {string} data.status
 * @param {string} data.severity
 */
const emitIncidentUpdated = (orgId, incidentId, data) => {
  const io = getSocketServer();
  if (!io || !orgId || !incidentId) return;

  const payload = {
    incidentId,
    status: data.status,
    severity: data.severity
  };

  io.to(`incident:${incidentId}`).to(`org:${orgId.toString()}`).emit('incident:updated', payload);
  logger.debug(`[Socket.IO Emitter] Emitted 'incident:updated' to org:${orgId} & incident:${incidentId}`);
};

/**
 * Emits device status change to the tenant room when device becomes quarantined, offline, or decommissioned.
 *
 * @param {string} orgId
 * @param {Object} data
 * @param {string|Object} data.deviceId
 * @param {string} data.status
 * @param {string} [data.previousStatus]
 */
const emitDeviceStatusChanged = (orgId, data) => {
  const io = getSocketServer();
  if (!io || !orgId) return;

  const allowedStatuses = ['quarantined', 'offline', 'decommissioned'];
  if (!allowedStatuses.includes(data.status)) return;

  const payload = {
    deviceId: typeof data.deviceId === 'object' && data.deviceId?._id
      ? data.deviceId._id.toString()
      : (data.deviceId ? data.deviceId.toString() : ''),
    status: data.status,
    previousStatus: data.previousStatus || 'active'
  };

  io.to(`org:${orgId.toString()}`).emit('device:status-changed', payload);
  logger.debug(`[Socket.IO Emitter] Emitted 'device:status-changed' to org:${orgId} for ${payload.deviceId}`);
};

/**
 * Emits device risk escalation to the tenant room when risk score enters Critical or Severe bracket.
 *
 * @param {string} orgId
 * @param {Object} data
 * @param {string|Object} data.deviceId
 * @param {number} data.riskScore
 * @param {string} data.riskSeverity
 */
const emitDeviceRiskEscalated = (orgId, data) => {
  const io = getSocketServer();
  if (!io || !orgId) return;

  if (!['critical', 'severe'].includes(data.riskSeverity)) return;

  const payload = {
    deviceId: typeof data.deviceId === 'object' && data.deviceId?._id
      ? data.deviceId._id.toString()
      : (data.deviceId ? data.deviceId.toString() : ''),
    riskScore: data.riskScore,
    riskSeverity: data.riskSeverity
  };

  io.to(`org:${orgId.toString()}`).emit('device:risk-escalated', payload);
  logger.debug(`[Socket.IO Emitter] Emitted 'device:risk-escalated' to org:${orgId} for ${payload.deviceId}`);
};

/**
 * Emits a newly created user notification to the target user's personal room.
 *
 * @param {string} userId
 * @param {Object} data
 * @param {string|Object} data.notificationId
 * @param {string} data.type
 * @param {string} data.title
 * @param {string} data.severity
 */
const emitNotificationNew = (userId, data) => {
  const io = getSocketServer();
  if (!io || !userId) return;

  const payload = {
    notificationId: data.notificationId ? data.notificationId.toString() : (data._id ? data._id.toString() : ''),
    type: data.type,
    title: data.title,
    severity: data.severity
  };

  io.to(`user:${userId.toString()}`).emit('notification:new', payload);
  logger.debug(`[Socket.IO Emitter] Emitted 'notification:new' to user:${userId} for ${payload.notificationId}`);
};

module.exports = {
  emitSecurityEventNew,
  emitIncidentNew,
  emitIncidentUpdated,
  emitDeviceStatusChanged,
  emitDeviceRiskEscalated,
  emitNotificationNew
};

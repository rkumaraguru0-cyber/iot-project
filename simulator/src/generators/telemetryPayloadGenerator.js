const { generateMetrics } = require('./metricGenerator');

/**
 * Builds a standardized telemetry payload envelope conforming to the Telemetry model.
 * 
 * @param {Object} device - Device descriptor (deviceId, organizationId, type, status, etc.)
 * @param {Object} profile - Device profile definition
 * @param {Object} currentState - Current persistent device state
 * @param {Object} [options={}] - Options (timestamp, elapsedSeconds, randomFn)
 * @returns {{ payload: Object, stateUpdates: Object }}
 */
function buildTelemetryPayload(device, profile, currentState, options = {}) {
  if (!device || !device.deviceId) {
    throw new Error('Valid device descriptor with deviceId is required');
  }
  if (!profile) {
    throw new Error('Valid device profile is required');
  }
  if (!currentState) {
    throw new Error('Valid currentState is required');
  }

  const timestamp = options.timestamp instanceof Date
    ? options.timestamp.toISOString()
    : (typeof options.timestamp === 'string' ? options.timestamp : new Date().toISOString());

  const { metrics, stateUpdates } = generateMetrics(profile, currentState, options);

  const payload = {
    deviceId: device.deviceId,
    organizationId: device.organizationId || currentState.organizationId || 'default-org',
    timestamp,
    metrics,
    metadata: {
      ip: currentState.ip || device.ip || '192.168.1.100',
      firmware_version: currentState.firmware_version || device.firmwareVersion || '1.0.0',
      uptime: stateUpdates.uptime !== undefined ? stateUpdates.uptime : (currentState.uptime || 0)
    }
  };

  return {
    payload,
    stateUpdates
  };
}

module.exports = {
  buildTelemetryPayload
};

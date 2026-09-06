const { generateMetrics } = require('./metricGenerator');
const { applyAnomaly } = require('../anomalies/anomalyModifiers');

/**
 * Builds a standardized telemetry payload envelope conforming to the Telemetry model.
 * 
 * @param {Object} device - Device descriptor (deviceId, organizationId, type, status, etc.)
 * @param {Object} profile - Device profile definition
 * @param {Object} currentState - Current persistent device state
 * @param {Object} [options={}] - Options (timestamp, elapsedSeconds, randomFn, anomalyMode, metricOverrides, metadataOverrides, timestampOverride)
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

  let timestamp = options.timestamp instanceof Date
    ? options.timestamp.toISOString()
    : (typeof options.timestamp === 'string' ? options.timestamp : new Date().toISOString());

  if (options.timestampOverride) {
    timestamp = options.timestampOverride instanceof Date
      ? options.timestampOverride.toISOString()
      : String(options.timestampOverride);
  }

  let { metrics, stateUpdates } = generateMetrics(profile, currentState, options);

  let metadata = {
    ip: currentState.ip || device.ip || '192.168.1.100',
    firmware_version: currentState.firmware_version || device.firmwareVersion || '1.0.0',
    uptime: stateUpdates.uptime !== undefined ? stateUpdates.uptime : (currentState.uptime || 0)
  };

  // Apply explicit overrides from scenario / caller if present
  if (options.metricOverrides && typeof options.metricOverrides === 'object') {
    metrics = { ...metrics, ...options.metricOverrides };
  }
  if (options.metadataOverrides && typeof options.metadataOverrides === 'object') {
    metadata = { ...metadata, ...options.metadataOverrides };
  }

  // Apply configured anomaly mode mutation if present
  if (options.anomalyMode) {
    const anomalyResult = applyAnomaly(options.anomalyMode, { metrics, metadata }, profile, currentState, options);
    metrics = anomalyResult.metrics;
    metadata = anomalyResult.metadata;
  }

  const payload = {
    deviceId: device.deviceId,
    organizationId: device.organizationId || currentState.organizationId || 'default-org',
    timestamp,
    metrics,
    metadata
  };

  return {
    payload,
    stateUpdates
  };
}

module.exports = {
  buildTelemetryPayload
};

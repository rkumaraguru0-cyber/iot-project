const {
  applyThresholdAnomaly,
  applyNetworkSpikeAnomaly,
  applyImpossibleValueAnomaly,
  applyFirmwareTamperAnomaly,
  applyBorderlineSafeValues,
  createSeededRandom,
  applyAnomaly
} = require('./anomalyModifiers');

const SUPPORTED_ANOMALY_MODES = [
  'threshold',
  'network-spike',
  'impossible-value',
  'heartbeat',
  'auth-bruteforce',
  'firmware-tamper'
];

/**
 * Validates if the given string is a supported anomaly mode.
 * 
 * @param {string} mode
 * @returns {boolean}
 */
function isValidAnomalyMode(mode) {
  return typeof mode === 'string' && SUPPORTED_ANOMALY_MODES.includes(mode.toLowerCase().trim());
}

module.exports = {
  SUPPORTED_ANOMALY_MODES,
  isValidAnomalyMode,
  applyThresholdAnomaly,
  applyNetworkSpikeAnomaly,
  applyImpossibleValueAnomaly,
  applyFirmwareTamperAnomaly,
  applyBorderlineSafeValues,
  createSeededRandom,
  applyAnomaly
};

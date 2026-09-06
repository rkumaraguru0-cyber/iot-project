const { round, clamp } = require('../generators/math');

/**
 * Anomaly Modifiers for Simulator v2
 * Applies deterministic metric and metadata mutations conforming to PRD §11.5.
 */

/**
 * Applies 'threshold' anomaly mode:
 * CPU usage sustained at 92–98% (target RULE-CPU-HIGH / RULE-001).
 * 
 * @param {Object} metrics
 * @param {Object} profile
 * @param {Object} state
 * @param {Object} [options={}]
 * @returns {Object} mutated metrics
 */
function applyThresholdAnomaly(metrics, profile, state, options = {}) {
  const randomFn = options.randomFn || Math.random;
  const cpu = round(92.0 + (randomFn() * 6.0), 1); // 92.0 to 98.0
  return {
    ...metrics,
    cpu_usage: clamp(cpu, 92.0, 98.0)
  };
}

/**
 * Applies 'network-spike' anomaly mode:
 * network_out surges to 50x normal baseline (target RULE-004).
 * 
 * @param {Object} metrics
 * @param {Object} profile
 * @param {Object} state
 * @param {Object} [options={}]
 * @returns {Object} mutated metrics
 */
function applyNetworkSpikeAnomaly(metrics, profile, state, options = {}) {
  const profileNetOut = profile?.metrics?.network_out;
  const baseline = profileNetOut
    ? (profileNetOut.min + profileNetOut.max) / 2.0
    : (metrics.network_out || 300);

  const spiked = Math.round(baseline * 50);
  return {
    ...metrics,
    network_out: spiked
  };
}

/**
 * Applies 'impossible-value' anomaly mode:
 * Temperature reported as -300°C (< -273.15°C absolute zero, target RULE-010).
 * 
 * @param {Object} metrics
 * @param {Object} profile
 * @param {Object} state
 * @param {Object} [options={}]
 * @returns {Object} mutated metrics
 */
function applyImpossibleValueAnomaly(metrics, profile, state, options = {}) {
  return {
    ...metrics,
    temperature: -300.0
  };
}

/**
 * Applies 'firmware-tamper' anomaly mode:
 * metadata.firmware_version set to '9.9.9-tampered' (target RULE-007).
 * 
 * @param {Object} metadata
 * @param {Object} profile
 * @param {Object} state
 * @param {Object} [options={}]
 * @returns {Object} mutated metadata
 */
function applyFirmwareTamperAnomaly(metadata, profile, state, options = {}) {
  return {
    ...metadata,
    firmware_version: '9.9.9-tampered'
  };
}

/**
 * Evaluates and applies the configured anomaly mode to payload data (metrics and metadata).
 * 
 * @param {string} anomalyMode - 'threshold' | 'network-spike' | 'impossible-value' | 'firmware-tamper' | 'heartbeat' | 'auth-bruteforce'
 * @param {Object} payloadData - { metrics: Object, metadata: Object }
 * @param {Object} profile - Device profile definition
 * @param {Object} state - Current device state
 * @param {Object} [options={}]
 * @returns {{ metrics: Object, metadata: Object, isSuppressed?: boolean }}
 */
function applyAnomaly(anomalyMode, payloadData, profile, state, options = {}) {
  if (!anomalyMode || anomalyMode === 'none') {
    return payloadData;
  }

  let metrics = { ...(payloadData.metrics || {}) };
  let metadata = { ...(payloadData.metadata || {}) };

  switch (anomalyMode) {
    case 'threshold':
      metrics = applyThresholdAnomaly(metrics, profile, state, options);
      break;

    case 'network-spike':
      metrics = applyNetworkSpikeAnomaly(metrics, profile, state, options);
      break;

    case 'impossible-value':
      metrics = applyImpossibleValueAnomaly(metrics, profile, state, options);
      break;

    case 'firmware-tamper':
      metadata = applyFirmwareTamperAnomaly(metadata, profile, state, options);
      break;

    case 'heartbeat':
      // Transmission suppression is handled by FleetSimulator scheduler
      return {
        metrics,
        metadata,
        isSuppressed: true
      };

    case 'auth-bruteforce':
      // Auth failures are executed via transport layer
      break;

    default:
      // Unknown mode; leave unchanged
      break;
  }

  return {
    metrics,
    metadata,
    isSuppressed: false
  };
}

/**
 * Applies borderline safe metric values for false positive validation (Scenario 6).
 * Safe ranges strictly below alert thresholds:
 * - CPU: 80.0–84.0% (< 85% rule threshold)
 * - Temperature: 55.0–58.0°C (< 60°C critical threshold)
 * - Memory: 85.0–88.0% (< 90% rule threshold)
 * - Battery: 20.0–25.0% (> 15% low battery threshold)
 * 
 * @param {Object} metrics
 * @param {Object} profile
 * @param {Object} state
 * @param {Object} [options={}]
 * @returns {Object} mutated metrics
 */
function applyBorderlineSafeValues(metrics, profile, state, options = {}) {
  const randomFn = options.randomFn || Math.random;
  const cpu = round(80.0 + (randomFn() * 4.0), 1);
  const temp = round(55.0 + (randomFn() * 3.0), 1);
  const mem = round(85.0 + (randomFn() * 3.0), 1);
  const bat = round(20.0 + (randomFn() * 5.0), 1);

  return {
    ...metrics,
    cpu_usage: clamp(cpu, 80.0, 84.0),
    temperature: clamp(temp, 55.0, 58.0),
    memory_usage: clamp(mem, 85.0, 88.0),
    battery_level: clamp(bat, 20.0, 25.0)
  };
}

/**
 * Creates a deterministic pseudo-random number generator (Mulberry32).
 * 
 * @param {number} [seed=12345]
 * @returns {Function} Function returning float in [0, 1)
 */
function createSeededRandom(seed = 12345) {
  let s = Math.floor(Math.abs(seed)) || 1;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t >>> 0) / 4294967296);
  };
}

module.exports = {
  applyThresholdAnomaly,
  applyNetworkSpikeAnomaly,
  applyImpossibleValueAnomaly,
  applyFirmwareTamperAnomaly,
  applyBorderlineSafeValues,
  createSeededRandom,
  applyAnomaly
};

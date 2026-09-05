const temperatureSensor = require('./temperatureSensor');
const smartCamera = require('./smartCamera');
const industrialGateway = require('./industrialGateway');
const medicalMonitor = require('./medicalMonitor');
const smartLock = require('./smartLock');

const PROFILES = {
  temperature_sensor: temperatureSensor,
  smart_camera: smartCamera,
  industrial_gateway: industrialGateway,
  medical_monitor: medicalMonitor,
  smart_lock: smartLock
};

/**
 * Retrieves a device profile definition by type.
 * @param {string} type - Device type name (e.g., 'temperature_sensor')
 * @returns {Object|null} The profile definition or null if not supported
 */
function getProfile(type) {
  if (!type || typeof type !== 'string') {
    return null;
  }
  return PROFILES[type.toLowerCase()] || null;
}

/**
 * Returns all supported profile keys.
 * @returns {string[]}
 */
function getSupportedProfileTypes() {
  return Object.keys(PROFILES);
}

module.exports = {
  PROFILES,
  getProfile,
  getSupportedProfileTypes
};

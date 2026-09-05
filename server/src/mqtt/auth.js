const { Device } = require('../models');
const { hashToken } = require('../utils/token');
const logger = require('../utils/logger');

/**
 * Aedes authentication hook for IoT device clients.
 * Authenticates username (deviceId) and password (rawApiKey) against Device.apiKeyHash.
 * 
 * @param {Object} client - Aedes client instance
 * @param {string} username - Device ID (e.g. DEV-TS-A1B2C3)
 * @param {Buffer|string} password - Raw 256-bit API key
 * @param {Function} callback - Aedes callback(error, success)
 */
async function authenticateMqttClient(client, username, password, callback) {
  try {
    if (!username || !password) {
      logger.warn(`[MQTT Auth] Connection rejected: Missing username or password (client ID: ${client.id})`);
      const err = new Error('Missing username or password');
      err.returnCode = 4; // Bad user name or password
      return callback(err, false);
    }

    const deviceId = username.toString().trim().toUpperCase();
    const rawApiKey = password.toString('utf8').trim();
    const apiKeyHash = hashToken(rawApiKey);

    const device = await Device.findOne({
      deviceId,
      apiKeyHash
    }).populate('organizationId', 'slug name');

    if (!device) {
      logger.warn(`[MQTT Auth] Authentication failed for deviceId '${deviceId}' (client ID: ${client.id})`);
      const err = new Error('Invalid device credentials');
      err.returnCode = 4;
      return callback(err, false);
    }

    if (device.status === 'decommissioned') {
      logger.warn(`[MQTT Auth] Connection rejected: Device '${deviceId}' is decommissioned`);
      const err = new Error('Device is decommissioned');
      err.returnCode = 5; // Not authorized
      return callback(err, false);
    }

    if (!device.organizationId || !device.organizationId.slug) {
      logger.error(`[MQTT Auth] Device '${deviceId}' belongs to invalid organization`);
      const err = new Error('Device has no associated organization');
      err.returnCode = 5;
      return callback(err, false);
    }

    // Attach authenticated session context to client
    client.session = {
      _id: device._id,
      deviceId: device.deviceId,
      organizationId: device.organizationId._id || device.organizationId,
      orgSlug: device.organizationId.slug,
      expectedReportingInterval: device.expectedReportingInterval,
      status: device.status
    };

    logger.info(`[MQTT Auth] Device '${deviceId}' (${device.organizationId.slug}) authenticated successfully`);
    return callback(null, true);
  } catch (error) {
    logger.error(`[MQTT Auth] Error during device authentication: ${error.message}`);
    const err = new Error('Internal authentication error');
    err.returnCode = 2; // Identifier rejected / internal error
    return callback(err, false);
  }
}

module.exports = {
  authenticateMqttClient,
  createAedesAuth: () => authenticateMqttClient
};

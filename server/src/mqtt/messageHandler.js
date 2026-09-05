const telemetryService = require('../services/telemetry.service');
const { Device } = require('../models');
const logger = require('../utils/logger');

const RATE_LIMIT_WINDOW_MS = 1000; // 1 second
const MAX_MESSAGES_PER_SEC = 10;

/**
 * Checks client message rate limiting.
 * @param {Object} client
 * @returns {boolean} True if allowed, False if rate limited
 */
function checkClientMessageRate(client) {
  const now = Date.now();
  if (!client._rateLimitWindowStart || (now - client._rateLimitWindowStart) >= RATE_LIMIT_WINDOW_MS) {
    client._rateLimitWindowStart = now;
    client._messageCountInWindow = 1;
    return true;
  }

  client._messageCountInWindow = (client._messageCountInWindow || 0) + 1;
  return client._messageCountInWindow <= MAX_MESSAGES_PER_SEC;
}

/**
 * Handles incoming published MQTT telemetry messages.
 * 
 * @param {Object} packet - MQTT publish packet
 * @param {Object} client - Aedes client instance
 */
async function handleMqttTelemetryPublish(packet, client) {
  // Ignore broker internal packets or packets with no authenticated client
  if (!client || !client.session || packet.topic.startsWith('$')) {
    return;
  }

  // Rate limiting check
  if (!checkClientMessageRate(client)) {
    logger.warn(`[MQTT Ingest] Rate limit exceeded for device '${client.session.deviceId}' (> ${MAX_MESSAGES_PER_SEC} msg/sec). Message dropped.`);
    return;
  }

  try {
    const rawPayloadString = packet.payload ? packet.payload.toString('utf8') : '';
    let parsedPayload;

    try {
      parsedPayload = JSON.parse(rawPayloadString);
    } catch (jsonErr) {
      logger.warn(`[MQTT Ingest] Malformed JSON received from device '${client.session.deviceId}': ${jsonErr.message}`);
      
      // Increment device malformed message counter
      if (client.session._id) {
        await Device.updateOne(
          { _id: client.session._id },
          { $inc: { malformedMessageCount: 1 } }
        ).catch(() => {});
      }
      return;
    }

    // Ingest through unified telemetry service
    const result = await telemetryService.ingestTelemetry(client.session, parsedPayload);

    if (result.isDuplicate) {
      logger.debug(`[MQTT Ingest] Duplicate telemetry deduplicated for '${client.session.deviceId}' at ${result.timestamp}`);
    } else {
      logger.info(`[MQTT Ingest] Telemetry stored for '${client.session.deviceId}' (${client.session.orgSlug}) [id: ${result.id}]`);
    }
  } catch (err) {
    logger.error(`[MQTT Ingest] Error processing telemetry packet from '${client.session?.deviceId}': ${err.message}`);
  }
}

module.exports = {
  handleMqttTelemetryPublish,
  createMessageHandler: () => handleMqttTelemetryPublish
};

const { parseTopic } = require('./topicParser');
const logger = require('../utils/logger');

/**
 * Aedes authorizePublish hook.
 * Enforces strict topic authorization: {orgSlug}/devices/{deviceId}/telemetry
 * 
 * @param {Object} client
 * @param {Object} packet
 * @param {Function} callback
 */
function authorizePublish(client, packet, callback) {
  // Allow internal server/broker publications
  if (!client) {
    return callback(null);
  }

  if (!client.session || !client.session.deviceId || !client.session.orgSlug) {
    logger.warn(`[MQTT Authz] Publish rejected: Unauthenticated client session (client ID: ${client.id})`);
    return callback(new Error('Client session unauthenticated'));
  }

  const topicResult = parseTopic(packet.topic);
  if (!topicResult.isValid) {
    logger.warn(`[MQTT Authz] Publish rejected: ${topicResult.reason} (topic: '${packet.topic}', client: ${client.id})`);
    return callback(new Error(`Invalid topic: ${topicResult.reason}`));
  }

  const { orgSlug, deviceId, action } = topicResult;

  // Verify tenant organization match
  if (orgSlug !== client.session.orgSlug.toLowerCase()) {
    logger.warn(`[MQTT Authz] Cross-tenant publish blocked: Client org '${client.session.orgSlug}' attempted publish to '${orgSlug}'`);
    return callback(new Error('Cross-tenant publishing is forbidden'));
  }

  // Verify device ID match
  if (deviceId !== client.session.deviceId.toUpperCase()) {
    logger.warn(`[MQTT Authz] Impersonation publish blocked: Client device '${client.session.deviceId}' attempted publish as '${deviceId}'`);
    return callback(new Error('Device impersonation is forbidden'));
  }

  // Verify action is telemetry
  if (action !== 'telemetry') {
    logger.warn(`[MQTT Authz] Unauthorized action '${action}' on topic '${packet.topic}'`);
    return callback(new Error(`Action '${action}' not supported in Phase 6`));
  }

  return callback(null);
}

/**
 * Aedes authorizeSubscribe hook.
 * In Phase 6, device clients are ingest-only; subscriptions and wildcards are rejected.
 * 
 * @param {Object} client
 * @param {Object} sub
 * @param {Function} callback
 */
function authorizeSubscribe(client, sub, callback) {
  if (!client) {
    return callback(null, sub);
  }

  logger.warn(`[MQTT Authz] Subscription rejected: Device clients cannot subscribe in Phase 6 (topic: '${sub.topic}', client: ${client.id})`);
  return callback(new Error('Client subscriptions are not permitted in Phase 6'));
}

module.exports = {
  authorizePublish,
  authorizeSubscribe,
  createTopicAuthorizer: () => ({ authorizePublish, authorizeSubscribe })
};

/**
 * Parses and validates MQTT topics for the IoT platform.
 * Canonical format: {orgSlug}/devices/{deviceId}/telemetry
 * 
 * @param {string} topic - The MQTT topic string
 * @returns {{ isValid: boolean, orgSlug?: string, deviceId?: string, action?: string, reason?: string }}
 */
function parseTopic(topic) {
  if (!topic || typeof topic !== 'string') {
    return { isValid: false, reason: 'Topic must be a non-empty string' };
  }

  // Reject wildcards or invalid characters
  if (topic.includes('+') || topic.includes('#') || topic.startsWith('$')) {
    return { isValid: false, reason: 'Wildcards and internal topics are not permitted' };
  }

  const parts = topic.split('/');
  if (parts.length !== 4) {
    return { isValid: false, reason: 'Topic must contain exactly 4 segments: {orgSlug}/devices/{deviceId}/{action}' };
  }

  const [orgSlug, devicesLiteral, deviceId, action] = parts;

  if (devicesLiteral !== 'devices') {
    return { isValid: false, reason: "Second segment must be 'devices'" };
  }

  if (!orgSlug || !/^[a-z0-9-]+$/.test(orgSlug)) {
    return { isValid: false, reason: 'Invalid organization slug format' };
  }

  if (!deviceId || !/^[A-Z0-9_-]+$/i.test(deviceId)) {
    return { isValid: false, reason: 'Invalid deviceId format' };
  }

  if (action !== 'telemetry') {
    return { isValid: false, reason: "Action segment must be 'telemetry' in Phase 6" };
  }

  return {
    isValid: true,
    orgSlug: orgSlug.toLowerCase(),
    deviceId: deviceId.toUpperCase(),
    action
  };
}

function parseTelemetryTopic(topic) {
  const res = parseTopic(topic);
  if (!res.isValid) return null;
  return { orgSlug: res.orgSlug, deviceId: res.deviceId };
}

function isTelemetryTopic(topic) {
  return parseTopic(topic).isValid;
}

module.exports = {
  parseTopic,
  parseTelemetryTopic,
  isTelemetryTopic
};

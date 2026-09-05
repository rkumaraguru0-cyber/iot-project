const Joi = require('joi');

const MAX_PAYLOAD_BYTES = 10 * 1024; // 10 KB
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // ±5 minutes

/**
 * Pure JavaScript validator for telemetry payloads (used by both MQTT and REST).
 * 
 * @param {Object} payload
 * @returns {{ isValid: boolean, error?: string, sanitized?: Object }}
 */
function validateTelemetryPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { isValid: false, error: 'Payload must be a non-null JSON object' };
  }

  // Size limit validation
  try {
    const serialized = JSON.stringify(payload);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) {
      return { isValid: false, error: 'Payload exceeds maximum allowed size of 10 KB' };
    }
  } catch (err) {
    return { isValid: false, error: 'Payload serialization error' };
  }

  // Timestamp validation
  if (!payload.timestamp) {
    return { isValid: false, error: 'Field "timestamp" is required' };
  }

  const timestampDate = new Date(payload.timestamp);
  if (Number.isNaN(timestampDate.getTime())) {
    return { isValid: false, error: 'Field "timestamp" must be a valid ISO-8601 date string' };
  }

  const now = Date.now();
  const reportedTime = timestampDate.getTime();
  if (Math.abs(now - reportedTime) > TIMESTAMP_WINDOW_MS) {
    return { isValid: false, error: 'Timestamp must be within ±5 minutes of server time' };
  }

  // Metrics validation
  if (!payload.metrics || typeof payload.metrics !== 'object' || Array.isArray(payload.metrics)) {
    return { isValid: false, error: 'Field "metrics" must be a non-empty object' };
  }

  const metricKeys = Object.keys(payload.metrics);
  if (metricKeys.length === 0) {
    return { isValid: false, error: 'Field "metrics" must contain at least one metric key-value pair' };
  }

  for (const key of metricKeys) {
    const val = payload.metrics[key];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      return { isValid: false, error: `Metric "${key}" must be a finite number` };
    }
  }

  // Metadata validation (optional)
  if (payload.metadata !== undefined && payload.metadata !== null) {
    if (typeof payload.metadata !== 'object' || Array.isArray(payload.metadata)) {
      return { isValid: false, error: 'Field "metadata" must be an object' };
    }
  }

  return {
    isValid: true,
    sanitized: {
      timestamp: timestampDate,
      metrics: payload.metrics,
      metadata: payload.metadata || {}
    }
  };
}

// Joi schemas for REST routes
const ingestTelemetrySchema = Joi.object({
  deviceId: Joi.string().trim().uppercase().optional(),
  timestamp: Joi.date().iso().required().messages({
    'date.base': 'Timestamp must be a valid ISO-8601 date string',
    'any.required': 'Timestamp is required'
  }),
  metrics: Joi.object().min(1).pattern(
    Joi.string(),
    Joi.number().strict().messages({
      'number.base': 'Metric value must be a valid finite number'
    })
  ).required().messages({
    'object.base': 'Metrics must be a non-empty key-value object',
    'object.min': 'Metrics must contain at least one metric',
    'any.required': 'Metrics is required'
  }),
  metadata: Joi.object({
    ip: Joi.string().ip({ version: ['ipv4', 'ipv6'] }).allow('', null).optional(),
    firmware_version: Joi.string().trim().allow('', null).optional(),
    firmwareVersion: Joi.string().trim().allow('', null).optional(),
    uptime: Joi.number().min(0).allow(null).optional()
  }).optional()
});

const getTelemetryQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(500).default(50),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  sort: Joi.string().valid('asc', 'desc').default('desc')
});

module.exports = {
  validateTelemetryPayload,
  ingestTelemetrySchema,
  getTelemetryQuerySchema,
  MAX_PAYLOAD_BYTES,
  TIMESTAMP_WINDOW_MS
};

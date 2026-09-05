const { Device } = require('../models');
const { hashToken } = require('../utils/token');
const telemetryService = require('../services/telemetry.service');

/**
 * Ingest telemetry via REST fallback endpoint.
 * Authenticates via X-Device-API-Key header.
 */
const ingestTelemetry = async (req, res, next) => {
  try {
    const rawApiKey = req.headers['x-device-api-key'];
    if (!rawApiKey) {
      const err = new Error('Missing X-Device-API-Key header');
      err.code = 'DEVICE_API_KEY_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    const apiKeyHash = hashToken(rawApiKey.trim());
    const device = await Device.findOne({ apiKeyHash });

    if (!device) {
      const err = new Error('Invalid device API key');
      err.code = 'INVALID_DEVICE_CREDENTIALS';
      err.statusCode = 401;
      throw err;
    }

    if (device.status === 'decommissioned') {
      const err = new Error('Decommissioned devices cannot submit telemetry');
      err.code = 'DEVICE_DECOMMISSIONED';
      err.statusCode = 403;
      throw err;
    }

    const result = await telemetryService.ingestTelemetry(device, req.body);

    if (result.isDuplicate) {
      return res.status(200).json({
        received: true,
        status: 'duplicate',
        message: 'Duplicate telemetry ignored',
        deviceId: device.deviceId,
        timestamp: result.timestamp
      });
    }

    return res.status(201).json({
      received: true,
      status: 'stored',
      id: result.id,
      deviceId: device.deviceId,
      timestamp: result.telemetry.timestamp
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recent telemetry time-series for a device.
 * Tenant-scoped and RBAC-protected.
 */
const getDeviceTelemetry = async (req, res, next) => {
  try {
    const result = await telemetryService.getDeviceTelemetry(
      req.params.id,
      req.organizationId,
      req.query
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  ingestTelemetry,
  getDeviceTelemetry
};

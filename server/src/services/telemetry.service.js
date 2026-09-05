const crypto = require('crypto');
const mongoose = require('mongoose');
const { Telemetry, Device } = require('../models');
const { validateTelemetryPayload } = require('../validators/telemetry.validator');
const anomalyService = require('./anomaly.service');
const logger = require('../utils/logger');

const DEDUP_CACHE_LIMIT = 10000;
const DEDUP_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class TelemetryService {
  constructor() {
    // In-memory deduplication cache: Map<fingerprint, timestamp>
    this.dedupCache = new Map();
  }

  /**
   * Generates a deterministic SHA-256 fingerprint for duplicate detection.
   * @param {string} deviceId
   * @param {string|Date} timestamp
   * @param {Object} metrics
   * @returns {string} SHA-256 hex string
   */
  computeFingerprint(deviceId, timestamp, metrics) {
    const dev = (deviceId || '').toString().toUpperCase();
    const ts = new Date(timestamp).toISOString();
    
    // Sort metric keys deterministically
    const sortedKeys = Object.keys(metrics || {}).sort();
    const sortedObj = {};
    for (const key of sortedKeys) {
      sortedObj[key] = metrics[key];
    }
    const sortedMetricsJson = JSON.stringify(sortedObj);

    return crypto
      .createHash('sha256')
      .update(`${dev}:${ts}:${sortedMetricsJson}`)
      .digest('hex');
  }

  /**
   * Checks if fingerprint is in cache and valid; if not, adds to cache.
   * @param {string} fingerprint
   * @returns {boolean} True if duplicate, False if new
   */
  checkAndRecordDuplicate(fingerprint) {
    const now = Date.now();

    // Evict expired entries if cache is large
    if (this.dedupCache.size >= DEDUP_CACHE_LIMIT) {
      this.evictExpiredEntries(now);
    }

    const cachedTime = this.dedupCache.get(fingerprint);
    if (cachedTime && (now - cachedTime) < DEDUP_CACHE_TTL_MS) {
      return true;
    }

    this.dedupCache.set(fingerprint, now);
    return false;
  }

  /**
   * Evicts expired deduplication entries.
   * @param {number} now
   */
  evictExpiredEntries(now = Date.now()) {
    for (const [key, timestamp] of this.dedupCache.entries()) {
      if (now - timestamp >= DEDUP_CACHE_TTL_MS) {
        this.dedupCache.delete(key);
      }
    }
  }

  /**
   * Clears the in-memory deduplication cache (for testing).
   */
  clearDeduplicationCache() {
    this.dedupCache.clear();
  }

  /**
   * Calculates device health status based on recency of telemetry.
   * @param {Date|string|null} lastSeenAt
   * @param {number} expectedReportingInterval - In seconds
   * @param {number|Date} [currentTime=Date.now()]
   * @returns {'healthy'|'degraded'|'offline'|'unknown'}
   */
  calculateHealthStatus(lastSeenAt, expectedReportingInterval = 30, currentTime = Date.now()) {
    if (!lastSeenAt) {
      return 'unknown';
    }

    const lastSeenDate = new Date(lastSeenAt);
    if (Number.isNaN(lastSeenDate.getTime())) {
      return 'unknown';
    }

    const currentMs = currentTime instanceof Date ? currentTime.getTime() : currentTime;
    const expected = Math.max(1, expectedReportingInterval || 30);
    const ageSeconds = (currentMs - lastSeenDate.getTime()) / 1000;

    if (ageSeconds < 0) {
      return 'healthy'; // Future within skew window is considered healthy
    }

    if (ageSeconds <= expected) {
      return 'healthy';
    }

    if (ageSeconds <= expected * 3) {
      return 'degraded';
    }

    return 'offline';
  }

  /**
   * Alias for calculateHealthStatus per Section 12 requirements.
   */
  calculateDeviceHealth(lastSeenAt, expectedReportingInterval = 30, currentTime = Date.now()) {
    return this.calculateHealthStatus(lastSeenAt, expectedReportingInterval, currentTime);
  }

  /**
   * Ingests a telemetry payload for an authenticated device.
   * 
   * @param {Object} deviceOrContext
   * @param {Object} [rawPayload]
   * @returns {Promise<{ status: string, isDuplicate: boolean, id?: string, telemetry?: Object }>}
   */
  async ingestTelemetry(deviceOrContext, rawPayload) {
    const deviceContext = deviceOrContext && deviceOrContext.device ? deviceOrContext.device : deviceOrContext;
    const payload = rawPayload !== undefined ? rawPayload : (deviceOrContext && deviceOrContext.payload ? deviceOrContext.payload : null);

    if (!deviceContext || !deviceContext._id) {
      const err = new Error('Invalid device context for telemetry ingestion');
      err.code = 'INVALID_DEVICE_CONTEXT';
      err.statusCode = 401;
      throw err;
    }

    if (deviceContext.status === 'decommissioned') {
      const err = new Error('Decommissioned devices cannot submit telemetry');
      err.code = 'DEVICE_DECOMMISSIONED';
      err.statusCode = 403;
      throw err;
    }

    // 1. Validate payload schema, timestamp window, and metric types
    const validation = validateTelemetryPayload(payload);
    if (!validation.isValid) {
      // Increment device malformed message count
      try {
        if (Device.updateOne) {
          await Device.updateOne(
            { _id: deviceContext._id },
            { $inc: { malformedMessageCount: 1 } }
          );
        }
      } catch (err) {
        logger.warn(`Failed to increment malformedMessageCount: ${err.message}`);
      }

      const err = new Error(validation.error);
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    const { sanitized } = validation;

    // 2. Check deduplication
    const fingerprint = this.computeFingerprint(
      deviceContext.deviceId,
      sanitized.timestamp,
      sanitized.metrics
    );

    if (this.checkAndRecordDuplicate(fingerprint)) {
      logger.debug(`Duplicate telemetry dropped for device ${deviceContext.deviceId} at ${sanitized.timestamp.toISOString()}`);
      return {
        status: 'duplicate',
        isDuplicate: true,
        deviceId: deviceContext.deviceId,
        timestamp: sanitized.timestamp.toISOString()
      };
    }

    // 3. Persist Telemetry document in MongoDB
    const metadata = {
      ip: (sanitized.metadata && (sanitized.metadata.ip || null)) || null,
      firmware_version: (sanitized.metadata && (sanitized.metadata.firmware_version || sanitized.metadata.firmwareVersion || null)) || null,
      uptime: (sanitized.metadata && typeof sanitized.metadata.uptime === 'number' ? sanitized.metadata.uptime : null)
    };

    const orgId = deviceContext.organizationId?._id || deviceContext.organizationId;
    const telemetryDoc = await Telemetry.create({
      deviceId: deviceContext._id,
      organizationId: orgId,
      timestamp: sanitized.timestamp,
      metrics: sanitized.metrics,
      metadata,
      receivedAt: new Date()
    });

    // 4. Update Device lastSeenAt and recalculate healthStatus
    const healthStatus = this.calculateHealthStatus(
      sanitized.timestamp,
      deviceContext.expectedReportingInterval
    );

    try {
      if (Device.updateOne) {
        await Device.updateOne(
          { _id: deviceContext._id },
          {
            $set: {
              lastSeenAt: sanitized.timestamp,
              healthStatus
            }
          }
        );
      }
    } catch (err) {
      logger.warn(`Failed to update device lastSeen: ${err.message}`);
    }

    const docObj = telemetryDoc && typeof telemetryDoc.toObject === 'function' ? telemetryDoc.toObject() : telemetryDoc;

    // 5. Non-blocking Phase 7 Anomaly Processing
    setImmediate(() => {
      try {
        anomalyService.processTelemetry(deviceContext, docObj || telemetryDoc).catch((err) => {
          logger.error(`[Anomaly Engine] Non-blocking anomaly evaluation failed: ${err.message}`);
        });
      } catch (err) {
        logger.error(`[Anomaly Engine] Non-blocking dispatch failed: ${err.message}`);
      }
    });

    return {
      status: 'stored',
      isDuplicate: false,
      id: telemetryDoc?._id?.toString() || 'stored',
      telemetry: docObj
    };
  }

  /**
   * Queries telemetry time-series for a device within a tenant organization.
   * 
   * @param {string} deviceIdOrMongoId
   * @param {string} organizationId
   * @param {Object} queryParams
   * @returns {Promise<{ telemetry: Array, total: number, device: Object }>}
   */
  async getDeviceTelemetry(deviceIdOrMongoId, organizationId, queryParams = {}) {
    const isObjectId = mongoose.Types.ObjectId.isValid(deviceIdOrMongoId);
    const targetOrgId = organizationId ? (organizationId._id || organizationId) : null;
    const deviceFilter = {
      organizationId: targetOrgId
    };

    if (isObjectId) {
      deviceFilter._id = deviceIdOrMongoId;
    } else {
      deviceFilter.deviceId = (deviceIdOrMongoId || '').toString().toUpperCase();
    }

    const deviceQuery = Device.findOne(deviceFilter);
    let device;
    if (deviceQuery && typeof deviceQuery.select === 'function') {
      const selected = deviceQuery.select('-apiKeyHash');
      device = selected && typeof selected.lean === 'function' ? await selected.lean() : await selected;
    } else {
      device = await deviceQuery;
    }

    if (!device) {
      const err = new Error('Device not found');
      err.code = 'DEVICE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const limit = Math.min(500, Math.max(1, parseInt(queryParams.limit, 10) || 50));
    const sortOrder = queryParams.sort === 'asc' ? 1 : -1;

    const telemetryFilter = {
      deviceId: device._id,
      organizationId: device.organizationId
    };

    if (queryParams.from || queryParams.to) {
      telemetryFilter.timestamp = {};
      if (queryParams.from) telemetryFilter.timestamp.$gte = new Date(queryParams.from);
      if (queryParams.to) telemetryFilter.timestamp.$lte = new Date(queryParams.to);
    }

    let telemetry = [];
    let total = 0;

    const findQuery = Telemetry.find(telemetryFilter);
    if (findQuery && typeof findQuery.sort === 'function') {
      const sorted = findQuery.sort({ timestamp: sortOrder });
      const limited = sorted && typeof sorted.limit === 'function' ? sorted.limit(limit) : sorted;
      telemetry = limited && typeof limited.lean === 'function' ? await limited.lean() : await limited;
    } else if (findQuery && typeof findQuery.limit === 'function') {
      const limited = findQuery.limit(limit);
      const sorted = limited && typeof limited.sort === 'function' ? limited.sort({ timestamp: sortOrder }) : limited;
      telemetry = sorted && typeof sorted.lean === 'function' ? await sorted.lean() : await sorted;
    } else if (findQuery) {
      telemetry = await findQuery;
    }

    if (Telemetry.countDocuments) {
      try {
        total = await Telemetry.countDocuments(telemetryFilter);
      } catch (e) {
        total = Array.isArray(telemetry) ? telemetry.length : 0;
      }
    } else {
      total = Array.isArray(telemetry) ? telemetry.length : 0;
    }

    return {
      telemetry: Array.isArray(telemetry) ? telemetry : [],
      total: typeof total === 'number' ? total : 0,
      limit,
      device: {
        id: device._id,
        deviceId: device.deviceId,
        name: device.name,
        type: device.type,
        healthStatus: device.healthStatus,
        lastSeenAt: device.lastSeenAt
      }
    };
  }
}

module.exports = new TelemetryService();

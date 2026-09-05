const crypto = require('crypto');
const mongoose = require('mongoose');
const { SecurityEvent, Device } = require('../models');
const riskService = require('./risk.service');
const correlationService = require('./correlation.service');
const logger = require('../utils/logger');
const { ROLE_HIERARCHY } = require('../middleware/rbac');

const AGGREGATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

class SecurityEventService {
  /**
   * Generates a unique, human-readable Event ID: EVT-YYYYMMDD-HEX6
   * @returns {string}
   */
  generateEventId() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `EVT-${dateStr}-${randomHex}`;
  }

  /**
   * Ingests a Phase 7 Anomaly detection record, performs atomic aggregation or creation,
   * and triggers non-blocking risk recalculation.
   * 
   * @param {Object} anomalyRecord - Persisted Anomaly document
   * @returns {Promise<Object>}
   */
  async processAnomaly(anomalyRecord) {
    if (!anomalyRecord || !anomalyRecord.deviceId || !anomalyRecord.organizationId) {
      return null;
    }

    try {
      const orgId = anomalyRecord.organizationId?._id || anomalyRecord.organizationId;
      const devId = anomalyRecord.deviceId?._id || anomalyRecord.deviceId;
      const timestamp = anomalyRecord.detectedAt
        ? new Date(anomalyRecord.detectedAt)
        : (anomalyRecord.timestamp ? new Date(anomalyRecord.timestamp) : new Date());
      const oneHourAgo = new Date(timestamp.getTime() - AGGREGATION_WINDOW_MS);

      // 1. Atomic Aggregation Check: Check for active event within the 1-hour window
      const updatedEvent = await SecurityEvent.findOneAndUpdate(
        {
          organizationId: orgId,
          deviceId: devId,
          ruleId: anomalyRecord.ruleId,
          status: { $in: ['open', 'acknowledged'] },
          lastOccurrence: { $gte: oneHourAgo }
        },
        {
          $inc: { occurrenceCount: 1 },
          $set: {
            lastOccurrence: timestamp,
            observedValue: anomalyRecord.observedValue,
            thresholdValue: anomalyRecord.thresholdValue,
            rawTelemetryId: anomalyRecord.rawTelemetryId,
            explanation: anomalyRecord.explanation
          }
        },
        { new: true }
      );

      let resultingEvent = updatedEvent;

      // 2. If no active event was aggregated, create a new SecurityEvent
      if (!resultingEvent) {
        resultingEvent = await SecurityEvent.create({
          eventId: this.generateEventId(),
          organizationId: orgId,
          deviceId: devId,
          anomalyId: anomalyRecord._id,
          rawTelemetryId: anomalyRecord.rawTelemetryId,
          ruleId: anomalyRecord.ruleId,
          ruleName: anomalyRecord.ruleName || 'Security Rule Breach',
          metric: anomalyRecord.metric,
          observedValue: anomalyRecord.observedValue,
          thresholdValue: anomalyRecord.thresholdValue,
          category: anomalyRecord.category || 'threshold',
          severity: anomalyRecord.severity || 'medium',
          confidence: anomalyRecord.confidence || 'high',
          status: 'open',
          explanation: anomalyRecord.explanation,
          occurrenceCount: 1,
          firstOccurrence: timestamp,
          lastOccurrence: timestamp
        });

        logger.info(`[Security Event Engine] Created new SecurityEvent ${resultingEvent.eventId} for device ${devId} [Rule: ${anomalyRecord.ruleId}, Severity: ${resultingEvent.severity}]`);
      } else {
        logger.debug(`[Security Event Engine] Aggregated anomaly into active SecurityEvent ${resultingEvent.eventId} (count: ${resultingEvent.occurrenceCount})`);
      }

      // 3. Asynchronously trigger Risk Engine recalculation & Phase 9 Event Correlation
      setImmediate(() => {
        try {
          riskService.recalculateDeviceRisk(devId, orgId).catch((err) => {
            logger.error(`[Risk Engine] Async risk calculation failed: ${err.message}`);
          });
        } catch (err) {
          logger.error(`[Risk Engine] Failed to dispatch risk calculation: ${err.message}`);
        }

        try {
          correlationService.processSecurityEvent(resultingEvent).catch((err) => {
            logger.error(`[Correlation Engine] Async event correlation failed: ${err.message}`);
          });
        } catch (err) {
          logger.error(`[Correlation Engine] Failed to dispatch event correlation: ${err.message}`);
        }
      });

      return resultingEvent;
    } catch (err) {
      logger.error(`[Security Event Engine] Error processing anomaly into security event: ${err.message}`);
      return null;
    }
  }

  /**
   * Lists security events for a tenant organization with pagination and filters.
   * 
   * @param {string} organizationId
   * @param {Object} queryParams
   * @returns {Promise<{ events: Array, total: number, page: number, limit: number, totalPages: number }>}
   */
  async listSecurityEvents(organizationId, queryParams = {}) {
    const filter = {
      organizationId: new mongoose.Types.ObjectId(organizationId)
    };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.severity) {
      filter.severity = queryParams.severity;
    }

    if (queryParams.category) {
      filter.category = queryParams.category;
    }

    if (queryParams.ruleId) {
      filter.ruleId = queryParams.ruleId.toUpperCase();
    }

    if (queryParams.deviceId) {
      if (mongoose.Types.ObjectId.isValid(queryParams.deviceId)) {
        filter.deviceId = new mongoose.Types.ObjectId(queryParams.deviceId);
      }
    }

    if (queryParams.from || queryParams.to) {
      filter.lastOccurrence = {};
      if (queryParams.from) filter.lastOccurrence.$gte = new Date(queryParams.from);
      if (queryParams.to) filter.lastOccurrence.$lte = new Date(queryParams.to);
    }

    if (queryParams.search) {
      const escaped = queryParams.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { eventId: { $regex: escaped, $options: 'i' } },
        { ruleName: { $regex: escaped, $options: 'i' } },
        { explanation: { $regex: escaped, $options: 'i' } }
      ];
    }

    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const sortField = queryParams.sortBy || 'lastOccurrence';
    const sortOrder = queryParams.sortOrder === 'asc' ? 1 : -1;

    const [events, total] = await Promise.all([
      SecurityEvent.find(filter)
        .populate('deviceId', 'deviceId name type healthStatus location')
        .populate('resolvedBy', 'displayName email')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      SecurityEvent.countDocuments(filter)
    ]);

    return {
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Retrieves single security event by ID or eventId.
   * 
   * @param {string} idOrEventId
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async getSecurityEventById(idOrEventId, organizationId) {
    const isObjectId = mongoose.Types.ObjectId.isValid(idOrEventId);
    const filter = {
      organizationId: new mongoose.Types.ObjectId(organizationId)
    };

    if (isObjectId) {
      filter._id = new mongoose.Types.ObjectId(idOrEventId);
    } else {
      filter.eventId = idOrEventId.toUpperCase();
    }

    const event = await SecurityEvent.findOne(filter)
      .populate('deviceId', 'deviceId name type healthStatus location riskScore riskSeverity')
      .populate('resolvedBy', 'displayName email')
      .populate('anomalyId')
      .lean();

    if (!event) {
      const err = new Error('Security event not found');
      err.code = 'EVENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return event;
  }

  /**
   * Retrieves security events for a specific device.
   * 
   * @param {string} deviceIdOrMongoId
   * @param {string} organizationId
   * @param {Object} queryParams
   * @returns {Promise<{ events: Array, total: number, device: Object }>}
   */
  async getDeviceSecurityEvents(deviceIdOrMongoId, organizationId, queryParams = {}) {
    const isObjectId = mongoose.Types.ObjectId.isValid(deviceIdOrMongoId);
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const deviceFilter = {
      organizationId: orgObjectId
    };

    if (isObjectId) {
      deviceFilter._id = new mongoose.Types.ObjectId(deviceIdOrMongoId);
    } else {
      deviceFilter.deviceId = deviceIdOrMongoId.toUpperCase();
    }

    const device = await Device.findOne(deviceFilter).select('_id deviceId name type healthStatus riskScore').lean();
    if (!device) {
      const err = new Error('Device not found');
      err.code = 'DEVICE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const filter = {
      organizationId: orgObjectId,
      deviceId: device._id
    };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.severity) {
      filter.severity = queryParams.severity;
    }

    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 50));

    const events = await SecurityEvent.find(filter)
      .sort({ lastOccurrence: -1 })
      .limit(limit)
      .lean();

    return {
      events,
      total: events.length,
      device
    };
  }

  /**
   * Updates status of a Security Event (triage action) and triggers risk recalculation.
   * 
   * @param {string} idOrEventId
   * @param {string} organizationId
   * @param {string} newStatus
   * @param {string} resolutionNote
   * @param {Object} actorUser
   * @returns {Promise<Object>}
   */
  async updateEventStatus(idOrEventId, organizationId, newStatus, resolutionNote, actorUser) {
    const isObjectId = mongoose.Types.ObjectId.isValid(idOrEventId);
    const filter = {
      organizationId: new mongoose.Types.ObjectId(organizationId)
    };

    if (isObjectId) {
      filter._id = new mongoose.Types.ObjectId(idOrEventId);
    } else {
      filter.eventId = idOrEventId.toUpperCase();
    }

    const event = await SecurityEvent.findOne(filter);
    if (!event) {
      const err = new Error('Security event not found');
      err.code = 'EVENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const currentStatus = event.status;
    const actorRole = actorUser?.role || 'viewer';
    const actorLevel = ROLE_HIERARCHY[actorRole] || 0;
    const adminLevel = ROLE_HIERARCHY.org_admin;

    // Viewers cannot transition status
    if (actorLevel < ROLE_HIERARCHY.operator) {
      const err = new Error('Viewers are not authorized to transition security event status');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    // Validate state machine transitions per role and current event status
    let isAllowed = false;

    if (actorLevel >= adminLevel) {
      // org_admin and super_admin have full status transition authority
      isAllowed = true;
    } else if (actorRole === 'operator') {
      // operator: open -> acknowledged ONLY
      if (currentStatus === 'open' && newStatus === 'acknowledged') {
        isAllowed = true;
      }
    } else if (actorRole === 'security_analyst') {
      // security_analyst:
      // - open / acknowledged -> resolved
      // - open / acknowledged -> false_positive
      // - resolved / false_positive -> open
      // - open -> acknowledged
      if (
        ((currentStatus === 'open' || currentStatus === 'acknowledged') && (newStatus === 'resolved' || newStatus === 'false_positive')) ||
        ((currentStatus === 'resolved' || currentStatus === 'false_positive') && newStatus === 'open') ||
        (currentStatus === 'open' && newStatus === 'acknowledged')
      ) {
        isAllowed = true;
      }
    }

    if (!isAllowed) {
      const err = new Error(`Invalid status transition from '${currentStatus}' to '${newStatus}' for role '${actorRole}'`);
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    event.status = newStatus;
    if (resolutionNote !== undefined) {
      event.resolutionNote = resolutionNote ? resolutionNote.trim() : null;
    }

    if (newStatus === 'resolved' || newStatus === 'false_positive') {
      event.resolvedAt = new Date();
      event.resolvedBy = actorUser?._id || null;
    } else {
      event.resolvedAt = null;
      event.resolvedBy = null;
    }

    await event.save();
    logger.info(`[Security Event Triage] Event ${event.eventId} transitioned to '${newStatus}' by ${actorUser?.email || 'user'}`);

    // Trigger Risk recalculation immediately on status change
    setImmediate(() => {
      riskService.recalculateDeviceRisk(event.deviceId, organizationId).catch((err) => {
        logger.error(`[Risk Engine] Recalculation after status change failed: ${err.message}`);
      });
    });

    return event.toObject();
  }
}

module.exports = new SecurityEventService();

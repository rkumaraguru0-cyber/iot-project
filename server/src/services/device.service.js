const crypto = require('crypto');
const mongoose = require('mongoose');
const { Device } = require('../models');
const { hashToken } = require('../utils/token');
const { logAuditEvent } = require('./audit.service');
const { ROLE_HIERARCHY } = require('../middleware/rbac');
const emitter = require('../socket/emitter');
const notificationService = require('./notification.service');
const logger = require('../utils/logger');

const TYPE_PREFIXES = {
  temperature_sensor: 'TS',
  smart_camera: 'SC',
  industrial_gateway: 'IG',
  medical_monitor: 'MM',
  smart_lock: 'SL'
};

const VALID_TRANSITIONS = {
  registered: ['active'],
  active: ['maintenance', 'quarantined', 'decommissioned'],
  maintenance: ['active', 'decommissioned'],
  quarantined: ['active', 'decommissioned'],
  decommissioned: [] // Terminal state: no outbound transitions
};

class DeviceService {
  /**
   * Generates a standardized Device ID: DEV-{TYPE_PREFIX}-{RANDOM_6}
   * @param {string} type
   * @returns {string}
   */
  generateDeviceId(type) {
    const prefix = TYPE_PREFIXES[type] || 'DV';
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `DEV-${prefix}-${randomHex}`;
  }

  /**
   * Generates a 256-bit cryptographically secure raw API key and its SHA-256 hash
   * @returns {{ rawApiKey: string, apiKeyHash: string }}
   */
  generateDeviceApiKey() {
    const rawApiKey = crypto.randomBytes(32).toString('hex');
    const apiKeyHash = hashToken(rawApiKey);
    return { rawApiKey, apiKeyHash };
  }

  /**
   * Registers a new device in the tenant's fleet and issues its initial API key
   * @param {Object} data
   * @param {string} organizationId
   * @param {Object} actorUser
   * @param {string} clientIp
   * @returns {Promise<{ device: Object, apiKey: string }>}
   */
  async registerDevice(data, organizationId, actorUser, clientIp) {
    const { rawApiKey, apiKeyHash } = this.generateDeviceApiKey();
    const deviceId = this.generateDeviceId(data.type);

    const initialTimelineEntry = {
      timestamp: new Date(),
      action: 'device.registered',
      actor: actorUser.displayName || actorUser.email || 'system',
      details: `Device registered with type ${data.type}`
    };

    const device = await Device.create({
      deviceId,
      name: data.name.trim(),
      type: data.type,
      manufacturer: data.manufacturer.trim(),
      model: data.model.trim(),
      location: data.location ? data.location.trim() : '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      status: 'registered',
      healthStatus: 'unknown',
      apiKeyHash,
      currentFirmwareVersion: data.firmwareVersion ? data.firmwareVersion.trim() : null,
      riskScore: 0,
      riskSeverity: 'low',
      riskFactors: [],
      expectedReportingInterval: 30,
      timeline: [initialTimelineEntry],
      organizationId
    });

    // Audit log
    await logAuditEvent({
      action: 'device.registered',
      actor: actorUser.userId,
      actorName: actorUser.displayName,
      actorIp: clientIp,
      targetType: 'device',
      targetId: device._id,
      organizationId,
      details: {
        deviceId: device.deviceId,
        name: device.name,
        type: device.type
      }
    });

    const sanitizedDevice = device.toObject();
    delete sanitizedDevice.apiKeyHash;

    return {
      device: sanitizedDevice,
      apiKey: rawApiKey
    };
  }

  /**
   * Lists devices for an organization with filtering, pagination, search, and sorting
   * @param {string} organizationId
   * @param {Object} queryParams
   * @returns {Promise<{ devices: Array, total: number, page: number, limit: number }>}
   */
  async listDevices(organizationId, queryParams = {}) {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {
      organizationId: new mongoose.Types.ObjectId(organizationId)
    };

    if (queryParams.type) {
      filter.type = queryParams.type;
    }

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.healthStatus) {
      filter.healthStatus = queryParams.healthStatus;
    }

    if (queryParams.riskMin !== undefined || queryParams.riskMax !== undefined) {
      filter.riskScore = {};
      if (queryParams.riskMin !== undefined) filter.riskScore.$gte = Number(queryParams.riskMin);
      if (queryParams.riskMax !== undefined) filter.riskScore.$lte = Number(queryParams.riskMax);
    }

    if (queryParams.tag) {
      const [key, value] = queryParams.tag.split(':');
      if (key && value) {
        filter.tags = { $elemMatch: { key: key.trim(), value: value.trim() } };
      } else if (key) {
        filter['tags.key'] = key.trim();
      }
    }

    if (queryParams.search) {
      const escapedSearch = queryParams.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: escapedSearch, $options: 'i' };
    }

    const sortField = queryParams.sortBy || 'createdAt';
    const sortDirection = queryParams.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortField]: sortDirection };

    const [devices, total] = await Promise.all([
      Device.find(filter)
        .select('-apiKeyHash')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Device.countDocuments(filter)
    ]);

    return {
      devices,
      total,
      page,
      limit
    };
  }

  /**
   * Retrieves single device details by ID or deviceId within the tenant scope
   * @param {string} id - Mongo ObjectId or deviceId
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async getDeviceById(id, organizationId) {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const filter = {
      organizationId: new mongoose.Types.ObjectId(organizationId)
    };

    if (isObjectId) {
      filter._id = new mongoose.Types.ObjectId(id);
    } else {
      filter.deviceId = id.toUpperCase();
    }

    const device = await Device.findOne(filter).select('-apiKeyHash').lean();
    if (!device) {
      const err = new Error('Device not found');
      err.code = 'DEVICE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return device;
  }

  /**
   * Returns aggregate counts by status, healthStatus, and risk brackets
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async getDeviceStats(organizationId) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);

    const statsAgg = await Device.aggregate([
      { $match: { organizationId: orgObjectId } },
      {
        $facet: {
          total: [{ $count: 'count' }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          byHealth: [{ $group: { _id: '$healthStatus', count: { $sum: 1 } } }],
          byRisk: [{ $group: { _id: '$riskSeverity', count: { $sum: 1 } } }]
        }
      }
    ]);

    const result = statsAgg[0] || {};
    const total = result.total && result.total[0] ? result.total[0].count : 0;

    const byStatus = {
      registered: 0,
      active: 0,
      maintenance: 0,
      quarantined: 0,
      decommissioned: 0
    };
    (result.byStatus || []).forEach((item) => {
      if (item._id && byStatus[item._id] !== undefined) byStatus[item._id] = item.count;
    });

    const byHealth = {
      healthy: 0,
      degraded: 0,
      offline: 0,
      unknown: 0
    };
    (result.byHealth || []).forEach((item) => {
      if (item._id && byHealth[item._id] !== undefined) byHealth[item._id] = item.count;
    });

    const byRisk = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
      severe: 0
    };
    (result.byRisk || []).forEach((item) => {
      if (item._id && byRisk[item._id] !== undefined) byRisk[item._id] = item.count;
    });

    return {
      total,
      byStatus,
      byHealth,
      byRisk
    };
  }

  /**
   * Updates device metadata or transitions lifecycle state with strict field-level RBAC
   * @param {string} id
   * @param {Object} data
   * @param {string} organizationId
   * @param {Object} actorUser
   * @param {string} clientIp
   * @returns {Promise<Object>}
   */
  async updateDevice(id, data, organizationId, actorUser, clientIp) {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = {
      organizationId: new mongoose.Types.ObjectId(organizationId)
    };
    if (isObjectId) {
      query._id = new mongoose.Types.ObjectId(id);
    } else {
      query.deviceId = id.toUpperCase();
    }

    const device = await Device.findOne(query);
    if (!device) {
      const err = new Error('Device not found');
      err.code = 'DEVICE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const actorLevel = ROLE_HIERARCHY[actorUser.role] || 0;
    const analystLevel = ROLE_HIERARCHY.security_analyst;

    const hasMetadataUpdate = data.name !== undefined || data.location !== undefined || data.tags !== undefined;
    const hasStatusUpdate = data.status !== undefined && data.status !== device.status;

    // Field-level RBAC: metadata update requires security_analyst+
    if (hasMetadataUpdate && actorLevel < analystLevel) {
      const err = new Error('Updating device metadata requires at least security_analyst role');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    // Lifecycle state transition validation
    if (hasStatusUpdate) {
      const currentStatus = device.status;
      const newStatus = data.status;

      const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
      if (!allowedTransitions.includes(newStatus)) {
        const err = new Error(`Invalid state transition: Cannot transition from '${currentStatus}' to '${newStatus}'`);
        err.code = 'INVALID_STATE_TRANSITION';
        err.statusCode = 400;
        throw err;
      }

      // Decommissioning requires security_analyst+
      if (newStatus === 'decommissioned' && actorLevel < analystLevel) {
        const err = new Error('Decommissioning a device requires at least security_analyst role');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }

      // Apply status change
      device.status = newStatus;

      // Add timeline entry (capped at 50)
      const timelineEntry = {
        timestamp: new Date(),
        action: 'device.state.changed',
        actor: actorUser.displayName || actorUser.email || 'system',
        details: `Status transitioned from ${currentStatus} to ${newStatus}`
      };

      device.timeline.push(timelineEntry);
      if (device.timeline.length > 50) {
        device.timeline = device.timeline.slice(-50);
      }

      await logAuditEvent({
        action: 'device.state.changed',
        actor: actorUser.userId,
        actorName: actorUser.displayName,
        actorIp: clientIp,
        targetType: 'device',
        targetId: device._id,
        organizationId,
        details: {
          deviceId: device.deviceId,
          from: currentStatus,
          to: newStatus
        }
      });

      // Real-time integration (Phase 11): Emit device status change for quarantined, offline, decommissioned
      if (['quarantined', 'offline', 'decommissioned'].includes(newStatus)) {
        emitter.emitDeviceStatusChanged(organizationId.toString(), {
          deviceId: device.deviceId,
          status: newStatus,
          previousStatus: currentStatus
        });
      }

      // Trigger notification if newly quarantined
      if (newStatus === 'quarantined') {
        notificationService.notifyDeviceQuarantined(organizationId.toString(), device).catch((err) => {
          logger.error(`[Notification Service] Async device quarantined notification failed: ${err.message}`);
        });
      }
    }

    // Apply metadata updates
    if (data.name !== undefined) device.name = data.name.trim();
    if (data.location !== undefined) device.location = data.location.trim();
    if (data.tags !== undefined) device.tags = data.tags;

    if (hasMetadataUpdate) {
      await logAuditEvent({
        action: 'device.updated',
        actor: actorUser.userId,
        actorName: actorUser.displayName,
        actorIp: clientIp,
        targetType: 'device',
        targetId: device._id,
        organizationId,
        details: {
          deviceId: device.deviceId,
          updatedFields: Object.keys(data).filter((k) => k !== 'status')
        }
      });
    }

    await device.save();

    const sanitizedDevice = device.toObject();
    delete sanitizedDevice.apiKeyHash;
    return sanitizedDevice;
  }

  /**
   * Regenerates a device's API key, invalidating the previous one immediately
   * @param {string} id
   * @param {string} organizationId
   * @param {Object} actorUser
   * @param {string} clientIp
   * @returns {Promise<{ apiKey: string }>}
   */
  async regenerateApiKey(id, organizationId, actorUser, clientIp) {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = {
      organizationId: new mongoose.Types.ObjectId(organizationId)
    };
    if (isObjectId) {
      query._id = new mongoose.Types.ObjectId(id);
    } else {
      query.deviceId = id.toUpperCase();
    }

    const device = await Device.findOne(query);
    if (!device) {
      const err = new Error('Device not found');
      err.code = 'DEVICE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const { rawApiKey, apiKeyHash } = this.generateDeviceApiKey();
    device.apiKeyHash = apiKeyHash;

    const timelineEntry = {
      timestamp: new Date(),
      action: 'device.key.regenerated',
      actor: actorUser.displayName || actorUser.email || 'system',
      details: 'Device API key was regenerated by operator'
    };

    device.timeline.push(timelineEntry);
    if (device.timeline.length > 50) {
      device.timeline = device.timeline.slice(-50);
    }

    await device.save();

    await logAuditEvent({
      action: 'device.key.regenerated',
      actor: actorUser.userId,
      actorName: actorUser.displayName,
      actorIp: clientIp,
      targetType: 'device',
      targetId: device._id,
      organizationId,
      details: {
        deviceId: device.deviceId
      }
    });

    return {
      apiKey: rawApiKey
    };
  }

  /**
   * Returns current risk posture fields for a device
   * @param {string} id
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async getDeviceRisk(id, organizationId) {
    const device = await this.getDeviceById(id, organizationId);
    return {
      id: device._id,
      deviceId: device.deviceId,
      riskScore: device.riskScore,
      riskSeverity: device.riskSeverity,
      riskFactors: device.riskFactors || [],
      riskCalculatedAt: device.riskCalculatedAt
    };
  }
}

module.exports = new DeviceService();

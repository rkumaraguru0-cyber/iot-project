const mongoose = require('mongoose');
const { AnomalyRule, Anomaly, Device } = require('../models');
const { DEFAULT_SYSTEM_RULES } = require('./anomaly/defaultRules');
const { evaluateRule } = require('./anomaly/ruleEvaluator');
const telemetryBuffer = require('./anomaly/telemetryBuffer');
const cooldownManager = require('./anomaly/cooldownManager');
const logger = require('../utils/logger');

class AnomalyService {
  constructor() {
    this.buffer = telemetryBuffer;
    this.cooldown = cooldownManager;
  }

  /**
   * Seeds default system baseline anomaly rules if they don't already exist.
   */
  async seedDefaultRules() {
    try {
      for (const defaultRule of DEFAULT_SYSTEM_RULES) {
        await AnomalyRule.findOneAndUpdate(
          { ruleId: defaultRule.ruleId },
          { $setOnInsert: defaultRule },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
      logger.info(`[Anomaly Service] System default rules verified/seeded (${DEFAULT_SYSTEM_RULES.length} rules)`);
    } catch (error) {
      logger.error(`[Anomaly Service] Failed to seed default rules: ${error.message}`);
    }
  }

  /**
   * Resolves all active candidate rules applicable to a given device and tenant.
   * 
   * @param {Object} deviceContext - { _id, organizationId, type, deviceId }
   * @returns {Promise<Array<Object>>}
   */
  async resolveActiveRules(deviceContext) {
    const orgId = deviceContext.organizationId?._id || deviceContext.organizationId;
    const deviceType = deviceContext.type;

    const query = {
      enabled: true,
      deleted: { $ne: true },
      $or: [
        { isSystem: true },
        { organizationId: orgId }
      ]
    };

    if (deviceType) {
      query.$and = [
        {
          $or: [
            { deviceTypes: '*' },
            { deviceTypes: deviceType }
          ]
        }
      ];
    }

    return AnomalyRule.find(query).lean();
  }

  /**
   * Evaluates incoming telemetry against all applicable detection rules.
   * Runs asynchronously and non-blockingly after Phase 6 persistence.
   * 
   * @param {Object} deviceContext - { _id, organizationId, deviceId, type }
   * @param {Object} rawTelemetry - Stored Telemetry document or payload
   * @returns {Promise<Array<Object>>} Array of created Anomaly records (if any)
   */
  async processTelemetry(deviceContext, rawTelemetry) {
    if (!deviceContext || !rawTelemetry || !rawTelemetry.metrics) {
      return [];
    }

    const deviceId = deviceContext.deviceId || 'DEV-UNKNOWN';
    const orgId = deviceContext.organizationId?._id || deviceContext.organizationId;
    const rawTelemetryId = rawTelemetry._id || new mongoose.Types.ObjectId();

    // 1. Retrieve history BEFORE pushing new reading for clean temporal delta calculation
    const history = this.buffer.getHistory(deviceId);

    // 2. Buffer the new reading
    this.buffer.push(deviceId, {
      timestamp: rawTelemetry.timestamp,
      metrics: rawTelemetry.metrics,
      metadata: rawTelemetry.metadata
    });

    // 3. Resolve active rules
    const activeRules = await this.resolveActiveRules(deviceContext);
    if (!activeRules || activeRules.length === 0) {
      return [];
    }

    const createdAnomalies = [];

    // 4. Evaluate each rule deterministically
    for (const rule of activeRules) {
      try {
        const evalResult = evaluateRule(rule, {
          timestamp: rawTelemetry.timestamp,
          metrics: rawTelemetry.metrics,
          deviceId
        }, history);

        if (evalResult.isAnomaly) {
          // 5. Check in-memory cooldown suppression
          const isSuppressed = this.cooldown.isSuppressed(
            deviceId,
            rule.ruleId,
            rule.cooldownSeconds
          );

          if (isSuppressed) {
            logger.debug(`[Anomaly Engine] Anomaly suppressed by cooldown for device '${deviceId}' on rule '${rule.ruleId}'`);
            continue;
          }

          // 6. Record trigger in cooldown manager
          this.cooldown.recordTrigger(deviceId, rule.ruleId);

          // 7. Persist immutable detection record in MongoDB
          const anomalyRecord = await Anomaly.create({
            organizationId: orgId,
            deviceId: deviceContext._id,
            rawTelemetryId,
            ruleId: rule.ruleId,
            ruleName: rule.name,
            category: rule.category,
            metric: rule.metric,
            observedValue: evalResult.observedValue,
            thresholdValue: evalResult.thresholdValue,
            severity: rule.severity,
            confidence: rule.confidence,
            explanation: evalResult.explanation,
            timestamp: rawTelemetry.timestamp
          });

          createdAnomalies.push(anomalyRecord);

          // Update lastTriggeredAt on rule asynchronously
          AnomalyRule.updateOne(
            { _id: rule._id },
            { $set: { lastTriggeredAt: new Date() } }
          ).catch(() => {});

          logger.warn(`[Anomaly Engine] Anomaly detected on device '${deviceId}' [Rule: ${rule.ruleId}, Severity: ${rule.severity}] - ${evalResult.explanation}`);
        }
      } catch (err) {
        logger.error(`[Anomaly Engine] Error evaluating rule '${rule.ruleId}' for device '${deviceId}': ${err.message}`);
      }
    }

    return createdAnomalies;
  }

  /**
   * Lists detection rules accessible to a tenant organization.
   * 
   * @param {string} organizationId
   * @param {Object} queryParams
   * @returns {Promise<{ rules: Array, total: number }>}
   */
  async listRules(organizationId, queryParams = {}) {
    const filter = {
      deleted: { $ne: true },
      $or: [
        { isSystem: true },
        { organizationId: new mongoose.Types.ObjectId(organizationId) }
      ]
    };

    if (queryParams.category) {
      filter.category = queryParams.category;
    }

    if (queryParams.severity) {
      filter.severity = queryParams.severity;
    }

    if (queryParams.enabled !== undefined) {
      filter.enabled = queryParams.enabled === 'true' || queryParams.enabled === true;
    }

    if (queryParams.deviceType) {
      filter.$and = [
        {
          $or: [
            { deviceTypes: '*' },
            { deviceTypes: queryParams.deviceType }
          ]
        }
      ];
    }

    const rules = await AnomalyRule.find(filter).sort({ isSystem: -1, createdAt: -1 }).lean();
    return {
      rules,
      total: rules.length
    };
  }

  /**
   * Retrieves a rule by ID or MongoId, scoped to tenant or system.
   * 
   * @param {string} ruleIdOrMongoId
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async getRuleById(ruleIdOrMongoId, organizationId) {
    const isObjectId = mongoose.Types.ObjectId.isValid(ruleIdOrMongoId);
    const filter = {
      deleted: { $ne: true },
      $or: [
        { isSystem: true },
        { organizationId: new mongoose.Types.ObjectId(organizationId) }
      ]
    };

    if (isObjectId) {
      filter._id = new mongoose.Types.ObjectId(ruleIdOrMongoId);
    } else {
      filter.ruleId = ruleIdOrMongoId.toUpperCase();
    }

    const rule = await AnomalyRule.findOne(filter).lean();
    if (!rule) {
      const err = new Error('Detection rule not found');
      err.code = 'RULE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return rule;
  }

  /**
   * Creates a custom detection rule for a tenant organization.
   * 
   * @param {string} organizationId
   * @param {Object} ruleData
   * @param {Object} user - Authenticated user
   * @returns {Promise<Object>}
   */
  async createTenantRule(organizationId, ruleData, user) {
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const ruleId = ruleData.ruleId
      ? ruleData.ruleId.trim().toUpperCase()
      : `RULE-CUSTOM-${randomSuffix}`;

    // Verify unique ruleId
    const existing = await AnomalyRule.findOne({ ruleId, deleted: { $ne: true } });
    if (existing) {
      const err = new Error(`Rule ID '${ruleId}' already exists`);
      err.code = 'RULE_ID_EXISTS';
      err.statusCode = 409;
      throw err;
    }

    const newRule = new AnomalyRule({
      ...ruleData,
      ruleId,
      organizationId: new mongoose.Types.ObjectId(organizationId),
      isSystem: false,
      deleted: false,
      createdBy: user?._id || user?.email || 'user'
    });

    await newRule.save();
    return newRule.toObject();
  }

  /**
   * Updates an existing custom tenant rule.
   * System rules cannot be updated by tenant users.
   * 
   * @param {string} ruleIdOrMongoId
   * @param {string} organizationId
   * @param {Object} updateData
   * @returns {Promise<Object>}
   */
  async updateTenantRule(ruleIdOrMongoId, organizationId, updateData) {
    const isObjectId = mongoose.Types.ObjectId.isValid(ruleIdOrMongoId);
    const filter = {
      deleted: { $ne: true }
    };

    if (isObjectId) {
      filter._id = new mongoose.Types.ObjectId(ruleIdOrMongoId);
    } else {
      filter.ruleId = ruleIdOrMongoId.toUpperCase();
    }

    const rule = await AnomalyRule.findOne(filter);
    if (!rule) {
      const err = new Error('Detection rule not found');
      err.code = 'RULE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (rule.isSystem) {
      const err = new Error('System rules are read-only and cannot be modified');
      err.code = 'SYSTEM_RULE_IMMUTABLE';
      err.statusCode = 403;
      throw err;
    }

    if (rule.organizationId?.toString() !== organizationId.toString()) {
      const err = new Error('Cannot modify rules belonging to another organization');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    // Allowed updatable fields
    const allowedFields = [
      'name',
      'description',
      'category',
      'enabled',
      'deviceTypes',
      'metric',
      'operator',
      'value',
      'window',
      'cooldownSeconds',
      'severity',
      'confidence',
      'explanationTemplate'
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        rule[field] = updateData[field];
      }
    }

    await rule.save();
    return rule.toObject();
  }

  /**
   * Soft-deletes a custom tenant rule.
   * System rules cannot be deleted.
   * 
   * @param {string} ruleIdOrMongoId
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async deleteTenantRule(ruleIdOrMongoId, organizationId) {
    const isObjectId = mongoose.Types.ObjectId.isValid(ruleIdOrMongoId);
    const filter = {
      deleted: { $ne: true }
    };

    if (isObjectId) {
      filter._id = new mongoose.Types.ObjectId(ruleIdOrMongoId);
    } else {
      filter.ruleId = ruleIdOrMongoId.toUpperCase();
    }

    const rule = await AnomalyRule.findOne(filter);
    if (!rule) {
      const err = new Error('Detection rule not found');
      err.code = 'RULE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (rule.isSystem) {
      const err = new Error('System rules cannot be deleted');
      err.code = 'SYSTEM_RULE_IMMUTABLE';
      err.statusCode = 403;
      throw err;
    }

    if (rule.organizationId?.toString() !== organizationId.toString()) {
      const err = new Error('Cannot delete rules belonging to another organization');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    rule.deleted = true;
    rule.enabled = false;
    await rule.save();

    return { message: 'Rule successfully deleted', ruleId: rule.ruleId };
  }

  /**
   * Dry-run evaluates a rule specification against sample telemetry without persisting anything.
   * 
   * @param {Object} ruleSpec
   * @param {Object} sampleTelemetry - { timestamp, metrics, deviceId }
   * @returns {Object}
   */
  dryRunEvaluateRule(ruleSpec, sampleTelemetry) {
    if (!ruleSpec || !sampleTelemetry) {
      const err = new Error('Rule specification and sample telemetry are required');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    return evaluateRule(ruleSpec, sampleTelemetry, []);
  }

  /**
   * Queries anomaly detection logs for a tenant organization.
   * 
   * @param {string} organizationId
   * @param {Object} queryParams
   * @returns {Promise<{ anomalies: Array, total: number, page: number, limit: number }>}
   */
  async getAnomalies(organizationId, queryParams = {}) {
    const filter = {
      organizationId: new mongoose.Types.ObjectId(organizationId)
    };

    if (queryParams.deviceId) {
      if (mongoose.Types.ObjectId.isValid(queryParams.deviceId)) {
        filter.deviceId = new mongoose.Types.ObjectId(queryParams.deviceId);
      }
    }

    if (queryParams.ruleId) {
      filter.ruleId = queryParams.ruleId.toUpperCase();
    }

    if (queryParams.severity) {
      filter.severity = queryParams.severity;
    }

    if (queryParams.from || queryParams.to) {
      filter.timestamp = {};
      if (queryParams.from) filter.timestamp.$gte = new Date(queryParams.from);
      if (queryParams.to) filter.timestamp.$lte = new Date(queryParams.to);
    }

    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [anomalies, total] = await Promise.all([
      Anomaly.find(filter)
        .populate('deviceId', 'deviceId name type healthStatus')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Anomaly.countDocuments(filter)
    ]);

    return {
      anomalies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Queries anomaly detection logs for a specific device within a tenant organization.
   * 
   * @param {string} deviceIdOrMongoId
   * @param {string} organizationId
   * @param {Object} queryParams
   * @returns {Promise<{ anomalies: Array, total: number, device: Object }>}
   */
  async getDeviceAnomalies(deviceIdOrMongoId, organizationId, queryParams = {}) {
    const isObjectId = mongoose.Types.ObjectId.isValid(deviceIdOrMongoId);
    const deviceFilter = {
      organizationId: new mongoose.Types.ObjectId(organizationId)
    };

    if (isObjectId) {
      deviceFilter._id = new mongoose.Types.ObjectId(deviceIdOrMongoId);
    } else {
      deviceFilter.deviceId = deviceIdOrMongoId.toUpperCase();
    }

    const device = await Device.findOne(deviceFilter).select('_id deviceId name type').lean();
    if (!device) {
      const err = new Error('Device not found');
      err.code = 'DEVICE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const filter = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
      deviceId: device._id
    };

    if (queryParams.ruleId) {
      filter.ruleId = queryParams.ruleId.toUpperCase();
    }

    if (queryParams.severity) {
      filter.severity = queryParams.severity;
    }

    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 50));

    const anomalies = await Anomaly.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return {
      anomalies,
      total: anomalies.length,
      device
    };
  }
}

module.exports = new AnomalyService();

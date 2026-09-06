const mongoose = require('mongoose');
const { Device, SecurityEvent } = require('../models');
const emitter = require('../socket/emitter');
const notificationService = require('./notification.service');
const logger = require('../utils/logger');

const SEVERITY_BASE_POINTS = {
  critical: 30,
  high: 18,
  medium: 8,
  low: 3
};

const CONFIDENCE_MULTIPLIERS = {
  high: 1.0,
  medium: 0.8,
  low: 0.6
};

const HEALTH_STATUS_POINTS = {
  healthy: 0,
  unknown: 5,
  degraded: 10,
  offline: 20
};

class RiskService {
  /**
   * Maps a numerical risk score (0-100) to its corresponding severity bracket.
   * Exact approved brackets:
   * 0–19   => low
   * 20–49  => medium
   * 50–74  => high
   * 75–89  => critical
   * 90–100 => severe
   * 
   * @param {number} score
   * @returns {'low'|'medium'|'high'|'critical'|'severe'}
   */
  classifyRiskSeverity(score) {
    if (score >= 90) return 'severe';
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 20) return 'medium';
    return 'low';
  }

  /**
   * Pure deterministic calculation function for a device's risk score and factor breakdown.
   * No recency decay — all active events within the active window receive equal weight.
   * 
   * @param {Object} device - Device document or plain object
   * @param {Array<Object>} activeEvents - Array of active SecurityEvent documents
   * @returns {{ riskScore: number, riskSeverity: string, riskFactors: Array<Object> }}
   */
  calculateRiskForDevice(device, activeEvents = []) {
    // 1. ScoreEvents (Cap: 60 pts)
    let rawEventsScore = 0;
    let totalRepeatedOccurrences = 0;
    const contributingEventIds = [];

    for (const event of activeEvents) {
      // Base severity points: critical (30), high (18), medium (8), low (3)
      const basePts = SEVERITY_BASE_POINTS[event.severity] || SEVERITY_BASE_POINTS.low;

      // Confidence multiplier: 1.0 (high), 0.8 (medium), 0.6 (low)
      let confMult = 1.0;
      if (typeof event.confidence === 'number') {
        confMult = Math.max(0, Math.min(1, event.confidence));
      } else if (typeof event.confidence === 'string') {
        confMult = CONFIDENCE_MULTIPLIERS[event.confidence] || CONFIDENCE_MULTIPLIERS.medium;
      }

      // Phase 8 event contribution: severity base points × confidence multiplier (NO recency decay)
      rawEventsScore += basePts * confMult;

      if (event.occurrenceCount > 1) {
        totalRepeatedOccurrences += (event.occurrenceCount - 1);
      }

      if (event.eventId) {
        contributingEventIds.push(event.eventId);
      }
    }

    const eventsScore = Math.min(60, rawEventsScore);

    // 2. ScoreHealth (Cap: 20 pts)
    const healthStatus = device.healthStatus || 'unknown';
    const healthScore = Math.min(20, HEALTH_STATUS_POINTS[healthStatus] !== undefined ? HEALTH_STATUS_POINTS[healthStatus] : 5);

    // 3. ScoreFrequency (Cap: 20 pts)
    const recurrencePenalty = Math.min(15, totalRepeatedOccurrences * 3);
    const malformedPenalty = Math.min(5, (device.malformedMessageCount || 0) * 1);
    const frequencyScore = Math.min(20, recurrencePenalty + malformedPenalty);

    // Total Score (Bounded 0 - 100)
    const totalScore = Math.min(100, Math.max(0, Math.round(eventsScore + healthScore + frequencyScore)));
    const riskSeverity = this.classifyRiskSeverity(totalScore);

    // Exactly 3 Phase 8 explainable risk factors
    const riskFactors = [
      {
        name: 'Active Security Events',
        value: Math.round(eventsScore),
        maxValue: 60,
        detail: `${activeEvents.length} active event(s) in active 24h window`,
        contributingIds: contributingEventIds
      },
      {
        name: 'Device Communication Health',
        value: Math.round(healthScore),
        maxValue: 20,
        detail: `Communication health status is '${healthStatus}'`,
        contributingIds: []
      },
      {
        name: 'Anomaly Repetition & Malformed Traffic',
        value: Math.round(frequencyScore),
        maxValue: 20,
        detail: `${totalRepeatedOccurrences} repeated anomaly occurrence(s), ${device.malformedMessageCount || 0} malformed message(s)`,
        contributingIds: []
      }
    ];

    return {
      riskScore: totalScore,
      riskSeverity,
      riskFactors
    };
  }

  /**
   * Deterministically calculates and updates a device's risk score and explainable risk factors in MongoDB.
   * 
   * @param {string|mongoose.Types.ObjectId} deviceId
   * @param {string|mongoose.Types.ObjectId} organizationId
   * @returns {Promise<Object>}
   */
  async recalculateDeviceRisk(deviceId, organizationId) {
    if (!deviceId) return null;

    try {
      const isObjectId = mongoose.Types.ObjectId.isValid(deviceId);
      const deviceFilter = {};

      if (organizationId) {
        deviceFilter.organizationId = new mongoose.Types.ObjectId(organizationId);
      }

      if (isObjectId) {
        deviceFilter._id = new mongoose.Types.ObjectId(deviceId);
      } else {
        deviceFilter.deviceId = deviceId.toString().toUpperCase();
      }

      const device = await Device.findOne(deviceFilter);
      if (!device) {
        return null;
      }

      // Query active security events within the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const activeEvents = await SecurityEvent.find({
        organizationId: device.organizationId,
        deviceId: device._id,
        status: { $in: ['open', 'acknowledged'] },
        lastOccurrence: { $gte: twentyFourHoursAgo }
      }).lean();

      const calculated = this.calculateRiskForDevice(device, activeEvents);
      const calculatedAt = new Date();
      const previousSeverity = device.riskSeverity || 'low';

      // Update Device document atomically
      await Device.updateOne(
        { _id: device._id },
        {
          $set: {
            riskScore: calculated.riskScore,
            riskSeverity: calculated.riskSeverity,
            riskFactors: calculated.riskFactors,
            riskCalculatedAt: calculatedAt
          }
        }
      );

      // Real-time integration (Phase 11): Emit device:risk-escalated & trigger notification ONLY when risk severity ENTERS critical or severe
      const SEVERITY_RANK = { low: 0, medium: 1, high: 2, critical: 3, severe: 4 };
      const isEscalation = ['critical', 'severe'].includes(calculated.riskSeverity) &&
        (SEVERITY_RANK[calculated.riskSeverity] || 0) > (SEVERITY_RANK[previousSeverity] || 0);

      if (isEscalation) {
        emitter.emitDeviceRiskEscalated(device.organizationId.toString(), {
          deviceId: device.deviceId,
          riskScore: calculated.riskScore,
          riskSeverity: calculated.riskSeverity
        });

        notificationService.notifyRiskEscalated(
          device.organizationId.toString(),
          device,
          calculated.riskScore,
          calculated.riskSeverity
        ).catch((err) => {
          logger.error(`[Notification Service] Async risk escalation notification failed: ${err.message}`);
        });
      }

      return {
        deviceId: device.deviceId,
        riskScore: calculated.riskScore,
        riskSeverity: calculated.riskSeverity,
        riskFactors: calculated.riskFactors,
        riskCalculatedAt: calculatedAt
      };
    } catch (err) {
      logger.error(`[Risk Engine] Error recalculating risk for device ${deviceId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Alias for recalculateDeviceRisk
   */
  async evaluateDeviceRisk(deviceId, organizationId) {
    return this.recalculateDeviceRisk(deviceId, organizationId);
  }

  /**
   * Retrieves detailed risk posture for a specific device within tenant organization.
   * 
   * @param {string} deviceIdOrMongoId
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async getDeviceRisk(deviceIdOrMongoId, organizationId) {
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

    const device = await Device.findOne(deviceFilter)
      .select('_id deviceId name type healthStatus riskScore riskSeverity riskFactors riskCalculatedAt lastSeenAt')
      .lean();

    if (!device) {
      const err = new Error('Device not found');
      err.code = 'DEVICE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return {
      id: device._id,
      deviceId: device.deviceId,
      name: device.name,
      type: device.type,
      healthStatus: device.healthStatus,
      riskScore: device.riskScore || 0,
      riskSeverity: device.riskSeverity || 'low',
      riskFactors: device.riskFactors || [],
      riskCalculatedAt: device.riskCalculatedAt,
      lastSeenAt: device.lastSeenAt
    };
  }

  /**
   * Computes real-time fleet risk aggregation summary for an organization.
   * 
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async getFleetRiskSummary(organizationId) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);

    const [statsResult, topDevices] = await Promise.all([
      Device.aggregate([
        { $match: { organizationId: orgObjectId } },
        {
          $facet: {
            total: [{ $count: 'count' }],
            avgScore: [{ $group: { _id: null, avg: { $avg: '$riskScore' }, max: { $max: '$riskScore' } } }],
            bySeverity: [{ $group: { _id: '$riskSeverity', count: { $sum: 1 } } }],
            highRisk: [
              { $match: { riskScore: { $gte: 50 } } },
              { $count: 'count' }
            ],
            zeroRisk: [
              { $match: { riskScore: 0 } },
              { $count: 'count' }
            ],
            pendingCalc: [
              { $match: { riskCalculatedAt: null } },
              { $count: 'count' }
            ]
          }
        }
      ]),
      Device.find({ organizationId: orgObjectId })
        .select('_id deviceId name type riskScore riskSeverity healthStatus lastSeenAt')
        .sort({ riskScore: -1, lastSeenAt: -1 })
        .limit(5)
        .lean()
    ]);

    const facet = statsResult[0] || {};
    const totalDevices = facet.total && facet.total[0] ? facet.total[0].count : 0;
    const avgScoreRaw = facet.avgScore && facet.avgScore[0] ? facet.avgScore[0].avg : 0;
    const maxScoreRaw = facet.avgScore && facet.avgScore[0] ? facet.avgScore[0].max : 0;
    const highRiskCount = facet.highRisk && facet.highRisk[0] ? facet.highRisk[0].count : 0;
    const zeroRiskCount = facet.zeroRisk && facet.zeroRisk[0] ? facet.zeroRisk[0].count : 0;
    const pendingCalcCount = facet.pendingCalc && facet.pendingCalc[0] ? facet.pendingCalc[0].count : 0;

    const devicesByRiskSeverity = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
      severe: 0
    };

    (facet.bySeverity || []).forEach((item) => {
      if (item._id && devicesByRiskSeverity[item._id] !== undefined) {
        devicesByRiskSeverity[item._id] = item.count;
      }
    });

    return {
      totalDevices,
      averageRiskScore: totalDevices > 0 ? Number(avgScoreRaw.toFixed(1)) : 0,
      maxRiskScore: totalDevices > 0 ? Math.round(maxScoreRaw) : 0,
      highRiskDeviceCount: highRiskCount,
      devicesWithZeroRisk: zeroRiskCount,
      devicesWithPendingCalculation: pendingCalcCount,
      devicesByRiskSeverity,
      topAtRiskDevices: Array.isArray(topDevices) ? topDevices : []
    };
  }
}

module.exports = new RiskService();

const mongoose = require('mongoose');
const { Device, Incident, SecurityEvent, FirmwareVersion } = require('../models');

class DashboardService {
  /**
   * Aggregates consolidated shift-start security dashboard metrics across W1–W6, W8, and W9 widgets.
   *
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async getSummary(organizationId) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);

    // Parallel aggregation across core SOC collections
    const [
      deviceMetrics,
      incidentMetrics,
      criticalEventsResult,
      firmwareVersionsResult,
      topRiskDevices
    ] = await Promise.all([
      // 1. Device Health & Risk Distribution Aggregations
      Device.aggregate([
        { $match: { organizationId: orgObjectId, status: { $ne: 'decommissioned' } } },
        {
          $facet: {
            posture: [
              {
                $group: {
                  _id: null,
                  totalDevices: { $sum: 1 },
                  averageRiskScore: { $avg: '$riskScore' },
                  elevatedRiskCount: {
                    $sum: {
                      $cond: [{ $in: ['$riskSeverity', ['high', 'critical', 'severe']] }, 1, 0]
                    }
                  }
                }
              }
            ],
            healthDistribution: [
              { $group: { _id: '$healthStatus', count: { $sum: 1 } } }
            ],
            riskDistribution: [
              {
                $group: {
                  _id: null,
                  low: { $sum: { $cond: [{ $and: [{ $gte: ['$riskScore', 0] }, { $lte: ['$riskScore', 19] }] }, 1, 0] } },
                  medium: { $sum: { $cond: [{ $and: [{ $gte: ['$riskScore', 20] }, { $lte: ['$riskScore', 49] }] }, 1, 0] } },
                  high: { $sum: { $cond: [{ $and: [{ $gte: ['$riskScore', 50] }, { $lte: ['$riskScore', 74] }] }, 1, 0] } },
                  critical: { $sum: { $cond: [{ $and: [{ $gte: ['$riskScore', 75] }, { $lte: ['$riskScore', 89] }] }, 1, 0] } },
                  severe: { $sum: { $cond: [{ $gte: ['$riskScore', 90] }, 1, 0] } }
                }
              }
            ],
            totalNonDecommissioned: [
              { $count: 'count' }
            ]
          }
        }
      ]),

      // 2. Incident Metrics & SLA Aggregation
      Incident.aggregate([
        {
          $match: {
            organizationId: orgObjectId,
            status: { $nin: ['closed', 'false_positive'] }
          }
        },
        {
          $group: {
            _id: null,
            totalOpen: { $sum: 1 },
            critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
            high: { $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] } },
            medium: { $sum: { $cond: [{ $eq: ['$severity', 'medium'] }, 1, 0] } },
            low: { $sum: { $cond: [{ $eq: ['$severity', 'low'] }, 1, 0] } },
            slaBreachedCount: { $sum: { $cond: [{ $eq: ['$slaBreached', true] }, 1, 0] } }
          }
        }
      ]),

      // 3. Critical Unacknowledged Security Events (Count & Top 3)
      Promise.all([
        SecurityEvent.countDocuments({
          organizationId: orgObjectId,
          severity: 'critical',
          status: 'open'
        }),
        SecurityEvent.find({
          organizationId: orgObjectId,
          severity: 'critical',
          status: 'open'
        })
          .populate('deviceId', 'deviceId name type location')
          .sort({ createdAt: -1 })
          .limit(3)
          .lean()
      ]),

      // 4. Firmware Exposure Data
      FirmwareVersion.find({
        organizationId: orgObjectId,
        securityStatus: { $in: ['vulnerable', 'recalled'] }
      })
        .select('version deviceType securityStatus')
        .lean(),

      // 5. Top 5 Highest-Risk Devices
      Device.find({
        organizationId: orgObjectId,
        status: { $ne: 'decommissioned' }
      })
        .select('deviceId name type location status healthStatus riskScore riskSeverity riskFactors lastSeenAt currentFirmwareVersion')
        .sort({ riskScore: -1 })
        .limit(5)
        .lean()
    ]);

    // Format Fleet Posture & Health & Risk Data
    const facetData = deviceMetrics[0] || {};
    const postureRaw = facetData.posture?.[0] || { totalDevices: 0, elevatedRiskCount: 0, averageRiskScore: 0 };
    const totalDevices = postureRaw.totalDevices || 0;
    const elevatedRiskCount = postureRaw.elevatedRiskCount || 0;
    const averageRiskScore = totalDevices > 0 ? Number(postureRaw.averageRiskScore.toFixed(1)) : 0;

    const healthMap = { healthy: 0, degraded: 0, offline: 0, unknown: 0 };
    (facetData.healthDistribution || []).forEach((item) => {
      if (item._id && healthMap[item._id] !== undefined) {
        healthMap[item._id] = item.count;
      }
    });

    const riskDistRaw = facetData.riskDistribution?.[0] || { low: 0, medium: 0, high: 0, critical: 0, severe: 0 };
    const riskDistribution = {
      low: riskDistRaw.low || 0,
      medium: riskDistRaw.medium || 0,
      high: riskDistRaw.high || 0,
      critical: riskDistRaw.critical || 0,
      severe: riskDistRaw.severe || 0
    };

    // Format Incident Metrics
    const incRaw = incidentMetrics[0] || { totalOpen: 0, critical: 0, high: 0, medium: 0, low: 0, slaBreachedCount: 0 };
    const activeIncidents = {
      critical: incRaw.critical || 0,
      high: incRaw.high || 0,
      medium: incRaw.medium || 0,
      low: incRaw.low || 0,
      total: incRaw.totalOpen || 0
    };

    const openIncidents = activeIncidents.total;
    const slaBreachedCount = incRaw.slaBreachedCount || 0;
    const complianceRate = openIncidents > 0
      ? Number((((openIncidents - slaBreachedCount) / openIncidents) * 100).toFixed(1))
      : 100.0;

    const slaCompliance = {
      openIncidents,
      slaBreachedCount,
      complianceRate
    };

    // Format Critical Events
    const [criticalUnackCount, top3CriticalEvents] = criticalEventsResult;
    const criticalEvents = {
      unacknowledgedCount: criticalUnackCount,
      topEvents: top3CriticalEvents.map((e) => ({
        _id: e._id,
        eventId: e.eventId,
        severity: e.severity,
        category: e.category,
        explanation: e.explanation,
        firstOccurrence: e.firstOccurrence || e.createdAt,
        deviceId: e.deviceId?._id || e.deviceId,
        deviceName: e.deviceId?.name || 'Device'
      }))
    };

    // Format Firmware Exposure
    const vulnerableVersions = firmwareVersionsResult.filter((f) => f.securityStatus === 'vulnerable').map((f) => f.version);
    const recalledVersions = firmwareVersionsResult.filter((f) => f.securityStatus === 'recalled').map((f) => f.version);

    let vulnerableDeviceCount = 0;
    let recalledDeviceCount = 0;

    if (vulnerableVersions.length > 0 || recalledVersions.length > 0) {
      const [vulnCount, recCount] = await Promise.all([
        vulnerableVersions.length > 0
          ? Device.countDocuments({
              organizationId: orgObjectId,
              status: { $ne: 'decommissioned' },
              currentFirmwareVersion: { $in: vulnerableVersions }
            })
          : 0,
        recalledVersions.length > 0
          ? Device.countDocuments({
              organizationId: orgObjectId,
              status: { $ne: 'decommissioned' },
              currentFirmwareVersion: { $in: recalledVersions }
            })
          : 0
      ]);
      vulnerableDeviceCount = vulnCount;
      recalledDeviceCount = recCount;
    }

    const totalExposed = vulnerableDeviceCount + recalledDeviceCount;
    const exposedPercentage = totalDevices > 0
      ? Number(((totalExposed / totalDevices) * 100).toFixed(1))
      : 0;

    const firmwareExposure = {
      vulnerableDeviceCount,
      recalledDeviceCount,
      totalDevices,
      exposedPercentage
    };

    return {
      fleetPosture: {
        totalDevices,
        elevatedRiskCount,
        averageRiskScore
      },
      activeIncidents,
      slaCompliance,
      criticalEvents,
      deviceHealth: healthMap,
      riskDistribution,
      firmwareExposure,
      topRiskDevices
    };
  }

  /**
   * Aggregates 7-day daily anomaly/security event counts for W7 Anomaly Trend.
   * Ensures exactly N contiguous daily points grouped by UTC date with zero-filling.
   *
   * @param {string} organizationId
   * @param {number} [days=7]
   * @returns {Promise<{ days: number, anomalyTrend: Array<{ date: string, count: number }> }>}
   */
  async getTrends(organizationId, days = 7) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const numDays = Math.min(90, Math.max(1, parseInt(days, 10) || 7));

    // Calculate UTC start time (00:00:00.000 UTC on start day)
    const now = new Date();
    const startDate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - (numDays - 1),
      0, 0, 0, 0
    ));

    const eventCounts = await SecurityEvent.aggregate([
      {
        $match: {
          organizationId: orgObjectId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = {};
    eventCounts.forEach((item) => {
      if (item._id) {
        countMap[item._id] = item.count;
      }
    });

    // Build contiguous array of exactly numDays points
    const anomalyTrend = [];
    for (let i = 0; i < numDays; i++) {
      const d = new Date(Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate() + i
      ));
      const dateStr = d.toISOString().slice(0, 10);
      anomalyTrend.push({
        date: dateStr,
        count: countMap[dateStr] || 0
      });
    }

    return {
      days: numDays,
      anomalyTrend
    };
  }
}

module.exports = new DashboardService();

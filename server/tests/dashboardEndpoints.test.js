const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/token');
const { User, Device, Incident, SecurityEvent, FirmwareVersion } = require('../src/models');
const dashboardService = require('../src/services/dashboard.service');

describe('Dashboard REST Endpoints & Service Aggregation (Phase 11)', () => {
  const orgId = new mongoose.Types.ObjectId();
  const otherOrgId = new mongoose.Types.ObjectId();

  const viewerUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'viewer',
    displayName: 'Viewer Alice',
    email: 'viewer@soc.org',
    isActive: true
  };

  const otherViewerUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: otherOrgId,
    role: 'viewer',
    displayName: 'Other Viewer',
    email: 'viewer@other.org',
    isActive: true
  };

  let viewerToken, otherViewerToken;

  beforeAll(() => {
    viewerToken = generateAccessToken(viewerUser);
    otherViewerToken = generateAccessToken(otherViewerUser);
  });

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      let matched = viewerUser;
      if (idStr === otherViewerUser._id.toString()) matched = otherViewerUser;

      return {
        select: jest.fn().mockResolvedValue({
          ...matched,
          isActive: true
        })
      };
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await new Promise((resolve) => setImmediate(resolve));
  });

  describe('GET /api/v1/dashboard/summary (REST & Auth)', () => {
    it('requires authentication (401 without token)', async () => {
      const res = await request(app).get('/api/v1/dashboard/summary');
      expect(res.status).toBe(401);
    });

    it('returns dashboard summary payload for authorized viewer', async () => {
      const mockSummary = {
        fleetPosture: { totalDevices: 10, elevatedRiskCount: 3, averageRiskScore: 42.5 },
        activeIncidents: { critical: 1, high: 2, medium: 1, low: 0, total: 4 },
        slaCompliance: { openIncidents: 4, slaBreachedCount: 1, complianceRate: 75.0 },
        criticalEvents: { unacknowledgedCount: 2, topEvents: [{ eventId: 'EVT-01' }] },
        deviceHealth: { healthy: 6, degraded: 2, offline: 1, unknown: 1 },
        riskDistribution: { low: 4, medium: 3, high: 2, critical: 1, severe: 0 },
        firmwareExposure: { vulnerableDeviceCount: 1, recalledDeviceCount: 1, totalDevices: 10, exposedPercentage: 20.0 },
        topRiskDevices: [{ deviceId: 'DEV-1', riskScore: 88 }]
      };

      jest.spyOn(dashboardService, 'getSummary').mockResolvedValue(mockSummary);

      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockSummary);
      expect(dashboardService.getSummary).toHaveBeenCalledWith(orgId.toString());
    });
  });

  describe('Dashboard Service Unit Aggregations (W1-W6, W8, W9)', () => {
    it('accurately computes summary on empty fleet', async () => {
      jest.spyOn(Device, 'aggregate').mockResolvedValue([
        {
          posture: [],
          healthDistribution: [],
          riskDistribution: [],
          totalNonDecommissioned: []
        }
      ]);
      jest.spyOn(Incident, 'aggregate').mockResolvedValue([]);
      jest.spyOn(SecurityEvent, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(SecurityEvent, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      });
      jest.spyOn(FirmwareVersion, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      });
      jest.spyOn(Device, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      });

      const summary = await dashboardService.getSummary(orgId.toString());

      expect(summary.fleetPosture).toEqual({ totalDevices: 0, elevatedRiskCount: 0, averageRiskScore: 0 });
      expect(summary.activeIncidents).toEqual({ critical: 0, high: 0, medium: 0, low: 0, total: 0 });
      expect(summary.slaCompliance).toEqual({ openIncidents: 0, slaBreachedCount: 0, complianceRate: 100 });
      expect(summary.criticalEvents).toEqual({ unacknowledgedCount: 0, topEvents: [] });
      expect(summary.deviceHealth).toEqual({ healthy: 0, degraded: 0, offline: 0, unknown: 0 });
      expect(summary.riskDistribution).toEqual({ low: 0, medium: 0, high: 0, critical: 0, severe: 0 });
      expect(summary.firmwareExposure).toEqual({ vulnerableDeviceCount: 0, recalledDeviceCount: 0, totalDevices: 0, exposedPercentage: 0 });
      expect(summary.topRiskDevices).toEqual([]);
    });

    it('accurately parses populated aggregate results and computes SLA and exposure rates', async () => {
      jest.spyOn(Device, 'aggregate').mockResolvedValue([
        {
          posture: [{ totalDevices: 100, elevatedRiskCount: 25, averageRiskScore: 54.321 }],
          healthDistribution: [
            { _id: 'healthy', count: 70 },
            { _id: 'degraded', count: 15 },
            { _id: 'offline', count: 10 },
            { _id: 'unknown', count: 5 }
          ],
          riskDistribution: [{ low: 50, medium: 25, high: 15, critical: 7, severe: 3 }],
          totalNonDecommissioned: [{ count: 100 }]
        }
      ]);

      jest.spyOn(Incident, 'aggregate').mockResolvedValue([
        {
          totalOpen: 10,
          critical: 2,
          high: 4,
          medium: 3,
          low: 1,
          slaBreachedCount: 2
        }
      ]);

      jest.spyOn(SecurityEvent, 'countDocuments').mockResolvedValue(5);
      jest.spyOn(SecurityEvent, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: 'evt-1',
            eventId: 'EVT-CRIT-1',
            severity: 'critical',
            category: 'auth_attack',
            explanation: 'Brute force detected',
            createdAt: new Date(),
            deviceId: { _id: 'dev-1', name: 'Gateway 1' }
          }
        ])
      });

      jest.spyOn(FirmwareVersion, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          { version: '1.0.0-vuln', securityStatus: 'vulnerable' },
          { version: '0.9.0-rec', securityStatus: 'recalled' }
        ])
      });

      jest.spyOn(Device, 'countDocuments').mockImplementation((filter) => {
        if (filter.currentFirmwareVersion?.$in?.includes('1.0.0-vuln')) return Promise.resolve(10);
        if (filter.currentFirmwareVersion?.$in?.includes('0.9.0-rec')) return Promise.resolve(5);
        return Promise.resolve(0);
      });

      jest.spyOn(Device, 'find').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          { deviceId: 'DEV-001', name: 'Pump A', riskScore: 95, riskSeverity: 'severe' }
        ])
      });

      const summary = await dashboardService.getSummary(orgId.toString());

      expect(summary.fleetPosture.totalDevices).toBe(100);
      expect(summary.fleetPosture.elevatedRiskCount).toBe(25);
      expect(summary.fleetPosture.averageRiskScore).toBe(54.3);

      expect(summary.riskDistribution).toEqual({ low: 50, medium: 25, high: 15, critical: 7, severe: 3 });
      expect(summary.deviceHealth).toEqual({ healthy: 70, degraded: 15, offline: 10, unknown: 5 });

      expect(summary.activeIncidents.total).toBe(10);
      expect(summary.activeIncidents.critical).toBe(2);

      // SLA Compliance: (10 - 2) / 10 = 80.0%
      expect(summary.slaCompliance.complianceRate).toBe(80.0);

      expect(summary.criticalEvents.unacknowledgedCount).toBe(5);
      expect(summary.criticalEvents.topEvents[0].eventId).toBe('EVT-CRIT-1');
      expect(summary.criticalEvents.topEvents[0].deviceName).toBe('Gateway 1');

      // Firmware Exposure: (10 + 5) / 100 = 15.0%
      expect(summary.firmwareExposure.vulnerableDeviceCount).toBe(10);
      expect(summary.firmwareExposure.recalledDeviceCount).toBe(5);
      expect(summary.firmwareExposure.exposedPercentage).toBe(15.0);

      expect(summary.topRiskDevices[0].deviceId).toBe('DEV-001');
    });
  });

  describe('GET /api/v1/dashboard/trends (W7 Trend Aggregation)', () => {
    it('returns exactly 7 contiguous UTC daily points with zero filling by default', async () => {
      const todayStr = new Date().toISOString().slice(0, 10);

      jest.spyOn(SecurityEvent, 'aggregate').mockResolvedValue([
        { _id: todayStr, count: 8 }
      ]);

      const res = await request(app)
        .get('/api/v1/dashboard/trends')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.days).toBe(7);
      expect(Array.isArray(res.body.anomalyTrend)).toBe(true);
      expect(res.body.anomalyTrend.length).toBe(7);

      const todayPoint = res.body.anomalyTrend.find((p) => p.date === todayStr);
      expect(todayPoint).toBeDefined();
      expect(todayPoint.count).toBe(8);

      const zeroCountPoints = res.body.anomalyTrend.filter((p) => p.count === 0);
      expect(zeroCountPoints.length).toBe(6);
    });

    it('handles custom days parameter between 1 and 90', async () => {
      jest.spyOn(SecurityEvent, 'aggregate').mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/dashboard/trends?days=14')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.days).toBe(14);
      expect(res.body.anomalyTrend.length).toBe(14);
    });
  });
});

const mongoose = require('mongoose');
const riskService = require('../src/services/risk.service');
const { Device, SecurityEvent } = require('../src/models');

describe('Deterministic Risk Engine (Phase 8)', () => {
  const orgId = new mongoose.Types.ObjectId();
  const deviceId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Zero-Event Edge Cases & Health Posture', () => {
    it('healthy device with 0 active events should have risk score 0 (low)', () => {
      const mockDevice = {
        _id: deviceId,
        organizationId: orgId,
        healthStatus: 'healthy',
        malformedMessageCount: 0
      };

      const result = riskService.calculateRiskForDevice(mockDevice, []);

      expect(result.riskScore).toBe(0);
      expect(result.riskSeverity).toBe('low');
      expect(result.riskFactors).toHaveLength(3);
      expect(result.riskFactors.find(f => f.name === 'Active Security Events').value).toBe(0);
      expect(result.riskFactors.find(f => f.name === 'Device Communication Health').value).toBe(0);
      expect(result.riskFactors.find(f => f.name === 'Anomaly Repetition & Malformed Traffic').value).toBe(0);
    });

    it('unknown health device with 0 active events should have risk score 5 (low)', () => {
      const mockDevice = {
        _id: deviceId,
        organizationId: orgId,
        healthStatus: 'unknown',
        malformedMessageCount: 0
      };

      const result = riskService.calculateRiskForDevice(mockDevice, []);

      expect(result.riskScore).toBe(5);
      expect(result.riskSeverity).toBe('low');
      expect(result.riskFactors.find(f => f.name === 'Device Communication Health').value).toBe(5);
    });

    it('degraded health device with 0 active events should have risk score 10 (low)', () => {
      const mockDevice = {
        _id: deviceId,
        organizationId: orgId,
        healthStatus: 'degraded',
        malformedMessageCount: 0
      };

      const result = riskService.calculateRiskForDevice(mockDevice, []);

      expect(result.riskScore).toBe(10);
      expect(result.riskSeverity).toBe('low');
      expect(result.riskFactors.find(f => f.name === 'Device Communication Health').value).toBe(10);
    });

    it('offline health device with 0 active events should have risk score 20 (medium per bracket >=20)', () => {
      const mockDevice = {
        _id: deviceId,
        organizationId: orgId,
        healthStatus: 'offline',
        malformedMessageCount: 0
      };

      const result = riskService.calculateRiskForDevice(mockDevice, []);

      expect(result.riskScore).toBe(20);
      expect(result.riskSeverity).toBe('medium');
      expect(result.riskFactors.find(f => f.name === 'Device Communication Health').value).toBe(20);
    });
  });

  describe('Approved Base Severity Points & Confidence Multipliers', () => {
    const mockHealthyDevice = {
      _id: deviceId,
      organizationId: orgId,
      healthStatus: 'healthy',
      malformedMessageCount: 0
    };

    it('critical severity event has base score of 30', () => {
      const events = [{ severity: 'critical', confidence: 1.0, occurrenceCount: 1 }];
      const result = riskService.calculateRiskForDevice(mockHealthyDevice, events);
      expect(result.riskScore).toBe(30);
      expect(result.riskSeverity).toBe('medium');
    });

    it('high severity event has base score of 18', () => {
      const events = [{ severity: 'high', confidence: 1.0, occurrenceCount: 1 }];
      const result = riskService.calculateRiskForDevice(mockHealthyDevice, events);
      expect(result.riskScore).toBe(18);
      expect(result.riskSeverity).toBe('low');
    });

    it('medium severity event has base score of 8', () => {
      const events = [{ severity: 'medium', confidence: 1.0, occurrenceCount: 1 }];
      const result = riskService.calculateRiskForDevice(mockHealthyDevice, events);
      expect(result.riskScore).toBe(8);
      expect(result.riskSeverity).toBe('low');
    });

    it('low severity event has base score of 3', () => {
      const events = [{ severity: 'low', confidence: 1.0, occurrenceCount: 1 }];
      const result = riskService.calculateRiskForDevice(mockHealthyDevice, events);
      expect(result.riskScore).toBe(3);
      expect(result.riskSeverity).toBe('low');
    });

    it('scales base points with confidence multipliers (high: 1.0, medium: 0.8, low: 0.6)', () => {
      // Critical (30) * medium confidence (0.8) = 24
      const evMediumConf = [{ severity: 'critical', confidence: 'medium', occurrenceCount: 1 }];
      const resMed = riskService.calculateRiskForDevice(mockHealthyDevice, evMediumConf);
      expect(resMed.riskScore).toBe(24);

      // Critical (30) * low confidence (0.6) = 18
      const evLowConf = [{ severity: 'critical', confidence: 'low', occurrenceCount: 1 }];
      const resLow = riskService.calculateRiskForDevice(mockHealthyDevice, evLowConf);
      expect(resLow.riskScore).toBe(18);

      // High (18) * numeric confidence 0.5 = 9
      const evNumConf = [{ severity: 'high', confidence: 0.5, occurrenceCount: 1 }];
      const resNum = riskService.calculateRiskForDevice(mockHealthyDevice, evNumConf);
      expect(resNum.riskScore).toBe(9);
    });

    it('caps ScoreEvents at 60 points regardless of multiple critical events', () => {
      const mockEvents = [
        { severity: 'critical', confidence: 1.0, occurrenceCount: 1 },
        { severity: 'critical', confidence: 1.0, occurrenceCount: 1 },
        { severity: 'critical', confidence: 1.0, occurrenceCount: 1 }
      ];

      // Raw event score = 30 + 30 + 30 = 90, capped at 60
      const result = riskService.calculateRiskForDevice(mockHealthyDevice, mockEvents);

      expect(result.riskScore).toBe(60);
      expect(result.riskSeverity).toBe('high');
      expect(result.riskFactors.find(f => f.name === 'Active Security Events').value).toBe(60);
    });
  });

  describe('Zero Recency Decay Invariant (Regression Test)', () => {
    it('produces identical score for two identical events with different ages inside the 24-hour active window', () => {
      const mockDevice = {
        _id: deviceId,
        organizationId: orgId,
        healthStatus: 'healthy',
        malformedMessageCount: 0
      };

      const now = new Date();
      // Event A detected 5 minutes ago
      const eventRecent = [
        {
          _id: new mongoose.Types.ObjectId(),
          severity: 'critical', // 30
          confidence: 1.0,
          occurrenceCount: 1,
          lastOccurrence: new Date(now.getTime() - 5 * 60 * 1000)
        }
      ];

      // Event B detected 23 hours ago
      const eventOlder = [
        {
          _id: new mongoose.Types.ObjectId(),
          severity: 'critical', // 30
          confidence: 1.0,
          occurrenceCount: 1,
          lastOccurrence: new Date(now.getTime() - 23 * 60 * 60 * 1000)
        }
      ];

      const resRecent = riskService.calculateRiskForDevice(mockDevice, eventRecent);
      const resOlder = riskService.calculateRiskForDevice(mockDevice, eventOlder);

      // Phase 8 has NO recency decay -> both must yield exact same score (30)
      expect(resRecent.riskScore).toBe(30);
      expect(resOlder.riskScore).toBe(30);
      expect(resRecent.riskScore).toEqual(resOlder.riskScore);
    });
  });

  describe('Frequency & Malformed Message Penalties', () => {
    it('applies recurrence penalty up to 15 points cap and malformed message penalty up to 5 points cap', () => {
      const mockDevice = {
        _id: deviceId,
        organizationId: orgId,
        healthStatus: 'healthy',
        malformedMessageCount: 10 // min(5, 10*1) = 5
      };

      const mockEvents = [
        {
          severity: 'medium', // 8 * 1.0 = 8
          confidence: 1.0,
          occurrenceCount: 10 // (10-1)*3 = 27 -> min(15, 27) = 15
        }
      ];

      // ScoreEvents = 8
      // ScoreHealth = 0
      // ScoreFrequency = 15 + 5 = 20 (cap 20)
      // Total = 8 + 0 + 20 = 28 -> medium
      const result = riskService.calculateRiskForDevice(mockDevice, mockEvents);

      expect(result.riskScore).toBe(28);
      expect(result.riskSeverity).toBe('medium');
      expect(result.riskFactors.find(f => f.name === 'Anomaly Repetition & Malformed Traffic').value).toBe(20);
    });

    it('severe category: bounded at 100 points maximum', () => {
      const mockDevice = {
        _id: deviceId,
        organizationId: orgId,
        healthStatus: 'offline', // 20 pts
        malformedMessageCount: 10 // 5 pts
      };

      const mockEvents = [
        { severity: 'critical', confidence: 1.0, occurrenceCount: 10 }, // 30 pts, freq cap 15
        { severity: 'critical', confidence: 1.0, occurrenceCount: 1 }    // 30 pts -> events total 60 (cap 60)
      ];

      // ScoreEvents = 60
      // ScoreHealth = 20
      // ScoreFrequency = 15 + 5 = 20
      // Total = 60 + 20 + 20 = 100 -> severe [90-100]
      const result = riskService.calculateRiskForDevice(mockDevice, mockEvents);

      expect(result.riskScore).toBe(100);
      expect(result.riskSeverity).toBe('severe');
    });
  });

  describe('Strict Phase 8 Risk Factors Representation', () => {
    it('returns exactly 3 Phase 8 risk factors with no future-phase placeholders', () => {
      const mockDevice = {
        _id: deviceId,
        organizationId: orgId,
        healthStatus: 'degraded', // 10 pts
        malformedMessageCount: 2 // 2 pts
      };

      const mockEvents = [
        { severity: 'high', confidence: 1.0, occurrenceCount: 3 } // 18 pts, (3-1)*3 = 6 pts freq
      ];

      const result = riskService.calculateRiskForDevice(mockDevice, mockEvents);

      // Must contain EXACTLY 3 factors
      expect(result.riskFactors).toHaveLength(3);

      const factorNames = result.riskFactors.map(f => f.name);
      expect(factorNames).toEqual([
        'Active Security Events',
        'Device Communication Health',
        'Anomaly Repetition & Malformed Traffic'
      ]);

      // Check max values
      expect(result.riskFactors.find(f => f.name === 'Active Security Events').maxValue).toBe(60);
      expect(result.riskFactors.find(f => f.name === 'Device Communication Health').maxValue).toBe(20);
      expect(result.riskFactors.find(f => f.name === 'Anomaly Repetition & Malformed Traffic').maxValue).toBe(20);

      // Verify absence of future phase factors
      expect(factorNames).not.toContain('Firmware Vulnerability Exposure');
      expect(factorNames).not.toContain('Attack Correlation Multiplier');
      expect(factorNames).not.toContain('Incident Escalation Offset');
    });
  });

  describe('Exact Severity Bracket Boundaries', () => {
    it('classifies every exact severity boundary accurately', () => {
      // 0–19 => low
      expect(riskService.classifyRiskSeverity(0)).toBe('low');
      expect(riskService.classifyRiskSeverity(19)).toBe('low');

      // 20–49 => medium
      expect(riskService.classifyRiskSeverity(20)).toBe('medium');
      expect(riskService.classifyRiskSeverity(49)).toBe('medium');

      // 50–74 => high
      expect(riskService.classifyRiskSeverity(50)).toBe('high');
      expect(riskService.classifyRiskSeverity(74)).toBe('high');

      // 75–89 => critical
      expect(riskService.classifyRiskSeverity(75)).toBe('critical');
      expect(riskService.classifyRiskSeverity(89)).toBe('critical');

      // 90–100 => severe
      expect(riskService.classifyRiskSeverity(90)).toBe('severe');
      expect(riskService.classifyRiskSeverity(100)).toBe('severe');
    });
  });

  describe('Fleet Risk Summary Aggregation', () => {
    it('aggregates organization device risk profiles correctly', async () => {
      const mockTopDevices = [
        { _id: new mongoose.Types.ObjectId(), deviceId: 'DEV-01', riskScore: 80, riskSeverity: 'critical' },
        { _id: new mongoose.Types.ObjectId(), deviceId: 'DEV-02', riskScore: 60, riskSeverity: 'high' }
      ];

      const mockFacet = [
        {
          total: [{ count: 4 }],
          avgScore: [{ avg: 37.5, max: 80 }],
          bySeverity: [
            { _id: 'critical', count: 1 },
            { _id: 'high', count: 1 },
            { _id: 'low', count: 2 }
          ],
          highRisk: [{ count: 2 }],
          zeroRisk: [{ count: 1 }],
          pendingCalc: [{ count: 0 }]
        }
      ];

      jest.spyOn(Device, 'aggregate').mockResolvedValue(mockFacet);
      jest.spyOn(Device, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockTopDevices)
            })
          })
        })
      });

      const summary = await riskService.getFleetRiskSummary(orgId);

      expect(summary.totalDevices).toBe(4);
      expect(summary.averageRiskScore).toBe(37.5);
      expect(summary.maxRiskScore).toBe(80);
      expect(summary.highRiskDeviceCount).toBe(2);
      expect(summary.devicesByRiskSeverity).toEqual({
        low: 2,
        medium: 0,
        high: 1,
        critical: 1,
        severe: 0
      });
      expect(summary.topAtRiskDevices).toHaveLength(2);
      expect(summary.topAtRiskDevices[0].deviceId).toBe('DEV-01');
    });

    it('returns clean zero defaults when organization has zero devices', async () => {
      jest.spyOn(Device, 'aggregate').mockResolvedValue([
        {
          total: [],
          avgScore: [],
          bySeverity: [],
          highRisk: [],
          zeroRisk: [],
          pendingCalc: []
        }
      ]);

      jest.spyOn(Device, 'find').mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([])
            })
          })
        })
      });

      const summary = await riskService.getFleetRiskSummary(orgId);

      expect(summary.totalDevices).toBe(0);
      expect(summary.averageRiskScore).toBe(0);
      expect(summary.highRiskDeviceCount).toBe(0);
      expect(summary.devicesByRiskSeverity.low).toBe(0);
    });
  });
});

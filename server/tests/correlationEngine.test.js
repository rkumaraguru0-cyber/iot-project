const mongoose = require('mongoose');
const correlationService = require('../src/services/correlation.service');
const incidentService = require('../src/services/incident.service');
const { SecurityEvent, Incident, Device, Organization, AuditLog } = require('../src/models');

describe('Event Correlation Engine (Phase 9)', () => {
  const orgId = new mongoose.Types.ObjectId();
  const otherOrgId = new mongoose.Types.ObjectId();
  const devId = new mongoose.Types.ObjectId();

  const mockDevice = {
    _id: devId,
    deviceId: 'DEV-TS-001',
    name: 'Core Gateway 01',
    type: 'industrial_gateway',
    organizationId: orgId,
    riskScore: 45
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Device, 'findOne').mockResolvedValue(mockDevice);
    jest.spyOn(AuditLog, 'create').mockResolvedValue({});
    jest.spyOn(Organization, 'findById').mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ settings: {} })
      })
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => setImmediate(resolve));
  });

  describe('Strategy 1: Same-Device Temporal Clustering (CORR-TEMPORAL)', () => {
    it('should correlate >= 3 events within 30 min on same device with at least 1 >= medium severity', async () => {
      // Mock 3 recent unassigned security events
      const candidateEvents = [
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: 'EVT-001',
          ruleId: 'RULE-001',
          ruleName: 'High CPU Usage',
          severity: 'medium',
          explanation: 'CPU spike',
          category: 'threshold',
          lastOccurrence: new Date()
        },
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: 'EVT-002',
          ruleId: 'RULE-004',
          ruleName: 'Network Egress Spike',
          severity: 'high',
          explanation: 'Egress spike',
          category: 'rate',
          lastOccurrence: new Date()
        },
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: 'EVT-003',
          ruleId: 'RULE-008',
          ruleName: 'Off-Schedule Activity',
          severity: 'low',
          explanation: 'Activity outside schedule',
          category: 'behavioral',
          lastOccurrence: new Date()
        }
      ];

      jest.spyOn(Incident, 'findOne').mockResolvedValue(null); // No open incident
      jest.spyOn(SecurityEvent, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(candidateEvents)
        })
      });

      const spyCreate = jest.spyOn(incidentService, 'createIncident').mockResolvedValue({
        incidentId: 'INC-20260905-1234',
        severity: 'high',
        status: 'detected',
        correlationDetails: {
          strategyId: 'CORR-TEMPORAL',
          strategyName: 'Same-Device Temporal Clustering',
          eventCount: 3
        }
      });

      const triggeringEvent = candidateEvents[0];
      const result = await correlationService.processSecurityEvent({
        ...triggeringEvent,
        organizationId: orgId,
        deviceId: devId
      });

      expect(spyCreate).toHaveBeenCalledTimes(1);
      const createArgs = spyCreate.mock.calls[0][0];
      expect(createArgs.correlationDetails.strategyId).toBe('CORR-TEMPORAL');
      expect(createArgs.severity).toBe('high'); // Max severity among (medium, high, low)
      expect(createArgs.relatedEventIds).toEqual(['EVT-001', 'EVT-002', 'EVT-003']);
      expect(result.incidentId).toBe('INC-20260905-1234');
    });

    it('should NOT trigger Strategy 1 if event count is less than 3', async () => {
      const candidateEvents = [
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: 'EVT-001',
          ruleId: 'RULE-001',
          severity: 'high',
          lastOccurrence: new Date()
        },
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: 'EVT-002',
          ruleId: 'RULE-002',
          severity: 'medium',
          lastOccurrence: new Date()
        }
      ];

      jest.spyOn(Incident, 'findOne').mockResolvedValue(null);
      jest.spyOn(SecurityEvent, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(candidateEvents)
        })
      });

      const spyCreate = jest.spyOn(incidentService, 'createIncident');

      // Trigger with low severity so standalone does not trigger
      await correlationService.processSecurityEvent({
        _id: new mongoose.Types.ObjectId(),
        eventId: 'EVT-003',
        severity: 'low',
        organizationId: orgId,
        deviceId: devId
      });

      // Neither Strategy 1 nor standalone should create an incident
      expect(spyCreate).not.toHaveBeenCalled();
    });

    it('should NOT trigger Strategy 1 if all 3 events are low severity', async () => {
      const candidateEvents = [
        { _id: new mongoose.Types.ObjectId(), eventId: 'EVT-1', severity: 'low', lastOccurrence: new Date() },
        { _id: new mongoose.Types.ObjectId(), eventId: 'EVT-2', severity: 'low', lastOccurrence: new Date() },
        { _id: new mongoose.Types.ObjectId(), eventId: 'EVT-3', severity: 'low', lastOccurrence: new Date() }
      ];

      jest.spyOn(Incident, 'findOne').mockResolvedValue(null);
      jest.spyOn(SecurityEvent, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(candidateEvents)
        })
      });

      const spyCreate = jest.spyOn(incidentService, 'createIncident');

      await correlationService.processSecurityEvent({
        _id: new mongoose.Types.ObjectId(),
        eventId: 'EVT-1',
        severity: 'low',
        organizationId: orgId,
        deviceId: devId
      });

      expect(spyCreate).not.toHaveBeenCalled();
    });
  });

  describe('Strategy 2: Same-Rule Repeated Clustering (CORR-REPEATED)', () => {
    it('should escalate medium -> high when same rule triggers >= 5 times within 60 min', async () => {
      const candidates = [
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: 'EVT-010',
          ruleId: 'RULE-001',
          ruleName: 'High CPU Usage',
          occurrenceCount: 5,
          severity: 'medium',
          category: 'threshold',
          lastOccurrence: new Date()
        }
      ];

      jest.spyOn(Incident, 'findOne').mockResolvedValue(null);
      // Mock find: first call for Strategy 1 (return 1 candidate < 3), second call for Strategy 2 (return candidate with 5 occurrences)
      jest.spyOn(SecurityEvent, 'find')
        .mockReturnValueOnce({
          sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([candidates[0]]) })
        })
        .mockReturnValueOnce({
          sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(candidates) })
        });

      const spyCreate = jest.spyOn(incidentService, 'createIncident').mockResolvedValue({
        incidentId: 'INC-20260905-5555',
        severity: 'high'
      });

      await correlationService.processSecurityEvent({
        _id: new mongoose.Types.ObjectId(),
        eventId: 'EVT-010',
        ruleId: 'RULE-001',
        ruleName: 'High CPU Usage',
        severity: 'medium',
        organizationId: orgId,
        deviceId: devId
      });

      expect(spyCreate).toHaveBeenCalledTimes(1);
      const args = spyCreate.mock.calls[0][0];
      expect(args.correlationDetails.strategyId).toBe('CORR-REPEATED');
      expect(args.severity).toBe('high'); // medium escalated to high
      expect(args.correlationDetails.eventCount).toBe(5);
    });

    it('should escalate high -> critical when high severity rule triggers >= 5 times', async () => {
      const candidates = [
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: 'EVT-020',
          ruleId: 'RULE-004',
          ruleName: 'Network Egress Spike',
          occurrenceCount: 5,
          severity: 'high',
          category: 'rate',
          lastOccurrence: new Date()
        }
      ];

      jest.spyOn(Incident, 'findOne').mockResolvedValue(null);
      jest.spyOn(SecurityEvent, 'find')
        .mockReturnValueOnce({
          sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([candidates[0]]) })
        })
        .mockReturnValueOnce({
          sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(candidates) })
        });

      const spyCreate = jest.spyOn(incidentService, 'createIncident').mockResolvedValue({
        incidentId: 'INC-20260905-9999',
        severity: 'critical'
      });

      await correlationService.processSecurityEvent({
        _id: new mongoose.Types.ObjectId(),
        eventId: 'EVT-020',
        ruleId: 'RULE-004',
        severity: 'high',
        organizationId: orgId,
        deviceId: devId
      });

      expect(spyCreate).toHaveBeenCalledTimes(1);
      const args = spyCreate.mock.calls[0][0];
      expect(args.severity).toBe('critical'); // high escalated to critical
    });
  });

  describe('Strategy 3: Severity Escalation on Open Incident (CORR-ESCALATION)', () => {
    it('should attach new event and escalate open incident severity when event severity > incident severity', async () => {
      const openIncidentMock = {
        _id: new mongoose.Types.ObjectId(),
        incidentId: 'INC-20260905-0001',
        severity: 'medium',
        status: 'investigating',
        relatedEventIds: ['EVT-OLD-1'],
        evidence: [],
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({
          incidentId: 'INC-20260905-0001',
          severity: 'critical',
          status: 'investigating'
        })
      };

      jest.spyOn(Incident, 'findOne').mockResolvedValue(openIncidentMock);
      jest.spyOn(SecurityEvent, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

      const newCriticalEvent = {
        _id: new mongoose.Types.ObjectId(),
        eventId: 'EVT-NEW-99',
        severity: 'critical',
        explanation: 'Brute force credential attack detected',
        organizationId: orgId,
        deviceId: devId
      };

      const result = await correlationService.processSecurityEvent(newCriticalEvent);

      expect(openIncidentMock.severity).toBe('critical'); // Escalated from medium to critical
      expect(openIncidentMock.relatedEventIds).toContain('EVT-NEW-99');
      expect(openIncidentMock.save).toHaveBeenCalledTimes(1);
      expect(SecurityEvent.updateOne).toHaveBeenCalledWith(
        { _id: newCriticalEvent._id },
        { $set: { incidentId: 'INC-20260905-0001' } }
      );
      expect(result.incidentId).toBe('INC-20260905-0001');
    });

    it('should attach event without escalating if incoming event severity is equal or lower', async () => {
      const openIncidentMock = {
        _id: new mongoose.Types.ObjectId(),
        incidentId: 'INC-20260905-0002',
        severity: 'high',
        status: 'triaged',
        relatedEventIds: ['EVT-01'],
        evidence: [],
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({
          incidentId: 'INC-20260905-0002',
          severity: 'high'
        })
      };

      jest.spyOn(Incident, 'findOne').mockResolvedValue(openIncidentMock);
      jest.spyOn(SecurityEvent, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

      const newMediumEvent = {
        _id: new mongoose.Types.ObjectId(),
        eventId: 'EVT-02',
        severity: 'medium',
        explanation: 'CPU surge',
        organizationId: orgId,
        deviceId: devId
      };

      await correlationService.processSecurityEvent(newMediumEvent);

      expect(openIncidentMock.severity).toBe('high'); // Retained original high severity
      expect(openIncidentMock.relatedEventIds).toContain('EVT-02');
      expect(openIncidentMock.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('Standalone High/Critical Incident Creation', () => {
    it('should create a standalone incident for un-correlated critical event with null correlationDetails', async () => {
      jest.spyOn(Incident, 'findOne').mockResolvedValue(null);
      // Both Strategy 1 and 2 return empty candidates
      jest.spyOn(SecurityEvent, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) })
      });

      const spyCreate = jest.spyOn(incidentService, 'createIncident').mockResolvedValue({
        incidentId: 'INC-STANDALONE-01',
        severity: 'critical',
        correlationDetails: null
      });

      const criticalEvent = {
        _id: new mongoose.Types.ObjectId(),
        eventId: 'EVT-BRUTE-01',
        ruleId: 'RULE-006',
        ruleName: 'Authentication Brute Force',
        severity: 'critical',
        explanation: '5 failed auth attempts in 10 minutes',
        category: 'auth',
        organizationId: orgId,
        deviceId: devId
      };

      const result = await correlationService.processSecurityEvent(criticalEvent);

      expect(spyCreate).toHaveBeenCalledTimes(1);
      const args = spyCreate.mock.calls[0][0];
      expect(args.severity).toBe('critical');
      expect(args.correlationDetails).toBeNull();
      expect(args.relatedEventIds).toEqual(['EVT-BRUTE-01']);
      expect(result.incidentId).toBe('INC-STANDALONE-01');
    });
  });

  describe('Tenant Isolation & Deduplication', () => {
    it('should never correlate events belonging to another organization', async () => {
      jest.spyOn(Device, 'findOne').mockResolvedValue(null); // Device not found in otherOrgId
      const spyCreate = jest.spyOn(incidentService, 'createIncident');

      const result = await correlationService.processSecurityEvent({
        _id: new mongoose.Types.ObjectId(),
        eventId: 'EVT-CROSS-ORG',
        severity: 'high',
        organizationId: otherOrgId,
        deviceId: devId
      });

      expect(result).toBeNull();
      expect(spyCreate).not.toHaveBeenCalled();
    });
  });
});

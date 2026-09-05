const mongoose = require('mongoose');
const securityEventService = require('../src/services/securityEvent.service');
const riskService = require('../src/services/risk.service');
const { SecurityEvent, Device } = require('../src/models');

describe('SecurityEvent Service & Aggregation (Phase 8)', () => {
  const orgId = new mongoose.Types.ObjectId();
  const otherOrgId = new mongoose.Types.ObjectId();
  const deviceObjectId = new mongoose.Types.ObjectId();

  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'org_admin',
    displayName: 'Admin User'
  };

  const analystUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'security_analyst',
    displayName: 'Analyst Jane'
  };

  const operatorUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'operator',
    displayName: 'Operator Bob'
  };

  const viewerUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'viewer',
    displayName: 'Viewer Alice'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(riskService, 'recalculateDeviceRisk').mockResolvedValue({});
  });

  afterEach(async () => {
    await new Promise((resolve) => setImmediate(resolve));
  });

  describe('Anomaly -> SecurityEvent Ingestion & Aggregation', () => {
    it('should create a new SecurityEvent when no active event exists in 1-hour window', async () => {
      const anomalyRecord = {
        _id: new mongoose.Types.ObjectId(),
        organizationId: orgId,
        deviceId: deviceObjectId,
        ruleId: 'RULE-CPU-HIGH',
        ruleName: 'High CPU Usage',
        severity: 'high',
        confidence: 0.9,
        explanation: 'CPU exceeded 85% for 2 consecutive cycles',
        metric: 'cpu',
        observedValue: 88,
        thresholdValue: 85,
        detectedAt: new Date()
      };

      jest.spyOn(SecurityEvent, 'findOneAndUpdate').mockResolvedValue(null);

      const createdEventMock = {
        _id: new mongoose.Types.ObjectId(),
        eventId: 'EVT-20260905-ABCDEF',
        ...anomalyRecord,
        status: 'open',
        occurrenceCount: 1,
        firstOccurrence: anomalyRecord.detectedAt,
        lastOccurrence: anomalyRecord.detectedAt
      };

      const spyCreate = jest.spyOn(SecurityEvent, 'create').mockResolvedValue(createdEventMock);

      const result = await securityEventService.processAnomaly(anomalyRecord);

      expect(spyCreate).toHaveBeenCalledTimes(1);
      expect(spyCreate).toHaveBeenCalledWith(expect.objectContaining({
        organizationId: orgId,
        deviceId: deviceObjectId,
        ruleId: 'RULE-CPU-HIGH',
        severity: 'high',
        status: 'open',
        occurrenceCount: 1,
        metric: 'cpu',
        observedValue: 88,
        thresholdValue: 85
      }));
      expect(result.occurrenceCount).toBe(1);
    });

    it('should atomically aggregate into existing active event if within 1-hour window', async () => {
      const anomalyRecord = {
        _id: new mongoose.Types.ObjectId(),
        organizationId: orgId,
        deviceId: deviceObjectId,
        ruleId: 'RULE-CPU-HIGH',
        ruleName: 'High CPU Usage',
        severity: 'high',
        confidence: 0.9,
        explanation: 'CPU spike',
        metric: 'cpu',
        observedValue: 92,
        thresholdValue: 85,
        detectedAt: new Date()
      };

      const existingUpdatedMock = {
        _id: new mongoose.Types.ObjectId(),
        eventId: 'EVT-20260905-112233',
        organizationId: orgId,
        deviceId: deviceObjectId,
        ruleId: 'RULE-CPU-HIGH',
        severity: 'high',
        status: 'open',
        occurrenceCount: 3,
        lastOccurrence: anomalyRecord.detectedAt
      };

      const spyFindOneAndUpdate = jest.spyOn(SecurityEvent, 'findOneAndUpdate').mockResolvedValue(existingUpdatedMock);
      const spyCreate = jest.spyOn(SecurityEvent, 'create');

      const result = await securityEventService.processAnomaly(anomalyRecord);

      expect(spyFindOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          deviceId: deviceObjectId,
          ruleId: 'RULE-CPU-HIGH',
          status: { $in: ['open', 'acknowledged'] }
        }),
        expect.objectContaining({
          $inc: { occurrenceCount: 1 },
          $set: expect.objectContaining({
            lastOccurrence: anomalyRecord.detectedAt,
            observedValue: 92
          })
        }),
        expect.objectContaining({ new: true })
      );

      expect(spyCreate).not.toHaveBeenCalled();
      expect(result.occurrenceCount).toBe(3);
    });
  });

  describe('RBAC & Security Event State Machine Transitions', () => {
    const createMockEvent = (status = 'open') => ({
      _id: new mongoose.Types.ObjectId(),
      eventId: 'EVT-20260905-998877',
      organizationId: orgId,
      deviceId: deviceObjectId,
      ruleId: 'RULE-CPU-HIGH',
      status,
      toObject: function() { return { ...this }; },
      save: jest.fn().mockImplementation(function() { return Promise.resolve(this); })
    });

    // 1. Operator: open -> acknowledged ONLY
    it('operator open -> acknowledged PASS', async () => {
      const eventInstance = createMockEvent('open');
      jest.spyOn(SecurityEvent, 'findOne').mockResolvedValue(eventInstance);

      const updated = await securityEventService.updateEventStatus(
        eventInstance._id,
        orgId,
        'acknowledged',
        null,
        operatorUser
      );

      expect(updated.status).toBe('acknowledged');
      expect(eventInstance.save).toHaveBeenCalled();
    });

    it('operator acknowledged -> acknowledged FAIL', async () => {
      const eventInstance = createMockEvent('acknowledged');
      jest.spyOn(SecurityEvent, 'findOne').mockResolvedValue(eventInstance);

      await expect(
        securityEventService.updateEventStatus(
          eventInstance._id,
          orgId,
          'acknowledged',
          null,
          operatorUser
        )
      ).rejects.toThrow(/Invalid status transition/i);
    });

    it('operator resolved -> acknowledged FAIL', async () => {
      const eventInstance = createMockEvent('resolved');
      jest.spyOn(SecurityEvent, 'findOne').mockResolvedValue(eventInstance);

      await expect(
        securityEventService.updateEventStatus(
          eventInstance._id,
          orgId,
          'acknowledged',
          null,
          operatorUser
        )
      ).rejects.toThrow(/Invalid status transition/i);
    });

    it('operator false_positive -> acknowledged FAIL', async () => {
      const eventInstance = createMockEvent('false_positive');
      jest.spyOn(SecurityEvent, 'findOne').mockResolvedValue(eventInstance);

      await expect(
        securityEventService.updateEventStatus(
          eventInstance._id,
          orgId,
          'acknowledged',
          null,
          operatorUser
        )
      ).rejects.toThrow(/Invalid status transition/i);
    });

    it('operator open -> resolved FAIL', async () => {
      const eventInstance = createMockEvent('open');
      jest.spyOn(SecurityEvent, 'findOne').mockResolvedValue(eventInstance);

      await expect(
        securityEventService.updateEventStatus(
          eventInstance._id,
          orgId,
          'resolved',
          'Note',
          operatorUser
        )
      ).rejects.toThrow(/Invalid status transition/i);
    });

    it('operator open -> false_positive FAIL', async () => {
      const eventInstance = createMockEvent('open');
      jest.spyOn(SecurityEvent, 'findOne').mockResolvedValue(eventInstance);

      await expect(
        securityEventService.updateEventStatus(
          eventInstance._id,
          orgId,
          'false_positive',
          null,
          operatorUser
        )
      ).rejects.toThrow(/Invalid status transition/i);
    });

    // 2. Security Analyst Transitions
    it('analyst open -> resolved PASS', async () => {
      const eventInstance = createMockEvent('open');
      jest.spyOn(SecurityEvent, 'findOne').mockResolvedValue(eventInstance);

      const updated = await securityEventService.updateEventStatus(
        eventInstance._id,
        orgId,
        'resolved',
        'Resolved runaway process',
        analystUser
      );

      expect(updated.status).toBe('resolved');
      expect(updated.resolvedBy).toEqual(analystUser._id);
      expect(updated.resolutionNote).toBe('Resolved runaway process');
      expect(updated.resolvedAt).toBeInstanceOf(Date);
    });

    it('analyst acknowledged -> false_positive PASS', async () => {
      const eventInstance = createMockEvent('acknowledged');
      jest.spyOn(SecurityEvent, 'findOne').mockResolvedValue(eventInstance);

      const updated = await securityEventService.updateEventStatus(
        eventInstance._id,
        orgId,
        'false_positive',
        'Legitimate test',
        analystUser
      );

      expect(updated.status).toBe('false_positive');
      expect(updated.resolvedBy).toEqual(analystUser._id);
      expect(updated.resolvedAt).toBeInstanceOf(Date);
    });

    it('analyst resolved -> false_positive FAIL', async () => {
      const eventInstance = createMockEvent('resolved');
      jest.spyOn(SecurityEvent, 'findOne').mockResolvedValue(eventInstance);

      await expect(
        securityEventService.updateEventStatus(
          eventInstance._id,
          orgId,
          'false_positive',
          null,
          analystUser
        )
      ).rejects.toThrow(/Invalid status transition/i);
    });

    it('analyst false_positive -> resolved FAIL', async () => {
      const eventInstance = createMockEvent('false_positive');
      jest.spyOn(SecurityEvent, 'findOne').mockResolvedValue(eventInstance);

      await expect(
        securityEventService.updateEventStatus(
          eventInstance._id,
          orgId,
          'resolved',
          null,
          analystUser
        )
      ).rejects.toThrow(/Invalid status transition/i);
    });

    it('analyst resolved -> open PASS', async () => {
      const eventInstance = createMockEvent('resolved');
      eventInstance.resolvedBy = analystUser._id;
      eventInstance.resolvedAt = new Date();
      eventInstance.resolutionNote = 'Old note';

      jest.spyOn(SecurityEvent, 'findOne').mockResolvedValue(eventInstance);

      const updated = await securityEventService.updateEventStatus(
        eventInstance._id,
        orgId,
        'open',
        null,
        analystUser
      );

      expect(updated.status).toBe('open');
      expect(updated.resolvedBy).toBeNull();
      expect(updated.resolvedAt).toBeNull();
      expect(updated.resolutionNote).toBeNull();
    });

    it('analyst false_positive -> open PASS', async () => {
      const eventInstance = createMockEvent('false_positive');
      eventInstance.resolvedBy = analystUser._id;
      eventInstance.resolvedAt = new Date();

      jest.spyOn(SecurityEvent, 'findOne').mockResolvedValue(eventInstance);

      const updated = await securityEventService.updateEventStatus(
        eventInstance._id,
        orgId,
        'open',
        null,
        analystUser
      );

      expect(updated.status).toBe('open');
      expect(updated.resolvedBy).toBeNull();
    });

    // 3. Admin Authority
    it('org_admin has full status transition authority', async () => {
      const eventInstance = createMockEvent('resolved');
      jest.spyOn(SecurityEvent, 'findOne').mockResolvedValue(eventInstance);

      const updated = await securityEventService.updateEventStatus(
        eventInstance._id,
        orgId,
        'false_positive',
        'Admin override',
        adminUser
      );

      expect(updated.status).toBe('false_positive');
      expect(updated.resolutionNote).toBe('Admin override');
    });

    // 4. Viewer Restrictions
    it('viewer role is FORBIDDEN from performing any status transition', async () => {
      const eventInstance = createMockEvent('open');
      jest.spyOn(SecurityEvent, 'findOne').mockResolvedValue(eventInstance);

      await expect(
        securityEventService.updateEventStatus(
          eventInstance._id,
          orgId,
          'acknowledged',
          null,
          viewerUser
        )
      ).rejects.toThrow(/Viewers are not authorized/i);
    });

    // 5. Tenant Isolation
    it('tenant isolation: prevents accessing or modifying event belonging to another org', async () => {
      jest.spyOn(SecurityEvent, 'findOne').mockResolvedValue(null);

      await expect(
        securityEventService.updateEventStatus(
          deviceObjectId,
          otherOrgId,
          'acknowledged',
          null,
          analystUser
        )
      ).rejects.toThrow(/not found/i);
    });
  });
});

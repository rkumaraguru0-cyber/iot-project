const mongoose = require('mongoose');
const incidentService = require('../src/services/incident.service');
const { Incident, Device, User, SecurityEvent, Organization, AuditLog } = require('../src/models');

describe('Incident Lifecycle & State Machine (Phase 9)', () => {
  const orgId = new mongoose.Types.ObjectId();
  const devId = new mongoose.Types.ObjectId();

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

  describe('SLA Deadline Calculations & Exact Breach Semantics', () => {
    it('should calculate SLA deadlines accurately for all four severities according to Phase 9 matrix', () => {
      const now = new Date('2026-09-05T12:00:00Z');

      // Critical: 15 min triage, 4 hours (240 min) resolve
      const criticalSla = incidentService.calculateSlaDeadlines('critical', now);
      expect(criticalSla.slaTriageDeadline.toISOString()).toBe('2026-09-05T12:15:00.000Z');
      expect(criticalSla.slaResolveDeadline.toISOString()).toBe('2026-09-05T16:00:00.000Z');

      // High: 1 hour (60 min) triage, 24 hours (1440 min) resolve
      const highSla = incidentService.calculateSlaDeadlines('high', now);
      expect(highSla.slaTriageDeadline.toISOString()).toBe('2026-09-05T13:00:00.000Z');
      expect(highSla.slaResolveDeadline.toISOString()).toBe('2026-09-06T12:00:00.000Z');

      // Medium: 4 hours (240 min) triage, 72 hours (4320 min) resolve
      const mediumSla = incidentService.calculateSlaDeadlines('medium', now);
      expect(mediumSla.slaTriageDeadline.toISOString()).toBe('2026-09-05T16:00:00.000Z');
      expect(mediumSla.slaResolveDeadline.toISOString()).toBe('2026-09-08T12:00:00.000Z');

      // Low: 24 hours (1440 min) triage, 7 days (10080 min / 168 hours) resolve
      const lowSla = incidentService.calculateSlaDeadlines('low', now);
      expect(lowSla.slaTriageDeadline.toISOString()).toBe('2026-09-06T12:00:00.000Z');
      expect(lowSla.slaResolveDeadline.toISOString()).toBe('2026-09-12T12:00:00.000Z');
    });

    it('should respect custom organization SLA threshold overrides if configured', () => {
      const now = new Date('2026-09-05T12:00:00Z');
      const customSettings = {
        slaThresholds: {
          critical: { triage: 10, resolve: 120 }
        }
      };

      const customSla = incidentService.calculateSlaDeadlines('critical', now, customSettings);
      expect(customSla.slaTriageDeadline.toISOString()).toBe('2026-09-05T12:10:00.000Z');
      expect(customSla.slaResolveDeadline.toISOString()).toBe('2026-09-05T14:00:00.000Z');
    });

    it('should set slaBreached = true when triagedAt > slaTriageDeadline', async () => {
      const detectedAt = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
      const slaTriageDeadline = new Date(Date.now() - 15 * 60 * 1000); // Expired 15 min ago

      const mockIncident = {
        _id: new mongoose.Types.ObjectId(),
        incidentId: 'INC-20260905-0001',
        status: 'detected',
        severity: 'critical',
        organizationId: orgId,
        detectedAt,
        slaTriageDeadline,
        slaResolveDeadline: new Date(Date.now() + 3 * 60 * 60 * 1000),
        slaBreached: false,
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
        toObject: function() { return this; }
      };

      jest.spyOn(Incident, 'findOne').mockResolvedValue(mockIncident);

      const updated = await incidentService.updateIncidentStatus(
        mockIncident.incidentId,
        orgId,
        'triaged',
        'Acknowledged late',
        operatorUser
      );

      expect(updated.status).toBe('triaged');
      expect(updated.slaBreached).toBe(true); // Persisted SLA breach verified
      expect(mockIncident.save).toHaveBeenCalled();
    });

    it('should NOT set slaBreached when triaged within SLA deadline', async () => {
      const detectedAt = new Date();
      const slaTriageDeadline = new Date(Date.now() + 15 * 60 * 1000); // Future

      const mockIncident = {
        _id: new mongoose.Types.ObjectId(),
        incidentId: 'INC-20260905-0002',
        status: 'detected',
        severity: 'critical',
        organizationId: orgId,
        detectedAt,
        slaTriageDeadline,
        slaResolveDeadline: new Date(Date.now() + 3 * 60 * 60 * 1000),
        slaBreached: false,
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
        toObject: function() { return this; }
      };

      jest.spyOn(Incident, 'findOne').mockResolvedValue(mockIncident);

      const updated = await incidentService.updateIncidentStatus(
        mockIncident.incidentId,
        orgId,
        'triaged',
        'Triaged promptly',
        operatorUser
      );

      expect(updated.status).toBe('triaged');
      expect(updated.slaBreached).toBe(false);
    });

    it('should set slaBreached = true when resolving after slaResolveDeadline', async () => {
      const slaResolveDeadline = new Date(Date.now() - 60 * 60 * 1000); // Expired 1 hour ago

      const mockIncident = {
        _id: new mongoose.Types.ObjectId(),
        incidentId: 'INC-20260905-0003',
        status: 'containment',
        severity: 'high',
        organizationId: orgId,
        slaTriageDeadline: new Date(Date.now() - 20 * 60 * 60 * 1000),
        slaResolveDeadline,
        slaBreached: false,
        triagedAt: new Date(Date.now() - 22 * 60 * 60 * 1000),
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
        toObject: function() { return this; }
      };

      jest.spyOn(Incident, 'findOne').mockResolvedValue(mockIncident);

      const updated = await incidentService.resolveIncident(
        mockIncident.incidentId,
        orgId,
        { summary: 'Resolved late', rootCause: 'Delayed hardware reboot' },
        analystUser
      );

      expect(updated.status).toBe('resolved');
      expect(updated.slaBreached).toBe(true);
      expect(mockIncident.save).toHaveBeenCalled();
    });

    it('should NOT set slaBreached when resolving within slaResolveDeadline', async () => {
      const slaResolveDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours future

      const mockIncident = {
        _id: new mongoose.Types.ObjectId(),
        incidentId: 'INC-20260905-0004',
        status: 'containment',
        severity: 'high',
        organizationId: orgId,
        slaTriageDeadline: new Date(Date.now() - 10 * 60 * 60 * 1000),
        slaResolveDeadline,
        slaBreached: false,
        triagedAt: new Date(Date.now() - 11 * 60 * 60 * 1000),
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
        toObject: function() { return this; }
      };

      jest.spyOn(Incident, 'findOne').mockResolvedValue(mockIncident);

      const updated = await incidentService.resolveIncident(
        mockIncident.incidentId,
        orgId,
        { summary: 'Resolved on time', rootCause: 'Known firmware bug' },
        analystUser
      );

      expect(updated.status).toBe('resolved');
      expect(updated.slaBreached).toBe(false);
    });
  });

  describe('7-State Lifecycle State Machine Transitions', () => {
    const validPaths = [
      { from: 'detected', to: 'triaged', user: operatorUser },
      { from: 'triaged', to: 'investigating', user: operatorUser },
      { from: 'investigating', to: 'containment', user: operatorUser },
      { from: 'investigating', to: 'false_positive', user: operatorUser },
      { from: 'containment', to: 'resolved', user: operatorUser },
      { from: 'containment', to: 'investigating', user: operatorUser },
      { from: 'resolved', to: 'closed', user: analystUser },
      { from: 'false_positive', to: 'closed', user: analystUser }
    ];

    validPaths.forEach(({ from, to, user }) => {
      it(`should ALLOW valid transition: ${from} -> ${to}`, async () => {
        const mockIncident = {
          _id: new mongoose.Types.ObjectId(),
          incidentId: 'INC-20260905-VAL',
          status: from,
          organizationId: orgId,
          slaTriageDeadline: new Date(Date.now() + 60000),
          slaResolveDeadline: new Date(Date.now() + 60000),
          slaBreached: false,
          timeline: [],
          save: jest.fn().mockResolvedValue(true),
          toObject: function() { return this; }
        };

        jest.spyOn(Incident, 'findOne').mockResolvedValue(mockIncident);

        const result = await incidentService.updateIncidentStatus(
          mockIncident.incidentId,
          orgId,
          to,
          'Valid transition test',
          user
        );

        expect(result.status).toBe(to);
        expect(mockIncident.save).toHaveBeenCalled();
      });
    });

    const invalidPaths = [
      { from: 'detected', to: 'resolved' },
      { from: 'detected', to: 'closed' },
      { from: 'triaged', to: 'closed' },
      { from: 'investigating', to: 'closed' },
      { from: 'closed', to: 'investigating' },
      { from: 'resolved', to: 'triaged' }
    ];

    invalidPaths.forEach(({ from, to }) => {
      it(`should REJECT invalid transition: ${from} -> ${to} with 400 INVALID_STATE_TRANSITION`, async () => {
        const mockIncident = {
          _id: new mongoose.Types.ObjectId(),
          incidentId: 'INC-20260905-INVAL',
          status: from,
          organizationId: orgId,
          timeline: [],
          save: jest.fn()
        };

        jest.spyOn(Incident, 'findOne').mockResolvedValue(mockIncident);

        await expect(
          incidentService.updateIncidentStatus(
            mockIncident.incidentId,
            orgId,
            to,
            'Invalid transition attempt',
            analystUser
          )
        ).rejects.toMatchObject({
          code: 'INVALID_STATE_TRANSITION',
          statusCode: 400
        });

        expect(mockIncident.save).not.toHaveBeenCalled();
      });
    });
  });

  describe('RBAC Authorization Boundaries', () => {
    it('should REJECT viewer role from updating status with 403 FORBIDDEN', async () => {
      const mockIncident = {
        _id: new mongoose.Types.ObjectId(),
        incidentId: 'INC-001',
        status: 'detected',
        organizationId: orgId
      };

      jest.spyOn(Incident, 'findOne').mockResolvedValue(mockIncident);

      await expect(
        incidentService.updateIncidentStatus(
          mockIncident.incidentId,
          orgId,
          'triaged',
          'Viewer attempt',
          viewerUser
        )
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        statusCode: 403
      });
    });

    it('should REJECT operator from closing an incident with 403 FORBIDDEN (requires security_analyst+)', async () => {
      const mockIncident = {
        _id: new mongoose.Types.ObjectId(),
        incidentId: 'INC-001',
        status: 'resolved',
        organizationId: orgId
      };

      jest.spyOn(Incident, 'findOne').mockResolvedValue(mockIncident);

      await expect(
        incidentService.updateIncidentStatus(
          mockIncident.incidentId,
          orgId,
          'closed',
          'Operator close attempt',
          operatorUser
        )
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        statusCode: 403
      });
    });
  });

  describe('Investigation Notes, Evidence & Response Actions', () => {
    it('should append investigation notes without editing or deleting previous entries', async () => {
      const mockIncident = {
        _id: new mongoose.Types.ObjectId(),
        incidentId: 'INC-NOTE-01',
        organizationId: orgId,
        notes: [],
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
        toObject: function() { return this; }
      };

      jest.spyOn(Incident, 'findOne').mockResolvedValue(mockIncident);

      const result = await incidentService.addNote(
        mockIncident.incidentId,
        orgId,
        'Initial forensic inspection confirms memory anomaly.',
        analystUser
      );

      expect(result.notes).toHaveLength(1);
      expect(result.notes[0].content).toBe('Initial forensic inspection confirms memory anomaly.');
      expect(result.notes[0].author).toBe('Analyst Jane');
      expect(mockIncident.save).toHaveBeenCalled();
    });

    it('should execute device quarantine when quarantine_device action is recorded', async () => {
      const mockIncident = {
        _id: new mongoose.Types.ObjectId(),
        incidentId: 'INC-ACT-01',
        organizationId: orgId,
        deviceId: devId,
        responseActions: [],
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
        toObject: function() { return this; }
      };

      jest.spyOn(Incident, 'findOne').mockResolvedValue(mockIncident);
      jest.spyOn(Device, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

      const result = await incidentService.recordResponseAction(
        mockIncident.incidentId,
        orgId,
        'quarantine_device',
        'Suspected C2 communication detected',
        operatorUser
      );

      expect(Device.updateOne).toHaveBeenCalledWith(
        { _id: devId, organizationId: orgId },
        { $set: { status: 'quarantined' } }
      );
      expect(result.responseActions[0].action).toBe('quarantine_device');
      expect(mockIncident.save).toHaveBeenCalled();
    });

    it('should execute rollback_firmware via Phase 10 firmwareService bridge', async () => {
      const mockIncident = {
        _id: new mongoose.Types.ObjectId(),
        incidentId: 'INC-ROLLBACK-01',
        organizationId: orgId,
        deviceId: devId,
        responseActions: [],
        timeline: [],
        save: jest.fn().mockResolvedValue(true),
        toObject: function() { return this; }
      };

      jest.spyOn(Incident, 'findOne').mockResolvedValue(mockIncident);
      const firmwareService = require('../src/services/firmware.service');
      jest.spyOn(firmwareService, 'rollbackFailedDeploymentForDevice').mockResolvedValue(
        'Firmware rollback skipped: no eligible failed deployment with previous version found'
      );

      const result = await incidentService.recordResponseAction(
        mockIncident.incidentId,
        orgId,
        'rollback_firmware',
        'Rollback to v1.0.2 recommended due to critical vulnerability',
        analystUser
      );

      expect(result.responseActions[0].action).toBe('rollback_firmware');
      expect(result.responseActions[0].details).toContain('Firmware rollback skipped');
      expect(firmwareService.rollbackFailedDeploymentForDevice).toHaveBeenCalledWith(
        devId,
        expect.any(mongoose.Types.ObjectId),
        analystUser
      );
      expect(mockIncident.save).toHaveBeenCalled();
    });
  });
});

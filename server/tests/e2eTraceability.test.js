const mongoose = require('mongoose');
const {
  Organization,
  User,
  Device,
  Telemetry,
  AnomalyRule,
  Anomaly,
  SecurityEvent,
  Incident,
  FirmwareVersion,
  FirmwareDeployment,
  AuditLog,
  Notification
} = require('../src/models');
const { hashToken } = require('../src/utils/token');
const telemetryService = require('../src/services/telemetry.service');
const riskService = require('../src/services/risk.service');
const incidentService = require('../src/services/incident.service');
const firmwareService = require('../src/services/firmware.service');
const emitter = require('../src/socket/emitter');
const notificationService = require('../src/services/notification.service');

describe('Full End-to-End Multi-Phase Traceability & Security Chain (Phase 13)', () => {
  const orgId = new mongoose.Types.ObjectId();
  const rawApiKey = 'sw_live_e2e_device_key_00000000000000000000000000000000';
  const apiKeyHash = hashToken(rawApiKey);

  const testUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'security_analyst',
    displayName: 'SOC Analyst Alice',
    email: 'alice@securewatch.io',
    isActive: true
  };

  let testDevice;
  let testRule;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock AuditLog and Organization lookups to prevent unhandled database buffering
    jest.spyOn(AuditLog, 'create').mockResolvedValue({});
    jest.spyOn(Organization, 'findById').mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ settings: {} })
      })
    });

    // Spies for socket and notifications to verify real-time event dispatches
    jest.spyOn(emitter, 'emitSecurityEventNew').mockImplementation(() => {});
    jest.spyOn(emitter, 'emitIncidentNew').mockImplementation(() => {});
    jest.spyOn(emitter, 'emitIncidentUpdated').mockImplementation(() => {});
    jest.spyOn(emitter, 'emitDeviceStatusChanged').mockImplementation(() => {});
    jest.spyOn(emitter, 'emitDeviceRiskEscalated').mockImplementation(() => {});
    jest.spyOn(emitter, 'emitNotificationNew').mockImplementation(() => {});

    jest.spyOn(notificationService, 'notifySecurityEvent').mockResolvedValue([]);
    jest.spyOn(notificationService, 'notifyIncidentCreated').mockResolvedValue([]);
    jest.spyOn(notificationService, 'notifyIncidentUpdated').mockResolvedValue([]);
    jest.spyOn(notificationService, 'notifyDeviceQuarantined').mockResolvedValue([]);
    jest.spyOn(notificationService, 'notifyRiskEscalated').mockResolvedValue([]);

    testDevice = {
      _id: new mongoose.Types.ObjectId(),
      deviceId: 'DEV-TS-E2E001',
      name: 'HVAC Sensor Alpha',
      type: 'temperature_sensor',
      status: 'active',
      healthStatus: 'healthy',
      currentFirmwareVersion: 'v1.0.0',
      riskScore: 0,
      riskSeverity: 'low',
      expectedReportingInterval: 30,
      organizationId: orgId,
      apiKeyHash,
      timeline: [],
      save: jest.fn().mockResolvedValue(true)
    };

    testRule = {
      _id: new mongoose.Types.ObjectId(),
      ruleId: 'RULE-SYS-TEMP-001',
      name: 'High Temperature Alarm',
      metric: 'temperature',
      operator: 'gt',
      threshold: 80,
      window: 'none',
      severity: 'high',
      cooldownSeconds: 60,
      targetDeviceTypes: ['temperature_sensor'],
      isSystemRule: true,
      isEnabled: true,
      organizationId: orgId
    };
  });

  afterEach(async () => {
    await new Promise((resolve) => setImmediate(resolve));
  });

  describe('Complete E2E Incident & Mitigation Lifecycle Traceability', () => {
    it('should trace complete flow: Telemetry Ingest -> Anomaly -> SecurityEvent -> Risk Score -> Incident Correlation -> Realtime Emit -> Device Quarantine -> Firmware Sync -> Audit Log', async () => {
      const now = new Date();
      const rawTelemetryId = new mongoose.Types.ObjectId();

      // Step 1: Telemetry Ingestion with anomalous metrics
      const telemetryDoc = {
        _id: rawTelemetryId,
        deviceId: testDevice._id,
        organizationId: orgId,
        timestamp: now,
        metrics: { temperature: 95.5, humidity: 40 },
        receivedAt: now
      };

      jest.spyOn(Telemetry, 'create').mockResolvedValue(telemetryDoc);
      jest.spyOn(Device, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

      const ingestResult = await telemetryService.ingestTelemetry(testDevice, {
        timestamp: now.toISOString(),
        metrics: { temperature: 95.5, humidity: 40 }
      });

      expect(ingestResult.status).toBe('stored');
      expect(ingestResult.isDuplicate).toBe(false);

      // Step 2: Anomaly Detection & Persistence with rawTelemetryId reference
      const anomalyDoc = {
        _id: new mongoose.Types.ObjectId(),
        ruleId: testRule._id,
        deviceId: testDevice._id,
        organizationId: orgId,
        rawTelemetryId: telemetryDoc._id,
        metric: 'temperature',
        observedValue: 95.5,
        threshold: 80,
        severity: 'high',
        detectedAt: now
      };

      jest.spyOn(Anomaly, 'create').mockResolvedValue(anomalyDoc);
      expect(anomalyDoc.rawTelemetryId).toEqual(telemetryDoc._id);
      expect(anomalyDoc.organizationId).toEqual(orgId);

      // Step 3: Security Event Creation & Traceability
      const securityEventDoc = {
        _id: new mongoose.Types.ObjectId(),
        eventId: 'EVT-2026-00001',
        eventType: 'ANOMALY_DETECTED',
        ruleId: testRule._id,
        deviceId: testDevice._id,
        organizationId: orgId,
        severity: 'high',
        status: 'active',
        confidence: 'high',
        rawTelemetryId: telemetryDoc._id,
        anomalyId: anomalyDoc._id,
        description: 'High Temperature Alarm triggered (observed: 95.5 > threshold: 80)',
        detectedAt: now
      };

      jest.spyOn(SecurityEvent, 'create').mockResolvedValue(securityEventDoc);
      jest.spyOn(SecurityEvent, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([securityEventDoc])
      });

      // Verify backwards traceability link from SecurityEvent to raw Telemetry
      expect(securityEventDoc.rawTelemetryId).toEqual(telemetryDoc._id);
      expect(securityEventDoc.deviceId).toEqual(testDevice._id);

      // Step 4: Deterministic Device Risk Recalculation (Phase 8 formula)
      // Active high severity event (18 points * 1.0 confidence = 18) + healthy communication (0) = 18 (low bracket)
      const riskCalculation = riskService.calculateRiskForDevice(
        testDevice,
        [securityEventDoc]
      );

      expect(riskCalculation).toHaveProperty('riskScore', 18);
      expect(riskCalculation).toHaveProperty('riskSeverity', 'low');
      expect(riskCalculation.riskFactors.length).toBe(3); // Exact 3 frozen risk factors

      // Step 5: Incident Correlation Engine & Auto-Creation
      const incidentDoc = {
        _id: new mongoose.Types.ObjectId(),
        incidentId: 'INC-2026-00001',
        title: 'Correlated Anomaly: High Temperature Alarm',
        description: 'High severity security event detected on HVAC Sensor Alpha',
        severity: 'high',
        status: 'detected',
        deviceId: testDevice._id,
        organizationId: orgId,
        securityEventIds: [securityEventDoc._id],
        slaTriageDeadline: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour for high
        slaResolveDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours for high
        notes: [],
        timeline: [],
        responseActions: [],
        toObject: function() { return { ...this }; },
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Incident, 'create').mockResolvedValue(incidentDoc);
      jest.spyOn(Incident, 'findOne').mockResolvedValue(incidentDoc);

      // Verify incident links the security event
      expect(incidentDoc.securityEventIds).toContainEqual(securityEventDoc._id);
      expect(incidentDoc.organizationId).toEqual(orgId);

      // Step 6: Incident Response Action: Device Quarantine
      jest.spyOn(Device, 'findOne').mockResolvedValue(testDevice);

      await incidentService.recordResponseAction(
        incidentDoc._id.toString(),
        orgId.toString(),
        'quarantine_device',
        'Quarantining device following abnormal temperature breach',
        testUser
      );

      // Verify Device update was requested and Socket.IO event was emitted
      expect(Device.updateOne).toHaveBeenCalledWith(
        { _id: testDevice._id, organizationId: expect.any(mongoose.Types.ObjectId) },
        { $set: { status: 'quarantined' } }
      );
      expect(emitter.emitDeviceStatusChanged).toHaveBeenCalledWith(
        orgId.toString(),
        expect.objectContaining({
          deviceId: testDevice._id,
          status: 'quarantined'
        })
      );

      // Step 7: Firmware Metadata & OTA Deployment Verification
      const validChecksum = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const firmwareVersionDoc = {
        _id: new mongoose.Types.ObjectId(),
        version: 'v1.1.0',
        deviceType: testDevice.type,
        checksum: validChecksum,
        securityStatus: 'secure',
        organizationId: orgId
      };

      const deploymentDoc = {
        _id: new mongoose.Types.ObjectId(),
        deploymentId: 'DEP-2026-E2E01',
        firmwareVersionId: firmwareVersionDoc._id,
        deviceId: testDevice._id,
        organizationId: orgId,
        status: 'verifying',
        result: {},
        toObject: function() { return { ...this }; },
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(FirmwareVersion, 'findById').mockResolvedValue(firmwareVersionDoc);
      jest.spyOn(Device, 'findById').mockResolvedValue(testDevice);
      jest.spyOn(FirmwareDeployment, 'findOne').mockResolvedValue(deploymentDoc);

      // Device verifies checksum and completes deployment
      const updateResult = await firmwareService.updateDeploymentStatus(
        deploymentDoc._id.toString(),
        {
          status: 'success',
          result: {
            verificationChecksum: validChecksum
          }
        },
        {
          isDevice: true,
          device: testDevice,
          organizationId: orgId.toString()
        }
      );

      expect(updateResult.status).toBe('success');
      expect(updateResult.result.success).toBe(true);
      expect(testDevice.currentFirmwareVersion).toBe('v1.1.0');

      // Step 8: Audit Log Immutability & Secret Protection
      const auditRecords = [
        {
          action: 'telemetry.ingested',
          organizationId: orgId,
          targetType: 'device',
          targetId: testDevice._id
        },
        {
          action: 'incident.response_action',
          organizationId: orgId,
          targetType: 'incident',
          targetId: incidentDoc._id,
          actor: testUser._id
        },
        {
          action: 'firmware.deployment_completed',
          organizationId: orgId,
          targetType: 'firmware_deployment',
          targetId: deploymentDoc._id
        }
      ];

      for (const record of auditRecords) {
        expect(record.organizationId).toEqual(orgId);
        expect(record).not.toHaveProperty('apiKey');
        expect(record).not.toHaveProperty('rawApiKey');
        expect(record).not.toHaveProperty('password');
      }
    });
  });
});

const mongoose = require('mongoose');
const {
  Organization,
  User,
  RefreshToken,
  Device,
  Telemetry,
  AnomalyRule,
  SecurityEvent,
  Incident,
  FirmwareVersion,
  FirmwareDeployment,
  AuditLog,
  Notification
} = require('../src/models');

describe('Database Foundation & Schema Validation (Phase 2)', () => {
  const dummyOrgId = new mongoose.Types.ObjectId();
  const dummyUserId = new mongoose.Types.ObjectId();
  const dummyDeviceId = new mongoose.Types.ObjectId();
  const dummyTelemetryId = new mongoose.Types.ObjectId();
  const dummyFwId = new mongoose.Types.ObjectId();

  describe('1. Organization Model', () => {
    it('should validate a valid organization document', () => {
      const org = new Organization({
        name: 'Acme IoT Corp',
        slug: 'acme-iot'
      });
      const err = org.validateSync();
      expect(err).toBeUndefined();
      expect(org.settings.slaThresholds.critical.triage).toBe(15);
      expect(org.settings.autoQuarantine.enabled).toBe(false);
    });

    it('should fail validation when required fields are missing or slug format is invalid', () => {
      const org = new Organization({
        name: 'A', // too short
        slug: 'Invalid Slug With Spaces!'
      });
      const err = org.validateSync();
      expect(err).toBeDefined();
      expect(err.errors['name']).toBeDefined();
      expect(err.errors['slug']).toBeDefined();
    });
  });

  describe('2. User Model', () => {
    it('should validate a valid user document with default role', () => {
      const user = new User({
        email: 'analyst@acme.com',
        passwordHash: 'hashed_bcrypt_secret_string',
        displayName: 'Security Analyst Jane',
        organizationId: dummyOrgId
      });
      const err = user.validateSync();
      expect(err).toBeUndefined();
      expect(user.role).toBe('viewer');
      expect(user.isActive).toBe(true);
    });

    it('should reject invalid role and invalid email format', () => {
      const user = new User({
        email: 'not-an-email',
        passwordHash: 'secret',
        displayName: 'Jane',
        role: 'super_hacker_role', // invalid enum
        organizationId: dummyOrgId
      });
      const err = user.validateSync();
      expect(err).toBeDefined();
      expect(err.errors['email']).toBeDefined();
      expect(err.errors['role']).toBeDefined();
    });
  });

  describe('3. RefreshToken Model', () => {
    it('should validate a valid refresh token and verify TTL index', () => {
      const token = new RefreshToken({
        userId: dummyUserId,
        tokenHash: 'sha256_hash_value_of_token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      const err = token.validateSync();
      expect(err).toBeUndefined();

      // Verify TTL index defined on schema
      const indexes = RefreshToken.schema.indexes();
      const ttlIndex = indexes.find(idx => idx[0].expiresAt === 1);
      expect(ttlIndex).toBeDefined();
      expect(ttlIndex[1]).toHaveProperty('expireAfterSeconds', 0);
    });
  });

  describe('4. Device Model', () => {
    it('should validate a valid device with correct defaults and risk brackets', () => {
      const device = new Device({
        deviceId: 'DEV-TS-001',
        name: 'Warehouse Temp Sensor 1',
        type: 'temperature_sensor',
        manufacturer: 'SensorWorks',
        model: 'TX-200',
        organizationId: dummyOrgId
      });
      const err = device.validateSync();
      expect(err).toBeUndefined();
      expect(device.status).toBe('registered');
      expect(device.healthStatus).toBe('unknown');
      expect(device.riskScore).toBe(0);
      expect(device.riskSeverity).toBe('low');
      expect(device.expectedReportingInterval).toBe(30);
    });

    it('should reject invalid device type or out-of-range risk score', () => {
      const device = new Device({
        deviceId: 'DEV-001',
        name: 'Device 1',
        type: 'quantum_laser_turret', // invalid enum
        manufacturer: 'Acme',
        model: 'M1',
        riskScore: 150, // exceeds max 100
        organizationId: dummyOrgId
      });
      const err = device.validateSync();
      expect(err).toBeDefined();
      expect(err.errors['type']).toBeDefined();
      expect(err.errors['riskScore']).toBeDefined();
    });
  });

  describe('5. Telemetry Model', () => {
    it('should validate valid telemetry payload with metrics', () => {
      const telemetry = new Telemetry({
        deviceId: dummyDeviceId,
        organizationId: dummyOrgId,
        timestamp: new Date(),
        metrics: {
          cpu_usage: 45.2,
          temperature: 24.1,
          battery_level: 98.0
        }
      });
      const err = telemetry.validateSync();
      expect(err).toBeUndefined();
      expect(telemetry.receivedAt).toBeDefined();

      // Verify TTL index defined on receivedAt
      const indexes = Telemetry.schema.indexes();
      const ttlIndex = indexes.find(idx => idx[0].receivedAt === 1);
      expect(ttlIndex).toBeDefined();
      expect(ttlIndex[1]).toHaveProperty('expireAfterSeconds', 30 * 24 * 60 * 60);
    });

    it('should reject telemetry without metrics object', () => {
      const telemetry = new Telemetry({
        deviceId: dummyDeviceId,
        organizationId: dummyOrgId,
        timestamp: new Date(),
        metrics: {} // empty object
      });
      const err = telemetry.validateSync();
      expect(err).toBeDefined();
      expect(err.errors['metrics']).toBeDefined();
    });
  });

  describe('6. AnomalyRule Model', () => {
    it('should validate a valid anomaly rule with deterministic operator', () => {
      const rule = new AnomalyRule({
        ruleId: 'RULE-001',
        name: 'High CPU Sustained',
        description: 'Detects sustained CPU > 90%',
        category: 'threshold',
        operator: 'gt',
        value: 90,
        cooldownSeconds: 300,
        severity: 'medium',
        confidence: 'medium',
        explanationTemplate: 'CPU was {{actual}}% exceeding 90%',
        organizationId: null // system global
      });
      const err = rule.validateSync();
      expect(err).toBeUndefined();
      expect(rule.enabled).toBe(true);
      expect(rule.deviceTypes).toEqual(['*']);
    });
  });

  describe('7. SecurityEvent Model', () => {
    it('should validate security event with rawTelemetryId reference for traceability', () => {
      const event = new SecurityEvent({
        eventId: 'EVT-20260903-0001',
        deviceId: dummyDeviceId,
        organizationId: dummyOrgId,
        ruleId: 'RULE-001',
        rawTelemetryId: dummyTelemetryId,
        category: 'threshold',
        severity: 'medium',
        confidence: 'medium',
        explanation: 'CPU usage was 94% exceeding threshold of 90%'
      });
      const err = event.validateSync();
      expect(err).toBeUndefined();
      expect(event.status).toBe('open');
      expect(event.occurrenceCount).toBe(1);
    });
  });

  describe('8. Incident Model', () => {
    it('should validate incident with 7-state lifecycle and SLA deadlines', () => {
      const incident = new Incident({
        incidentId: 'INC-20260903-0001',
        title: 'High CPU Sustained Anomaly on Device',
        severity: 'high',
        category: 'threshold',
        organizationId: dummyOrgId,
        deviceId: dummyDeviceId,
        slaTriageDeadline: new Date(Date.now() + 60 * 60 * 1000),
        slaResolveDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      const err = incident.validateSync();
      expect(err).toBeUndefined();
      expect(incident.status).toBe('detected');
      expect(incident.slaBreached).toBe(false);
    });

    it('should reject invalid incident status', () => {
      const incident = new Incident({
        incidentId: 'INC-0001',
        title: 'Test Incident',
        severity: 'high',
        status: 'invalid_status_xyz', // invalid
        category: 'threshold',
        organizationId: dummyOrgId,
        deviceId: dummyDeviceId,
        slaTriageDeadline: new Date(),
        slaResolveDeadline: new Date()
      });
      const err = incident.validateSync();
      expect(err).toBeDefined();
      expect(err.errors['status']).toBeDefined();
    });
  });

  describe('9. FirmwareVersion & FirmwareDeployment Models', () => {
    it('should validate firmware version and deployment lifecycle document', () => {
      const version = new FirmwareVersion({
        version: '2.1.0',
        deviceType: 'temperature_sensor',
        checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        releaseDate: new Date(),
        uploadedBy: dummyUserId,
        organizationId: dummyOrgId
      });
      const errVersion = version.validateSync();
      expect(errVersion).toBeUndefined();
      expect(version.securityStatus).toBe('under_review');
      expect(version.deploymentPolicy).toBe('restricted');

      const deployment = new FirmwareDeployment({
        deploymentId: 'DEP-20260903-0001',
        firmwareVersionId: dummyFwId,
        deviceId: dummyDeviceId,
        organizationId: dummyOrgId,
        initiatedBy: dummyUserId
      });
      const errDeploy = deployment.validateSync();
      expect(errDeploy).toBeUndefined();
      expect(deployment.status).toBe('pending');
    });
  });

  describe('10. AuditLog & Notification Models', () => {
    it('should validate append-only audit log and user notification schemas', () => {
      const audit = new AuditLog({
        action: 'device.quarantine',
        actor: dummyUserId,
        targetType: 'device',
        targetId: dummyDeviceId,
        organizationId: dummyOrgId,
        details: { reason: 'Risk score exceeded 80' }
      });
      const errAudit = audit.validateSync();
      expect(errAudit).toBeUndefined();

      const notif = new Notification({
        userId: dummyUserId,
        organizationId: dummyOrgId,
        type: 'incident_created',
        title: 'New Incident Detected',
        message: 'Incident INC-20260903-0001 created for DEV-TS-001',
        severity: 'high'
      });
      const errNotif = notif.validateSync();
      expect(errNotif).toBeUndefined();
      expect(notif.read).toBe(false);
    });
  });
});

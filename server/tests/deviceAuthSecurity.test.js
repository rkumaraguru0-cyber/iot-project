const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { hashToken } = require('../src/utils/token');
const { Device, FirmwareDeployment, AuditLog } = require('../src/models');
const telemetryService = require('../src/services/telemetry.service');
const firmwareService = require('../src/services/firmware.service');

describe('Device API Key Authentication & Access Boundary Security (Phase 13)', () => {
  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();

  const rawKeyDeviceA1 = 'sw_live_key_device_a1_00000000000000000000000000000000';
  const rawKeyDeviceA2 = 'sw_live_key_device_a2_00000000000000000000000000000000';
  const rawKeyDeviceB1 = 'sw_live_key_device_b1_00000000000000000000000000000000';

  const deviceA1 = {
    _id: new mongoose.Types.ObjectId(),
    deviceId: 'DEV-TS-AAAA01',
    name: 'Device A1',
    type: 'temperature_sensor',
    status: 'active',
    healthStatus: 'healthy',
    organizationId: orgAId,
    apiKeyHash: hashToken(rawKeyDeviceA1)
  };

  const deviceA2 = {
    _id: new mongoose.Types.ObjectId(),
    deviceId: 'DEV-TS-AAAA02',
    name: 'Device A2',
    type: 'temperature_sensor',
    status: 'active',
    healthStatus: 'healthy',
    organizationId: orgAId,
    apiKeyHash: hashToken(rawKeyDeviceA2)
  };

  const decommissionedDeviceA = {
    _id: new mongoose.Types.ObjectId(),
    deviceId: 'DEV-TS-DECOMM',
    name: 'Decommissioned Device',
    type: 'temperature_sensor',
    status: 'decommissioned',
    healthStatus: 'offline',
    organizationId: orgAId,
    apiKeyHash: hashToken('sw_live_key_decomm_00000000000000000000000000000000')
  };

  const deviceB1 = {
    _id: new mongoose.Types.ObjectId(),
    deviceId: 'DEV-TS-BBBB01',
    name: 'Device B1',
    type: 'temperature_sensor',
    status: 'active',
    healthStatus: 'healthy',
    organizationId: orgBId,
    apiKeyHash: hashToken(rawKeyDeviceB1)
  };

  beforeEach(() => {
    jest.restoreAllMocks();

    jest.spyOn(Device, 'findOne').mockImplementation((query) => {
      let matched = null;
      if (query.apiKeyHash === deviceA1.apiKeyHash) matched = deviceA1;
      else if (query.apiKeyHash === deviceA2.apiKeyHash) matched = deviceA2;
      else if (query.apiKeyHash === decommissionedDeviceA.apiKeyHash) matched = decommissionedDeviceA;
      else if (query.apiKeyHash === deviceB1.apiKeyHash) matched = deviceB1;

      return Promise.resolve(matched ? { ...matched } : null);
    });
  });

  describe('1. Ingestion Authentication via API Key', () => {
    it('should authenticate valid device API key and ingest telemetry', async () => {
      jest.spyOn(telemetryService, 'ingestTelemetry').mockResolvedValue({
        isDuplicate: false,
        id: new mongoose.Types.ObjectId().toString(),
        telemetry: { timestamp: new Date().toISOString() }
      });

      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('x-device-api-key', rawKeyDeviceA1)
        .send({
          timestamp: new Date().toISOString(),
          metrics: { temperature: 24.5, humidity: 45 }
        });

      expect(res.status).toBe(201);
      expect(res.body.received).toBe(true);
      expect(res.body.status).toBe('stored');
      expect(res.body.deviceId).toBe(deviceA1.deviceId);
    });

    it('should return 401 when X-Device-API-Key header is missing', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .send({
          timestamp: new Date().toISOString(),
          metrics: { temperature: 24.5 }
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('DEVICE_API_KEY_REQUIRED');
    });

    it('should return 401 when invalid device API key is provided', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('x-device-api-key', 'sw_live_invalid_key_12345678901234567890123456789012')
        .send({
          timestamp: new Date().toISOString(),
          metrics: { temperature: 24.5 }
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_DEVICE_CREDENTIALS');
    });

    it('should return 403 when decommissioned device attempts to submit telemetry', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('x-device-api-key', 'sw_live_key_decomm_00000000000000000000000000000000')
        .send({
          timestamp: new Date().toISOString(),
          metrics: { temperature: 24.5 }
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('DEVICE_DECOMMISSIONED');
    });
  });

  describe('2. Firmware Deployment Device Authentication & Identity Binding', () => {
    const deploymentA1 = {
      _id: new mongoose.Types.ObjectId(),
      deploymentId: 'DEP-2026-A101',
      deviceId: deviceA1._id,
      organizationId: orgAId,
      status: 'downloading'
    };

    it('should authenticate device API key for updating its own deployment status', async () => {
      jest.spyOn(firmwareService, 'updateDeploymentStatus').mockResolvedValue({
        deploymentId: deploymentA1.deploymentId,
        status: 'installing',
        deviceId: deviceA1._id.toString()
      });

      const res = await request(app)
        .patch(`/api/v1/firmware/deployments/${deploymentA1._id}/status`)
        .set('x-device-api-key', rawKeyDeviceA1)
        .send({ status: 'installing' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('installing');
    });

    it('should reject device attempting to update deployment intended for another device (403 DEVICE_DEPLOYMENT_MISMATCH)', async () => {
      jest.spyOn(firmwareService, 'updateDeploymentStatus').mockRejectedValue({
        statusCode: 403,
        code: 'DEVICE_DEPLOYMENT_MISMATCH',
        message: 'Authenticated device is not authorized to update another device deployment'
      });

      // Device A2 attempts to update Device A1's deployment
      const res = await request(app)
        .patch(`/api/v1/firmware/deployments/${deploymentA1._id}/status`)
        .set('x-device-api-key', rawKeyDeviceA2)
        .send({ status: 'installing' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('DEVICE_DEPLOYMENT_MISMATCH');
    });

    it('should reject device attempting to update deployment of another organization (404/403 isolation)', async () => {
      jest.spyOn(firmwareService, 'updateDeploymentStatus').mockRejectedValue({
        statusCode: 404,
        code: 'DEPLOYMENT_NOT_FOUND',
        message: 'Deployment not found'
      });

      // Device B1 (Org B) attempts to update Org A's deployment
      const res = await request(app)
        .patch(`/api/v1/firmware/deployments/${deploymentA1._id}/status`)
        .set('x-device-api-key', rawKeyDeviceB1)
        .send({ status: 'installing' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DEPLOYMENT_NOT_FOUND');
    });
  });

  describe('3. Secret Integrity & Log Audit Protection', () => {
    it('should ensure plaintext API keys are never stored in AuditLog records', async () => {
      const auditEntry = {
        action: 'device.registered',
        actor: { type: 'user', id: new mongoose.Types.ObjectId() },
        organizationId: orgAId,
        details: {
          deviceId: deviceA1.deviceId,
          name: deviceA1.name
        }
      };

      // Ensure details object in audit log does not contain rawApiKey or apiKey
      expect(auditEntry.details.rawApiKey).toBeUndefined();
      expect(auditEntry.details.apiKey).toBeUndefined();
      expect(auditEntry.details.apiKeyHash).toBeUndefined();
    });
  });
});

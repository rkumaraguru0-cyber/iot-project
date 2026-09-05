const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/token');
const deviceService = require('../src/services/device.service');

describe('Device Domain Unit & API Endpoints (Phase 4)', () => {
  const orgId = new mongoose.Types.ObjectId();
  const analystUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'security_analyst',
    displayName: 'Analyst Jane',
    email: 'analyst@soc.org'
  };

  const operatorUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'operator',
    displayName: 'Operator John',
    email: 'operator@soc.org'
  };

  const viewerUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'viewer',
    displayName: 'Viewer Alice',
    email: 'viewer@soc.org'
  };

  let analystToken, operatorToken, viewerToken;

  beforeAll(() => {
    analystToken = generateAccessToken(analystUser);
    operatorToken = generateAccessToken(operatorUser);
    viewerToken = generateAccessToken(viewerUser);
  });

  const { User } = require('../src/models');

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      let matched = viewerUser;
      if (idStr === analystUser._id.toString()) matched = analystUser;
      else if (idStr === operatorUser._id.toString()) matched = operatorUser;

      return {
        select: jest.fn().mockResolvedValue({
          ...matched,
          isActive: true
        })
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Device Service Unit Logic', () => {
    it('generateDeviceId should follow DEV-{TYPE_PREFIX}-{RANDOM_6} format', () => {
      const tsId = deviceService.generateDeviceId('temperature_sensor');
      expect(tsId).toMatch(/^DEV-TS-[A-F0-9]{6}$/);

      const scId = deviceService.generateDeviceId('smart_camera');
      expect(scId).toMatch(/^DEV-SC-[A-F0-9]{6}$/);

      const igId = deviceService.generateDeviceId('industrial_gateway');
      expect(igId).toMatch(/^DEV-IG-[A-F0-9]{6}$/);

      const mmId = deviceService.generateDeviceId('medical_monitor');
      expect(mmId).toMatch(/^DEV-MM-[A-F0-9]{6}$/);

      const slId = deviceService.generateDeviceId('smart_lock');
      expect(slId).toMatch(/^DEV-SL-[A-F0-9]{6}$/);
    });

    it('generateDeviceApiKey should return a 64-character hex raw key and its SHA-256 hash', () => {
      const { rawApiKey, apiKeyHash } = deviceService.generateDeviceApiKey();
      expect(typeof rawApiKey).toBe('string');
      expect(rawApiKey.length).toBe(64); // 256 bits = 32 bytes = 64 hex chars
      expect(typeof apiKeyHash).toBe('string');
      expect(apiKeyHash.length).toBe(64);
      expect(rawApiKey).not.toBe(apiKeyHash);
    });
  });

  describe('POST /api/v1/devices (Registration)', () => {
    it('should register a device and return plaintext API key once', async () => {
      const dummyDevice = {
        _id: new mongoose.Types.ObjectId(),
        deviceId: 'DEV-TS-A1B2C3',
        name: 'Server Room Sensor',
        type: 'temperature_sensor',
        manufacturer: 'Bosch',
        model: 'BME680',
        status: 'registered',
        healthStatus: 'unknown',
        riskScore: 0,
        riskSeverity: 'low',
        organizationId: orgId
      };

      jest.spyOn(deviceService, 'registerDevice').mockResolvedValue({
        device: dummyDevice,
        apiKey: 'mock_raw_api_key_64_hex_string'
      });

      const res = await request(app)
        .post('/api/v1/devices')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          name: 'Server Room Sensor',
          type: 'temperature_sensor',
          manufacturer: 'Bosch',
          model: 'BME680'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('device');
      expect(res.body).toHaveProperty('apiKey', 'mock_raw_api_key_64_hex_string');
      expect(res.body.device.deviceId).toBe('DEV-TS-A1B2C3');
      expect(res.body.device).not.toHaveProperty('apiKeyHash');
    });

    it('should fail with 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/devices')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          name: 'Sensor Without Manufacturer'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should fail with 400 when invalid device type is specified', async () => {
      const res = await request(app)
        .post('/api/v1/devices')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          name: 'Invalid Type Device',
          type: 'flying_drone',
          manufacturer: 'DJI',
          model: 'Mavic'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/devices (List & Filter)', () => {
    it('should list devices with pagination metadata', async () => {
      jest.spyOn(deviceService, 'listDevices').mockResolvedValue({
        devices: [
          { deviceId: 'DEV-TS-111111', name: 'Sensor 1', type: 'temperature_sensor' },
          { deviceId: 'DEV-SC-222222', name: 'Camera 1', type: 'smart_camera' }
        ],
        total: 2,
        page: 1,
        limit: 20
      });

      const res = await request(app)
        .get('/api/v1/devices?page=1&limit=20')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.devices).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(res.body.page).toBe(1);
    });

    it('should pass query filter parameters to service', async () => {
      const listSpy = jest.spyOn(deviceService, 'listDevices').mockResolvedValue({
        devices: [],
        total: 0,
        page: 1,
        limit: 20
      });

      const res = await request(app)
        .get('/api/v1/devices?type=smart_camera&status=active&healthStatus=healthy&search=lobby')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(listSpy).toHaveBeenCalledWith(
        orgId.toString(),
        expect.objectContaining({
          type: 'smart_camera',
          status: 'active',
          healthStatus: 'healthy',
          search: 'lobby'
        })
      );
    });
  });

  describe('GET /api/v1/devices/stats (Aggregates)', () => {
    it('should return aggregated fleet counts', async () => {
      jest.spyOn(deviceService, 'getDeviceStats').mockResolvedValue({
        total: 10,
        byStatus: { registered: 2, active: 6, maintenance: 1, quarantined: 1, decommissioned: 0 },
        byHealth: { healthy: 6, degraded: 2, offline: 1, unknown: 1 },
        byRisk: { low: 7, medium: 2, high: 1, critical: 0, severe: 0 }
      });

      const res = await request(app)
        .get('/api/v1/devices/stats')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(10);
      expect(res.body.byStatus.active).toBe(6);
      expect(res.body.byHealth.healthy).toBe(6);
    });
  });

  describe('GET /api/v1/devices/:id (Details)', () => {
    it('should return device details without apiKeyHash', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      jest.spyOn(deviceService, 'getDeviceById').mockResolvedValue({
        _id: dummyId,
        deviceId: 'DEV-TS-999999',
        name: 'High Precision Thermometer',
        riskScore: 15,
        riskSeverity: 'low',
        timeline: []
      });

      const res = await request(app)
        .get(`/api/v1/devices/${dummyId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.deviceId).toBe('DEV-TS-999999');
      expect(res.body).not.toHaveProperty('apiKeyHash');
    });

    it('should return 404 when device is not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const err = new Error('Device not found');
      err.code = 'DEVICE_NOT_FOUND';
      err.statusCode = 404;
      jest.spyOn(deviceService, 'getDeviceById').mockRejectedValue(err);

      const res = await request(app)
        .get(`/api/v1/devices/${nonExistentId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toHaveProperty('code', 'DEVICE_NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/devices/:id (Update & State Transitions)', () => {
    it('should allow operator to transition valid state (active -> maintenance)', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      jest.spyOn(deviceService, 'updateDevice').mockResolvedValue({
        _id: dummyId,
        deviceId: 'DEV-TS-123456',
        status: 'maintenance'
      });

      const res = await request(app)
        .patch(`/api/v1/devices/${dummyId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          status: 'maintenance'
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('maintenance');
    });

    it('should reject invalid lifecycle transitions with 400', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      const err = new Error("Invalid state transition: Cannot transition from 'registered' to 'decommissioned'");
      err.code = 'INVALID_STATE_TRANSITION';
      err.statusCode = 400;
      jest.spyOn(deviceService, 'updateDevice').mockRejectedValue(err);

      const res = await request(app)
        .patch(`/api/v1/devices/${dummyId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          status: 'decommissioned'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'INVALID_STATE_TRANSITION');
    });
  });

  describe('POST /api/v1/devices/:id/regenerate-key', () => {
    it('should regenerate device API key and return plaintext key once', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      jest.spyOn(deviceService, 'regenerateApiKey').mockResolvedValue({
        apiKey: 'new_regenerated_api_key_64_chars'
      });

      const res = await request(app)
        .post(`/api/v1/devices/${dummyId}/regenerate-key`)
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('apiKey', 'new_regenerated_api_key_64_chars');
    });
  });

  describe('GET /api/v1/devices/:id/risk', () => {
    it('should return device risk posture breakdown', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      jest.spyOn(deviceService, 'getDeviceRisk').mockResolvedValue({
        id: dummyId,
        deviceId: 'DEV-TS-123456',
        riskScore: 25,
        riskSeverity: 'medium',
        riskFactors: [{ name: 'Auth Anomalies', value: 10, maxValue: 10, detail: 'Multiple failed attempts' }]
      });

      const res = await request(app)
        .get(`/api/v1/devices/${dummyId}/risk`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.riskScore).toBe(25);
      expect(res.body.riskFactors).toHaveLength(1);
    });
  });
});

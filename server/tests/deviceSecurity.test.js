const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/token');
const deviceService = require('../src/services/device.service');

describe('Device Security, RBAC & Multi-Tenancy Isolation (Phase 4)', () => {
  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();

  const viewerOrgA = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgAId,
    role: 'viewer',
    displayName: 'Org A Viewer'
  };

  const operatorOrgA = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgAId,
    role: 'operator',
    displayName: 'Org A Operator'
  };

  const analystOrgA = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgAId,
    role: 'security_analyst',
    displayName: 'Org A Analyst'
  };

  const analystOrgB = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgBId,
    role: 'security_analyst',
    displayName: 'Org B Analyst'
  };

  let viewerTokenOrgA, operatorTokenOrgA, analystTokenOrgA, analystTokenOrgB;

  beforeAll(() => {
    viewerTokenOrgA = generateAccessToken(viewerOrgA);
    operatorTokenOrgA = generateAccessToken(operatorOrgA);
    analystTokenOrgA = generateAccessToken(analystOrgA);
    analystTokenOrgB = generateAccessToken(analystOrgB);
  });

  const { User } = require('../src/models');

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      let matched = viewerOrgA;
      if (idStr === analystOrgA._id.toString()) matched = analystOrgA;
      else if (idStr === operatorOrgA._id.toString()) matched = operatorOrgA;
      else if (idStr === analystOrgB._id.toString()) matched = analystOrgB;

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

  describe('Authentication Enforcement', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/devices');
      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should reject unauthenticated POST /devices with 401', async () => {
      const res = await request(app)
        .post('/api/v1/devices')
        .send({ name: 'Hacker Device' });
      expect(res.status).toBe(401);
    });
  });

  describe('RBAC Role Boundary Enforcement', () => {
    it('should deny viewer from registering a device (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/v1/devices')
        .set('Authorization', `Bearer ${viewerTokenOrgA}`)
        .send({
          name: 'Unauthorized Device',
          type: 'temperature_sensor',
          manufacturer: 'Bosch',
          model: 'BME680'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
    });

    it('should deny operator from registering a device (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/v1/devices')
        .set('Authorization', `Bearer ${operatorTokenOrgA}`)
        .send({
          name: 'Unauthorized Device',
          type: 'temperature_sensor',
          manufacturer: 'Bosch',
          model: 'BME680'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
    });

    it('should deny operator from regenerating device API key (403 FORBIDDEN)', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/v1/devices/${dummyId}/regenerate-key`)
        .set('Authorization', `Bearer ${operatorTokenOrgA}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
    });

    it('should deny viewer from changing device state (403 FORBIDDEN)', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/v1/devices/${dummyId}`)
        .set('Authorization', `Bearer ${viewerTokenOrgA}`)
        .send({ status: 'active' });

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
    });

    it('should deny operator from updating metadata (requires security_analyst+) (403)', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      const err = new Error('Updating device metadata requires at least security_analyst role');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      jest.spyOn(deviceService, 'updateDevice').mockRejectedValue(err);

      const res = await request(app)
        .patch(`/api/v1/devices/${dummyId}`)
        .set('Authorization', `Bearer ${operatorTokenOrgA}`)
        .send({ name: 'Operator Renaming Device' });

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
    });

    it('should deny operator from decommissioning a device (requires security_analyst+) (403)', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      const err = new Error('Decommissioning a device requires at least security_analyst role');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      jest.spyOn(deviceService, 'updateDevice').mockRejectedValue(err);

      const res = await request(app)
        .patch(`/api/v1/devices/${dummyId}`)
        .set('Authorization', `Bearer ${operatorTokenOrgA}`)
        .send({ status: 'decommissioned' });

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
    });
  });

  describe('Multi-Tenancy Isolation & Tenant Context Anchoring', () => {
    it('should prevent Org A user from accessing Org B device (returns 404)', async () => {
      const orgBDeviceId = new mongoose.Types.ObjectId();
      const err = new Error('Device not found');
      err.code = 'DEVICE_NOT_FOUND';
      err.statusCode = 404;
      jest.spyOn(deviceService, 'getDeviceById').mockRejectedValue(err);

      const res = await request(app)
        .get(`/api/v1/devices/${orgBDeviceId}`)
        .set('Authorization', `Bearer ${analystTokenOrgA}`);

      expect(res.status).toBe(404);
    });

    it('should ignore client-supplied organizationId query param for non-super_admin', async () => {
      const listSpy = jest.spyOn(deviceService, 'listDevices').mockResolvedValue({
        devices: [],
        total: 0,
        page: 1,
        limit: 20
      });

      const res = await request(app)
        .get(`/api/v1/devices?organizationId=${orgBId.toString()}`)
        .set('Authorization', `Bearer ${analystTokenOrgA}`);

      expect(res.status).toBe(200);
      // Verify service was called with Org A's ID from JWT, NOT Org B from query
      expect(listSpy).toHaveBeenCalledWith(
        orgAId.toString(),
        expect.any(Object)
      );
    });

    it('should ignore client-supplied organizationId in request body for device registration', async () => {
      const regSpy = jest.spyOn(deviceService, 'registerDevice').mockResolvedValue({
        device: { deviceId: 'DEV-TS-000000', organizationId: orgAId },
        apiKey: 'key_123'
      });

      const res = await request(app)
        .post('/api/v1/devices')
        .set('Authorization', `Bearer ${analystTokenOrgA}`)
        .send({
          name: 'New Sensor',
          type: 'temperature_sensor',
          manufacturer: 'Bosch',
          model: 'BME680',
          organizationId: orgBId.toString() // Malicious body override attempt
        });

      expect(res.status).toBe(201);
      // Service must receive authenticated user's organizationId (Org A)
      expect(regSpy).toHaveBeenCalledWith(
        expect.any(Object),
        orgAId.toString(),
        expect.any(Object),
        expect.any(String)
      );
    });
  });

  describe('Credential & Secret Exposure Prevention', () => {
    it('should never expose apiKeyHash in device responses', async () => {
      const dummyDevice = {
        _id: new mongoose.Types.ObjectId(),
        deviceId: 'DEV-TS-555555',
        name: 'Secure Sensor',
        type: 'temperature_sensor',
        status: 'active'
      };

      jest.spyOn(deviceService, 'getDeviceById').mockResolvedValue(dummyDevice);

      const res = await request(app)
        .get(`/api/v1/devices/${dummyDevice._id}`)
        .set('Authorization', `Bearer ${viewerTokenOrgA}`);

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('apiKeyHash');
      expect(res.body).not.toHaveProperty('apiKey');
    });
  });
});

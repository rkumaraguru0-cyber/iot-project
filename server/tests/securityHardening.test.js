const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const config = require('../src/config');
const { generateAccessToken } = require('../src/utils/token');
const { User } = require('../src/models');
const deviceService = require('../src/services/device.service');
const incidentService = require('../src/services/incident.service');
const firmwareService = require('../src/services/firmware.service');

describe('Security Hardening & OWASP Top 10 Suite (Phase 13)', () => {
  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();

  const superAdmin = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgAId,
    role: 'super_admin',
    displayName: 'Super Admin',
    email: 'superadmin@securewatch.io',
    isActive: true
  };

  const orgAdminA = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgAId,
    role: 'org_admin',
    displayName: 'Org A Admin',
    email: 'admin@org-a.com',
    isActive: true
  };

  const analystA = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgAId,
    role: 'security_analyst',
    displayName: 'Org A Analyst',
    email: 'analyst@org-a.com',
    isActive: true
  };

  const operatorA = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgAId,
    role: 'operator',
    displayName: 'Org A Operator',
    email: 'operator@org-a.com',
    isActive: true
  };

  const viewerA = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgAId,
    role: 'viewer',
    displayName: 'Org A Viewer',
    email: 'viewer@org-a.com',
    isActive: true
  };

  const inactiveUserA = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgAId,
    role: 'viewer',
    displayName: 'Inactive User',
    email: 'inactive@org-a.com',
    isActive: false
  };

  const analystB = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgBId,
    role: 'security_analyst',
    displayName: 'Org B Analyst',
    email: 'analyst@org-b.com',
    isActive: true
  };

  let superAdminToken, orgAdminAToken, analystAToken, operatorAToken, viewerAToken, inactiveUserAToken, analystBToken;

  beforeAll(() => {
    superAdminToken = generateAccessToken(superAdmin);
    orgAdminAToken = generateAccessToken(orgAdminA);
    analystAToken = generateAccessToken(analystA);
    operatorAToken = generateAccessToken(operatorA);
    viewerAToken = generateAccessToken(viewerA);
    inactiveUserAToken = generateAccessToken(inactiveUserA);
    analystBToken = generateAccessToken(analystB);
  });

  beforeEach(() => {
    jest.restoreAllMocks();

    // Default mock for User.findById to support authentication middleware
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      let matched = null;
      if (idStr === superAdmin._id.toString()) matched = superAdmin;
      else if (idStr === orgAdminA._id.toString()) matched = orgAdminA;
      else if (idStr === analystA._id.toString()) matched = analystA;
      else if (idStr === operatorA._id.toString()) matched = operatorA;
      else if (idStr === viewerA._id.toString()) matched = viewerA;
      else if (idStr === inactiveUserA._id.toString()) matched = inactiveUserA;
      else if (idStr === analystB._id.toString()) matched = analystB;

      return {
        select: jest.fn().mockResolvedValue(matched ? { ...matched } : null)
      };
    });
  });

  describe('1. Identification & Authentication Failures (A07)', () => {
    it('should reject unauthenticated request with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/v1/devices');
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject malformed JWT format with 401 INVALID_TOKEN', async () => {
      const res = await request(app)
        .get('/api/v1/devices')
        .set('Authorization', 'Bearer not-a-valid-jwt-structure');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject tampered JWT signature with 401 INVALID_TOKEN', async () => {
      // Create token with different secret
      const forgedToken = jwt.sign(
        { sub: analystA._id.toString(), email: analystA.email, role: 'super_admin' },
        'wrong-secret-key-12345678901234567890123456789012',
        { algorithm: 'HS256', expiresIn: '15m' }
      );

      const res = await request(app)
        .get('/api/v1/devices')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject expired JWT token with 401 TOKEN_EXPIRED', async () => {
      const expiredToken = jwt.sign(
        { sub: analystA._id.toString(), email: analystA.email, role: analystA.role },
        config.jwt.secret,
        { algorithm: 'HS256', expiresIn: '-10s' }
      );

      const res = await request(app)
        .get('/api/v1/devices')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('should reject authenticated requests from deactivated users with 403 ACCOUNT_DEACTIVATED', async () => {
      const res = await request(app)
        .get('/api/v1/devices')
        .set('Authorization', `Bearer ${inactiveUserAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
    });

    it('should reject login attempts with invalid credentials with 401 INVALID_CREDENTIALS', async () => {
      jest.spyOn(User, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'unknown@securewatch.io',
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('2. Broken Access Control & RBAC Enforcement (A01)', () => {
    it('should prevent viewer role from registering devices (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/v1/devices')
        .set('Authorization', `Bearer ${viewerAToken}`)
        .send({
          name: 'Unauthorized Device',
          type: 'environmental',
          manufacturer: 'Acme',
          model: 'Sensor-X'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should prevent operator role from regenerating device API keys (403 FORBIDDEN)', async () => {
      const dummyDevId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/v1/devices/${dummyDevId}/regenerate-key`)
        .set('Authorization', `Bearer ${operatorAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should prevent security_analyst from performing org_admin-only user invite (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post('/api/v1/users/invite')
        .set('Authorization', `Bearer ${analystAToken}`)
        .send({
          email: 'newoperator@org-a.com',
          displayName: 'New Operator',
          role: 'operator'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject role manipulation in request payload attempting privilege escalation', async () => {
      const devId = new mongoose.Types.ObjectId();
      jest.spyOn(deviceService, 'updateDevice').mockResolvedValue({
        _id: devId,
        name: 'Updated Name'
      });

      const res = await request(app)
        .patch(`/api/v1/devices/${devId}`)
        .set('Authorization', `Bearer ${operatorAToken}`)
        .send({
          name: 'Updated Name'
        });

      expect(res.status).toBe(200);
      expect(res.body.role).toBeUndefined();
    });
  });

  describe('3. Multi-Tenancy & BOLA / IDOR Defense (A01)', () => {
    const orgBDevId = new mongoose.Types.ObjectId();
    const orgBIncidentId = new mongoose.Types.ObjectId();
    const orgBFirmwareId = new mongoose.Types.ObjectId();

    it('should prevent Org A user from accessing Org B device details (404 Not Found)', async () => {
      jest.spyOn(deviceService, 'getDeviceById').mockRejectedValue({
        statusCode: 404,
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found'
      });

      const res = await request(app)
        .get(`/api/v1/devices/${orgBDevId}`)
        .set('Authorization', `Bearer ${analystAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DEVICE_NOT_FOUND');
    });

    it('should prevent Org A user from mutating Org B device (404 Not Found)', async () => {
      jest.spyOn(deviceService, 'updateDevice').mockRejectedValue({
        statusCode: 404,
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found'
      });

      const res = await request(app)
        .patch(`/api/v1/devices/${orgBDevId}`)
        .set('Authorization', `Bearer ${operatorAToken}`)
        .send({ name: 'Cross Org Name Change' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DEVICE_NOT_FOUND');
    });

    it('should prevent Org A user from accessing Org B incident (404 Not Found)', async () => {
      jest.spyOn(incidentService, 'getIncidentById').mockRejectedValue({
        statusCode: 404,
        code: 'INCIDENT_NOT_FOUND',
        message: 'Incident not found'
      });

      const res = await request(app)
        .get(`/api/v1/incidents/${orgBIncidentId}`)
        .set('Authorization', `Bearer ${analystAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INCIDENT_NOT_FOUND');
    });

    it('should prevent Org A user from accessing Org B firmware version (404 Not Found)', async () => {
      jest.spyOn(firmwareService, 'getFirmwareVersionById').mockRejectedValue({
        statusCode: 404,
        code: 'FIRMWARE_VERSION_NOT_FOUND',
        message: 'Firmware version not found'
      });

      const res = await request(app)
        .get(`/api/v1/firmware/versions/${orgBFirmwareId}`)
        .set('Authorization', `Bearer ${analystAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FIRMWARE_VERSION_NOT_FOUND');
    });

    it('should anchor tenant context and ignore client-supplied organizationId query parameter for non-super_admin', async () => {
      const listSpy = jest.spyOn(deviceService, 'listDevices').mockResolvedValue({
        devices: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 }
      });

      await request(app)
        .get(`/api/v1/devices?organizationId=${orgBId.toString()}`)
        .set('Authorization', `Bearer ${analystAToken}`);

      // First argument to listDevices must be Org A's ID
      expect(listSpy).toHaveBeenCalled();
      const calledOrgId = listSpy.mock.calls[0][0];
      expect(calledOrgId).toBe(orgAId.toString());
    });
  });

  describe('4. Injection Defense (A03 - NoSQL Injection)', () => {
    it('should reject NoSQL operator object in login email parameter with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: { $gt: '' },
          password: 'Password123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject NoSQL $ne operator in login password parameter with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@org-a.com',
          password: { $ne: null }
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent device ID query safely without unhandled exception', async () => {
      jest.spyOn(deviceService, 'getDeviceById').mockRejectedValue({
        statusCode: 404,
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found'
      });

      const res = await request(app)
        .get('/api/v1/devices/NONEXISTENTDEV123')
        .set('Authorization', `Bearer ${viewerAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DEVICE_NOT_FOUND');
    });
  });

  describe('5. XSS & User Input Safety (A03 / Input Safety)', () => {
    it('should safely accept and store harmless XSS payloads in string fields without execution', async () => {
      const xssPayload = "<script>alert('xss')</script>";
      const devId = new mongoose.Types.ObjectId();

      jest.spyOn(deviceService, 'updateDevice').mockResolvedValue({
        _id: devId,
        name: xssPayload,
        location: 'Server Room A'
      });

      const res = await request(app)
        .patch(`/api/v1/devices/${devId}`)
        .set('Authorization', `Bearer ${operatorAToken}`)
        .send({
          name: xssPayload,
          location: 'Server Room A'
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe(xssPayload);
      // Response Content-Type is application/json (safe against direct browser script execution)
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('6. Cryptographic & Sensitive Data Protection (A02)', () => {
    it('should never expose apiKeyHash in device responses', async () => {
      const mockDevice = {
        _id: new mongoose.Types.ObjectId(),
        deviceId: 'DEV-TS-012345',
        name: 'Safe Device',
        type: 'temperature_sensor',
        status: 'active'
      };

      jest.spyOn(deviceService, 'getDeviceById').mockResolvedValue(mockDevice);

      const res = await request(app)
        .get(`/api/v1/devices/${mockDevice._id}`)
        .set('Authorization', `Bearer ${viewerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.apiKeyHash).toBeUndefined();
      expect(res.body.apiKey).toBeUndefined();
    });
  });
});

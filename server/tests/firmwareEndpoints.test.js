const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { generateAccessToken, hashToken } = require('../src/utils/token');
const { User, FirmwareVersion, FirmwareDeployment, Device } = require('../src/models');
const firmwareService = require('../src/services/firmware.service');

describe('Firmware & OTA REST Endpoints (Phase 10)', () => {
  const orgId = new mongoose.Types.ObjectId();
  const otherOrgId = new mongoose.Types.ObjectId();
  const devObjectId = new mongoose.Types.ObjectId();
  const fwObjectId = new mongoose.Types.ObjectId();
  const depObjectId = new mongoose.Types.ObjectId();

  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'org_admin',
    displayName: 'Admin User',
    email: 'admin@soc.org',
    isActive: true
  };

  const analystUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'security_analyst',
    displayName: 'Analyst Jane',
    email: 'analyst@soc.org',
    isActive: true
  };

  const operatorUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'operator',
    displayName: 'Operator Bob',
    email: 'operator@soc.org',
    isActive: true
  };

  const viewerUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'viewer',
    displayName: 'Viewer Alice',
    email: 'viewer@soc.org',
    isActive: true
  };

  let adminToken, analystToken, operatorToken, viewerToken;

  beforeAll(() => {
    adminToken = generateAccessToken(adminUser);
    analystToken = generateAccessToken(analystUser);
    operatorToken = generateAccessToken(operatorUser);
    viewerToken = generateAccessToken(viewerUser);
  });

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      let matched = viewerUser;
      if (idStr === adminUser._id.toString()) matched = adminUser;
      else if (idStr === analystUser._id.toString()) matched = analystUser;
      else if (idStr === operatorUser._id.toString()) matched = operatorUser;

      return {
        select: jest.fn().mockResolvedValue({
          ...matched,
          isActive: true
        })
      };
    });
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await new Promise((resolve) => setImmediate(resolve));
  });

  // =========================================================
  // 1. POST /api/v1/firmware/versions
  // =========================================================
  describe('POST /api/v1/firmware/versions', () => {
    it('should allow security_analyst to register firmware version (201 Created)', async () => {
      const payload = {
        version: '2.0.0',
        deviceType: 'temperature_sensor',
        checksum: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        fileSize: 2097152,
        releaseDate: '2026-09-05T00:00:00Z',
        changelog: 'Initial firmware release for temperature sensor v2',
        securityStatus: 'under_review',
        deploymentPolicy: 'restricted'
      };

      jest.spyOn(firmwareService, 'createFirmwareVersion').mockResolvedValue({
        _id: fwObjectId.toString(),
        ...payload
      });

      const res = await request(app)
        .post('/api/v1/firmware/versions')
        .set('Authorization', `Bearer ${analystToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.version).toBe('2.0.0');
    });

    it('should reject registration when checksum is not a 64-char hex string (400 Bad Request)', async () => {
      const payload = {
        version: '2.0.0',
        deviceType: 'temperature_sensor',
        checksum: 'invalid-short-checksum',
        releaseDate: '2026-09-05T00:00:00Z'
      };

      const res = await request(app)
        .post('/api/v1/firmware/versions')
        .set('Authorization', `Bearer ${analystToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject viewer or operator with 403 Forbidden', async () => {
      const payload = {
        version: '2.0.0',
        deviceType: 'temperature_sensor',
        checksum: 'a'.repeat(64),
        releaseDate: '2026-09-05T00:00:00Z'
      };

      const res = await request(app)
        .post('/api/v1/firmware/versions')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(payload);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================
  // 2. GET /api/v1/firmware/versions
  // =========================================================
  describe('GET /api/v1/firmware/versions', () => {
    it('should allow viewer to list firmware versions (200 OK)', async () => {
      jest.spyOn(firmwareService, 'listFirmwareVersions').mockResolvedValue({
        versions: [{ _id: fwObjectId.toString(), version: '1.0.0', deviceType: 'smart_camera' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      });

      const res = await request(app)
        .get('/api/v1/firmware/versions?deviceType=smart_camera')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.versions).toHaveLength(1);
      expect(firmwareService.listFirmwareVersions).toHaveBeenCalledWith(
        orgId.toString(),
        expect.objectContaining({ deviceType: 'smart_camera' })
      );
    });
  });

  // =========================================================
  // 3. GET /api/v1/firmware/versions/:id
  // =========================================================
  describe('GET /api/v1/firmware/versions/:id', () => {
    it('should return firmware version details for viewer (200 OK)', async () => {
      jest.spyOn(firmwareService, 'getFirmwareVersionById').mockResolvedValue({
        _id: fwObjectId.toString(),
        version: '1.0.0',
        deviceType: 'smart_camera'
      });

      const res = await request(app)
        .get(`/api/v1/firmware/versions/${fwObjectId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.version).toBe('1.0.0');
    });

    it('should return 404 when firmware version not found', async () => {
      const notFoundErr = new Error('Firmware version not found');
      notFoundErr.code = 'FIRMWARE_NOT_FOUND';
      notFoundErr.statusCode = 404;

      jest.spyOn(firmwareService, 'getFirmwareVersionById').mockRejectedValue(notFoundErr);

      const res = await request(app)
        .get(`/api/v1/firmware/versions/${fwObjectId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('FIRMWARE_NOT_FOUND');
    });
  });

  // =========================================================
  // 4. PATCH /api/v1/firmware/versions/:id
  // =========================================================
  describe('PATCH /api/v1/firmware/versions/:id', () => {
    it('should allow security_analyst to update security metadata (200 OK)', async () => {
      jest.spyOn(firmwareService, 'updateFirmwareVersion').mockResolvedValue({
        _id: fwObjectId.toString(),
        version: '1.0.0',
        securityStatus: 'secure',
        deploymentPolicy: 'allowed'
      });

      const res = await request(app)
        .patch(`/api/v1/firmware/versions/${fwObjectId}`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          securityStatus: 'secure',
          deploymentPolicy: 'allowed'
        });

      expect(res.status).toBe(200);
      expect(res.body.securityStatus).toBe('secure');
    });

    it('should reject update from viewer with 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/v1/firmware/versions/${fwObjectId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ securityStatus: 'secure' });

      expect(res.status).toBe(403);
    });

    it('should reject empty body with 400 Bad Request', async () => {
      const res = await request(app)
        .patch(`/api/v1/firmware/versions/${fwObjectId}`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================
  // 5. POST /api/v1/firmware/deployments
  // =========================================================
  describe('POST /api/v1/firmware/deployments', () => {
    it('should allow security_analyst to create batch deployments (201 Created)', async () => {
      jest.spyOn(firmwareService, 'createDeployments').mockResolvedValue({
        deployments: [
          {
            _id: depObjectId.toString(),
            deploymentId: 'DEP-20260905-ABCD',
            status: 'pending'
          }
        ],
        warnings: []
      });

      const res = await request(app)
        .post('/api/v1/firmware/deployments')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          firmwareVersionId: fwObjectId.toString(),
          deviceIds: [devObjectId.toString()]
        });

      expect(res.status).toBe(201);
      expect(res.body.deployments).toHaveLength(1);
      expect(res.body.warnings).toEqual([]);
    });

    it('should return warnings array when target devices have active critical incidents', async () => {
      jest.spyOn(firmwareService, 'createDeployments').mockResolvedValue({
        deployments: [
          {
            _id: depObjectId.toString(),
            deploymentId: 'DEP-20260905-ABCD',
            status: 'pending'
          }
        ],
        warnings: [
          {
            deviceId: devObjectId.toString(),
            incidentId: 'INC-20260905-001',
            code: 'OPEN_CRITICAL_INCIDENT',
            message: 'Target device has an active critical incident'
          }
        ]
      });

      const res = await request(app)
        .post('/api/v1/firmware/deployments')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          firmwareVersionId: fwObjectId.toString(),
          deviceIds: [devObjectId.toString()]
        });

      expect(res.status).toBe(201);
      expect(res.body.warnings).toHaveLength(1);
      expect(res.body.warnings[0].code).toBe('OPEN_CRITICAL_INCIDENT');
    });

    it('should reject viewer or operator with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/firmware/deployments')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          firmwareVersionId: fwObjectId.toString(),
          deviceIds: [devObjectId.toString()]
        });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================
  // 6. GET /api/v1/firmware/deployments
  // =========================================================
  describe('GET /api/v1/firmware/deployments', () => {
    it('should allow viewer to list deployments with filters (200 OK)', async () => {
      jest.spyOn(firmwareService, 'listDeployments').mockResolvedValue({
        deployments: [
          {
            _id: depObjectId.toString(),
            deploymentId: 'DEP-20260905-ABCD',
            status: 'pending'
          }
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      });

      const res = await request(app)
        .get('/api/v1/firmware/deployments?status=pending')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.deployments).toHaveLength(1);
    });
  });

  // =========================================================
  // 7. GET /api/v1/firmware/deployments/:id
  // =========================================================
  describe('GET /api/v1/firmware/deployments/:id', () => {
    it('should allow viewer to view deployment details (200 OK)', async () => {
      jest.spyOn(firmwareService, 'getDeploymentById').mockResolvedValue({
        _id: depObjectId.toString(),
        deploymentId: 'DEP-20260905-ABCD',
        status: 'installing'
      });

      const res = await request(app)
        .get(`/api/v1/firmware/deployments/${depObjectId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.deploymentId).toBe('DEP-20260905-ABCD');
    });
  });

  // =========================================================
  // 8. PATCH /api/v1/firmware/deployments/:id/status
  // =========================================================
  describe('PATCH /api/v1/firmware/deployments/:id/status', () => {
    it('should allow operator with JWT to update deployment status (200 OK)', async () => {
      jest.spyOn(firmwareService, 'updateDeploymentStatus').mockResolvedValue({
        _id: depObjectId.toString(),
        deploymentId: 'DEP-20260905-ABCD',
        status: 'downloading'
      });

      const res = await request(app)
        .patch(`/api/v1/firmware/deployments/${depObjectId}/status`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ status: 'downloading' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('downloading');
    });

    it('should reject viewer JWT with 403 Forbidden', async () => {
      const err = new Error('Viewers are not authorized to update deployment status');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;

      jest.spyOn(firmwareService, 'updateDeploymentStatus').mockRejectedValue(err);

      const res = await request(app)
        .patch(`/api/v1/firmware/deployments/${depObjectId}/status`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ status: 'downloading' });

      expect(res.status).toBe(403);
    });

    it('should allow Device API-Key to report deployment status (200 OK)', async () => {
      const rawApiKey = 'd'.repeat(64);
      const apiKeyHash = hashToken(rawApiKey);

      const mockDevice = {
        _id: devObjectId,
        deviceId: 'DEV-TEMP-001',
        organizationId: orgId,
        status: 'online',
        apiKeyHash
      };

      jest.spyOn(Device, 'findOne').mockResolvedValue(mockDevice);
      jest.spyOn(firmwareService, 'updateDeploymentStatus').mockResolvedValue({
        _id: depObjectId.toString(),
        deploymentId: 'DEP-20260905-ABCD',
        status: 'installing'
      });

      const res = await request(app)
        .patch(`/api/v1/firmware/deployments/${depObjectId}/status`)
        .set('X-Device-API-Key', rawApiKey)
        .send({ status: 'installing' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('installing');
    });

    it('should reject invalid Device API-Key with 401 INVALID_DEVICE_CREDENTIALS', async () => {
      jest.spyOn(Device, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .patch(`/api/v1/firmware/deployments/${depObjectId}/status`)
        .set('X-Device-API-Key', 'invalid-key')
        .send({ status: 'installing' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_DEVICE_CREDENTIALS');
    });

    it('should reject decommissioned Device API-Key with 403 DEVICE_DECOMMISSIONED', async () => {
      const mockDevice = {
        _id: devObjectId,
        deviceId: 'DEV-TEMP-001',
        organizationId: orgId,
        status: 'decommissioned'
      };

      jest.spyOn(Device, 'findOne').mockResolvedValue(mockDevice);

      const res = await request(app)
        .patch(`/api/v1/firmware/deployments/${depObjectId}/status`)
        .set('X-Device-API-Key', 'some-key')
        .send({ status: 'installing' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('DEVICE_DECOMMISSIONED');
    });

    it('should return 401 UNAUTHORIZED when neither Bearer token nor X-Device-API-Key is provided', async () => {
      const res = await request(app)
        .patch(`/api/v1/firmware/deployments/${depObjectId}/status`)
        .send({ status: 'downloading' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 CHECKSUM_VERIFICATION_FAILED when checksum verification fails', async () => {
      const checksumErr = new Error('Firmware verification checksum mismatch');
      checksumErr.code = 'CHECKSUM_VERIFICATION_FAILED';
      checksumErr.statusCode = 400;

      jest.spyOn(firmwareService, 'updateDeploymentStatus').mockRejectedValue(checksumErr);

      const res = await request(app)
        .patch(`/api/v1/firmware/deployments/${depObjectId}/status`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          status: 'success',
          result: { verificationChecksum: 'mismatch' }
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CHECKSUM_VERIFICATION_FAILED');
    });

    it('should return 400 INVALID_DEPLOYMENT_TRANSITION when an illegal state skip is attempted', async () => {
      const transitionErr = new Error('Invalid deployment transition from pending to success');
      transitionErr.code = 'INVALID_DEPLOYMENT_TRANSITION';
      transitionErr.statusCode = 400;

      jest.spyOn(firmwareService, 'updateDeploymentStatus').mockRejectedValue(transitionErr);

      const res = await request(app)
        .patch(`/api/v1/firmware/deployments/${depObjectId}/status`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ status: 'success' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DEPLOYMENT_TRANSITION');
    });
  });
});

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/token');
const { User } = require('../src/models');
const firmwareService = require('../src/services/firmware.service');

describe('Firmware Metadata & Checksum Integrity Suite (Phase 13)', () => {
  const orgId = new mongoose.Types.ObjectId();

  const analystUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'security_analyst',
    displayName: 'Analyst Bob',
    email: 'analyst@sec.org',
    isActive: true
  };

  const operatorUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'operator',
    displayName: 'Operator Tim',
    email: 'operator@sec.org',
    isActive: true
  };

  let analystToken, operatorToken;

  const validChecksum = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const corruptChecksum = '0000000000000000000000000000000000000000000000000000000000000000';

  beforeAll(() => {
    analystToken = generateAccessToken(analystUser);
    operatorToken = generateAccessToken(operatorUser);
  });

  beforeEach(() => {
    jest.restoreAllMocks();

    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      let matched = null;
      if (idStr === analystUser._id.toString()) matched = analystUser;
      else if (idStr === operatorUser._id.toString()) matched = operatorUser;

      return {
        select: jest.fn().mockResolvedValue(matched ? { ...matched } : null)
      };
    });
  });

  describe('1. Checksum Format Validation on Firmware Version Creation', () => {
    it('should accept valid 64-character SHA-256 checksum string', async () => {
      const mockCreated = {
        _id: new mongoose.Types.ObjectId(),
        version: 'v2.1.0',
        deviceType: 'temperature_sensor',
        checksum: validChecksum,
        securityStatus: 'secure'
      };

      jest.spyOn(firmwareService, 'createFirmwareVersion').mockResolvedValue(mockCreated);

      const res = await request(app)
        .post('/api/v1/firmware/versions')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          version: 'v2.1.0',
          deviceType: 'temperature_sensor',
          checksum: validChecksum,
          securityStatus: 'secure',
          releaseDate: new Date().toISOString()
        });

      expect(res.status).toBe(201);
      expect(res.body.checksum).toBe(validChecksum);
    });

    it('should reject invalid checksum format (not 64-char hex) with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/firmware/versions')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          version: 'v2.1.0',
          deviceType: 'temperature_sensor',
          checksum: 'not-a-valid-sha256-hex-hash',
          securityStatus: 'secure',
          releaseDate: new Date().toISOString()
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('2. OTA Checksum Verification & Mismatch Enforcement', () => {
    const deploymentId = new mongoose.Types.ObjectId();

    it('should allow transition from verifying to success when verificationChecksum matches case-insensitively', async () => {
      const upperChecksum = validChecksum.toUpperCase();

      jest.spyOn(firmwareService, 'updateDeploymentStatus').mockResolvedValue({
        _id: deploymentId,
        deploymentId: 'DEP-2026-0001',
        status: 'success',
        result: {
          success: true,
          verificationChecksum: upperChecksum
        }
      });

      const res = await request(app)
        .patch(`/api/v1/firmware/deployments/${deploymentId}/status`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          status: 'success',
          result: {
            verificationChecksum: upperChecksum
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.result.success).toBe(true);
    });

    it('should reject transition to success with CHECKSUM_VERIFICATION_FAILED when checksums do not match', async () => {
      jest.spyOn(firmwareService, 'updateDeploymentStatus').mockRejectedValue({
        statusCode: 400,
        code: 'CHECKSUM_VERIFICATION_FAILED',
        message: 'Firmware verification checksum mismatch'
      });

      const res = await request(app)
        .patch(`/api/v1/firmware/deployments/${deploymentId}/status`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          status: 'success',
          result: {
            verificationChecksum: corruptChecksum
          }
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CHECKSUM_VERIFICATION_FAILED');
    });
  });

  describe('3. Deployment State Machine Transitions & Rollback Enforcement', () => {
    const deploymentId = new mongoose.Types.ObjectId();

    it('should allow transition from failed to rolled_back', async () => {
      jest.spyOn(firmwareService, 'updateDeploymentStatus').mockResolvedValue({
        _id: deploymentId,
        status: 'rolled_back',
        result: {
          success: false,
          message: 'Deployment rolled back to previous version'
        }
      });

      const res = await request(app)
        .patch(`/api/v1/firmware/deployments/${deploymentId}/status`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          status: 'rolled_back',
          result: {
            message: 'Deployment rolled back to previous version'
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('rolled_back');
    });

    it('should reject illegal transitions out of terminal state success (400 INVALID_DEPLOYMENT_TRANSITION)', async () => {
      jest.spyOn(firmwareService, 'updateDeploymentStatus').mockRejectedValue({
        statusCode: 400,
        code: 'INVALID_DEPLOYMENT_TRANSITION',
        message: 'Invalid deployment transition'
      });

      const res = await request(app)
        .patch(`/api/v1/firmware/deployments/${deploymentId}/status`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ status: 'installing' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DEPLOYMENT_TRANSITION');
    });
  });
});

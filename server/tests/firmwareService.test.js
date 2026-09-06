const mongoose = require('mongoose');
const firmwareService = require('../src/services/firmware.service');
const {
  FirmwareVersion,
  FirmwareDeployment,
  Device,
  Incident,
  AuditLog
} = require('../src/models');

describe('Firmware Service & OTA Lifecycle (Phase 10)', () => {
  const orgId = new mongoose.Types.ObjectId();
  const otherOrgId = new mongoose.Types.ObjectId();
  const devObjectId = new mongoose.Types.ObjectId();
  const fwObjectId = new mongoose.Types.ObjectId();

  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'org_admin',
    displayName: 'Admin User',
    email: 'admin@soc.org'
  };

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
    displayName: 'Operator Bob',
    email: 'operator@soc.org'
  };

  const viewerUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'viewer',
    displayName: 'Viewer Alice',
    email: 'viewer@soc.org'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AuditLog, 'create').mockResolvedValue({});
    jest.spyOn(FirmwareVersion, 'findById').mockResolvedValue({
      _id: fwObjectId,
      version: '1.2.0',
      checksum: 'c'.repeat(64)
    });
    jest.spyOn(Device, 'findById').mockResolvedValue({
      _id: devObjectId,
      organizationId: orgId,
      deviceId: 'DEV-TEMP-001',
      currentFirmwareVersion: '1.0.0',
      timeline: [],
      save: jest.fn().mockResolvedValue(true)
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => setImmediate(resolve));
  });

  describe('Firmware Version Registration & Management', () => {
    it('should register a valid firmware version and generate audit event', async () => {
      const mockDoc = {
        _id: fwObjectId,
        version: '1.4.0',
        deviceType: 'temperature_sensor',
        checksum: 'a'.repeat(64),
        fileSize: 1048576,
        releaseDate: new Date(),
        changelog: 'Security hardening and sensor calibration update',
        securityStatus: 'under_review',
        deploymentPolicy: 'restricted',
        vulnerabilities: [],
        toObject: () => ({
          _id: fwObjectId,
          version: '1.4.0',
          deviceType: 'temperature_sensor',
          checksum: 'a'.repeat(64),
          securityStatus: 'under_review',
          deploymentPolicy: 'restricted'
        })
      };

      jest.spyOn(FirmwareVersion, 'findOne').mockResolvedValue(null);
      jest.spyOn(FirmwareVersion, 'create').mockResolvedValue(mockDoc);

      const result = await firmwareService.createFirmwareVersion(
        orgId.toString(),
        {
          version: '1.4.0',
          deviceType: 'temperature_sensor',
          checksum: 'A'.repeat(64), // uppercase should be normalized
          fileSize: 1048576,
          changelog: 'Security hardening'
        },
        analystUser
      );

      expect(FirmwareVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '1.4.0',
          deviceType: 'temperature_sensor',
          checksum: 'a'.repeat(64),
          securityStatus: 'under_review',
          deploymentPolicy: 'restricted'
        })
      );
      expect(result.version).toBe('1.4.0');
    });

    it('should reject registration if duplicate version exists for deviceType in organization', async () => {
      jest.spyOn(FirmwareVersion, 'findOne').mockResolvedValue({ _id: fwObjectId });

      await expect(
        firmwareService.createFirmwareVersion(
          orgId.toString(),
          {
            version: '1.4.0',
            deviceType: 'temperature_sensor',
            checksum: 'a'.repeat(64)
          },
          analystUser
        )
      ).rejects.toThrow(/already registered/);
    });

    it('should list firmware versions with device and deployment counts', async () => {
      const mockVersions = [
        {
          _id: fwObjectId,
          version: '1.2.0',
          deviceType: 'smart_camera',
          checksum: 'b'.repeat(64),
          securityStatus: 'secure',
          deploymentPolicy: 'allowed'
        }
      ];

      jest.spyOn(FirmwareVersion, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockVersions)
              })
            })
          })
        })
      });
      jest.spyOn(FirmwareVersion, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(Device, 'countDocuments').mockResolvedValue(5);
      jest.spyOn(FirmwareDeployment, 'countDocuments').mockResolvedValue(2);

      const result = await firmwareService.listFirmwareVersions(orgId.toString(), {});
      expect(result.versions).toHaveLength(1);
      expect(result.versions[0].deviceCount).toBe(5);
      expect(result.versions[0].deploymentCount).toBe(2);
      expect(result.total).toBe(1);
    });

    it('should update firmware metadata, securityStatus, and vulnerabilities', async () => {
      const mockDoc = {
        _id: fwObjectId,
        version: '1.2.0',
        securityStatus: 'under_review',
        deploymentPolicy: 'restricted',
        vulnerabilities: [],
        changelog: '',
        save: jest.fn().mockResolvedValue(true),
        toObject: function () {
          return {
            _id: this._id,
            version: this.version,
            securityStatus: this.securityStatus,
            deploymentPolicy: this.deploymentPolicy,
            vulnerabilities: this.vulnerabilities,
            changelog: this.changelog
          };
        }
      };

      jest.spyOn(FirmwareVersion, 'findOne').mockResolvedValue(mockDoc);

      const result = await firmwareService.updateFirmwareVersion(
        fwObjectId.toString(),
        orgId.toString(),
        {
          securityStatus: 'secure',
          deploymentPolicy: 'allowed',
          changelog: 'Verified clean',
          vulnerabilities: [
            {
              cveId: 'CVE-2026-1001',
              severity: 'low',
              description: 'Minor logging info leak'
            }
          ]
        },
        analystUser
      );

      expect(mockDoc.securityStatus).toBe('secure');
      expect(mockDoc.deploymentPolicy).toBe('allowed');
      expect(mockDoc.vulnerabilities).toHaveLength(1);
      expect(mockDoc.save).toHaveBeenCalled();
    });
  });

  describe('OTA Deployment Eligibility & Security Checks', () => {
    it('should reject deployment creation if firmware is marked vulnerable or recalled', async () => {
      jest.spyOn(FirmwareVersion, 'findOne').mockResolvedValue({
        _id: fwObjectId,
        version: '1.0.0',
        securityStatus: 'vulnerable',
        deploymentPolicy: 'allowed'
      });

      await expect(
        firmwareService.createDeployments(
          orgId.toString(),
          {
            firmwareVersionId: fwObjectId.toString(),
            deviceIds: [devObjectId.toString()]
          },
          analystUser
        )
      ).rejects.toThrow(/Cannot deploy firmware version with security status 'vulnerable'/);
    });

    it('should reject deployment creation if firmware deployment policy is blocked', async () => {
      jest.spyOn(FirmwareVersion, 'findOne').mockResolvedValue({
        _id: fwObjectId,
        version: '1.0.0',
        securityStatus: 'secure',
        deploymentPolicy: 'blocked'
      });

      await expect(
        firmwareService.createDeployments(
          orgId.toString(),
          {
            firmwareVersionId: fwObjectId.toString(),
            deviceIds: [devObjectId.toString()]
          },
          analystUser
        )
      ).rejects.toThrow(/administratively blocked/);
    });

    it('should reject restricted firmware deployment if actor role is below security_analyst', async () => {
      jest.spyOn(FirmwareVersion, 'findOne').mockResolvedValue({
        _id: fwObjectId,
        version: '1.0.0',
        securityStatus: 'under_review',
        deploymentPolicy: 'restricted'
      });

      await expect(
        firmwareService.createDeployments(
          orgId.toString(),
          {
            firmwareVersionId: fwObjectId.toString(),
            deviceIds: [devObjectId.toString()]
          },
          operatorUser
        )
      ).rejects.toThrow(/Deploying restricted firmware requires security_analyst/);
    });

    it('should reject deployment if device type does not match firmware deviceType', async () => {
      jest.spyOn(FirmwareVersion, 'findOne').mockResolvedValue({
        _id: fwObjectId,
        version: '1.1.0',
        deviceType: 'temperature_sensor',
        securityStatus: 'secure',
        deploymentPolicy: 'allowed'
      });

      jest.spyOn(Device, 'find').mockResolvedValue([
        {
          _id: devObjectId,
          deviceId: 'DEV-CAM-001',
          type: 'smart_camera', // mismatch!
          status: 'online',
          timeline: [],
          save: jest.fn().mockResolvedValue(true)
        }
      ]);

      await expect(
        firmwareService.createDeployments(
          orgId.toString(),
          {
            firmwareVersionId: fwObjectId.toString(),
            deviceIds: [devObjectId.toString()]
          },
          analystUser
        )
      ).rejects.toThrow(/does not match firmware device type/);
    });

    it('should reject deployment if device is decommissioned', async () => {
      jest.spyOn(FirmwareVersion, 'findOne').mockResolvedValue({
        _id: fwObjectId,
        version: '1.1.0',
        deviceType: 'temperature_sensor',
        securityStatus: 'secure',
        deploymentPolicy: 'allowed'
      });

      jest.spyOn(Device, 'find').mockResolvedValue([
        {
          _id: devObjectId,
          deviceId: 'DEV-TEMP-001',
          type: 'temperature_sensor',
          status: 'decommissioned',
          timeline: [],
          save: jest.fn().mockResolvedValue(true)
        }
      ]);

      await expect(
        firmwareService.createDeployments(
          orgId.toString(),
          {
            firmwareVersionId: fwObjectId.toString(),
            deviceIds: [devObjectId.toString()]
          },
          analystUser
        )
      ).rejects.toThrow(/is decommissioned and cannot receive firmware updates/);
    });

    it('should allow deployment but return non-blocking warning when device has active critical incident', async () => {
      const targetDevice = {
        _id: devObjectId,
        deviceId: 'DEV-TEMP-001',
        type: 'temperature_sensor',
        status: 'online',
        currentFirmwareVersion: '1.0.0',
        timeline: [],
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(FirmwareVersion, 'findOne').mockResolvedValue({
        _id: fwObjectId,
        version: '1.1.0',
        deviceType: 'temperature_sensor',
        securityStatus: 'secure',
        deploymentPolicy: 'allowed'
      });

      jest.spyOn(Device, 'find').mockResolvedValue([targetDevice]);

      jest.spyOn(Incident, 'find').mockReturnValue({
        select: jest.fn().mockResolvedValue([
          {
            deviceId: devObjectId,
            incidentId: 'INC-20260905-ABCD',
            title: 'Critical DDoS Flood Detected'
          }
        ])
      });

      jest.spyOn(FirmwareDeployment, 'create').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        deploymentId: 'DEP-20260905-1234',
        firmwareVersionId: fwObjectId,
        deviceId: devObjectId,
        status: 'pending',
        previousFirmwareVersion: '1.0.0',
        toObject: function () {
          return {
            _id: this._id,
            deploymentId: this.deploymentId,
            status: this.status,
            previousFirmwareVersion: this.previousFirmwareVersion
          };
        }
      });

      const result = await firmwareService.createDeployments(
        orgId.toString(),
        {
          firmwareVersionId: fwObjectId.toString(),
          deviceIds: [devObjectId.toString()]
        },
        analystUser
      );

      expect(result.deployments).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('OPEN_CRITICAL_INCIDENT');
      expect(targetDevice.timeline).toHaveLength(1);
      expect(targetDevice.timeline[0].action).toBe('firmware.deployment_initiated');
    });
  });

  describe('OTA Deployment State Machine & Checksum Verification', () => {
    let mockDeployment;
    let mockDevice;
    let mockFirmware;

    beforeEach(() => {
      mockDeployment = {
        _id: new mongoose.Types.ObjectId(),
        deploymentId: 'DEP-20260905-5678',
        firmwareVersionId: fwObjectId,
        deviceId: devObjectId,
        organizationId: orgId,
        status: 'pending',
        previousFirmwareVersion: '1.0.0',
        result: {},
        save: jest.fn().mockResolvedValue(true),
        toObject: function () {
          return { ...this };
        }
      };

      mockDevice = {
        _id: devObjectId,
        organizationId: orgId,
        deviceId: 'DEV-TEMP-001',
        currentFirmwareVersion: '1.0.0',
        timeline: [],
        save: jest.fn().mockResolvedValue(true)
      };

      mockFirmware = {
        _id: fwObjectId,
        version: '1.2.0',
        checksum: 'c'.repeat(64)
      };

      jest.spyOn(FirmwareDeployment, 'findOne').mockResolvedValue(mockDeployment);
      jest.spyOn(FirmwareVersion, 'findById').mockResolvedValue(mockFirmware);
      jest.spyOn(Device, 'findById').mockResolvedValue(mockDevice);
    });

    it('should follow exact happy path: pending -> downloading -> installing -> verifying -> success', async () => {
      const authCtx = { user: operatorUser, isDevice: false, organizationId: orgId.toString() };

      // 1. pending -> downloading
      mockDeployment.status = 'pending';
      let res = await firmwareService.updateDeploymentStatus(
        mockDeployment._id.toString(),
        { status: 'downloading' },
        authCtx
      );
      expect(mockDeployment.status).toBe('downloading');

      // 2. downloading -> installing
      res = await firmwareService.updateDeploymentStatus(
        mockDeployment._id.toString(),
        { status: 'installing' },
        authCtx
      );
      expect(mockDeployment.status).toBe('installing');

      // 3. installing -> verifying
      res = await firmwareService.updateDeploymentStatus(
        mockDeployment._id.toString(),
        { status: 'verifying' },
        authCtx
      );
      expect(mockDeployment.status).toBe('verifying');

      // 4. verifying -> success with valid matching checksum (case-insensitive)
      res = await firmwareService.updateDeploymentStatus(
        mockDeployment._id.toString(),
        {
          status: 'success',
          result: {
            verificationChecksum: 'C'.repeat(64), // uppercase matches lowercase
            message: 'Installation and verification completed'
          }
        },
        authCtx
      );
      expect(mockDeployment.status).toBe('success');
      expect(mockDevice.currentFirmwareVersion).toBe('1.2.0');
      expect(mockDevice.timeline.some((t) => t.action === 'firmware.updated')).toBe(true);
    });

    it('should reject invalid transition skips with INVALID_DEPLOYMENT_TRANSITION', async () => {
      const authCtx = { user: operatorUser, isDevice: false, organizationId: orgId.toString() };

      mockDeployment.status = 'pending';

      // pending -> installing (invalid skip)
      await expect(
        firmwareService.updateDeploymentStatus(
          mockDeployment._id.toString(),
          { status: 'installing' },
          authCtx
        )
      ).rejects.toThrow(/Invalid deployment transition from 'pending' to 'installing'/);

      // pending -> success (invalid skip)
      await expect(
        firmwareService.updateDeploymentStatus(
          mockDeployment._id.toString(),
          { status: 'success' },
          authCtx
        )
      ).rejects.toThrow(/Invalid deployment transition from 'pending' to 'success'/);
    });

    it('should reject transition to success if verification checksum mismatches firmware checksum', async () => {
      const authCtx = { user: operatorUser, isDevice: false, organizationId: orgId.toString() };
      mockDeployment.status = 'verifying';

      await expect(
        firmwareService.updateDeploymentStatus(
          mockDeployment._id.toString(),
          {
            status: 'success',
            result: {
              verificationChecksum: 'd'.repeat(64) // mismatch!
            }
          },
          authCtx
        )
      ).rejects.toThrow(/checksum mismatch/);

      // Device firmware must NOT be updated
      expect(mockDevice.currentFirmwareVersion).toBe('1.0.0');
    });

    it('should transition from verifying to failed with failure diagnostics', async () => {
      const authCtx = { user: operatorUser, isDevice: false, organizationId: orgId.toString() };
      mockDeployment.status = 'verifying';

      await firmwareService.updateDeploymentStatus(
        mockDeployment._id.toString(),
        {
          status: 'failed',
          result: {
            message: 'Signature check failed on device hardware',
            verificationChecksum: 'badchecksum'
          }
        },
        authCtx
      );

      expect(mockDeployment.status).toBe('failed');
      expect(mockDeployment.result.success).toBe(false);
      expect(mockDevice.timeline.some((t) => t.action === 'firmware.deployment_failed')).toBe(true);
    });

    it('should allow rollback from failed state to previousFirmwareVersion', async () => {
      const authCtx = { user: analystUser, isDevice: false, organizationId: orgId.toString() };
      mockDeployment.status = 'failed';
      mockDeployment.previousFirmwareVersion = '1.0.0';

      await firmwareService.updateDeploymentStatus(
        mockDeployment._id.toString(),
        {
          status: 'rolled_back',
          result: { message: 'Manual operator rollback' }
        },
        authCtx
      );

      expect(mockDeployment.status).toBe('rolled_back');
      expect(mockDevice.currentFirmwareVersion).toBe('1.0.0');
      expect(mockDevice.timeline.some((t) => t.action === 'firmware.rollback')).toBe(true);
    });

    it('should reject rollback if no previousFirmwareVersion exists on deployment', async () => {
      const authCtx = { user: analystUser, isDevice: false, organizationId: orgId.toString() };
      mockDeployment.status = 'failed';
      mockDeployment.previousFirmwareVersion = null; // no previous version

      await expect(
        firmwareService.updateDeploymentStatus(
          mockDeployment._id.toString(),
          { status: 'rolled_back' },
          authCtx
        )
      ).rejects.toThrow(/No previous firmware version recorded for rollback/);
    });

    it('should reject any transition from terminal states (success, rolled_back)', async () => {
      const authCtx = { user: analystUser, isDevice: false, organizationId: orgId.toString() };

      mockDeployment.status = 'success';
      await expect(
        firmwareService.updateDeploymentStatus(
          mockDeployment._id.toString(),
          { status: 'rolled_back' },
          authCtx
        )
      ).rejects.toThrow(/Invalid deployment transition from 'success' to 'rolled_back'/);

      mockDeployment.status = 'rolled_back';
      await expect(
        firmwareService.updateDeploymentStatus(
          mockDeployment._id.toString(),
          { status: 'installing' },
          authCtx
        )
      ).rejects.toThrow(/Invalid deployment transition from 'rolled_back' to 'installing'/);
    });
  });

  describe('Device API-Key Authentication Binding', () => {
    it('should allow device API-key to update status when deviceId and organizationId match deployment', async () => {
      const mockDeployment = {
        _id: new mongoose.Types.ObjectId(),
        deploymentId: 'DEP-20260905-9999',
        firmwareVersionId: fwObjectId,
        deviceId: devObjectId,
        organizationId: orgId,
        status: 'pending',
        save: jest.fn().mockResolvedValue(true),
        toObject: function () {
          return { ...this };
        }
      };

      jest.spyOn(FirmwareDeployment, 'findOne').mockResolvedValue(mockDeployment);

      const deviceAuthCtx = {
        device: {
          _id: devObjectId,
          deviceId: 'DEV-TEMP-001',
          organizationId: orgId
        },
        isDevice: true,
        organizationId: orgId.toString()
      };

      await firmwareService.updateDeploymentStatus(
        mockDeployment._id.toString(),
        { status: 'downloading' },
        deviceAuthCtx
      );

      expect(mockDeployment.status).toBe('downloading');
    });

    it('should reject device API-key update if authenticated device does not match deployment deviceId', async () => {
      const otherDevObjectId = new mongoose.Types.ObjectId();
      const mockDeployment = {
        _id: new mongoose.Types.ObjectId(),
        deploymentId: 'DEP-20260905-9999',
        firmwareVersionId: fwObjectId,
        deviceId: devObjectId, // belongs to devObjectId
        organizationId: orgId,
        status: 'pending',
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(FirmwareDeployment, 'findOne').mockResolvedValue(mockDeployment);

      const deviceAuthCtx = {
        device: {
          _id: otherDevObjectId, // different device!
          deviceId: 'DEV-CAM-999',
          organizationId: orgId
        },
        isDevice: true,
        organizationId: orgId.toString()
      };

      await expect(
        firmwareService.updateDeploymentStatus(
          mockDeployment._id.toString(),
          { status: 'downloading' },
          deviceAuthCtx
        )
      ).rejects.toThrow(/not authorized to update another device deployment/);
    });
  });

  describe('Phase 9 Rollback Bridge Integration', () => {
    it('should execute rollback for eligible failed deployment on target device', async () => {
      const failedDep = {
        _id: new mongoose.Types.ObjectId(),
        deploymentId: 'DEP-20260905-FAIL',
        deviceId: devObjectId,
        organizationId: orgId,
        status: 'failed',
        previousFirmwareVersion: '1.0.0',
        firmwareVersionId: fwObjectId,
        save: jest.fn().mockResolvedValue(true),
        toObject: function () {
          return { ...this };
        }
      };

      const mockDevice = {
        _id: devObjectId,
        organizationId: orgId,
        currentFirmwareVersion: '1.0.0',
        timeline: [],
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(FirmwareDeployment, 'findOne').mockImplementation((query) => {
        if (query.status === 'failed') {
          return {
            sort: jest.fn().mockResolvedValue(failedDep)
          };
        }
        return Promise.resolve(failedDep);
      });
      jest.spyOn(Device, 'findById').mockResolvedValue(mockDevice);
      jest.spyOn(FirmwareVersion, 'findById').mockResolvedValue({ _id: fwObjectId, version: '1.1.0' });

      const outcome = await firmwareService.rollbackFailedDeploymentForDevice(
        devObjectId.toString(),
        orgId.toString(),
        analystUser
      );

      expect(outcome).toContain('Firmware rollback executed: reverted to v1.0.0');
      expect(failedDep.status).toBe('rolled_back');
      expect(mockDevice.currentFirmwareVersion).toBe('1.0.0');
    });

    it('should return skip message if no eligible failed deployment exists for device', async () => {
      jest.spyOn(FirmwareDeployment, 'findOne').mockReturnValue({
        sort: jest.fn().mockResolvedValue(null)
      });

      const outcome = await firmwareService.rollbackFailedDeploymentForDevice(
        devObjectId.toString(),
        orgId.toString(),
        analystUser
      );

      expect(outcome).toContain('Firmware rollback skipped: no eligible failed deployment with previous version found');
    });
  });
});

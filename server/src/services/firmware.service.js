const crypto = require('crypto');
const mongoose = require('mongoose');
const { FirmwareVersion, FirmwareDeployment, Device, Incident, User } = require('../models');
const { logAuditEvent } = require('./audit.service');
const { ROLE_HIERARCHY } = require('../middleware/rbac');
const logger = require('../utils/logger');

const VALID_DEPLOYMENT_TRANSITIONS = {
  pending: ['downloading', 'failed'],
  downloading: ['installing', 'failed'],
  installing: ['verifying', 'failed'],
  verifying: ['success', 'failed'],
  failed: ['rolled_back'],
  success: [],
  rolled_back: []
};

class FirmwareService {
  /**
   * Generates a unique, human-readable Deployment ID: DEP-YYYYMMDD-HEX4
   * @returns {string}
   */
  generateDeploymentId() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `DEP-${dateStr}-${randomHex}`;
  }

  /**
   * Registers a new FirmwareVersion metadata document.
   *
   * @param {string} organizationId
   * @param {Object} data
   * @param {Object} actorUser
   * @returns {Promise<Object>}
   */
  async createFirmwareVersion(organizationId, data, actorUser) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);

    // Check for duplicate version for the same device type within organization
    const existing = await FirmwareVersion.findOne({
      organizationId: orgObjectId,
      deviceType: data.deviceType,
      version: data.version.trim()
    });

    if (existing) {
      const err = new Error(`Firmware version '${data.version}' already registered for device type '${data.deviceType}' in this organization`);
      err.code = 'FIRMWARE_VERSION_EXISTS';
      err.statusCode = 409;
      throw err;
    }

    const versionDoc = await FirmwareVersion.create({
      version: data.version.trim(),
      deviceType: data.deviceType,
      checksum: data.checksum.trim().toLowerCase(),
      fileSize: data.fileSize !== undefined ? data.fileSize : 0,
      releaseDate: data.releaseDate ? new Date(data.releaseDate) : new Date(),
      changelog: data.changelog ? data.changelog.trim() : '',
      securityStatus: data.securityStatus || 'under_review',
      deploymentPolicy: data.deploymentPolicy || 'restricted',
      vulnerabilities: data.vulnerabilities || [],
      uploadedBy: actorUser?._id || new mongoose.Types.ObjectId(),
      organizationId: orgObjectId
    });

    const actorName = actorUser ? (actorUser.displayName || actorUser.email) : 'security_analyst';

    await logAuditEvent({
      action: 'firmware.version_created',
      actor: actorUser ? actorUser._id : 'system',
      actorName,
      targetType: 'firmware_version',
      targetId: versionDoc._id,
      organizationId: orgObjectId,
      details: {
        version: versionDoc.version,
        deviceType: versionDoc.deviceType,
        checksum: versionDoc.checksum,
        securityStatus: versionDoc.securityStatus,
        deploymentPolicy: versionDoc.deploymentPolicy
      }
    });

    logger.info(`[Firmware Service] Registered new firmware version ${versionDoc.version} for ${versionDoc.deviceType} by ${actorName}`);
    return versionDoc.toObject();
  }

  /**
   * Lists firmware versions with filtering, pagination, and active device counts.
   *
   * @param {string} organizationId
   * @param {Object} queryParams
   * @returns {Promise<{ versions: Array, total: number, page: number, limit: number, totalPages: number }>}
   */
  async listFirmwareVersions(organizationId, queryParams = {}) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const filter = { organizationId: orgObjectId };

    if (queryParams.deviceType) {
      filter.deviceType = queryParams.deviceType;
    }

    if (queryParams.securityStatus) {
      filter.securityStatus = queryParams.securityStatus;
    }

    if (queryParams.deploymentPolicy) {
      filter.deploymentPolicy = queryParams.deploymentPolicy;
    }

    if (queryParams.search) {
      const escaped = queryParams.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { version: { $regex: escaped, $options: 'i' } },
        { changelog: { $regex: escaped, $options: 'i' } }
      ];
    }

    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const sortField = queryParams.sortBy || 'releaseDate';
    const sortOrder = queryParams.sortOrder === 'asc' ? 1 : -1;

    const [versions, total] = await Promise.all([
      FirmwareVersion.find(filter)
        .populate('uploadedBy', 'displayName email role')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      FirmwareVersion.countDocuments(filter)
    ]);

    // Aggregate device and deployment counts for each version in parallel
    const enrichedVersions = await Promise.all(
      versions.map(async (v) => {
        const [deviceCount, deploymentCount] = await Promise.all([
          Device.countDocuments({
            organizationId: orgObjectId,
            type: v.deviceType,
            currentFirmwareVersion: v.version
          }),
          FirmwareDeployment.countDocuments({
            organizationId: orgObjectId,
            firmwareVersionId: v._id
          })
        ]);

        return {
          ...v,
          deviceCount,
          deploymentCount
        };
      })
    );

    return {
      versions: enrichedVersions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Retrieves full details for a specific firmware version.
   *
   * @param {string} id
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async getFirmwareVersionById(id, organizationId) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const filter = {
      organizationId: orgObjectId
    };

    if (mongoose.Types.ObjectId.isValid(id)) {
      filter._id = new mongoose.Types.ObjectId(id);
    } else {
      filter.version = id;
    }

    const versionDoc = await FirmwareVersion.findOne(filter)
      .populate('uploadedBy', 'displayName email role')
      .lean();

    if (!versionDoc) {
      const err = new Error('Firmware version not found');
      err.code = 'FIRMWARE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const [deviceCount, deploymentCount] = await Promise.all([
      Device.countDocuments({
        organizationId: orgObjectId,
        type: versionDoc.deviceType,
        currentFirmwareVersion: versionDoc.version
      }),
      FirmwareDeployment.countDocuments({
        organizationId: orgObjectId,
        firmwareVersionId: versionDoc._id
      })
    ]);

    return {
      ...versionDoc,
      deviceCount,
      deploymentCount
    };
  }

  /**
   * Updates firmware security status, policy, changelog, or vulnerabilities.
   *
   * @param {string} id
   * @param {string} organizationId
   * @param {Object} updateData
   * @param {Object} actorUser
   * @returns {Promise<Object>}
   */
  async updateFirmwareVersion(id, organizationId, updateData, actorUser) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const versionDoc = await FirmwareVersion.findOne({
      _id: new mongoose.Types.ObjectId(id),
      organizationId: orgObjectId
    });

    if (!versionDoc) {
      const err = new Error('Firmware version not found');
      err.code = 'FIRMWARE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (updateData.securityStatus) {
      versionDoc.securityStatus = updateData.securityStatus;
    }

    if (updateData.deploymentPolicy) {
      versionDoc.deploymentPolicy = updateData.deploymentPolicy;
    }

    if (updateData.changelog !== undefined) {
      versionDoc.changelog = updateData.changelog.trim();
    }

    if (updateData.vulnerabilities) {
      versionDoc.vulnerabilities = updateData.vulnerabilities;
    }

    await versionDoc.save();

    const actorName = actorUser ? (actorUser.displayName || actorUser.email) : 'security_analyst';

    await logAuditEvent({
      action: 'firmware.version_updated',
      actor: actorUser ? actorUser._id : 'system',
      actorName,
      targetType: 'firmware_version',
      targetId: versionDoc._id,
      organizationId: orgObjectId,
      details: {
        version: versionDoc.version,
        securityStatus: versionDoc.securityStatus,
        deploymentPolicy: versionDoc.deploymentPolicy,
        vulnerabilitiesCount: versionDoc.vulnerabilities.length
      }
    });

    logger.info(`[Firmware Service] Updated metadata for version ${versionDoc.version} by ${actorName}`);
    return versionDoc.toObject();
  }

  /**
   * Creates a batch of OTA deployments for specified target devices.
   * Enforces PRD §9.4 eligibility rules and non-blocking critical incident warnings.
   *
   * @param {string} organizationId
   * @param {Object} params
   * @param {Object} actorUser
   * @returns {Promise<{ deployments: Array, warnings: Array }>}
   */
  async createDeployments(organizationId, { firmwareVersionId, deviceIds }, actorUser) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);

    // 1. Fetch and validate FirmwareVersion
    const firmware = await FirmwareVersion.findOne({
      _id: new mongoose.Types.ObjectId(firmwareVersionId),
      organizationId: orgObjectId
    });

    if (!firmware) {
      const err = new Error('Target firmware version not found');
      err.code = 'FIRMWARE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Eligibility Rule 1: Vulnerable or recalled firmware cannot be deployed
    if (['vulnerable', 'recalled'].includes(firmware.securityStatus)) {
      const err = new Error(`Cannot deploy firmware version with security status '${firmware.securityStatus}'`);
      err.code = 'FIRMWARE_VULNERABLE_OR_RECALLED';
      err.statusCode = 400;
      throw err;
    }

    // Eligibility Rule 2: Blocked deployment policy cannot be deployed
    if (firmware.deploymentPolicy === 'blocked') {
      const err = new Error('Deployments for this firmware version are administratively blocked');
      err.code = 'DEPLOYMENT_POLICY_BLOCKED';
      err.statusCode = 400;
      throw err;
    }

    // Eligibility Rule 3: Restricted deployment policy requires security_analyst+
    const actorRole = actorUser?.role || 'viewer';
    const actorLevel = ROLE_HIERARCHY[actorRole] || 0;
    if (firmware.deploymentPolicy === 'restricted' && actorLevel < ROLE_HIERARCHY.security_analyst) {
      const err = new Error('Deploying restricted firmware requires security_analyst or org_admin privileges');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    // 2. Fetch and validate all target devices
    const deviceObjectIds = deviceIds.map((id) => new mongoose.Types.ObjectId(id));
    const targetDevices = await Device.find({
      _id: { $in: deviceObjectIds },
      organizationId: orgObjectId
    });

    if (targetDevices.length !== deviceIds.length) {
      const err = new Error('One or more target devices were not found in this organization');
      err.code = 'DEVICE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Check device types & status
    for (const device of targetDevices) {
      // Eligibility Rule 4: Device type must match firmware deviceType
      if (device.type !== firmware.deviceType) {
        const err = new Error(`Device '${device.name || device.deviceId}' type (${device.type}) does not match firmware device type (${firmware.deviceType})`);
        err.code = 'DEVICE_TYPE_MISMATCH';
        err.statusCode = 400;
        throw err;
      }

      // Eligibility Rule 5: Decommissioned devices cannot receive updates
      if (device.status === 'decommissioned') {
        const err = new Error(`Device '${device.name || device.deviceId}' is decommissioned and cannot receive firmware updates`);
        err.code = 'DEVICE_DECOMMISSIONED';
        err.statusCode = 400;
        throw err;
      }
    }

    // 3. Non-blocking warning: Check for open critical incidents on target devices
    const activeCriticalIncidents = await Incident.find({
      deviceId: { $in: targetDevices.map((d) => d._id) },
      organizationId: orgObjectId,
      status: { $in: ['detected', 'triaged', 'investigating', 'containment'] },
      severity: 'critical'
    }).select('incidentId deviceId title');

    const warnings = [];
    if (activeCriticalIncidents.length > 0) {
      for (const inc of activeCriticalIncidents) {
        warnings.push({
          deviceId: inc.deviceId.toString(),
          incidentId: inc.incidentId,
          code: 'OPEN_CRITICAL_INCIDENT',
          message: `Target device has an active critical incident (${inc.incidentId}: ${inc.title})`
        });
      }
    }

    // 4. Create deployment documents for all eligible devices
    const now = new Date();
    const actorName = actorUser ? (actorUser.displayName || actorUser.email) : 'security_analyst';
    const createdDeployments = [];

    for (const device of targetDevices) {
      const deploymentId = this.generateDeploymentId();

      const deployment = await FirmwareDeployment.create({
        deploymentId,
        firmwareVersionId: firmware._id,
        deviceId: device._id,
        organizationId: orgObjectId,
        status: 'pending',
        initiatedBy: actorUser?._id || new mongoose.Types.ObjectId(),
        initiatedAt: now,
        completedAt: null,
        previousFirmwareVersion: device.currentFirmwareVersion || null,
        result: {
          success: null,
          message: null,
          verificationChecksum: null
        }
      });

      // Append device audit timeline entry
      device.timeline.push({
        timestamp: now,
        action: 'firmware.deployment_initiated',
        actor: actorName,
        details: `OTA deployment to version ${firmware.version} initiated (Deployment ID: ${deploymentId})`
      });
      await device.save();

      await logAuditEvent({
        action: 'firmware.deployment_created',
        actor: actorUser ? actorUser._id : 'system',
        actorName,
        targetType: 'firmware_deployment',
        targetId: deployment._id,
        organizationId: orgObjectId,
        details: {
          deploymentId,
          firmwareVersion: firmware.version,
          deviceId: device._id,
          targetDeviceId: device.deviceId
        }
      });

      createdDeployments.push(deployment.toObject());
    }

    logger.info(`[Firmware Service] Created ${createdDeployments.length} OTA deployments for firmware ${firmware.version} by ${actorName}`);
    return {
      deployments: createdDeployments,
      warnings
    };
  }

  /**
   * Lists OTA deployments with filtering, pagination, and sorting.
   *
   * @param {string} organizationId
   * @param {Object} queryParams
   * @returns {Promise<{ deployments: Array, total: number, page: number, limit: number, totalPages: number }>}
   */
  async listDeployments(organizationId, queryParams = {}) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const filter = { organizationId: orgObjectId };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.firmwareVersionId) {
      if (mongoose.Types.ObjectId.isValid(queryParams.firmwareVersionId)) {
        filter.firmwareVersionId = new mongoose.Types.ObjectId(queryParams.firmwareVersionId);
      }
    }

    if (queryParams.deviceId) {
      if (mongoose.Types.ObjectId.isValid(queryParams.deviceId)) {
        filter.deviceId = new mongoose.Types.ObjectId(queryParams.deviceId);
      }
    }

    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const sortField = queryParams.sortBy || 'initiatedAt';
    const sortOrder = queryParams.sortOrder === 'asc' ? 1 : -1;

    const [deployments, total] = await Promise.all([
      FirmwareDeployment.find(filter)
        .populate('firmwareVersionId', 'version deviceType checksum securityStatus releaseDate')
        .populate('deviceId', 'deviceId name type status currentFirmwareVersion location healthStatus')
        .populate('initiatedBy', 'displayName email role')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      FirmwareDeployment.countDocuments(filter)
    ]);

    return {
      deployments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Retrieves full details for a specific deployment.
   *
   * @param {string} idOrDeploymentId
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async getDeploymentById(idOrDeploymentId, organizationId) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const filter = { organizationId: orgObjectId };

    if (mongoose.Types.ObjectId.isValid(idOrDeploymentId)) {
      filter._id = new mongoose.Types.ObjectId(idOrDeploymentId);
    } else {
      filter.deploymentId = idOrDeploymentId.toUpperCase();
    }

    const deployment = await FirmwareDeployment.findOne(filter)
      .populate('firmwareVersionId', 'version deviceType checksum securityStatus releaseDate changelog')
      .populate('deviceId', 'deviceId name type status currentFirmwareVersion location healthStatus')
      .populate('initiatedBy', 'displayName email role')
      .lean();

    if (!deployment) {
      const err = new Error('Deployment not found');
      err.code = 'DEPLOYMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return deployment;
  }

  /**
   * Updates deployment status according to the exact OTA state machine.
   * Handles checksum integrity verification on success, device firmware sync, and rollback.
   * Supports both user JWT and device API key authentication contexts.
   *
   * @param {string} idOrDeploymentId
   * @param {Object} statusData
   * @param {Object} authContext - { user?, device?, isDevice: boolean, organizationId: string }
   * @returns {Promise<Object>}
   */
  async updateDeploymentStatus(idOrDeploymentId, { status: newStatus, result = {} }, authContext) {
    const orgObjectId = new mongoose.Types.ObjectId(authContext.organizationId);
    const filter = { organizationId: orgObjectId };

    if (mongoose.Types.ObjectId.isValid(idOrDeploymentId)) {
      filter._id = new mongoose.Types.ObjectId(idOrDeploymentId);
    } else {
      filter.deploymentId = idOrDeploymentId.toUpperCase();
    }

    const deployment = await FirmwareDeployment.findOne(filter);
    if (!deployment) {
      const err = new Error('Deployment not found');
      err.code = 'DEPLOYMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // 1. Mandatory Identity Binding Enforcement for Device API Key
    if (authContext.isDevice) {
      const authenticatedDeviceId = authContext.device._id.toString();
      const authenticatedOrgId = authContext.device.organizationId.toString();

      if (
        authenticatedDeviceId !== deployment.deviceId.toString() ||
        authenticatedOrgId !== deployment.organizationId.toString()
      ) {
        const err = new Error('Authenticated device is not authorized to update another device deployment');
        err.code = 'DEVICE_DEPLOYMENT_MISMATCH';
        err.statusCode = 403;
        throw err;
      }
    } else {
      // User RBAC Check: operator+ required
      const userRole = authContext.user?.role || 'viewer';
      const userLevel = ROLE_HIERARCHY[userRole] || 0;
      if (userLevel < ROLE_HIERARCHY.operator) {
        const err = new Error('Viewers are not authorized to update deployment status');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }
    }

    const currentStatus = deployment.status;

    // 2. Exact State Machine Validation
    const allowedTargets = VALID_DEPLOYMENT_TRANSITIONS[currentStatus] || [];
    if (!allowedTargets.includes(newStatus)) {
      const err = new Error(`Invalid deployment transition from '${currentStatus}' to '${newStatus}'`);
      err.code = 'INVALID_DEPLOYMENT_TRANSITION';
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    const actorName = authContext.isDevice
      ? `device:${authContext.device.deviceId}`
      : authContext.user?.displayName || authContext.user?.email || 'operator';

    // 3. Process Specific Transitions
    const firmware = await FirmwareVersion.findById(deployment.firmwareVersionId);
    const targetDevice = await Device.findById(deployment.deviceId);

    if (newStatus === 'success') {
      // Checksum Verification Integrity Rule:
      // If verificationChecksum provided, compare case-insensitively with firmware.checksum
      if (result.verificationChecksum && firmware) {
        const expected = firmware.checksum.trim().toLowerCase();
        const actual = result.verificationChecksum.trim().toLowerCase();

        if (expected !== actual) {
          const err = new Error(`Firmware verification checksum mismatch (expected ${expected}, got ${actual}). Deployment rejected.`);
          err.code = 'CHECKSUM_VERIFICATION_FAILED';
          err.statusCode = 400;
          throw err;
        }
      }

      deployment.status = 'success';
      deployment.completedAt = now;
      deployment.result = {
        success: true,
        message: result.message || 'OTA firmware update completed and verified successfully',
        verificationChecksum: result.verificationChecksum || (firmware ? firmware.checksum : null)
      };

      // Synchronize target device current firmware version
      if (targetDevice && firmware) {
        targetDevice.currentFirmwareVersion = firmware.version;
        targetDevice.timeline.push({
          timestamp: now,
          action: 'firmware.updated',
          actor: actorName,
          details: `Firmware successfully upgraded to version ${firmware.version} (DEP ID: ${deployment.deploymentId})`
        });
        await targetDevice.save();
      }
    } else if (newStatus === 'failed') {
      deployment.status = 'failed';
      deployment.completedAt = now;
      deployment.result = {
        success: false,
        message: result.message || `Deployment failed during '${currentStatus}' phase`,
        verificationChecksum: result.verificationChecksum || null
      };

      if (targetDevice) {
        targetDevice.timeline.push({
          timestamp: now,
          action: 'firmware.deployment_failed',
          actor: actorName,
          details: `OTA deployment failed at state '${currentStatus}': ${result.message || 'Error occurred'}`
        });
        await targetDevice.save();
      }
    } else if (newStatus === 'rolled_back') {
      // Rollback is valid ONLY from 'failed' state and requires previousFirmwareVersion
      if (!deployment.previousFirmwareVersion) {
        const err = new Error('No previous firmware version recorded for rollback');
        err.code = 'NO_PREVIOUS_VERSION_AVAILABLE';
        err.statusCode = 400;
        throw err;
      }

      deployment.status = 'rolled_back';
      deployment.completedAt = now;
      deployment.result = {
        success: false,
        message: result.message || `Firmware rolled back to version ${deployment.previousFirmwareVersion}`,
        verificationChecksum: null
      };

      // Restore device current firmware version to previous version
      if (targetDevice) {
        targetDevice.currentFirmwareVersion = deployment.previousFirmwareVersion;
        targetDevice.timeline.push({
          timestamp: now,
          action: 'firmware.rollback',
          actor: actorName,
          details: `Firmware restored to previous version ${deployment.previousFirmwareVersion} following deployment failure (DEP ID: ${deployment.deploymentId})`
        });
        await targetDevice.save();
      }

      await logAuditEvent({
        action: 'firmware.rollback_initiated',
        actor: authContext.isDevice ? authContext.device._id : authContext.user?._id || 'system',
        actorName,
        targetType: 'firmware_deployment',
        targetId: deployment._id,
        organizationId: orgObjectId,
        details: {
          deploymentId: deployment.deploymentId,
          restoredVersion: deployment.previousFirmwareVersion,
          deviceId: deployment.deviceId
        }
      });
    } else {
      // Intermediate states: downloading, installing, verifying
      deployment.status = newStatus;
      if (result.message) {
        deployment.result = {
          success: null,
          message: result.message,
          verificationChecksum: result.verificationChecksum || null
        };
      }
    }

    await deployment.save();

    await logAuditEvent({
      action: 'firmware.deployment_status_updated',
      actor: authContext.isDevice ? authContext.device._id : authContext.user?._id || 'system',
      actorName,
      targetType: 'firmware_deployment',
      targetId: deployment._id,
      organizationId: orgObjectId,
      details: {
        deploymentId: deployment.deploymentId,
        from: currentStatus,
        to: newStatus,
        result: deployment.result
      }
    });

    logger.info(`[Firmware Service] Deployment ${deployment.deploymentId} transitioned from '${currentStatus}' to '${newStatus}' by ${actorName}`);
    return deployment.toObject();
  }

  /**
   * Rollback execution bridge for Phase 9 incident response actions.
   * Finds the specific eligible failed deployment for a device and executes rollback.
   *
   * @param {string|ObjectId} deviceId
   * @param {string|ObjectId} organizationId
   * @param {Object} actorUser
   * @returns {Promise<string>} Diagnostic outcome message
   */
  async rollbackFailedDeploymentForDevice(deviceId, organizationId, actorUser) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const devObjectId = new mongoose.Types.ObjectId(deviceId);

    // Look for the specific latest failed deployment for this device with a valid previous version
    const eligibleDeployment = await FirmwareDeployment.findOne({
      deviceId: devObjectId,
      organizationId: orgObjectId,
      status: 'failed',
      previousFirmwareVersion: { $ne: null }
    }).sort({ createdAt: -1 });

    if (!eligibleDeployment) {
      return 'Firmware rollback skipped: no eligible failed deployment with previous version found';
    }

    await this.updateDeploymentStatus(
      eligibleDeployment._id,
      {
        status: 'rolled_back',
        result: {
          message: 'Rollback triggered via incident containment response action'
        }
      },
      {
        user: actorUser,
        isDevice: false,
        organizationId: orgObjectId.toString()
      }
    );

    return `Firmware rollback executed: reverted to v${eligibleDeployment.previousFirmwareVersion} via deployment ${eligibleDeployment.deploymentId}`;
  }
}

module.exports = new FirmwareService();

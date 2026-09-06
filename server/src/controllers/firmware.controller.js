const firmwareService = require('../services/firmware.service');

/**
 * Register a new firmware version metadata document
 */
const createFirmwareVersion = async (req, res, next) => {
  try {
    const result = await firmwareService.createFirmwareVersion(
      req.organizationId,
      req.body,
      req.user
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * List firmware versions with filtering and pagination
 */
const listFirmwareVersions = async (req, res, next) => {
  try {
    const result = await firmwareService.listFirmwareVersions(
      req.organizationId,
      req.query
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get firmware version details by ID or version tag
 */
const getFirmwareVersionById = async (req, res, next) => {
  try {
    const result = await firmwareService.getFirmwareVersionById(
      req.params.id,
      req.organizationId
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Update firmware metadata, security status, policy, or vulnerabilities
 */
const updateFirmwareVersion = async (req, res, next) => {
  try {
    const result = await firmwareService.updateFirmwareVersion(
      req.params.id,
      req.organizationId,
      req.body,
      req.user
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Create batch OTA deployments for target devices
 */
const createDeployments = async (req, res, next) => {
  try {
    const result = await firmwareService.createDeployments(
      req.organizationId,
      req.body,
      req.user
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * List OTA deployments with status/device filtering and pagination
 */
const listDeployments = async (req, res, next) => {
  try {
    const result = await firmwareService.listDeployments(
      req.organizationId,
      req.query
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get deployment details by ID or deploymentId
 */
const getDeploymentById = async (req, res, next) => {
  try {
    const result = await firmwareService.getDeploymentById(
      req.params.id,
      req.organizationId
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Update deployment lifecycle status (supports operator JWT or target Device API Key)
 */
const updateDeploymentStatus = async (req, res, next) => {
  try {
    const authContext = req.isDeviceAuth
      ? {
          device: req.device,
          isDevice: true,
          organizationId: req.device.organizationId.toString()
        }
      : {
          user: req.user,
          isDevice: false,
          organizationId: req.organizationId
        };

    const result = await firmwareService.updateDeploymentStatus(
      req.params.id,
      req.body,
      authContext
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFirmwareVersion,
  listFirmwareVersions,
  getFirmwareVersionById,
  updateFirmwareVersion,
  createDeployments,
  listDeployments,
  getDeploymentById,
  updateDeploymentStatus
};

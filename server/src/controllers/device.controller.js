const deviceService = require('../services/device.service');

/**
 * Register a new device in the tenant's fleet
 */
const registerDevice = async (req, res, next) => {
  try {
    const result = await deviceService.registerDevice(
      req.body,
      req.organizationId,
      req.user,
      req.ip
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * List devices with filters, pagination, and sorting
 */
const listDevices = async (req, res, next) => {
  try {
    const result = await deviceService.listDevices(req.organizationId, req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get device fleet statistics (counts by status, health, risk)
 */
const getDeviceStats = async (req, res, next) => {
  try {
    const result = await deviceService.getDeviceStats(req.organizationId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get device details by ID
 */
const getDeviceById = async (req, res, next) => {
  try {
    const device = await deviceService.getDeviceById(req.params.id, req.organizationId);
    res.status(200).json(device);
  } catch (error) {
    next(error);
  }
};

/**
 * Update device metadata or transition lifecycle status
 */
const updateDevice = async (req, res, next) => {
  try {
    const updatedDevice = await deviceService.updateDevice(
      req.params.id,
      req.body,
      req.organizationId,
      req.user,
      req.ip
    );
    res.status(200).json(updatedDevice);
  } catch (error) {
    next(error);
  }
};

/**
 * Regenerate device API key (invalidating the previous one)
 */
const regenerateApiKey = async (req, res, next) => {
  try {
    const result = await deviceService.regenerateApiKey(
      req.params.id,
      req.organizationId,
      req.user,
      req.ip
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get device risk posture breakdown
 */
const getDeviceRisk = async (req, res, next) => {
  try {
    const riskData = await deviceService.getDeviceRisk(req.params.id, req.organizationId);
    res.status(200).json(riskData);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerDevice,
  listDevices,
  getDeviceStats,
  getDeviceById,
  updateDevice,
  regenerateApiKey,
  getDeviceRisk
};

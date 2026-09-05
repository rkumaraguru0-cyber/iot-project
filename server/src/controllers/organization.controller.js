const organizationService = require('../services/organization.service');

/**
 * Get current organization details and settings
 */
const getCurrentOrganization = async (req, res, next) => {
  try {
    const org = await organizationService.getCurrentOrganization(req.organizationId);
    res.status(200).json(org);
  } catch (error) {
    next(error);
  }
};

/**
 * Update organization name and/or settings
 */
const updateCurrentOrganization = async (req, res, next) => {
  try {
    const updated = await organizationService.updateOrganizationSettings(
      req.organizationId,
      req.body,
      req.user,
      req.ip
    );
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new organization (super_admin platform-level action)
 */
const createOrganization = async (req, res, next) => {
  try {
    const newOrg = await organizationService.createOrganization(
      req.body,
      req.user,
      req.ip
    );
    res.status(201).json(newOrg);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCurrentOrganization,
  updateCurrentOrganization,
  createOrganization
};

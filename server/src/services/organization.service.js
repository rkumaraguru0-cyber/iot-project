const mongoose = require('mongoose');
const { Organization } = require('../models');
const { logAuditEvent } = require('./audit.service');

class OrganizationService {
  /**
   * Retrieves the current organization and its security configuration
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async getCurrentOrganization(organizationId) {
    if (!organizationId || !mongoose.Types.ObjectId.isValid(organizationId)) {
      const err = new Error('Invalid organization context');
      err.code = 'INVALID_ORGANIZATION';
      err.statusCode = 400;
      throw err;
    }

    const org = await Organization.findById(organizationId).lean();
    if (!org) {
      const err = new Error('Organization not found');
      err.code = 'ORGANIZATION_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return {
      id: org._id.toString(),
      name: org.name,
      slug: org.slug,
      settings: org.settings || {},
      createdAt: org.createdAt,
      updatedAt: org.updatedAt
    };
  }

  /**
   * Updates organization name or SLA / auto-quarantine / alert settings
   * @param {string} organizationId
   * @param {Object} data
   * @param {Object} actorUser
   * @param {string} clientIp
   * @returns {Promise<Object>}
   */
  async updateOrganizationSettings(organizationId, data, actorUser, clientIp) {
    const org = await Organization.findById(organizationId);
    if (!org) {
      const err = new Error('Organization not found');
      err.code = 'ORGANIZATION_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (data.name !== undefined) {
      org.name = data.name.trim();
    }

    if (data.settings) {
      if (data.settings.slaThresholds) {
        org.settings = org.settings || {};
        org.settings.slaThresholds = {
          ...org.settings.slaThresholds,
          ...data.settings.slaThresholds
        };
      }
      if (data.settings.autoQuarantine) {
        org.settings = org.settings || {};
        org.settings.autoQuarantine = {
          ...org.settings.autoQuarantine,
          ...data.settings.autoQuarantine
        };
      }
      if (data.settings.alertPreferences) {
        org.settings = org.settings || {};
        org.settings.alertPreferences = {
          ...org.settings.alertPreferences,
          ...data.settings.alertPreferences
        };
      }
    }

    await org.save();

    await logAuditEvent({
      action: 'organization.settings.updated',
      actor: actorUser.userId,
      actorName: actorUser.displayName,
      actorIp: clientIp,
      targetType: 'organization',
      targetId: org._id,
      organizationId: org._id,
      details: {
        updatedFields: Object.keys(data)
      }
    });

    return {
      id: org._id.toString(),
      name: org.name,
      slug: org.slug,
      settings: org.settings,
      updatedAt: org.updatedAt
    };
  }

  /**
   * Creates a new organization (Platform super_admin operation)
   * @param {Object} data
   * @param {Object} actorUser
   * @param {string} clientIp
   * @returns {Promise<Object>}
   */
  async createOrganization(data, actorUser, clientIp) {
    const slug = data.slug.toLowerCase().trim();

    const existing = await Organization.findOne({ slug });
    if (existing) {
      const err = new Error(`Organization slug '${slug}' is already in use`);
      err.code = 'SLUG_EXISTS';
      err.statusCode = 409;
      throw err;
    }

    const org = await Organization.create({
      name: data.name.trim(),
      slug
    });

    await logAuditEvent({
      action: 'organization.created',
      actor: actorUser.userId,
      actorName: actorUser.displayName,
      actorIp: clientIp,
      targetType: 'organization',
      targetId: org._id,
      organizationId: org._id,
      details: {
        name: org.name,
        slug: org.slug
      }
    });

    return {
      id: org._id.toString(),
      name: org.name,
      slug: org.slug,
      settings: org.settings,
      createdAt: org.createdAt
    };
  }
}

module.exports = new OrganizationService();

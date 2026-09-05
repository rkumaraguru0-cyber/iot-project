const mongoose = require('mongoose');

/**
 * Utility functions for multi-tenancy data isolation
 */

/**
 * Injects organizationId filter into query conditions
 * @param {Object} filter - Existing query filter
 * @param {string|mongoose.Types.ObjectId} organizationId - Target organization ID
 * @param {boolean} [allowSystemGlobal=false] - If true, matches organizationId OR null (e.g. for system rules)
 * @returns {Object} Scoped filter object
 */
const scopeToOrganization = (filter = {}, organizationId, allowSystemGlobal = false) => {
  if (!organizationId) {
    throw new Error('Organization ID is required for tenant-scoped database operations');
  }

  const orgId = typeof organizationId === 'string'
    ? new mongoose.Types.ObjectId(organizationId)
    : organizationId;

  if (allowSystemGlobal) {
    return {
      ...filter,
      $or: [
        { organizationId: orgId },
        { organizationId: null }
      ]
    };
  }

  return {
    ...filter,
    organizationId: orgId
  };
};

/**
 * Verifies that an entity document belongs to the specified organization
 * @param {Object} document - Mongoose document with organizationId
 * @param {string|mongoose.Types.ObjectId} organizationId - Expected organization ID
 * @returns {boolean} True if document belongs to the organization
 */
const matchesOrganization = (document, organizationId) => {
  if (!document || !document.organizationId || !organizationId) {
    return false;
  }
  return document.organizationId.toString() === organizationId.toString();
};

module.exports = {
  scopeToOrganization,
  matchesOrganization
};

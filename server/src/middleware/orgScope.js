const { scopeToOrganization } = require('../utils/tenantScope');

/**
 * Multi-tenancy scoping middleware: enforces organization context on query filters
 */
const orgScope = (req, res, next) => {
  if (!req.user || !req.user.organizationId) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Organization context is required'
      }
    });
  }

  // super_admin may optionally override orgId via query param for platform-level management
  let targetOrgId = req.user.organizationId;
  if (req.user.role === 'super_admin' && req.query.organizationId) {
    targetOrgId = req.query.organizationId;
  }

  req.organizationId = targetOrgId;

  // Helper method attached to request for controllers to scope their Mongoose queries effortlessly
  req.getTenantFilter = (baseFilter = {}, allowSystemGlobal = false) => {
    return scopeToOrganization(baseFilter, req.organizationId, allowSystemGlobal);
  };

  next();
};

module.exports = orgScope;

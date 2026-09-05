const ROLE_HIERARCHY = {
  viewer: 10,
  operator: 20,
  security_analyst: 30,
  org_admin: 40,
  super_admin: 50
};

/**
 * Hierarchical RBAC middleware: ensures req.user.role meets or exceeds minimumRole
 * @param {string} minimumRole - 'viewer' | 'operator' | 'security_analyst' | 'org_admin' | 'super_admin'
 */
const requireRole = (minimumRole) => {
  const minLevel = ROLE_HIERARCHY[minimumRole];
  if (minLevel === undefined) {
    throw new Error(`Invalid RBAC role defined in route: ${minimumRole}`);
  }

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required before role verification'
        }
      });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;

    if (userLevel < minLevel) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Forbidden: Requires at least ${minimumRole} role. Your role is ${req.user.role}.`
        }
      });
    }

    next();
  };
};

/**
 * Exact-match role middleware: ensures req.user.role is one of the allowed roles
 * @param  {...string} allowedRoles
 */
const requireSpecificRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Forbidden: Role '${req.user.role}' is not authorized to access this resource.`
        }
      });
    }

    next();
  };
};

module.exports = {
  requireRole,
  requireSpecificRoles,
  ROLE_HIERARCHY
};

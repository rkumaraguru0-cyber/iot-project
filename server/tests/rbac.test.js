const { requireRole, requireSpecificRoles, ROLE_HIERARCHY } = require('../src/middleware/rbac');
const orgScope = require('../src/middleware/orgScope');

describe('RBAC & Multi-Tenancy Middleware (Phase 3)', () => {
  const createMockReqRes = (user = null, query = {}) => {
    const req = {
      user,
      query,
      headers: {},
      cookies: {}
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    const next = jest.fn();
    return { req, res, next };
  };

  describe('Hierarchical RBAC (requireRole)', () => {
    it('should allow higher role (super_admin) when lower role (operator) is required', () => {
      const { req, res, next } = createMockReqRes({ role: 'super_admin', organizationId: 'org123' });
      const middleware = requireRole('operator');

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow exact required role (security_analyst)', () => {
      const { req, res, next } = createMockReqRes({ role: 'security_analyst', organizationId: 'org123' });
      const middleware = requireRole('security_analyst');

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should deny lower role (viewer) when higher role (security_analyst) is required', () => {
      const { req, res, next } = createMockReqRes({ role: 'viewer', organizationId: 'org123' });
      const middleware = requireRole('security_analyst');

      middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'FORBIDDEN',
          message: expect.stringContaining('Requires at least security_analyst')
        }
      });
    });

    it('should deny request if user is not authenticated', () => {
      const { req, res, next } = createMockReqRes(null);
      const middleware = requireRole('viewer');

      middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Exact RBAC (requireSpecificRoles)', () => {
    it('should allow if role is in specific allowed roles', () => {
      const { req, res, next } = createMockReqRes({ role: 'org_admin' });
      const middleware = requireSpecificRoles('org_admin', 'super_admin');

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should deny if role is not in allowed roles', () => {
      const { req, res, next } = createMockReqRes({ role: 'operator' });
      const middleware = requireSpecificRoles('org_admin', 'super_admin');

      middleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Organization Scoping Middleware (orgScope)', () => {
    it('should extract organizationId from req.user and attach getTenantFilter', () => {
      const { req, res, next } = createMockReqRes({
        userId: 'user1',
        organizationId: '507f1f77bcf86cd799439011',
        role: 'operator'
      });

      orgScope(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.organizationId).toBe('507f1f77bcf86cd799439011');
      expect(typeof req.getTenantFilter).toBe('function');

      const filter = req.getTenantFilter({ status: 'active' });
      expect(filter.status).toBe('active');
      expect(filter.organizationId.toString()).toBe('507f1f77bcf86cd799439011');
    });

    it('should allow super_admin to override organizationId via query parameter', () => {
      const targetOrg = '507f191e810c19729de860ea';
      const { req, res, next } = createMockReqRes(
        { userId: 'admin1', organizationId: '507f1f77bcf86cd799439011', role: 'super_admin' },
        { organizationId: targetOrg }
      );

      orgScope(req, res, next);
      expect(req.organizationId).toBe(targetOrg);
    });

    it('should NOT allow non-super_admin to override organizationId via query parameter', () => {
      const { req, res, next } = createMockReqRes(
        { userId: 'analyst1', organizationId: '507f1f77bcf86cd799439011', role: 'security_analyst' },
        { organizationId: 'hacked_other_org_id' }
      );

      orgScope(req, res, next);
      expect(req.organizationId).toBe('507f1f77bcf86cd799439011');
    });
  });
});

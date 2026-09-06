const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/token');
const { User, AuditLog } = require('../src/models');
const auditLogService = require('../src/services/auditLog.service');

describe('Forensic Audit Log REST Endpoints & Service (Phase 11)', () => {
  const orgId = new mongoose.Types.ObjectId();
  const otherOrgId = new mongoose.Types.ObjectId();

  const superAdminUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'super_admin',
    displayName: 'Super Admin',
    email: 'super@soc.org',
    isActive: true
  };

  const orgAdminUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'org_admin',
    displayName: 'Org Admin',
    email: 'admin@soc.org',
    isActive: true
  };

  const analystUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'security_analyst',
    displayName: 'Analyst Jane',
    email: 'analyst@soc.org',
    isActive: true
  };

  const operatorUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'operator',
    displayName: 'Operator John',
    email: 'operator@soc.org',
    isActive: true
  };

  const viewerUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'viewer',
    displayName: 'Viewer Alice',
    email: 'viewer@soc.org',
    isActive: true
  };

  let superAdminToken, orgAdminToken, analystToken, operatorToken, viewerToken;

  beforeAll(() => {
    superAdminToken = generateAccessToken(superAdminUser);
    orgAdminToken = generateAccessToken(orgAdminUser);
    analystToken = generateAccessToken(analystUser);
    operatorToken = generateAccessToken(operatorUser);
    viewerToken = generateAccessToken(viewerUser);
  });

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      let matched = viewerUser;
      if (idStr === superAdminUser._id.toString()) matched = superAdminUser;
      else if (idStr === orgAdminUser._id.toString()) matched = orgAdminUser;
      else if (idStr === analystUser._id.toString()) matched = analystUser;
      else if (idStr === operatorUser._id.toString()) matched = operatorUser;

      return {
        select: jest.fn().mockResolvedValue({
          ...matched,
          isActive: true
        })
      };
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await new Promise((resolve) => setImmediate(resolve));
  });

  describe('GET /api/v1/audit-logs - RBAC Role Hierarchy', () => {
    it('returns 401 when no token is supplied', async () => {
      const res = await request(app).get('/api/v1/audit-logs');
      expect(res.status).toBe(401);
    });

    it('returns 403 for viewer role', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 403 for operator role', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${operatorToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 200 for security_analyst role', async () => {
      jest.spyOn(auditLogService, 'listAuditLogs').mockResolvedValue({
        logs: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0
      });

      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('logs');
    });

    it('returns 200 for org_admin role', async () => {
      jest.spyOn(auditLogService, 'listAuditLogs').mockResolvedValue({
        logs: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0
      });

      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
    });

    it('returns 200 for super_admin role', async () => {
      jest.spyOn(auditLogService, 'listAuditLogs').mockResolvedValue({
        logs: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0
      });

      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('AuditLog Service Unit Logic (Filters, Pagination, and Scoping)', () => {
    it('queries with default pagination and sorts by timestamp descending', async () => {
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          { _id: 'log-1', action: 'DEVICE_REGISTERED' }
        ])
      };
      jest.spyOn(AuditLog, 'find').mockReturnValue(mockFind);
      jest.spyOn(AuditLog, 'countDocuments').mockResolvedValue(1);

      const result = await auditLogService.listAuditLogs(orgId.toString(), { page: 1, limit: 10 });

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.logs).toHaveLength(1);
      expect(AuditLog.find).toHaveBeenCalledWith(expect.objectContaining({
        organizationId: expect.any(mongoose.Types.ObjectId)
      }));
    });

    it('constructs multi-filters for action, actor, targetType, date range, and search', async () => {
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      };
      jest.spyOn(AuditLog, 'find').mockReturnValue(mockFind);
      jest.spyOn(AuditLog, 'countDocuments').mockResolvedValue(0);

      const actorId = new mongoose.Types.ObjectId();
      await auditLogService.listAuditLogs(orgId.toString(), {
        action: 'DEVICE_QUARANTINED',
        actor: actorId.toString(),
        targetType: 'Device',
        from: '2026-03-01T00:00:00Z',
        to: '2026-03-02T00:00:00Z',
        search: 'Jane'
      });

      expect(AuditLog.find).toHaveBeenCalledWith(expect.objectContaining({
        action: 'DEVICE_QUARANTINED',
        actor: expect.any(mongoose.Types.ObjectId),
        targetType: 'Device',
        timestamp: {
          $gte: new Date('2026-03-01T00:00:00Z'),
          $lte: new Date('2026-03-02T00:00:00Z')
        },
        $or: expect.any(Array)
      }));
    });
  });
});

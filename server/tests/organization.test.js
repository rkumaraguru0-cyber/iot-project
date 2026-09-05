const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/token');
const organizationService = require('../src/services/organization.service');

describe('Organization Domain API Endpoints (Phase 4)', () => {
  const orgId = new mongoose.Types.ObjectId();

  const superAdminUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'super_admin',
    displayName: 'Global Super Admin'
  };

  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'org_admin',
    displayName: 'Org Admin'
  };

  const operatorUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'operator',
    displayName: 'Operator'
  };

  let superAdminToken, adminToken, operatorToken;

  beforeAll(() => {
    superAdminToken = generateAccessToken(superAdminUser);
    adminToken = generateAccessToken(adminUser);
    operatorToken = generateAccessToken(operatorUser);
  });

  const { User } = require('../src/models');

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      let matched = operatorUser;
      if (idStr === superAdminUser._id.toString()) matched = superAdminUser;
      else if (idStr === adminUser._id.toString()) matched = adminUser;

      return {
        select: jest.fn().mockResolvedValue({
          ...matched,
          isActive: true
        })
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/v1/organizations/current', () => {
    it('should return current organization details and settings', async () => {
      jest.spyOn(organizationService, 'getCurrentOrganization').mockResolvedValue({
        id: orgId.toString(),
        name: 'Acme IoT Corp',
        slug: 'acme-iot',
        settings: {
          slaThresholds: {
            critical: { triage: 15, resolve: 240 }
          },
          autoQuarantine: { enabled: false, threshold: 80 },
          alertPreferences: { minSeverity: 'medium' }
        }
      });

      const res = await request(app)
        .get('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Acme IoT Corp');
      expect(res.body.slug).toBe('acme-iot');
      expect(res.body.settings.autoQuarantine.threshold).toBe(80);
    });
  });

  describe('PATCH /api/v1/organizations/current', () => {
    it('should allow org_admin to update organization settings', async () => {
      jest.spyOn(organizationService, 'updateOrganizationSettings').mockResolvedValue({
        id: orgId.toString(),
        name: 'Acme IoT Corp Renamed',
        settings: {
          autoQuarantine: { enabled: true, threshold: 75 }
        }
      });

      const res = await request(app)
        .patch('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Acme IoT Corp Renamed',
          settings: {
            autoQuarantine: { enabled: true, threshold: 75 }
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Acme IoT Corp Renamed');
      expect(res.body.settings.autoQuarantine.enabled).toBe(true);
    });

    it('should deny non-org_admin from updating organization settings (403)', async () => {
      const res = await request(app)
        .patch('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
    });
  });

  describe('POST /api/v1/organizations (Platform super_admin operation)', () => {
    it('should allow super_admin to create a new organization', async () => {
      const newOrgId = new mongoose.Types.ObjectId();
      jest.spyOn(organizationService, 'createOrganization').mockResolvedValue({
        id: newOrgId.toString(),
        name: 'New Tenant Corp',
        slug: 'new-tenant-corp',
        settings: {}
      });

      const res = await request(app)
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'New Tenant Corp',
          slug: 'new-tenant-corp'
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Tenant Corp');
      expect(res.body.slug).toBe('new-tenant-corp');
    });

    it('should deny non-super_admin from creating organizations (403)', async () => {
      const res = await request(app)
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Unauthorized Tenant',
          slug: 'unauthorized-tenant'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
    });
  });
});

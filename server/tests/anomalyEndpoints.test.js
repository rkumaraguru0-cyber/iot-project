const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/token');
const { User, AnomalyRule, Anomaly, Device } = require('../src/models');
const anomalyService = require('../src/services/anomaly.service');

describe('Anomaly Detection Rules & Query Endpoints (Phase 7)', () => {
  const orgId = new mongoose.Types.ObjectId();
  const otherOrgId = new mongoose.Types.ObjectId();

  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'org_admin',
    displayName: 'Admin User',
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

  let adminToken, analystToken, operatorToken, viewerToken;

  beforeAll(() => {
    adminToken = generateAccessToken(adminUser);
    analystToken = generateAccessToken(analystUser);
    operatorToken = generateAccessToken(operatorUser);
    viewerToken = generateAccessToken(viewerUser);
  });

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      let matched = viewerUser;
      if (idStr === adminUser._id.toString()) matched = adminUser;
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/v1/rules', () => {
    it('should allow viewer role to list detection rules', async () => {
      const mockRules = [
        { ruleId: 'RULE-CPU-HIGH', isSystem: true, name: 'High CPU' },
        { ruleId: 'RULE-CUSTOM-1', isSystem: false, name: 'Custom Rule', organizationId: orgId }
      ];
      jest.spyOn(anomalyService, 'listRules').mockResolvedValue({
        rules: mockRules,
        total: 2
      });

      const res = await request(app)
        .get('/api/v1/rules')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.rules).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/rules');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/rules (Create Custom Rule)', () => {
    const validRulePayload = {
      name: 'Custom Camera Temp Alert',
      category: 'threshold',
      deviceTypes: ['smart_camera'],
      metric: 'temperature',
      operator: 'gt',
      value: 70,
      window: { type: 'none', size: 1 },
      cooldownSeconds: 300,
      severity: 'high',
      confidence: 'high'
    };

    it('should allow security_analyst to create a custom rule', async () => {
      jest.spyOn(AnomalyRule, 'findOne').mockResolvedValue(null);
      jest.spyOn(AnomalyRule.prototype, 'save').mockImplementation(function() {
        this._id = new mongoose.Types.ObjectId();
        return Promise.resolve(this);
      });

      const res = await request(app)
        .post('/api/v1/rules')
        .set('Authorization', `Bearer ${analystToken}`)
        .send(validRulePayload);

      expect(res.status).toBe(201);
      expect(res.body.rule).toBeDefined();
      expect(res.body.rule.isSystem).toBe(false);
      expect(res.body.rule.organizationId.toString()).toBe(orgId.toString());
    });

    it('should reject viewer from creating rules with 403', async () => {
      const res = await request(app)
        .post('/api/v1/rules')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(validRulePayload);

      expect(res.status).toBe(403);
    });

    it('should reject operator from creating rules with 403', async () => {
      const res = await request(app)
        .post('/api/v1/rules')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(validRulePayload);

      expect(res.status).toBe(403);
    });

    it('should reject malformed payload with 400', async () => {
      const res = await request(app)
        .post('/api/v1/rules')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ name: 'Incomplete' }); // Missing metric, operator, value, etc.

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/v1/rules/:id (Update Rule)', () => {
    it('should prevent modifying system baseline rules with 403', async () => {
      const systemRule = {
        _id: new mongoose.Types.ObjectId(),
        ruleId: 'RULE-CPU-HIGH',
        isSystem: true,
        save: jest.fn()
      };
      jest.spyOn(AnomalyRule, 'findOne').mockResolvedValue(systemRule);

      const res = await request(app)
        .patch(`/api/v1/rules/${systemRule.ruleId}`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ value: 95 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SYSTEM_RULE_IMMUTABLE');
    });

    it('should prevent modifying another organization\'s rules with 403', async () => {
      const otherOrgRule = {
        _id: new mongoose.Types.ObjectId(),
        ruleId: 'RULE-OTHER-ORG',
        isSystem: false,
        organizationId: otherOrgId,
        save: jest.fn()
      };
      jest.spyOn(AnomalyRule, 'findOne').mockResolvedValue(otherOrgRule);

      const res = await request(app)
        .patch(`/api/v1/rules/${otherOrgRule._id}`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ value: 95 });

      expect(res.status).toBe(403);
    });

    it('should allow security_analyst to update their organization\'s tenant rule', async () => {
      const tenantRule = {
        _id: new mongoose.Types.ObjectId(),
        ruleId: 'RULE-MY-TENANT',
        isSystem: false,
        organizationId: orgId,
        name: 'Old Name',
        value: 50,
        save: jest.fn().mockResolvedValue(true),
        toObject: function() { return { ...this, name: 'Updated Name', value: 80 }; }
      };
      jest.spyOn(AnomalyRule, 'findOne').mockResolvedValue(tenantRule);

      const res = await request(app)
        .patch(`/api/v1/rules/${tenantRule._id}`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ name: 'Updated Name', value: 80 });

      expect(res.status).toBe(200);
      expect(tenantRule.name).toBe('Updated Name');
      expect(tenantRule.value).toBe(80);
    });
  });

  describe('DELETE /api/v1/rules/:id (Soft Delete)', () => {
    it('should prevent deleting system rules with 403', async () => {
      const systemRule = {
        _id: new mongoose.Types.ObjectId(),
        ruleId: 'RULE-TEMP-CRITICAL',
        isSystem: true,
        save: jest.fn()
      };
      jest.spyOn(AnomalyRule, 'findOne').mockResolvedValue(systemRule);

      const res = await request(app)
        .delete(`/api/v1/rules/${systemRule.ruleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SYSTEM_RULE_IMMUTABLE');
    });

    it('should reject security_analyst from deleting rules with 403 (requires org_admin+)', async () => {
      const res = await request(app)
        .delete('/api/v1/rules/RULE-CUSTOM-1')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow org_admin to soft-delete tenant rule', async () => {
      const tenantRule = {
        _id: new mongoose.Types.ObjectId(),
        ruleId: 'RULE-TENANT-DEL',
        isSystem: false,
        organizationId: orgId,
        deleted: false,
        enabled: true,
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(AnomalyRule, 'findOne').mockResolvedValue(tenantRule);

      const res = await request(app)
        .delete(`/api/v1/rules/${tenantRule._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(tenantRule.deleted).toBe(true);
      expect(tenantRule.enabled).toBe(false);
    });
  });

  describe('POST /api/v1/rules/test (Dry-Run Rule Test)', () => {
    const testPayload = {
      rule: {
        metric: 'cpu_usage',
        operator: 'gt',
        value: 85,
        window: { type: 'none', size: 1 }
      },
      telemetry: {
        metrics: {
          cpu_usage: 95
        }
      }
    };

    it('should allow operator+ to test a rule without database side effects', async () => {
      const res = await request(app)
        .post('/api/v1/rules/test')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(testPayload);

      expect(res.status).toBe(200);
      expect(res.body.evaluation).toBeDefined();
      expect(res.body.evaluation.isAnomaly).toBe(true);
      expect(res.body.evaluation.observedValue).toBe(95);
      expect(res.body.evaluation.thresholdValue).toBe(85);
    });

    it('should reject viewer from running dry-run test with 403', async () => {
      const res = await request(app)
        .post('/api/v1/rules/test')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(testPayload);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/anomalies (Query Anomaly Logs)', () => {
    it('should allow viewer to query anomalies scoped to organization', async () => {
      const mockAnomalies = [
        {
          _id: new mongoose.Types.ObjectId(),
          organizationId: orgId,
          ruleId: 'RULE-CPU-HIGH',
          severity: 'high',
          observedValue: 92,
          thresholdValue: 85,
          timestamp: new Date()
        }
      ];

      jest.spyOn(Anomaly, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockAnomalies)
      });
      jest.spyOn(Anomaly, 'countDocuments').mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/anomalies')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.anomalies).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });
  });

  describe('GET /api/v1/devices/:id/anomalies', () => {
    it('should query anomalies for a specific device', async () => {
      const deviceMongoId = new mongoose.Types.ObjectId();
      const mockDevice = {
        _id: deviceMongoId,
        deviceId: 'DEV-001',
        organizationId: orgId
      };

      jest.spyOn(Device, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockDevice)
        })
      });

      const mockAnomalies = [
        {
          _id: new mongoose.Types.ObjectId(),
          deviceId: deviceMongoId,
          ruleId: 'RULE-TEMP-CRITICAL'
        }
      ];

      jest.spyOn(Anomaly, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockAnomalies)
      });

      const res = await request(app)
        .get(`/api/v1/devices/${deviceMongoId}/anomalies`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.anomalies).toHaveLength(1);
      expect(res.body.device.deviceId).toBe('DEV-001');
    });
  });
});

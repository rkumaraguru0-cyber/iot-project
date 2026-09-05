const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/token');
const { User, SecurityEvent, Device } = require('../src/models');
const riskService = require('../src/services/risk.service');
const securityEventService = require('../src/services/securityEvent.service');

describe('Security Events & Risk REST Endpoints (Phase 8)', () => {
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
    jest.clearAllMocks();
  });

  describe('GET /api/v1/security-events', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/security-events');
      expect(res.status).toBe(401);
    });

    it('returns paginated security events for the authenticated org', async () => {
      const mockEvents = [
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: 'EVT-20260905-000001',
          organizationId: orgId,
          ruleId: 'RULE-CPU-HIGH',
          severity: 'high',
          status: 'open',
          occurrenceCount: 2
        }
      ];

      jest.spyOn(securityEventService, 'listSecurityEvents').mockResolvedValue({
        events: mockEvents,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      });

      const res = await request(app)
        .get('/api/v1/security-events')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0].eventId).toBe('EVT-20260905-000001');
    });

    it('passes status and severity query filters to service', async () => {
      const spyList = jest.spyOn(securityEventService, 'listSecurityEvents').mockResolvedValue({
        events: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0
      });

      const res = await request(app)
        .get('/api/v1/security-events?status=open&severity=critical')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(spyList).toHaveBeenCalledWith(
        orgId.toString(),
        expect.objectContaining({
          status: 'open',
          severity: 'critical'
        })
      );
    });
  });

  describe('GET /api/v1/security-events/:id', () => {
    it('returns event details if found and authorized', async () => {
      const eventId = new mongoose.Types.ObjectId();
      const mockEvent = {
        _id: eventId,
        eventId: 'EVT-20260905-123456',
        organizationId: orgId,
        ruleId: 'RULE-TEMP-HIGH',
        status: 'open'
      };

      jest.spyOn(securityEventService, 'getSecurityEventById').mockResolvedValue(mockEvent);

      const res = await request(app)
        .get(`/api/v1/security-events/${eventId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.event.eventId).toBe('EVT-20260905-123456');
    });
  });

  describe('PATCH /api/v1/security-events/:id/status', () => {
    const eventId = new mongoose.Types.ObjectId();

    it('rejects viewer attempts with 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/v1/security-events/${eventId}/status`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ status: 'acknowledged' });

      expect(res.status).toBe(403);
    });

    it('allows operator to acknowledge an open event', async () => {
      const updatedEvent = {
        _id: eventId,
        eventId: 'EVT-20260905-123456',
        status: 'acknowledged'
      };

      jest.spyOn(securityEventService, 'updateEventStatus').mockResolvedValue(updatedEvent);

      const res = await request(app)
        .patch(`/api/v1/security-events/${eventId}/status`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ status: 'acknowledged' });

      expect(res.status).toBe(200);
      expect(res.body.event.status).toBe('acknowledged');
    });

    it('allows security_analyst to resolve an event with a note', async () => {
      const updatedEvent = {
        _id: eventId,
        eventId: 'EVT-20260905-123456',
        status: 'resolved',
        resolutionNote: 'Handled'
      };

      jest.spyOn(securityEventService, 'updateEventStatus').mockResolvedValue(updatedEvent);

      const res = await request(app)
        .patch(`/api/v1/security-events/${eventId}/status`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'resolved', resolutionNote: 'Handled' });

      expect(res.status).toBe(200);
      expect(res.body.event.status).toBe('resolved');
    });

    it('validates status value and rejects invalid enum with 400', async () => {
      const res = await request(app)
        .patch(`/api/v1/security-events/${eventId}/status`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'not_a_valid_status' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/devices/:id/security-events', () => {
    it('returns events scoped to a specific device', async () => {
      const deviceObjectId = new mongoose.Types.ObjectId();
      const mockEvents = [
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: 'EVT-20260905-DEV001',
          deviceId: deviceObjectId,
          status: 'open'
        }
      ];

      jest.spyOn(securityEventService, 'getDeviceSecurityEvents').mockResolvedValue({
        events: mockEvents,
        total: 1,
        device: { _id: deviceObjectId, deviceId: 'DEV-001' }
      });

      const res = await request(app)
        .get(`/api/v1/devices/${deviceObjectId}/security-events`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(1);
    });
  });

  describe('GET /api/v1/risk/summary', () => {
    it('returns fleet risk summary for organization', async () => {
      const mockSummary = {
        totalDevices: 5,
        averageRiskScore: 32,
        highRiskDeviceCount: 1,
        devicesByRiskSeverity: { low: 3, medium: 1, high: 1, critical: 0, severe: 0 },
        topAtRiskDevices: []
      };

      jest.spyOn(riskService, 'getFleetRiskSummary').mockResolvedValue(mockSummary);

      const res = await request(app)
        .get('/api/v1/risk/summary')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.summary.averageRiskScore).toBe(32);
      expect(res.body.summary.highRiskDeviceCount).toBe(1);
    });
  });

  describe('GET /api/v1/devices/:id/risk', () => {
    it('evaluates and returns device risk profile and factors', async () => {
      const deviceObjectId = new mongoose.Types.ObjectId();
      const mockRiskResult = {
        id: deviceObjectId,
        deviceId: 'DEV-001',
        riskScore: 45,
        riskSeverity: 'medium',
        riskFactors: [
          { name: 'Active Security Events', value: 30, maxValue: 60, detail: '1 active event' },
          { name: 'Device Health Status', value: 5, maxValue: 20, detail: 'Communication health status is unknown' }
        ],
        riskCalculatedAt: new Date()
      };

      const deviceService = require('../src/services/device.service');
      jest.spyOn(deviceService, 'getDeviceRisk').mockResolvedValue(mockRiskResult);

      const res = await request(app)
        .get(`/api/v1/devices/${deviceObjectId}/risk`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.riskScore).toBe(45);
      expect(res.body.riskSeverity).toBe('medium');
      expect(res.body.riskFactors).toHaveLength(2);
    });
  });
});

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/token');
const { User, Incident, Device } = require('../src/models');
const incidentService = require('../src/services/incident.service');

describe('Incidents REST Endpoints (Phase 9)', () => {
  const orgId = new mongoose.Types.ObjectId();
  const otherOrgId = new mongoose.Types.ObjectId();
  const devId = new mongoose.Types.ObjectId();

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

  afterEach(async () => {
    jest.clearAllMocks();
    await new Promise((resolve) => setImmediate(resolve));
  });

  describe('GET /api/v1/incidents', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/incidents');
      expect(res.status).toBe(401);
    });

    it('returns paginated incidents for the authenticated org', async () => {
      jest.spyOn(incidentService, 'listIncidents').mockResolvedValue({
        incidents: [{ incidentId: 'INC-20260905-001', severity: 'high', status: 'detected' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      });

      const res = await request(app)
        .get('/api/v1/incidents')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.incidents).toHaveLength(1);
    });

    it('passes status and severity query filters to service', async () => {
      const spyList = jest.spyOn(incidentService, 'listIncidents').mockResolvedValue({
        incidents: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0
      });

      const res = await request(app)
        .get('/api/v1/incidents?status=investigating&severity=critical')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(spyList).toHaveBeenCalledWith(
        orgId.toString(),
        expect.objectContaining({
          status: 'investigating',
          severity: 'critical'
        })
      );
    });
  });

  describe('GET /api/v1/incidents/stats', () => {
    it('returns incident statistics and MTTA/MTTR metrics', async () => {
      jest.spyOn(incidentService, 'getIncidentStats').mockResolvedValue({
        total: 10,
        byStatus: { detected: 2, investigating: 5, resolved: 3 },
        bySeverity: { critical: 2, high: 4, medium: 4, low: 0 },
        slaBreached: 1,
        mttt: 12,
        mttr: 145
      });

      const res = await request(app)
        .get('/api/v1/incidents/stats')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.total).toBe(10);
      expect(res.body.mttt).toBe(12);
    });
  });

  describe('GET /api/v1/incidents/:id', () => {
    it('returns incident details if found', async () => {
      jest.spyOn(incidentService, 'getIncidentById').mockResolvedValue({
        incidentId: 'INC-20260905-001',
        title: 'Network Egress Surge',
        severity: 'high',
        status: 'detected',
        relatedEvents: []
      });

      const res = await request(app)
        .get('/api/v1/incidents/INC-20260905-001')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.incident.incidentId).toBe('INC-20260905-001');
    });
  });

  describe('PATCH /api/v1/incidents/:id/status', () => {
    it('rejects viewer attempts with 403 Forbidden', async () => {
      const res = await request(app)
        .patch('/api/v1/incidents/INC-001/status')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ status: 'triaged' });

      expect(res.status).toBe(403);
    });

    it('allows operator to update status to triaged', async () => {
      jest.spyOn(incidentService, 'updateIncidentStatus').mockResolvedValue({
        incidentId: 'INC-001',
        status: 'triaged'
      });

      const res = await request(app)
        .patch('/api/v1/incidents/INC-001/status')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ status: 'triaged', note: 'Triaged by operator' });

      expect(res.status).toBe(200);
      expect(res.body.incident.status).toBe('triaged');
    });

    it('validates status and rejects invalid status enum with 400', async () => {
      const res = await request(app)
        .patch('/api/v1/incidents/INC-001/status')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ status: 'not_a_valid_state' });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/incidents/:id/assign', () => {
    it('allows operator to assign an incident', async () => {
      const targetUserId = new mongoose.Types.ObjectId().toString();
      jest.spyOn(incidentService, 'assignIncident').mockResolvedValue({
        incidentId: 'INC-001',
        assignedTo: targetUserId
      });

      const res = await request(app)
        .patch('/api/v1/incidents/INC-001/assign')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ assignedTo: targetUserId });

      expect(res.status).toBe(200);
      expect(res.body.incident.assignedTo).toBe(targetUserId);
    });
  });

  describe('POST /api/v1/incidents/:id/notes', () => {
    it('allows operator to add an investigation note', async () => {
      jest.spyOn(incidentService, 'addNote').mockResolvedValue({
        incidentId: 'INC-001',
        notes: [{ content: 'Suspicious outbound connection', author: 'Operator John' }]
      });

      const res = await request(app)
        .post('/api/v1/incidents/INC-001/notes')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ content: 'Suspicious outbound connection' });

      expect(res.status).toBe(201);
      expect(res.body.incident.notes).toHaveLength(1);
    });

    it('rejects empty note content with 400', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/INC-001/notes')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ content: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/incidents/:id/actions', () => {
    it('allows operator to record response action', async () => {
      jest.spyOn(incidentService, 'recordResponseAction').mockResolvedValue({
        incidentId: 'INC-001',
        responseActions: [{ action: 'quarantine_device', details: 'Quarantine applied' }]
      });

      const res = await request(app)
        .post('/api/v1/incidents/INC-001/actions')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ action: 'quarantine_device', details: 'Quarantine applied' });

      expect(res.status).toBe(201);
      expect(res.body.incident.responseActions).toHaveLength(1);
    });
  });

  describe('POST /api/v1/incidents/:id/evidence', () => {
    it('allows operator to attach evidence', async () => {
      jest.spyOn(incidentService, 'addEvidence').mockResolvedValue({
        incidentId: 'INC-001',
        evidence: [{ type: 'telemetry', entityId: 'TEL-123' }]
      });

      const res = await request(app)
        .post('/api/v1/incidents/INC-001/evidence')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ type: 'telemetry', entityId: 'TEL-123', note: 'Outlier metric' });

      expect(res.status).toBe(201);
      expect(res.body.incident.evidence).toHaveLength(1);
    });
  });

  describe('POST /api/v1/incidents/:id/resolve', () => {
    it('allows operator to submit resolution', async () => {
      jest.spyOn(incidentService, 'resolveIncident').mockResolvedValue({
        incidentId: 'INC-001',
        status: 'resolved',
        resolution: { summary: 'Quarantine verified', rootCause: 'Misconfigured script' }
      });

      const res = await request(app)
        .post('/api/v1/incidents/INC-001/resolve')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ summary: 'Quarantine verified', rootCause: 'Misconfigured script' });

      expect(res.status).toBe(200);
      expect(res.body.incident.status).toBe('resolved');
    });
  });

  describe('GET /api/v1/devices/:id/incidents', () => {
    it('returns incidents scoped to a specific device', async () => {
      jest.spyOn(incidentService, 'getDeviceIncidents').mockResolvedValue({
        incidents: [{ incidentId: 'INC-DEV-01' }],
        total: 1
      });

      const res = await request(app)
        .get(`/api/v1/devices/${devId}/incidents`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.incidents).toHaveLength(1);
    });
  });
});

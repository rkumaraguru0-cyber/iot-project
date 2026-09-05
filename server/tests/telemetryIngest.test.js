const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { Device, Telemetry } = require('../src/models');
const { hashToken } = require('../src/utils/token');
const telemetryService = require('../src/services/telemetry.service');

describe('REST Telemetry Ingestion Endpoint (Phase 6)', () => {
  const orgId = new mongoose.Types.ObjectId();
  const rawApiKey = 'test_raw_device_api_key_1234567890';
  const hashedKey = hashToken(rawApiKey);

  const mockDevice = {
    _id: new mongoose.Types.ObjectId(),
    deviceId: 'DEV-INGEST-001',
    name: 'Ingest Test Device',
    organizationId: orgId,
    apiKeyHash: hashedKey,
    status: 'registered',
    healthStatus: 'unknown',
    expectedReportingInterval: 30,
    lastSeenAt: null
  };

  beforeEach(() => {
    telemetryService.clearDeduplicationCache();
    jest.clearAllMocks();
    jest.spyOn(Device, 'updateOne').mockResolvedValue({ acknowledged: true });
  });

  describe('POST /api/v1/telemetry/ingest', () => {
    it('16. should accept valid telemetry with valid X-Device-API-Key header and return 201', async () => {
      jest.spyOn(Device, 'findOne').mockResolvedValue(mockDevice);
      jest.spyOn(Telemetry, 'create').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        deviceId: mockDevice._id,
        organizationId: orgId,
        metrics: { cpu_usage: 15.5, temperature: 22.0 }
      });
      jest.spyOn(Device, 'updateOne').mockResolvedValue({ acknowledged: true });

      const response = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('X-Device-API-Key', rawApiKey)
        .send({
          timestamp: new Date().toISOString(),
          metrics: {
            cpu_usage: 15.5,
            temperature: 22.0
          },
          metadata: {
            firmwareVersion: '1.0.0'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('stored');
      expect(response.body.deviceId).toBe(mockDevice.deviceId);
      expect(Device.findOne).toHaveBeenCalledWith({ apiKeyHash: hashedKey });
    });

    it('17. should reject request with 401 when X-Device-API-Key header is missing', async () => {
      const response = await request(app)
        .post('/api/v1/telemetry/ingest')
        .send({
          timestamp: new Date().toISOString(),
          metrics: { cpu_usage: 15.5 }
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('DEVICE_API_KEY_REQUIRED');
    });

    it('17b. should reject request with 401 when X-Device-API-Key is invalid', async () => {
      jest.spyOn(Device, 'findOne').mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('X-Device-API-Key', 'invalid_bogus_key')
        .send({
          timestamp: new Date().toISOString(),
          metrics: { cpu_usage: 15.5 }
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_DEVICE_CREDENTIALS');
    });

    it('18. should reject malformed payload with missing timestamp or metrics with 400', async () => {
      jest.spyOn(Device, 'findOne').mockResolvedValue(mockDevice);

      const response = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('X-Device-API-Key', rawApiKey)
        .send({
          // missing timestamp and metrics
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('18b. should reject timestamp outside +/- 5 minutes server window with 400', async () => {
      jest.spyOn(Device, 'findOne').mockResolvedValue(mockDevice);

      const pastTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago

      const response = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('X-Device-API-Key', rawApiKey)
        .send({
          timestamp: pastTimestamp,
          metrics: { cpu_usage: 20 }
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('19. should reject invalid metrics (non-numeric, NaN, Infinity) with 400', async () => {
      jest.spyOn(Device, 'findOne').mockResolvedValue(mockDevice);

      const response = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('X-Device-API-Key', rawApiKey)
        .send({
          timestamp: new Date().toISOString(),
          metrics: {
            cpu_usage: 'not_a_number'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('20. should return 200 with status: duplicate for replayed telemetry', async () => {
      jest.spyOn(Device, 'findOne').mockResolvedValue(mockDevice);
      jest.spyOn(Telemetry, 'create').mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
      jest.spyOn(Device, 'updateOne').mockResolvedValue({ acknowledged: true });

      const nowIso = new Date().toISOString();
      const payload = {
        timestamp: nowIso,
        metrics: { cpu_usage: 30.0 }
      };

      // 1st request
      const res1 = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('X-Device-API-Key', rawApiKey)
        .send(payload);
      expect(res1.status).toBe(201);
      expect(res1.body.status).toBe('stored');

      // 2nd request (duplicate)
      const res2 = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('X-Device-API-Key', rawApiKey)
        .send(payload);
      expect(res2.status).toBe(200);
      expect(res2.body.status).toBe('duplicate');
      expect(res2.body.message).toMatch(/duplicate/i);
    });

    it('21. should enforce tenant isolation and never trust organizationId supplied in body', async () => {
      const spoofedOrgId = new mongoose.Types.ObjectId();
      jest.spyOn(Device, 'findOne').mockResolvedValue(mockDevice);
      jest.spyOn(Telemetry, 'create').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        deviceId: mockDevice._id,
        organizationId: mockDevice.organizationId // verified bound to mockDevice.organizationId
      });
      jest.spyOn(Device, 'updateOne').mockResolvedValue({ acknowledged: true });

      const response = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('X-Device-API-Key', rawApiKey)
        .send({
          timestamp: new Date().toISOString(),
          metrics: { cpu_usage: 25 },
          organizationId: spoofedOrgId.toString() // spoof attempt
        });

      expect(response.status).toBe(201);
      expect(Telemetry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockDevice.organizationId // matches device org, not spoofed
        })
      );
    });
  });
});

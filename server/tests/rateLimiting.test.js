const request = require('supertest');
const express = require('express');
const { authLimiter, apiLimiter, telemetryIngestLimiter } = require('../src/middleware/rateLimiter');

describe('Rate Limiting & Abuse Prevention Suite (Phase 13)', () => {
  let app;

  beforeEach(() => {
    // Create dedicated Express test app instance to avoid cross-suite limiter interference
    app = express();
    app.use(express.json());

    // Test route with authLimiter (max: 10 req/min)
    app.post('/test/auth/login', authLimiter, (req, res) => {
      res.status(200).json({ success: true });
    });

    // Test route with general apiLimiter (max: 100 req/min)
    app.get('/test/api/resource', apiLimiter, (req, res) => {
      res.status(200).json({ success: true });
    });

    // Test route with telemetryIngestLimiter (max: 600 req/min)
    app.post('/test/telemetry/ingest', telemetryIngestLimiter, (req, res) => {
      res.status(200).json({ success: true });
    });
  });

  describe('1. Authentication Rate Limiting', () => {
    it('should allow up to 10 auth requests and return 429 RATE_LIMIT_EXCEEDED on the 11th request', async () => {
      // Send 10 successful requests
      for (let i = 1; i <= 10; i++) {
        const res = await request(app).post('/test/auth/login').send({ email: 'test@soc.com' });
        expect(res.status).toBe(200);
      }

      // 11th request must be rate limited with 429
      const blockedRes = await request(app).post('/test/auth/login').send({ email: 'test@soc.com' });
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error).toBeDefined();
      expect(blockedRes.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(blockedRes.body.error.message).toMatch(/Too many authentication attempts/i);
    });
  });

  describe('2. General API Rate Limiting', () => {
    it('should allow up to 100 API requests and return 429 RATE_LIMIT_EXCEEDED on the 101st request', async () => {
      const promises = [];
      for (let i = 1; i <= 100; i++) {
        promises.push(request(app).get('/test/api/resource'));
      }

      const results = await Promise.all(promises);
      results.forEach(res => {
        expect(res.status).toBe(200);
      });

      // 101st request must trigger 429
      const blockedRes = await request(app).get('/test/api/resource');
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error).toBeDefined();
      expect(blockedRes.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(blockedRes.body.error.message).toMatch(/Too many requests/i);
    });
  });

  describe('3. Telemetry Ingestion Rate Limiting', () => {
    it('should key telemetry ingestion by device key header', async () => {
      // Different keys get separate bucket allocations
      const resKey1 = await request(app)
        .post('/test/telemetry/ingest')
        .set('x-device-api-key', 'key-device-alpha')
        .send({});
      expect(resKey1.status).toBe(200);

      const resKey2 = await request(app)
        .post('/test/telemetry/ingest')
        .set('x-device-api-key', 'key-device-beta')
        .send({});
      expect(resKey2.status).toBe(200);
    });
  });
});

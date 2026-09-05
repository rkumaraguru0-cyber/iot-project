const mongoose = require('mongoose');
const telemetryService = require('../src/services/telemetry.service');
const { Device, Telemetry } = require('../src/models');

describe('Telemetry Service & Health Calculation (Phase 6)', () => {
  const dummyOrgId = new mongoose.Types.ObjectId();
  const dummyDeviceId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    telemetryService.clearDeduplicationCache();
    jest.clearAllMocks();
  });

  describe('Health Calculation Rules', () => {
    it('26. health = UNKNOWN when device has never reported telemetry (lastSeenAt is null)', () => {
      const health = telemetryService.calculateDeviceHealth(null, 30);
      expect(health).toBe('unknown');
    });

    it('27. health = HEALTHY when age <= expectedReportingInterval', () => {
      const now = new Date();
      // Age = 10s, expected = 30s
      const lastSeen = new Date(now.getTime() - 10 * 1000);
      const health = telemetryService.calculateDeviceHealth(lastSeen, 30, now);
      expect(health).toBe('healthy');
    });

    it('27b. health = HEALTHY when age exactly equals expectedReportingInterval', () => {
      const now = new Date();
      const lastSeen = new Date(now.getTime() - 30 * 1000);
      const health = telemetryService.calculateDeviceHealth(lastSeen, 30, now);
      expect(health).toBe('healthy');
    });

    it('28. health = DEGRADED when expectedReportingInterval < age <= 3 * expectedReportingInterval', () => {
      const now = new Date();
      // Age = 45s, expected = 30s (30s < 45s <= 90s)
      const lastSeen = new Date(now.getTime() - 45 * 1000);
      const health = telemetryService.calculateDeviceHealth(lastSeen, 30, now);
      expect(health).toBe('degraded');
    });

    it('28b. health = DEGRADED when age is exactly 3 * expectedReportingInterval', () => {
      const now = new Date();
      const lastSeen = new Date(now.getTime() - 90 * 1000);
      const health = telemetryService.calculateDeviceHealth(lastSeen, 30, now);
      expect(health).toBe('degraded');
    });

    it('29. health = OFFLINE when age > 3 * expectedReportingInterval', () => {
      const now = new Date();
      // Age = 95s, expected = 30s
      const lastSeen = new Date(now.getTime() - 95 * 1000);
      const health = telemetryService.calculateDeviceHealth(lastSeen, 30, now);
      expect(health).toBe('offline');
    });
  });

  describe('Telemetry Ingestion & Persistence', () => {
    const mockDevice = {
      _id: dummyDeviceId,
      deviceId: 'DEV-TEST-001',
      organizationId: dummyOrgId,
      expectedReportingInterval: 30,
      status: 'registered',
      healthStatus: 'unknown',
      lastSeenAt: null,
      save: jest.fn().mockResolvedValue(true)
    };

    it('23 & 24 & 25. telemetry stored with correct device, org, and updates lastSeenAt and healthStatus without changing lifecycle status', async () => {
      const nowIso = new Date().toISOString();
      const payload = {
        timestamp: nowIso,
        metrics: {
          cpu_usage: 25.4,
          memory_usage: 42.1,
          temperature: 24.5
        },
        metadata: {
          firmwareVersion: '1.0.0'
        }
      };

      const savedDoc = {
        _id: new mongoose.Types.ObjectId(),
        deviceId: dummyDeviceId,
        organizationId: dummyOrgId,
        timestamp: new Date(nowIso),
        metrics: payload.metrics,
        metadata: payload.metadata,
        receivedAt: new Date()
      };

      jest.spyOn(Telemetry, 'create').mockResolvedValue(savedDoc);
      jest.spyOn(Device, 'updateOne').mockResolvedValue({ acknowledged: true });

      const result = await telemetryService.ingestTelemetry({
        device: mockDevice,
        payload,
        source: 'mqtt'
      });

      expect(result.status).toBe('stored');
      expect(result.telemetry).toBeDefined();
      expect(Telemetry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: dummyDeviceId,
          organizationId: dummyOrgId,
          metrics: payload.metrics
        })
      );

      expect(Device.updateOne).toHaveBeenCalledWith(
        { _id: dummyDeviceId },
        expect.objectContaining({
          $set: expect.objectContaining({
            lastSeenAt: expect.any(Date),
            healthStatus: 'healthy'
          })
        })
      );
    });

    it('13 & 20. duplicate telemetry is detected and not stored multiple times', async () => {
      const nowIso = new Date().toISOString();
      const payload = {
        timestamp: nowIso,
        metrics: { cpu_usage: 12.0, temperature: 21.0 }
      };

      jest.spyOn(Telemetry, 'create').mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
      jest.spyOn(Device, 'updateOne').mockResolvedValue({ acknowledged: true });

      // First call
      const res1 = await telemetryService.ingestTelemetry({
        device: mockDevice,
        payload,
        source: 'mqtt'
      });
      expect(res1.status).toBe('stored');
      expect(Telemetry.create).toHaveBeenCalledTimes(1);

      // Second call with same fingerprint
      const res2 = await telemetryService.ingestTelemetry({
        device: mockDevice,
        payload,
        source: 'mqtt'
      });
      expect(res2.status).toBe('duplicate');
      expect(Telemetry.create).toHaveBeenCalledTimes(1); // Not called again
    });
  });
});

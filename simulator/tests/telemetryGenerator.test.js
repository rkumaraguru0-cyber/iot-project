const { generateMetrics } = require('../src/generators/metricGenerator');
const { buildTelemetryPayload } = require('../src/generators/telemetryPayloadGenerator');
const { getProfile } = require('../src/profiles');

describe('Telemetry & Metric Generators (Phase 5)', () => {
  const tsProfile = getProfile('temperature_sensor');
  const scProfile = getProfile('smart_camera');
  const igProfile = getProfile('industrial_gateway');

  describe('generateMetrics() Invariants', () => {
    it('should generate all required metrics for profile within valid ranges', () => {
      const state = {
        battery_level: 95.0,
        uptime: 1200,
        current_temperature: 22.5
      };

      const { metrics, stateUpdates } = generateMetrics(tsProfile, state, { elapsedSeconds: 30 });

      expect(metrics).toHaveProperty('cpu_usage');
      expect(metrics.cpu_usage).toBeGreaterThanOrEqual(5);
      expect(metrics.cpu_usage).toBeLessThanOrEqual(30);

      expect(metrics).toHaveProperty('memory_usage');
      expect(metrics.memory_usage).toBeGreaterThanOrEqual(20);
      expect(metrics.memory_usage).toBeLessThanOrEqual(50);

      expect(metrics).toHaveProperty('temperature');
      expect(metrics.temperature).toBeGreaterThanOrEqual(18.0);
      expect(metrics.temperature).toBeLessThanOrEqual(28.0);

      expect(metrics).toHaveProperty('battery_level');
      expect(metrics.battery_level).toBe(94.9); // 95.0 - 0.1

      expect(metrics).toHaveProperty('network_out');
      expect(metrics.network_out).toBeGreaterThanOrEqual(100);
      expect(metrics.network_out).toBeLessThanOrEqual(500);

      expect(metrics).toHaveProperty('signal_strength');
      expect(metrics.signal_strength).toBeGreaterThanOrEqual(-70);
      expect(metrics.signal_strength).toBeLessThanOrEqual(-30);

      expect(stateUpdates.uptime).toBe(1230); // 1200 + 30
      expect(stateUpdates.battery_level).toBe(94.9);
    });

    it('should maintain stateful battery drain and enforce zero floor', () => {
      let state = {
        battery_level: 0.15,
        uptime: 0,
        current_temperature: 20.0
      };

      // Tick 1: drain 0.1 -> 0.05
      let result = generateMetrics(tsProfile, state, { elapsedSeconds: 30 });
      expect(result.metrics.battery_level).toBe(0.05);
      state.battery_level = result.stateUpdates.battery_level;

      // Tick 2: drain 0.1 -> 0.0 (floored)
      result = generateMetrics(tsProfile, state, { elapsedSeconds: 30 });
      expect(result.metrics.battery_level).toBe(0);
      expect(result.stateUpdates.battery_level).toBe(0);
      state.battery_level = result.stateUpdates.battery_level;

      // Tick 3: remaining at 0, never negative, never resetting
      result = generateMetrics(tsProfile, state, { elapsedSeconds: 30 });
      expect(result.metrics.battery_level).toBe(0);
      expect(result.stateUpdates.battery_level).toBe(0);
    });

    it('should progress uptime monotonically with logical elapsed time', () => {
      let state = { uptime: 500 };
      const res1 = generateMetrics(igProfile, state, { elapsedSeconds: 15 });
      expect(res1.stateUpdates.uptime).toBe(515);

      state.uptime = res1.stateUpdates.uptime;
      const res2 = generateMetrics(igProfile, state, { elapsedSeconds: 45 });
      expect(res2.stateUpdates.uptime).toBe(560);
    });

    it('should ensure smooth continuous temperature variation', () => {
      let currentTemp = 23.0;
      let state = { current_temperature: currentTemp };

      for (let i = 0; i < 50; i++) {
        const { metrics, stateUpdates } = generateMetrics(tsProfile, state, { elapsedSeconds: 30 });
        const delta = Math.abs(metrics.temperature - currentTemp);
        expect(delta).toBeLessThanOrEqual(0.35); // 0.3 maxDelta + rounding epsilon
        expect(metrics.temperature).toBeGreaterThanOrEqual(18.0);
        expect(metrics.temperature).toBeLessThanOrEqual(28.0);

        currentTemp = metrics.temperature;
        state.current_temperature = stateUpdates.current_temperature;
      }
    });

    it('should support deterministic testing with injected randomFn', () => {
      const fixedRandom = () => 0.5; // midpoint deterministic
      const state = { current_temperature: 25.0, battery_level: 100, uptime: 0 };
      const { metrics } = generateMetrics(scProfile, state, { randomFn: fixedRandom });

      for (const [key, val] of Object.entries(metrics)) {
        expect(Number.isFinite(val)).toBe(true);
      }
    });
  });

  describe('buildTelemetryPayload() Envelope', () => {
    it('should construct valid telemetry envelope with all required properties', () => {
      const device = {
        deviceId: 'DEV-TS-A1B2C3',
        organizationId: '64b0f91a2c3d4e5f6a7b8c9d',
        type: 'temperature_sensor',
        ip: '10.0.0.42',
        firmwareVersion: '2.1.0'
      };

      const state = {
        battery_level: 88.0,
        uptime: 3600,
        current_temperature: 24.0,
        ip: device.ip,
        firmware_version: device.firmwareVersion
      };

      const now = new Date('2026-09-05T10:00:00.000Z');
      const { payload, stateUpdates } = buildTelemetryPayload(device, tsProfile, state, {
        timestamp: now,
        elapsedSeconds: 30
      });

      expect(payload).toHaveProperty('deviceId', 'DEV-TS-A1B2C3');
      expect(payload).toHaveProperty('organizationId', '64b0f91a2c3d4e5f6a7b8c9d');
      expect(payload).toHaveProperty('timestamp', '2026-09-05T10:00:00.000Z');
      expect(payload).toHaveProperty('metrics');
      expect(payload).toHaveProperty('metadata');

      expect(payload.metadata).toEqual({
        ip: '10.0.0.42',
        firmware_version: '2.1.0',
        uptime: 3630
      });

      expect(stateUpdates.battery_level).toBe(87.9);
      expect(stateUpdates.uptime).toBe(3630);
    });

    it('should throw error on missing device descriptor, profile, or state', () => {
      expect(() => buildTelemetryPayload(null, tsProfile, {})).toThrow();
      expect(() => buildTelemetryPayload({ deviceId: 'DEV-1' }, null, {})).toThrow();
      expect(() => buildTelemetryPayload({ deviceId: 'DEV-1' }, tsProfile, null)).toThrow();
    });
  });
});

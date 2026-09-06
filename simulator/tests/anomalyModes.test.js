const FleetSimulator = require('../src/engine/fleetSimulator');
const {
  SUPPORTED_ANOMALY_MODES,
  isValidAnomalyMode,
  applyThresholdAnomaly,
  applyNetworkSpikeAnomaly,
  applyImpossibleValueAnomaly,
  applyFirmwareTamperAnomaly,
  applyAnomaly,
  createSeededRandom
} = require('../src/anomalies');
const MqttTransport = require('../src/transports/mqttTransport');
const RestTransport = require('../src/transports/restTransport');
const { getProfile } = require('../src/profiles');

describe('Simulator Anomaly Modes (PRD §11.5)', () => {
  describe('Supported Anomaly Modes Registry & Validation', () => {
    test('contains all six required anomaly modes', () => {
      expect(SUPPORTED_ANOMALY_MODES).toHaveLength(6);
      expect(SUPPORTED_ANOMALY_MODES).toContain('threshold');
      expect(SUPPORTED_ANOMALY_MODES).toContain('network-spike');
      expect(SUPPORTED_ANOMALY_MODES).toContain('impossible-value');
      expect(SUPPORTED_ANOMALY_MODES).toContain('heartbeat');
      expect(SUPPORTED_ANOMALY_MODES).toContain('auth-bruteforce');
      expect(SUPPORTED_ANOMALY_MODES).toContain('firmware-tamper');
    });

    test('isValidAnomalyMode correctly validates modes', () => {
      expect(isValidAnomalyMode('threshold')).toBe(true);
      expect(isValidAnomalyMode('network-spike')).toBe(true);
      expect(isValidAnomalyMode('impossible-value')).toBe(true);
      expect(isValidAnomalyMode('heartbeat')).toBe(true);
      expect(isValidAnomalyMode('auth-bruteforce')).toBe(true);
      expect(isValidAnomalyMode('firmware-tamper')).toBe(true);

      expect(isValidAnomalyMode('invalid-mode')).toBe(false);
      expect(isValidAnomalyMode('')).toBe(false);
      expect(isValidAnomalyMode(null)).toBe(false);
    });
  });

  describe('Mode 1: threshold (CPU 92–98%, min 10 consecutive readings)', () => {
    test('applyThresholdAnomaly produces CPU between 92.0% and 98.0%', () => {
      const profile = getProfile('industrial_gateway');
      const baseMetrics = { cpu_usage: 25.0, memory_usage: 40.0 };

      for (let i = 0; i < 20; i++) {
        const mutated = applyThresholdAnomaly(baseMetrics, profile, {});
        expect(mutated.cpu_usage).toBeGreaterThanOrEqual(92.0);
        expect(mutated.cpu_usage).toBeLessThanOrEqual(98.0);
      }
    });

    test('FleetSimulator in threshold mode generates at least 10 consecutive readings in 92–98% range', () => {
      const sim = new FleetSimulator({
        deviceCount: 1,
        intervalMs: 5000,
        anomalyMode: 'threshold',
        randomFn: createSeededRandom(42)
      });

      const readings = [];
      // Device is temperature sensor with 30s reporting interval. Tick 12 times with 30s elapsed per tick.
      for (let i = 0; i < 12; i++) {
        const payloads = sim.tick(30);
        if (payloads.length > 0) {
          readings.push(payloads[0].metrics.cpu_usage);
        }
      }

      expect(readings.length).toBeGreaterThanOrEqual(10);
      for (const cpu of readings) {
        expect(cpu).toBeGreaterThanOrEqual(92.0);
        expect(cpu).toBeLessThanOrEqual(98.0);
      }
    });
  });

  describe('Mode 2: network-spike (50x baseline, min 5 readings)', () => {
    test('applyNetworkSpikeAnomaly scales network_out by 50x baseline', () => {
      const profile = getProfile('smart_camera');
      const baseNetOut = (profile.metrics.network_out.min + profile.metrics.network_out.max) / 2.0;
      const expectedSpike = Math.round(baseNetOut * 50);

      const mutated = applyNetworkSpikeAnomaly({ network_out: baseNetOut }, profile, {});
      expect(mutated.network_out).toBe(expectedSpike);
      expect(mutated.network_out).toBeGreaterThanOrEqual(50000);
    });

    test('FleetSimulator in network-spike mode generates at least 5 consecutive spiked readings', () => {
      const sim = new FleetSimulator({
        deviceCount: 1,
        intervalMs: 5000,
        anomalyMode: 'network-spike',
        randomFn: createSeededRandom(99)
      });

      const readings = [];
      // Tick 6 times with 30s elapsed per tick
      for (let i = 0; i < 6; i++) {
        const payloads = sim.tick(30);
        if (payloads.length > 0) {
          readings.push(payloads[0].metrics.network_out);
        }
      }

      expect(readings.length).toBeGreaterThanOrEqual(5);
      for (const netOut of readings) {
        expect(netOut).toBeGreaterThanOrEqual(15000); // 300 baseline * 50x = 15000
      }
    });
  });

  describe('Mode 3: impossible-value (temperature = -300°C)', () => {
    test('applyImpossibleValueAnomaly sets temperature to -300.0°C', () => {
      const profile = getProfile('temperature_sensor');
      const baseMetrics = { temperature: 22.5 };

      const mutated = applyImpossibleValueAnomaly(baseMetrics, profile, {});
      expect(mutated.temperature).toBe(-300.0);
    });

    test('FleetSimulator in impossible-value mode emits temperature of -300°C', () => {
      const sim = new FleetSimulator({
        deviceCount: 1,
        intervalMs: 5000,
        anomalyMode: 'impossible-value'
      });

      const payloads = sim.tick(5);
      expect(payloads).toHaveLength(1);
      expect(payloads[0].metrics.temperature).toBe(-300.0);
    });
  });

  describe('Mode 4: heartbeat (300s transmission suppression)', () => {
    test('suppresses telemetry for exactly 300 logical seconds and resumes afterwards', () => {
      const sim = new FleetSimulator({
        deviceCount: 1,
        intervalMs: 5000
      });

      const deviceId = sim.devices[0].deviceId;

      // Initial tick before anomaly emits telemetry
      const initialPayloads = sim.tick(5);
      expect(initialPayloads).toHaveLength(1);

      // Trigger heartbeat suppression (suppressed for 300s)
      sim.setDeviceAnomaly(deviceId, 'heartbeat');

      // First tick sets suppression window [0, 300s) and emits nothing
      const tick1 = sim.tick(5);
      expect(tick1).toHaveLength(0);
      expect(sim.isDeviceSuppressed(deviceId)).toBe(true);

      // Ticking through remaining seconds of suppression up to 290s
      let suppressedEmissions = 0;
      for (let s = 5; s < 290; s += 5) {
        const tick = sim.tick(5);
        suppressedEmissions += tick.length;
      }
      expect(suppressedEmissions).toBe(0);
      expect(sim.isDeviceSuppressed(deviceId)).toBe(true);

      // Clear anomaly mode so it won't trigger a new suppression window once 300s expires
      sim.setDeviceAnomaly(deviceId, null);

      // Advance through 300s boundary
      sim.tick(15);

      // Past 300s window -> suppression expired and normal transmission resumes
      const resumedPayloads = sim.tick(15);
      expect(resumedPayloads.length).toBeGreaterThanOrEqual(1);
      expect(resumedPayloads[0].deviceId).toBe(deviceId);
      expect(sim.isDeviceSuppressed(deviceId)).toBe(false);
    });

    test('heartbeat suppression does not mutate server device health status', () => {
      const sim = new FleetSimulator({ deviceCount: 1 });
      const dev = sim.devices[0];

      sim.suppressDevice(dev.deviceId, 300);
      expect(sim.isDeviceSuppressed(dev.deviceId)).toBe(true);

      // The simulator device descriptor maintains its local status, no DB calls made
      expect(dev.status).toBe('active');
    });
  });

  describe('Mode 5: auth-bruteforce (10 failed attempts, verifies rejection, safe credentials)', () => {
    test('MQTT transport simulateAuthFailures attempts 10 connections and records rejections', async () => {
      const transport = new MqttTransport({ mqttUrl: 'mqtt://127.0.0.1:19999' }); // Unreachable / invalid broker port
      const device = { deviceId: 'DEV-TS-001', organizationId: 'test-org' };

      const result = await transport.simulateAuthFailures(device, 10);
      expect(result.attempts).toBe(10);
      expect(result.rejected).toBe(10);
      transport.close();
    });

    test('REST transport simulateAuthFailures attempts 10 requests with invalid API keys', async () => {
      const transport = new RestTransport({ apiUrl: 'http://127.0.0.1:59999/api/v1' }); // Unreachable / rejected
      const device = { deviceId: 'DEV-SC-002', organizationId: 'test-org' };

      const result = await transport.simulateAuthFailures(device, 10);
      expect(result.attempts).toBe(10);
      expect(result.rejected).toBe(10);
    });
  });

  describe('Mode 6: firmware-tamper (metadata.firmware_version = "9.9.9-tampered")', () => {
    test('applyFirmwareTamperAnomaly sets metadata.firmware_version', () => {
      const profile = getProfile('smart_lock');
      const baseMetadata = { ip: '192.168.1.50', firmware_version: '1.0.0', uptime: 100 };

      const mutated = applyFirmwareTamperAnomaly(baseMetadata, profile, {});
      expect(mutated.firmware_version).toBe('9.9.9-tampered');
      expect(mutated.ip).toBe('192.168.1.50');
    });

    test('FleetSimulator in firmware-tamper mode emits payload with 9.9.9-tampered metadata', () => {
      const sim = new FleetSimulator({
        deviceCount: 1,
        intervalMs: 5000,
        anomalyMode: 'firmware-tamper'
      });

      const payloads = sim.tick(5);
      expect(payloads).toHaveLength(1);
      expect(payloads[0].metadata.firmware_version).toBe('9.9.9-tampered');
    });
  });

  describe('Determinism and Seedable PRNG', () => {
    test('createSeededRandom generates deterministic repeatable sequences', () => {
      const rng1 = createSeededRandom(12345);
      const rng2 = createSeededRandom(12345);

      const seq1 = Array.from({ length: 10 }, () => rng1());
      const seq2 = Array.from({ length: 10 }, () => rng2());

      expect(seq1).toEqual(seq2);
    });

    test('FleetSimulator produces identical telemetry with matching seed', () => {
      const sim1 = new FleetSimulator({ deviceCount: 3, intervalMs: 5000, randomFn: createSeededRandom(888) });
      const sim2 = new FleetSimulator({ deviceCount: 3, intervalMs: 5000, randomFn: createSeededRandom(888) });

      const p1 = sim1.tick(5);
      const p2 = sim2.tick(5);

      expect(p1.map(p => p.metrics)).toEqual(p2.map(p => p.metrics));
    });
  });
});

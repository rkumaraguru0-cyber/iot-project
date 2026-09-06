const { ScenarioRunner, getScenarioDefinition, SCENARIO_DEFINITIONS } = require('../src/scenarios');
const { createSeededRandom } = require('../src/anomalies');

describe('Simulator Attack Scenarios (PRD §11.6)', () => {
  describe('Declarative Scenario Registry', () => {
    test('contains all six required scenarios with valid metadata', () => {
      expect(Object.keys(SCENARIO_DEFINITIONS)).toHaveLength(6);
      for (let id = 1; id <= 6; id++) {
        const def = getScenarioDefinition(id);
        expect(def).toBeDefined();
        expect(def.id).toBe(id);
        expect(def.name).toBeDefined();
        expect(def.durationSeconds).toBeGreaterThan(0);
        expect(Array.isArray(def.stages)).toBe(true);
        expect(def.stages.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('Scenario 1 — Normal Fleet (10 devices, 30 min, 0 intentional anomalies)', () => {
    test('executes 10 devices across 1800s with normal baseline telemetry', () => {
      const runner = new ScenarioRunner(1, {
        seed: 101,
        timeScale: 0
      });

      expect(runner.definition.deviceCount).toBe(10);
      expect(runner.fleetSimulator.devices).toHaveLength(10);
      expect(runner.definition.durationSeconds).toBe(1800);

      // Advance by 30 minutes (360 ticks of 5s)
      let totalEmissions = 0;
      for (let s = 0; s < 1800; s += 5) {
        const payloads = runner.tick(5);
        totalEmissions += payloads.length;
        for (const p of payloads) {
          // Zero intentional anomalies: CPU should remain normal baseline (< 85%), temp < 60°C
          if (p.metrics.cpu_usage !== undefined) {
            expect(p.metrics.cpu_usage).toBeLessThan(85.0);
          }
          if (p.metrics.temperature !== undefined) {
            expect(p.metrics.temperature).toBeLessThan(60.0);
          }
          expect(p.metadata.firmware_version).not.toBe('9.9.9-tampered');
        }
      }

      expect(totalEmissions).toBeGreaterThan(0);
      expect(runner.isCompleted).toBe(true);
      expect(runner.logicalElapsedSeconds).toBe(1800);
    });
  });

  describe('Scenario 2 — Single Device Compromise (Smart Camera, 4 sequential stages)', () => {
    test('progresses through Auth Brute Force -> Off-Schedule -> Network Spike -> Firmware Tamper', () => {
      const authAttempts = [];
      const stageTransitions = [];

      const runner = new ScenarioRunner(2, {
        seed: 202,
        timeScale: 0,
        onAuthFailure: (res, dev) => {
          authAttempts.push({ dev: dev.deviceId, attempts: res.attempts });
        },
        onStageChange: (newStage) => {
          stageTransitions.push(newStage?.name);
        }
      });

      const targetDeviceId = runner.fleetSimulator.devices[1].deviceId; // DEV-SC-002
      expect(targetDeviceId).toContain('SC');

      // Stage 1: T+0 to T+300s (Auth Brute Force)
      runner.tick(5);
      expect(authAttempts).toHaveLength(1);
      expect(authAttempts[0].dev).toBe(targetDeviceId);
      expect(authAttempts[0].attempts).toBe(10);

      for (let s = 5; s < 300; s += 5) {
        runner.tick(5);
      }

      // Stage 2: T+300 to T+600s (Off-Schedule Reporting)
      const stage2Payloads = [];
      for (let s = 300; s < 600; s += 5) {
        const payloads = runner.tick(5);
        const targetP = payloads.find(p => p.deviceId === targetDeviceId);
        if (targetP) stage2Payloads.push(targetP);
      }
      expect(stage2Payloads.length).toBeGreaterThanOrEqual(1);
      const date = new Date(stage2Payloads[0].timestamp);
      expect(date.getUTCHours()).toBe(3);
      expect(date.getUTCMinutes()).toBe(15);

      // Stage 3: T+600 to T+900s (Network Egress Spike)
      const stage3Payloads = [];
      for (let s = 600; s < 900; s += 5) {
        const payloads = runner.tick(5);
        const targetP = payloads.find(p => p.deviceId === targetDeviceId);
        if (targetP) stage3Payloads.push(targetP);
      }
      expect(stage3Payloads.length).toBeGreaterThanOrEqual(1);
      for (const p of stage3Payloads) {
        expect(p.metrics.network_out).toBeGreaterThanOrEqual(50000); // 50x baseline
      }

      // Stage 4: T+900 to T+1200s (Firmware Version Tamper)
      const stage4Payloads = [];
      for (let s = 900; s < 1200; s += 5) {
        const payloads = runner.tick(5);
        const targetP = payloads.find(p => p.deviceId === targetDeviceId);
        if (targetP) stage4Payloads.push(targetP);
      }
      expect(stage4Payloads.length).toBeGreaterThanOrEqual(1);
      for (const p of stage4Payloads) {
        expect(p.metadata.firmware_version).toBe('9.9.9-tampered');
      }

      expect(runner.isCompleted).toBe(true);
      expect(stageTransitions).toContain('Auth Brute Force');
      expect(stageTransitions).toContain('Off-Schedule Reporting');
      expect(stageTransitions).toContain('Network Egress Spike');
      expect(stageTransitions).toContain('Firmware Version Tamper');

      // Non-target devices must not be tampered
      const otherDevices = runner.fleetSimulator.devices.filter(d => d.deviceId !== targetDeviceId);
      for (const dev of otherDevices) {
        const state = runner.fleetSimulator.stateStore.getOrCreateState(runner.organizationId, dev.deviceId);
        expect(state.firmware_version).not.toBe('9.9.9-tampered');
      }
    });
  });

  describe('Scenario 3 — Firmware Exploit (Industrial Gateway CPU ramp -> Memory -> Network spike)', () => {
    test('ramps CPU 45% -> 95%, raises memory to ~96.5%, and spikes network egress', () => {
      const runner = new ScenarioRunner(3, {
        seed: 303,
        timeScale: 0
      });

      const targetIdx = 2;
      const targetDev = runner.fleetSimulator.devices[targetIdx];
      expect(targetDev.deviceId).toContain('IG');
      expect(targetDev.firmwareVersion).toBe('1.0.3');

      // Stage 1 (0–900s): CPU ramp from 45% to 95%
      const stage1Payloads = [];
      for (let s = 0; s < 900; s += 5) {
        const payloads = runner.tick(5);
        const p = payloads.find(x => x.deviceId === targetDev.deviceId);
        if (p) stage1Payloads.push({ s, cpu: p.metrics.cpu_usage });
      }
      expect(stage1Payloads.length).toBeGreaterThanOrEqual(5);
      expect(stage1Payloads[0].cpu).toBeLessThanOrEqual(55.0);
      expect(stage1Payloads[stage1Payloads.length - 1].cpu).toBeGreaterThanOrEqual(92.0);

      // Stage 2 (900–1200s): Memory Exhaustion ~96.5%, CPU 95-97%
      const stage2Payloads = [];
      for (let s = 900; s < 1200; s += 5) {
        const payloads = runner.tick(5);
        const p = payloads.find(x => x.deviceId === targetDev.deviceId);
        if (p) stage2Payloads.push(p);
      }
      expect(stage2Payloads.length).toBeGreaterThanOrEqual(1);
      for (const p of stage2Payloads) {
        expect(p.metrics.memory_usage).toBe(96.5);
        expect(p.metrics.cpu_usage).toBeGreaterThanOrEqual(95.0);
      }

      // Stage 3 (1200–1500s): Network Egress Spike
      const stage3Payloads = [];
      for (let s = 1200; s < 1500; s += 5) {
        const payloads = runner.tick(5);
        const p = payloads.find(x => x.deviceId === targetDev.deviceId);
        if (p) stage3Payloads.push(p);
      }
      expect(stage3Payloads.length).toBeGreaterThanOrEqual(1);
      for (const p of stage3Payloads) {
        expect(p.metrics.network_out).toBeGreaterThanOrEqual(25000);
        expect(p.metrics.memory_usage).toBe(96.5);
        expect(p.metrics.cpu_usage).toBeGreaterThanOrEqual(95.0);
      }

      expect(runner.isCompleted).toBe(true);
    });
  });

  describe('Scenario 4 — Gradual Degradation (Temperature drift +0.5°C/min from 25°C to 90°C over 130 min)', () => {
    test('drifts linearly: 25°C (0m) -> 40°C (30m) -> 60°C (70m) -> 85°C (120m) -> 90°C (130m)', () => {
      const runner = new ScenarioRunner(4, {
        seed: 404,
        timeScale: 0
      });

      expect(runner.definition.durationSeconds).toBe(7800); // 130 min / 7800s
      const targetDev = runner.fleetSimulator.devices[0];

      // Track emissions across 7800s (260 ticks of 30s)
      const tempRecords = [];
      for (let s = 0; s <= 7800; s += 30) {
        const payloads = runner.tick(30);
        const p = payloads.find(x => x.deviceId === targetDev.deviceId);
        if (p) {
          tempRecords.push({ s: runner.logicalElapsedSeconds, temp: p.metrics.temperature });
        }
      }

      expect(tempRecords.length).toBeGreaterThanOrEqual(50);

      // Verify milestones:
      // T=0s: ~25°C
      expect(tempRecords[0].temp).toBe(25.0);

      // Around 30 min (1800s): 40°C
      const rec30m = tempRecords.find(r => r.s >= 1800);
      expect(rec30m.temp).toBeCloseTo(40.0, 0);

      // Around 70 min (4200s): 60°C
      const rec70m = tempRecords.find(r => r.s >= 4200);
      expect(rec70m.temp).toBeCloseTo(60.0, 0);

      // Around 120 min (7200s): 85°C
      const rec120m = tempRecords.find(r => r.s >= 7200);
      expect(rec120m.temp).toBeCloseTo(85.0, 0);

      // Final (7800s / 130m): 90°C
      const rec130m = tempRecords[tempRecords.length - 1];
      expect(rec130m.temp).toBe(90.0);

      expect(runner.isCompleted).toBe(true);
    });
  });

  describe('Scenario 5 — Fleet-Wide Attack (5 devices simultaneous auth brute force + network spike)', () => {
    test('affects all 5 devices simultaneously across 2 stages', () => {
      const authFailedDevices = new Set();

      const runner = new ScenarioRunner(5, {
        seed: 505,
        timeScale: 0,
        onAuthFailure: (res, dev) => {
          authFailedDevices.add(dev.deviceId);
        }
      });

      // Stage 1 (0–120s): simultaneous auth brute force
      runner.tick(5);
      expect(authFailedDevices.size).toBe(5);

      for (let s = 5; s < 120; s += 5) {
        runner.tick(5);
      }

      // Stage 2 (120–600s): simultaneous network spikes on all 5 devices
      const spikedDevices = new Set();
      for (let s = 120; s < 600; s += 5) {
        const payloads = runner.tick(5);
        for (const p of payloads) {
          expect(p.metrics.network_out).toBeGreaterThanOrEqual(10000); // 50x baseline
          spikedDevices.add(p.deviceId);
        }
      }

      expect(spikedDevices.size).toBe(5);
      expect(runner.isCompleted).toBe(true);
    });
  });

  describe('Scenario 6 — False Positive Validation (Safe borderline values, zero rule triggers)', () => {
    test('generates values within safe boundaries and 4 auth attempts', () => {
      let authAttemptsTotal = 0;

      const runner = new ScenarioRunner(6, {
        seed: 606,
        timeScale: 0,
        onAuthFailure: (res) => {
          authAttemptsTotal += res.attempts;
        }
      });

      expect(runner.definition.durationSeconds).toBe(600);

      // Run full 10-minute simulation (120 ticks of 5s)
      for (let s = 0; s < 600; s += 5) {
        const payloads = runner.tick(5);
        for (const p of payloads) {
          // Verify safe boundaries:
          // CPU: 80–84% (RULE-CPU-HIGH triggers at > 85%)
          expect(p.metrics.cpu_usage).toBeGreaterThanOrEqual(80.0);
          expect(p.metrics.cpu_usage).toBeLessThanOrEqual(84.0);

          // Temp: 55–58°C (RULE-TEMP-CRITICAL triggers at > 60°C)
          expect(p.metrics.temperature).toBeGreaterThanOrEqual(55.0);
          expect(p.metrics.temperature).toBeLessThanOrEqual(58.0);

          // Mem: 85–88% (RULE-MEM-HIGH triggers at > 90%)
          expect(p.metrics.memory_usage).toBeGreaterThanOrEqual(85.0);
          expect(p.metrics.memory_usage).toBeLessThanOrEqual(88.0);

          // Battery: 20–25% (RULE-BATTERY-LOW triggers at < 15%)
          expect(p.metrics.battery_level).toBeGreaterThanOrEqual(20.0);
          expect(p.metrics.battery_level).toBeLessThanOrEqual(25.0);
        }
      }

      // Exactly 4 auth failures (< 5 threshold)
      expect(authAttemptsTotal).toBe(4);
      expect(runner.isCompleted).toBe(true);
    });
  });
});

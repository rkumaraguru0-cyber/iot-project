const FleetSimulator = require('../src/engine/fleetSimulator');
const DeviceStateStore = require('../src/engine/deviceStateStore');

describe('Fleet Simulator Engine & Scheduler (Phase 5)', () => {
  describe('DeviceStateStore Unit Tests', () => {
    let store;

    beforeEach(() => {
      store = new DeviceStateStore();
    });

    it('should isolate state between different organizations with the same device ID', () => {
      const stateOrgA = store.getOrCreateState('org-alpha', 'DEV-TS-001', null, {
        battery_level: 80,
        uptime: 100
      });

      const stateOrgB = store.getOrCreateState('org-beta', 'DEV-TS-001', null, {
        battery_level: 50,
        uptime: 200
      });

      expect(store.size).toBe(2);
      expect(stateOrgA.battery_level).toBe(80);
      expect(stateOrgB.battery_level).toBe(50);

      store.updateState('org-alpha', 'DEV-TS-001', { battery_level: 79.9 });
      expect(store.getState('org-alpha', 'DEV-TS-001').battery_level).toBe(79.9);
      expect(store.getState('org-beta', 'DEV-TS-001').battery_level).toBe(50);
    });

    it('should delete and clear states properly', () => {
      store.getOrCreateState('org-1', 'DEV-1', null);
      store.getOrCreateState('org-1', 'DEV-2', null);
      expect(store.size).toBe(2);

      store.deleteState('org-1', 'DEV-1');
      expect(store.size).toBe(1);
      expect(store.getState('org-1', 'DEV-1')).toBeNull();

      store.clear();
      expect(store.size).toBe(0);
    });
  });

  describe('FleetSimulator Scheduling & Invariants', () => {
    it('should seed virtual fleet representing all 5 device profiles', () => {
      const simulator = new FleetSimulator({
        organizationId: 'test-org-123',
        deviceCount: 5
      });

      expect(simulator.devices).toHaveLength(5);
      const types = simulator.devices.map(d => d.type);
      expect(types).toContain('temperature_sensor');
      expect(types).toContain('smart_camera');
      expect(types).toContain('industrial_gateway');
      expect(types).toContain('medical_monitor');
      expect(types).toContain('smart_lock');
    });

    it('should filter device lifecycle states correctly (skip decommissioned)', () => {
      const simulator = new FleetSimulator({ deviceCount: 0 });

      const customFleet = [
        { deviceId: 'DEV-REG', type: 'temperature_sensor', status: 'registered' },
        { deviceId: 'DEV-ACT', type: 'temperature_sensor', status: 'active' },
        { deviceId: 'DEV-MNT', type: 'temperature_sensor', status: 'maintenance' },
        { deviceId: 'DEV-QRT', type: 'temperature_sensor', status: 'quarantined' },
        { deviceId: 'DEV-DEC', type: 'temperature_sensor', status: 'decommissioned' }
      ];

      simulator.setFleet(customFleet);

      const telemetryList = simulator.tick(30, new Date('2026-09-05T10:00:00Z'));

      const emittedDeviceIds = telemetryList.map(t => t.deviceId);
      expect(emittedDeviceIds).toContain('DEV-REG');
      expect(emittedDeviceIds).toContain('DEV-ACT');
      expect(emittedDeviceIds).toContain('DEV-MNT');
      expect(emittedDeviceIds).toContain('DEV-QRT');
      expect(emittedDeviceIds).not.toContain('DEV-DEC'); // Decommissioned must be skipped
    });

    it('should safely skip unknown device profiles without crashing or falling back to generic profile', () => {
      const simulator = new FleetSimulator({ deviceCount: 0 });

      const mixedFleet = [
        { deviceId: 'DEV-VALID', type: 'temperature_sensor', status: 'active' },
        { deviceId: 'DEV-ROGUE', type: 'unsupported_alien_device', status: 'active' }
      ];

      simulator.setFleet(mixedFleet);

      const telemetryList = simulator.tick(30, new Date('2026-09-05T10:00:00Z'));

      expect(telemetryList).toHaveLength(1);
      expect(telemetryList[0].deviceId).toBe('DEV-VALID');
    });

    it('should respect profile-specific reporting intervals during simulation progression', () => {
      const simulator = new FleetSimulator({ deviceCount: 0 });

      const fleet = [
        { deviceId: 'DEV-IG', type: 'industrial_gateway', status: 'active' }, // 15s interval
        { deviceId: 'DEV-TS', type: 'temperature_sensor', status: 'active' },   // 30s interval
        { deviceId: 'DEV-SL', type: 'smart_lock', status: 'active' }          // 60s interval
      ];

      simulator.setFleet(fleet);

      const startTime = new Date('2026-09-05T10:00:00.000Z');

      // Tick 1 (T=0): Initial run, all devices emit initial telemetry
      const tick1 = simulator.tick(0, startTime);
      expect(tick1.map(t => t.deviceId)).toEqual(['DEV-IG', 'DEV-TS', 'DEV-SL']);

      // Tick 2 (T+15s): Only Industrial Gateway (15s) is due
      const time15s = new Date(startTime.getTime() + 15000);
      const tick2 = simulator.tick(15, time15s);
      expect(tick2.map(t => t.deviceId)).toEqual(['DEV-IG']);

      // Tick 3 (T+30s): Industrial Gateway (15s) and Temperature Sensor (30s) are due
      const time30s = new Date(startTime.getTime() + 30000);
      const tick3 = simulator.tick(15, time30s);
      expect(tick3.map(t => t.deviceId)).toEqual(['DEV-IG', 'DEV-TS']);

      // Tick 4 (T+45s): Only Industrial Gateway (15s) is due
      const time45s = new Date(startTime.getTime() + 45000);
      const tick4 = simulator.tick(15, time45s);
      expect(tick4.map(t => t.deviceId)).toEqual(['DEV-IG']);

      // Tick 5 (T+60s): All three devices are due
      const time60s = new Date(startTime.getTime() + 60000);
      const tick5 = simulator.tick(15, time60s);
      expect(tick5.map(t => t.deviceId)).toEqual(['DEV-IG', 'DEV-TS', 'DEV-SL']);
    });

    it('should start, stop, and prevent duplicate active schedulers cleanly', () => {
      jest.useFakeTimers();

      const telemetryCallback = jest.fn();
      const simulator = new FleetSimulator({
        deviceCount: 2,
        intervalMs: 1000,
        onTelemetry: telemetryCallback
      });

      expect(simulator.isRunning).toBe(false);

      simulator.start();
      expect(simulator.isRunning).toBe(true);
      expect(simulator.timer).not.toBeNull();

      // Calling start again should not create duplicate timers
      const timerRef = simulator.timer;
      simulator.start();
      expect(simulator.timer).toBe(timerRef);

      // Advance timer
      jest.advanceTimersByTime(2500);

      simulator.gracefulShutdown();
      expect(simulator.isRunning).toBe(false);
      expect(simulator.timer).toBeNull();

      jest.useRealTimers();
    });
  });
});

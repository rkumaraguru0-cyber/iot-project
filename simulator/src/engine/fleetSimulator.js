const { getProfile, getSupportedProfileTypes } = require('../profiles');
const { buildTelemetryPayload } = require('../generators/telemetryPayloadGenerator');
const DeviceStateStore = require('./deviceStateStore');
const logger = require('../utils/logger');

const TYPE_PREFIXES = {
  temperature_sensor: 'TS',
  smart_camera: 'SC',
  industrial_gateway: 'IG',
  medical_monitor: 'MM',
  smart_lock: 'SL'
};

class FleetSimulator {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.organizationId='default-org']
   * @param {number} [options.deviceCount=5]
   * @param {number} [options.intervalMs=5000]
   * @param {Function} [options.onTelemetry]
   * @param {Function} [options.randomFn]
   */
  constructor(options = {}) {
    this.organizationId = options.organizationId || 'default-org';
    this.deviceCount = options.deviceCount || 5;
    this.intervalMs = options.intervalMs || 5000;
    this.onTelemetry = options.onTelemetry || null;
    this.randomFn = options.randomFn || Math.random;

    this.stateStore = new DeviceStateStore();
    this.devices = [];
    this.timer = null;
    this.isRunning = false;
    this.logicalTime = Date.now();

    this.initializeDefaultFleet();
  }

  /**
   * Seeds the in-memory virtual device fleet across supported profiles.
   */
  initializeDefaultFleet() {
    this.devices = [];
    const supportedTypes = getSupportedProfileTypes();

    for (let i = 0; i < this.deviceCount; i++) {
      const type = supportedTypes[i % supportedTypes.length];
      const prefix = TYPE_PREFIXES[type] || 'DV';
      const indexStr = String(i + 1).padStart(3, '0');
      const deviceId = `DEV-${prefix}-${indexStr}`;

      const device = {
        deviceId,
        name: `Virtual ${type.replace(/_/g, ' ')} #${i + 1}`,
        type,
        status: 'active', // default active
        organizationId: this.organizationId,
        ip: `192.168.1.${100 + i}`,
        firmwareVersion: '1.0.0'
      };

      this.devices.push(device);

      // Pre-initialize persistent state
      const profile = getProfile(type);
      this.stateStore.getOrCreateState(this.organizationId, deviceId, profile, {
        ip: device.ip,
        firmware_version: device.firmwareVersion,
        uptime: 0,
        battery_level: 100.0
      });
    }
  }

  /**
   * Overrides or injects a custom device fleet.
   * @param {Array<Object>} devices
   */
  setFleet(devices) {
    if (!Array.isArray(devices)) {
      throw new Error('Fleet must be an array of device objects');
    }
    this.devices = [...devices];

    // Initialize state store for new fleet
    for (const dev of this.devices) {
      const profile = getProfile(dev.type);
      if (profile) {
        this.stateStore.getOrCreateState(dev.organizationId || this.organizationId, dev.deviceId, profile, {
          ip: dev.ip,
          firmware_version: dev.firmwareVersion,
          uptime: dev.uptime !== undefined ? dev.uptime : 0,
          battery_level: dev.battery_level !== undefined ? dev.battery_level : 100.0
        });
      }
    }
  }

  /**
   * Simulates a single tick of logical elapsed time for the fleet.
   * Checks reporting intervals and lifecycle states.
   * 
   * @param {number} [elapsedSeconds=5]
   * @param {Date} [currentTime]
   * @returns {Array<Object>} Array of generated telemetry payloads in this tick
   */
  tick(elapsedSeconds = 5, currentTime = null) {
    const now = currentTime ? new Date(currentTime) : new Date(this.logicalTime);
    this.logicalTime = now.getTime() + (elapsedSeconds * 1000);

    const generatedTelemetry = [];

    for (const device of this.devices) {
      // Lifecycle check: skip decommissioned
      if (device.status === 'decommissioned') {
        logger.debug(`Skipping telemetry for decommissioned device '${device.deviceId}'`);
        continue;
      }

      // Profile validation: skip unknown profiles with error
      const profile = getProfile(device.type);
      if (!profile) {
        logger.error(`Unknown device profile '${device.type}' for device '${device.deviceId}'. Skipping device.`);
        continue;
      }

      // Check device state
      const orgId = device.organizationId || this.organizationId;
      const state = this.stateStore.getOrCreateState(orgId, device.deviceId, profile);

      // Interval check: determine if telemetry is due
      const lastEmitted = state.lastEmittedTimestamp ? new Date(state.lastEmittedTimestamp).getTime() : 0;
      const intervalMs = (profile.reportingIntervalSeconds || 30) * 1000;

      const timeSinceLastEmitted = now.getTime() - lastEmitted;
      if (lastEmitted > 0 && timeSinceLastEmitted < intervalMs) {
        // Not due yet; continue
        continue;
      }

      // Generate telemetry
      const effectiveElapsed = lastEmitted > 0 ? (timeSinceLastEmitted / 1000) : profile.reportingIntervalSeconds;

      const { payload, stateUpdates } = buildTelemetryPayload(device, profile, state, {
        timestamp: now,
        elapsedSeconds: effectiveElapsed,
        randomFn: this.randomFn
      });

      // Update state store with new state and emission timestamp
      this.stateStore.updateState(orgId, device.deviceId, {
        ...stateUpdates,
        lastEmittedTimestamp: now.toISOString(),
        lastSimulatedAt: now.toISOString()
      });

      generatedTelemetry.push(payload);

      if (typeof this.onTelemetry === 'function') {
        this.onTelemetry(payload, device);
      }
    }

    return generatedTelemetry;
  }

  /**
   * Starts the simulation interval timer.
   */
  start() {
    if (this.isRunning) {
      logger.warn('FleetSimulator is already running. Ignoring duplicate start call.');
      return;
    }

    this.isRunning = true;
    logger.info(`FleetSimulator started. Fleet size: ${this.devices.length} devices. Interval: ${this.intervalMs}ms.`);

    // Perform initial tick immediately
    this.tick(this.intervalMs / 1000);

    this.timer = setInterval(() => {
      try {
        this.tick(this.intervalMs / 1000);
      } catch (err) {
        logger.error(`Error during simulation tick: ${err.message}`);
      }
    }, this.intervalMs);
  }

  /**
   * Stops the simulation interval timer.
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('FleetSimulator stopped.');
  }

  /**
   * Graceful shutdown handler.
   */
  gracefulShutdown() {
    logger.info('Shutting down FleetSimulator gracefully...');
    this.stop();
  }
}

module.exports = FleetSimulator;

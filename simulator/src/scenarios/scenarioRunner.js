const { getScenarioDefinition } = require('./scenarioDefinitions');
const FleetSimulator = require('../engine/fleetSimulator');
const { round, clamp } = require('../generators/math');
const { createSeededRandom, applyBorderlineSafeValues } = require('../anomalies/anomalyModifiers');
const logger = require('../utils/logger');

class ScenarioRunner {
  /**
   * @param {number|string|Object} scenarioIdOrOptions
   * @param {Object} [options={}]
   */
  constructor(scenarioIdOrOptions, options = {}) {
    let scenarioId = scenarioIdOrOptions;
    let configOpts = { ...options };

    if (typeof scenarioIdOrOptions === 'object' && scenarioIdOrOptions !== null) {
      scenarioId = scenarioIdOrOptions.scenarioId || scenarioIdOrOptions.id || 1;
      configOpts = { ...scenarioIdOrOptions, ...options };
    }

    this.scenarioId = parseInt(scenarioId, 10) || 1;
    this.definition = getScenarioDefinition(this.scenarioId);

    if (!this.definition) {
      throw new Error(`Scenario #${this.scenarioId} is not defined`);
    }

    this.organizationId = configOpts.organizationId || 'default-org';
    this.deviceCount = configOpts.deviceCount || this.definition.deviceCount || 5;
    this.intervalMs = configOpts.intervalMs || 5000;
    this.timeScale = configOpts.timeScale !== undefined ? configOpts.timeScale : 1.0;
    this.transport = configOpts.transport || null;
    this.transportMode = configOpts.transportMode || configOpts.mode || 'console';

    // Deterministic random generator support
    this.seed = configOpts.seed !== undefined ? configOpts.seed : null;
    this.randomFn = this.seed !== null ? createSeededRandom(this.seed) : (configOpts.randomFn || Math.random);

    // Callbacks
    this.onTelemetry = configOpts.onTelemetry || null;
    this.onStageChange = configOpts.onStageChange || null;
    this.onAuthFailure = configOpts.onAuthFailure || null;
    this.onComplete = configOpts.onComplete || null;

    // Runtime state
    this.logicalElapsedSeconds = 0;
    this.currentStageIndex = -1;
    this.executedAuthStages = new Set();
    this.timer = null;
    this.isRunning = false;
    this.isCompleted = false;

    this.initializeSimulator();
  }

  /**
   * Initializes the inner FleetSimulator and configures initial device state.
   */
  initializeSimulator() {
    this.fleetSimulator = new FleetSimulator({
      organizationId: this.organizationId,
      deviceCount: this.deviceCount,
      intervalMs: this.intervalMs,
      randomFn: this.randomFn,
      onTelemetry: (payload, device) => {
        if (typeof this.onTelemetry === 'function') {
          this.onTelemetry(payload, device, this.getContext());
        }
      }
    });

    // Apply scenario-specific device profile configurations if needed
    if (this.scenarioId === 3 && this.definition.targetDeviceIndex !== undefined) {
      // Scenario 3: industrial gateway with initial firmware 1.0.3
      const targetDev = this.fleetSimulator.devices[this.definition.targetDeviceIndex];
      if (targetDev) {
        targetDev.firmwareVersion = this.definition.initialFirmwareVersion || '1.0.3';
        const profile = require('../profiles').getProfile(targetDev.type);
        if (profile) {
          this.fleetSimulator.stateStore.updateState(this.organizationId, targetDev.deviceId, {
            firmware_version: targetDev.firmwareVersion
          });
        }
      }
    }

    // Attach per-device modifier hook to fleet simulator
    for (let i = 0; i < this.fleetSimulator.devices.length; i++) {
      const dev = this.fleetSimulator.devices[i];
      this.fleetSimulator.setDeviceModifier(dev.deviceId, (device, profile, state, ctx) => {
        const stage = this.getStageAt(this.logicalElapsedSeconds);
        return this.calculateDeviceOverrides(device, i, this.logicalElapsedSeconds, stage);
      });
    }
  }

  /**
   * Returns current execution context metadata.
   * @returns {Object}
   */
  getContext() {
    return {
      scenarioId: this.scenarioId,
      scenarioName: this.definition.name,
      logicalElapsedSeconds: this.logicalElapsedSeconds,
      durationSeconds: this.definition.durationSeconds,
      currentStageIndex: this.currentStageIndex,
      currentStage: this.getStageAt(this.logicalElapsedSeconds),
      isCompleted: this.isCompleted
    };
  }

  /**
   * Finds the active stage for the given elapsed seconds.
   * @param {number} elapsedSeconds
   * @returns {Object|null}
   */
  getStageAt(elapsedSeconds) {
    if (!this.definition.stages || this.definition.stages.length === 0) {
      return null;
    }
    for (const stage of this.definition.stages) {
      if (elapsedSeconds >= stage.startOffsetSeconds && elapsedSeconds < stage.endOffsetSeconds) {
        return stage;
      }
    }
    // If at or past end, return last stage
    return this.definition.stages[this.definition.stages.length - 1];
  }

  /**
   * Finds the active stage index.
   * @param {number} elapsedSeconds
   * @returns {number}
   */
  getStageIndexAt(elapsedSeconds) {
    if (!this.definition.stages || this.definition.stages.length === 0) {
      return -1;
    }
    for (let i = 0; i < this.definition.stages.length; i++) {
      const stage = this.definition.stages[i];
      if (elapsedSeconds >= stage.startOffsetSeconds && elapsedSeconds < stage.endOffsetSeconds) {
        return i;
      }
    }
    return this.definition.stages.length - 1;
  }

  /**
   * Computes device-specific metric and metadata overrides for the current stage & elapsed time.
   * 
   * @param {Object} device
   * @param {number} deviceIndex
   * @param {number} elapsedSeconds
   * @param {Object|null} stage
   * @returns {Object} { metricOverrides, metadataOverrides, timestampOverride, anomalyMode, forceEmit }
   */
  calculateDeviceOverrides(device, deviceIndex, elapsedSeconds, stage) {
    if (!stage) {
      return {};
    }

    const overrides = {};

    switch (this.scenarioId) {
      case 1: // Normal Fleet
        return {};

      case 2: { // Single Device Compromise (target: smart_camera at targetDeviceIndex)
        const isTarget = deviceIndex === (this.definition.targetDeviceIndex !== undefined ? this.definition.targetDeviceIndex : 1);
        if (!isTarget) {
          return {};
        }

        if (stage.offSchedule) {
          // Off-schedule reporting: override hour/minute
          const now = new Date(this.fleetSimulator.logicalTime);
          const offDate = new Date(now);
          offDate.setUTCHours(stage.overrideHourUtc || 3, stage.overrideMinuteUtc || 15, 0, 0);
          overrides.timestampOverride = offDate;
          overrides.forceEmit = true;
        }

        if (stage.anomalyMode) {
          overrides.anomalyMode = stage.anomalyMode;
        }
        return overrides;
      }

      case 3: { // Firmware Exploit (target: industrial_gateway at targetDeviceIndex)
        const isTarget = deviceIndex === (this.definition.targetDeviceIndex !== undefined ? this.definition.targetDeviceIndex : 2);
        if (!isTarget) {
          return {};
        }

        const metricOverrides = {};

        if (stage.cpuRamp) {
          const stageDuration = stage.endOffsetSeconds - stage.startOffsetSeconds;
          const stageProgress = stageDuration > 0
            ? clamp((elapsedSeconds - stage.startOffsetSeconds) / stageDuration, 0, 1)
            : 1.0;

          const cpu = stage.cpuRamp.startPercent + stageProgress * (stage.cpuRamp.endPercent - stage.cpuRamp.startPercent);
          metricOverrides.cpu_usage = round(cpu, 1);
        }

        if (stage.memoryOverride !== undefined) {
          metricOverrides.memory_usage = stage.memoryOverride;
        }

        if (stage.anomalyMode) {
          overrides.anomalyMode = stage.anomalyMode;
        }

        overrides.metricOverrides = metricOverrides;
        return overrides;
      }

      case 4: { // Gradual Degradation (target: temperature_sensor at targetDeviceIndex)
        const isTarget = deviceIndex === (this.definition.targetDeviceIndex !== undefined ? this.definition.targetDeviceIndex : 0);
        if (!isTarget) {
          return {};
        }

        if (stage.tempDrift) {
          const { startTemp = 25.0, ratePerMinute = 0.5, maxTemp = 90.0 } = stage.tempDrift;
          const currentTemp = startTemp + (elapsedSeconds / 60.0) * ratePerMinute;
          overrides.metricOverrides = {
            temperature: round(clamp(currentTemp, startTemp, maxTemp), 1)
          };
        }
        return overrides;
      }

      case 5: { // Fleet-Wide Attack (all 5 devices)
        if (stage.anomalyMode) {
          overrides.anomalyMode = stage.anomalyMode;
        }
        return overrides;
      }

      case 6: { // False Positive Validation (safe borderline values for all devices)
        if (stage.borderlineValues) {
          const profile = require('../profiles').getProfile(device.type);
          const state = this.fleetSimulator.stateStore.getOrCreateState(this.organizationId, device.deviceId, profile);
          const borderlineMetrics = applyBorderlineSafeValues({}, profile, state, { randomFn: this.randomFn });
          overrides.metricOverrides = borderlineMetrics;
        }
        return overrides;
      }

      default:
        return {};
    }
  }

  /**
   * Executes simulated auth failures if the current stage requires them and hasn't run yet.
   * 
   * @param {Object} stage
   * @param {number} stageIndex
   */
  async executeAuthBruteForceIfNeeded(stage, stageIndex) {
    if (!stage) return;
    if (!stage.authBruteForce && !stage.authFailuresCount) return;

    const stageKey = `stage_${stageIndex}`;
    if (this.executedAuthStages.has(stageKey)) {
      return;
    }
    this.executedAuthStages.add(stageKey);

    const attemptsCount = stage.authAttemptsCount || stage.authFailuresCount || 10;
    const targetDevices = [];

    if (this.scenarioId === 5) {
      // Fleet-wide attack: target all devices
      targetDevices.push(...this.fleetSimulator.devices);
    } else if (this.scenarioId === 2) {
      // Scenario 2: target smart camera
      const targetIdx = this.definition.targetDeviceIndex !== undefined ? this.definition.targetDeviceIndex : 1;
      if (this.fleetSimulator.devices[targetIdx]) {
        targetDevices.push(this.fleetSimulator.devices[targetIdx]);
      }
    } else if (this.scenarioId === 6) {
      // Scenario 6: false positive validation (4 failed attempts)
      targetDevices.push(this.fleetSimulator.devices[0]);
    }

    for (const dev of targetDevices) {
      let result = { attempts: attemptsCount, rejected: attemptsCount };

      if (this.transport && typeof this.transport.simulateAuthFailures === 'function') {
        try {
          result = await this.transport.simulateAuthFailures(dev, attemptsCount);
        } catch (err) {
          logger.warn(`[ScenarioRunner] Transport simulateAuthFailures error: ${err.message}`);
        }
      }

      logger.debug(`[ScenarioRunner] Simulated auth brute force on '${dev.deviceId}': ${result.rejected}/${result.attempts} rejected.`);

      if (typeof this.onAuthFailure === 'function') {
        this.onAuthFailure(result, dev, this.getContext());
      }
    }
  }

  /**
   * Advances the scenario by `elapsedSeconds` logical time.
   * 
   * @param {number} [elapsedSeconds=5]
   * @param {Date} [currentTime=null]
   * @returns {Promise<Array<Object>>|Array<Object>} Array of generated telemetry payloads
   */
  tick(elapsedSeconds = 5, currentTime = null) {
    const previousStageIndex = this.currentStageIndex;
    const newStageIndex = this.getStageIndexAt(this.logicalElapsedSeconds);
    const currentStage = this.getStageAt(this.logicalElapsedSeconds);

    // Detect stage transition
    if (newStageIndex !== previousStageIndex) {
      const oldStage = previousStageIndex >= 0 ? this.definition.stages[previousStageIndex] : null;
      this.currentStageIndex = newStageIndex;

      logger.info(`[ScenarioRunner] Scenario #${this.scenarioId} stage transition: ${oldStage?.name || 'Start'} -> ${currentStage?.name || 'End'}`);

      if (typeof this.onStageChange === 'function') {
        this.onStageChange(currentStage, oldStage, this.getContext());
      }

      // Check auth brute force trigger
      this.executeAuthBruteForceIfNeeded(currentStage, newStageIndex);
    }

    // Step the inner fleet simulator
    const payloads = this.fleetSimulator.tick(elapsedSeconds, currentTime);

    // Advance logical scenario clock
    this.logicalElapsedSeconds += elapsedSeconds;

    // Check completion condition
    if (this.logicalElapsedSeconds >= this.definition.durationSeconds && !this.isCompleted) {
      this.isCompleted = true;
      logger.info(`[ScenarioRunner] Scenario #${this.scenarioId} ('${this.definition.name}') completed (${this.logicalElapsedSeconds}s elapsed).`);

      if (typeof this.onComplete === 'function') {
        this.onComplete(this.getContext());
      }
    }

    return payloads;
  }

  /**
   * Starts running the scenario on an asynchronous interval timer.
   */
  start() {
    if (this.isRunning) {
      logger.warn('ScenarioRunner is already running.');
      return;
    }

    this.isRunning = true;
    logger.info(`[ScenarioRunner] Starting Scenario #${this.scenarioId} ('${this.definition.name}'). Total duration: ${this.definition.durationSeconds}s.`);

    const effectiveIntervalMs = this.timeScale > 0
      ? Math.max(10, Math.round(this.intervalMs / this.timeScale))
      : this.intervalMs;

    const elapsedPerTick = this.intervalMs / 1000;

    // Perform initial tick
    this.tick(elapsedPerTick);

    this.timer = setInterval(() => {
      try {
        this.tick(elapsedPerTick);
        if (this.isCompleted) {
          this.stop();
        }
      } catch (err) {
        logger.error(`[ScenarioRunner] Tick error: ${err.message}`);
      }
    }, effectiveIntervalMs);
  }

  /**
   * Stops the scenario timer.
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info(`[ScenarioRunner] Stopped Scenario #${this.scenarioId}.`);
  }
}

module.exports = ScenarioRunner;

const config = require('./config');
const FleetSimulator = require('./engine/fleetSimulator');
const { ScenarioRunner } = require('./scenarios');
const MqttTransport = require('./transports/mqttTransport');
const RestTransport = require('./transports/restTransport');
const logger = require('./utils/logger');

function formatTelemetryLog(payload, device, context = null) {
  const metricStrings = Object.entries(payload.metrics)
    .map(([k, v]) => `${k}=${v}`)
    .join('  ');

  const contextTag = context ? ` [Scenario #${context.scenarioId} T+${context.logicalElapsedSeconds}s]` : '';
  return `[TELEMETRY]${contextTag} [${payload.timestamp}] ${payload.deviceId} (${device.type}) -> ${metricStrings} [uptime=${payload.metadata.uptime}s, ip=${payload.metadata.ip}, fw=${payload.metadata.firmware_version || '1.0.0'}]`;
}

function startSimulator() {
  logger.setLevel(config.logLevel);

  console.log('====================================================');
  console.log('  SecureWatch IoT — Telemetry Simulator Engine     ');
  console.log('====================================================');
  console.log(`Organization:     ${config.orgSlug} (${config.organizationId})`);
  console.log(`Device Count:     ${config.deviceCount}`);
  console.log(`Interval:         ${config.intervalMs}ms`);
  console.log(`Simulation Mode:  ${config.simulationMode}`);
  if (config.scenario) {
    console.log(`Scenario:         #${config.scenario}`);
    console.log(`Time Scale:       ${config.timeScale}x`);
  }
  if (config.anomalyMode) {
    console.log(`Anomaly Mode:     ${config.anomalyMode}`);
  }
  if (config.targetDevice) {
    console.log(`Target Device:    ${config.targetDevice}`);
  }
  if (config.seed !== null) {
    console.log(`Seed:             ${config.seed}`);
  }
  console.log(`Target API URL:   ${config.apiUrl}`);
  console.log(`Target MQTT URL:  ${config.mqttUrl}`);
  console.log(`Profiles Loaded:  ${config.deviceProfiles.join(', ')}`);
  console.log('----------------------------------------------------');

  let mqttTransport = null;
  let restTransport = null;

  if (config.simulationMode === 'mqtt') {
    mqttTransport = new MqttTransport({
      mqttUrl: config.mqttUrl,
      orgSlug: config.orgSlug
    });
  } else if (config.simulationMode === 'rest') {
    restTransport = new RestTransport({
      apiUrl: config.apiUrl
    });
  }

  const activeTransport = mqttTransport || restTransport || null;

  const handleTelemetryDispatch = async (payload, device, context = null) => {
    if (config.simulationMode === 'console') {
      console.log(formatTelemetryLog(payload, device, context));
    } else if (config.simulationMode === 'dry-run') {
      logger.debug(`[Dry-Run] Generated telemetry for ${payload.deviceId}`);
    } else if (config.simulationMode === 'mqtt' && mqttTransport) {
      console.log(`[MQTT Publish] ${device.deviceId} -> ${config.orgSlug}/devices/${device.deviceId}/telemetry`);
      await mqttTransport.publish(payload, device);
    } else if (config.simulationMode === 'rest' && restTransport) {
      console.log(`[REST Ingest] ${device.deviceId} -> POST /telemetry/ingest`);
      await restTransport.send(payload, device);
    }
  };

  let runner = null;

  if (config.scenario) {
    // Run declarative attack scenario
    runner = new ScenarioRunner(config.scenario, {
      organizationId: config.organizationId,
      deviceCount: config.deviceCount,
      intervalMs: config.intervalMs,
      timeScale: config.timeScale,
      seed: config.seed,
      transport: activeTransport,
      transportMode: config.simulationMode,
      onTelemetry: handleTelemetryDispatch,
      onStageChange: (newStage, oldStage, ctx) => {
        console.log(`\n>>> [SCENARIO STAGE CHANGE] T+${ctx.logicalElapsedSeconds}s: ${newStage?.name || 'Complete'}`);
      },
      onAuthFailure: (result, dev, ctx) => {
        console.log(`>>> [AUTH BRUTE FORCE] ${dev.deviceId}: ${result.rejected}/${result.attempts} attempts rejected.`);
      },
      onComplete: (ctx) => {
        console.log(`\n====================================================`);
        console.log(`  Scenario #${ctx.scenarioId} '${ctx.scenarioName}' Finished  `);
        console.log(`====================================================`);
      }
    });

    runner.start();
  } else {
    // Run fleet simulator (standard or single anomaly mode)
    const simulator = new FleetSimulator({
      organizationId: config.organizationId,
      deviceCount: config.deviceCount,
      intervalMs: config.intervalMs,
      anomalyMode: config.targetDevice ? null : config.anomalyMode,
      onTelemetry: handleTelemetryDispatch
    });

    if (config.anomalyMode && config.targetDevice) {
      simulator.setDeviceAnomaly(config.targetDevice, config.anomalyMode);
    }

    simulator.start();
    runner = simulator;
  }

  const handleShutdown = (signal) => {
    console.log(`\nReceived ${signal}. Gracefully stopping telemetry simulator...`);
    if (mqttTransport) {
      mqttTransport.close();
    }
    if (runner) {
      if (typeof runner.gracefulShutdown === 'function') {
        runner.gracefulShutdown();
      } else if (typeof runner.stop === 'function') {
        runner.stop();
      }
    }
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  return { runner, mqttTransport, restTransport };
}

if (require.main === module) {
  startSimulator();
}

module.exports = {
  startSimulator,
  FleetSimulator,
  ScenarioRunner,
  MqttTransport,
  RestTransport
};

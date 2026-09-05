const config = require('./config');
const FleetSimulator = require('./engine/fleetSimulator');
const logger = require('./utils/logger');

function formatTelemetryLog(payload, device) {
  const metricStrings = Object.entries(payload.metrics)
    .map(([k, v]) => `${k}=${v}`)
    .join('  ');

  return `[TELEMETRY] [${payload.timestamp}] ${payload.deviceId} (${device.type}) -> ${metricStrings} [uptime=${payload.metadata.uptime}s, ip=${payload.metadata.ip}]`;
}

function startSimulator() {
  logger.setLevel(config.logLevel);

  console.log('====================================================');
  console.log('  SecureWatch IoT — Telemetry Simulator (Phase 5)  ');
  console.log('====================================================');
  console.log(`Organization:     ${config.orgSlug} (${config.organizationId})`);
  console.log(`Device Count:     ${config.deviceCount}`);
  console.log(`Interval:         ${config.intervalMs}ms`);
  console.log(`Simulation Mode:  ${config.simulationMode}`);
  console.log(`Profiles Loaded:  ${config.deviceProfiles.join(', ')}`);
  console.log('----------------------------------------------------');

  const simulator = new FleetSimulator({
    organizationId: config.organizationId,
    deviceCount: config.deviceCount,
    intervalMs: config.intervalMs,
    onTelemetry: (payload, device) => {
      if (config.simulationMode === 'console') {
        console.log(formatTelemetryLog(payload, device));
      } else if (config.simulationMode === 'dry-run') {
        logger.debug(`[Dry-Run] Generated telemetry for ${payload.deviceId}`);
      }
    }
  });

  simulator.start();

  const handleShutdown = (signal) => {
    console.log(`\nReceived ${signal}. Gracefully stopping telemetry simulator...`);
    simulator.gracefulShutdown();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  return simulator;
}

if (require.main === module) {
  startSimulator();
}

module.exports = {
  startSimulator,
  FleetSimulator
};

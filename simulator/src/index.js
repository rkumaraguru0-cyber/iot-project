const config = require('./config');
const FleetSimulator = require('./engine/fleetSimulator');
const MqttTransport = require('./transports/mqttTransport');
const RestTransport = require('./transports/restTransport');
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
  console.log('  SecureWatch IoT — Telemetry Simulator Engine     ');
  console.log('====================================================');
  console.log(`Organization:     ${config.orgSlug} (${config.organizationId})`);
  console.log(`Device Count:     ${config.deviceCount}`);
  console.log(`Interval:         ${config.intervalMs}ms`);
  console.log(`Simulation Mode:  ${config.simulationMode}`);
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

  const simulator = new FleetSimulator({
    organizationId: config.organizationId,
    deviceCount: config.deviceCount,
    intervalMs: config.intervalMs,
    onTelemetry: async (payload, device) => {
      if (config.simulationMode === 'console') {
        console.log(formatTelemetryLog(payload, device));
      } else if (config.simulationMode === 'dry-run') {
        logger.debug(`[Dry-Run] Generated telemetry for ${payload.deviceId}`);
      } else if (config.simulationMode === 'mqtt' && mqttTransport) {
        console.log(`[MQTT Publish] ${device.deviceId} -> ${config.orgSlug}/devices/${device.deviceId}/telemetry`);
        await mqttTransport.publish(payload, device);
      } else if (config.simulationMode === 'rest' && restTransport) {
        console.log(`[REST Ingest] ${device.deviceId} -> POST /telemetry/ingest`);
        await restTransport.send(payload, device);
      }
    }
  });

  simulator.start();

  const handleShutdown = (signal) => {
    console.log(`\nReceived ${signal}. Gracefully stopping telemetry simulator...`);
    if (mqttTransport) {
      mqttTransport.close();
    }
    simulator.gracefulShutdown();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  return { simulator, mqttTransport, restTransport };
}

if (require.main === module) {
  startSimulator();
}

module.exports = {
  startSimulator,
  FleetSimulator,
  MqttTransport,
  RestTransport
};

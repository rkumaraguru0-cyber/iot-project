require('dotenv').config();

function parseCliArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (key.includes('=')) {
        const [k, v] = key.split('=');
        args[k] = v;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args[key] = argv[i + 1];
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

const cliArgs = parseCliArgs();

function parseDuration(val) {
  if (!val) return null;
  if (typeof val === 'number') return val;
  const str = String(val).trim().toLowerCase();
  if (str.endsWith('m')) {
    return parseInt(str.slice(0, -1), 10) * 60;
  }
  if (str.endsWith('s')) {
    return parseInt(str.slice(0, -1), 10);
  }
  return parseInt(str, 10) || null;
}

function parseInterval(val) {
  if (!val) return null;
  if (typeof val === 'number') return val;
  const str = String(val).trim().toLowerCase();
  if (str.endsWith('s')) {
    return parseInt(str.slice(0, -1), 10) * 1000;
  }
  if (str.endsWith('ms')) {
    return parseInt(str.slice(0, -2), 10);
  }
  const num = parseInt(str, 10);
  return num < 100 ? num * 1000 : num;
}

const config = {
  apiUrl: cliArgs['api-url'] || process.env.SIMULATOR_API_URL || 'http://localhost:5000/api/v1',
  mqttUrl: cliArgs['mqtt-url'] || process.env.SIMULATOR_MQTT_URL || 'mqtt://localhost:1883',
  orgSlug: cliArgs['org-slug'] || process.env.ORGANIZATION_SLUG || 'default-org',
  organizationId: cliArgs['org-id'] || process.env.ORGANIZATION_ID || 'default-org',
  deviceCount: Math.max(1, parseInt(cliArgs['device-count'], 10) || parseInt(process.env.SIMULATION_DEVICE_COUNT, 10) || 5),
  intervalMs: Math.max(500, parseInterval(cliArgs.interval) || parseInt(process.env.SIMULATION_INTERVAL_MS, 10) || 5000),
  simulationMode: cliArgs.mode || process.env.SIMULATION_MODE || 'console', // 'console' | 'dry-run' | 'mqtt' | 'rest'
  logLevel: cliArgs['log-level'] || process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'none' : 'info'),
  anomalyMode: cliArgs.anomaly || process.env.SIMULATION_ANOMALY || null,
  scenario: cliArgs.scenario ? parseInt(cliArgs.scenario, 10) : (process.env.SIMULATION_SCENARIO ? parseInt(process.env.SIMULATION_SCENARIO, 10) : null),
  durationSeconds: parseDuration(cliArgs.duration) || (process.env.SIMULATION_DURATION ? parseDuration(process.env.SIMULATION_DURATION) : null),
  targetDevice: cliArgs['target-device'] || process.env.SIMULATION_TARGET_DEVICE || null,
  timeScale: cliArgs['time-scale'] ? parseFloat(cliArgs['time-scale']) : (process.env.SIMULATION_TIME_SCALE ? parseFloat(process.env.SIMULATION_TIME_SCALE) : 1.0),
  seed: cliArgs.seed ? parseInt(cliArgs.seed, 10) : (process.env.SIMULATION_SEED ? parseInt(process.env.SIMULATION_SEED, 10) : null),
  deviceProfiles: [
    'temperature_sensor',
    'smart_camera',
    'industrial_gateway',
    'medical_monitor',
    'smart_lock'
  ],
  parseCliArgs
};

module.exports = config;

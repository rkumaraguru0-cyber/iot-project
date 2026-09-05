require('dotenv').config();

const config = {
  apiUrl: process.env.SIMULATOR_API_URL || 'http://localhost:5000/api/v1',
  mqttUrl: process.env.SIMULATOR_MQTT_URL || 'mqtt://localhost:1883',
  orgSlug: process.env.ORGANIZATION_SLUG || 'default-org',
  deviceCount: parseInt(process.env.SIMULATION_DEVICE_COUNT, 10) || 5,
  intervalMs: parseInt(process.env.SIMULATION_INTERVAL_MS, 10) || 5000,
  deviceProfiles: [
    'temperature_sensor',
    'smart_camera',
    'industrial_gateway',
    'medical_monitor',
    'smart_lock'
  ]
};

module.exports = config;

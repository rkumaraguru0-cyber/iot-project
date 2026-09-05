const temperatureSensorProfile = {
  type: 'temperature_sensor',
  name: 'Temperature Sensor',
  reportingIntervalSeconds: 30,
  metrics: {
    cpu_usage: { min: 5, max: 30, unit: '%', decimals: 1 },
    memory_usage: { min: 20, max: 50, unit: '%', decimals: 1 },
    temperature: { min: 18.0, max: 28.0, unit: '°C', decimals: 1, isContinuous: true, maxDelta: 0.3 },
    battery_level: { min: 0, max: 100, unit: '%', decimals: 2, isBattery: true, drainRatePerInterval: 0.1 },
    network_out: { min: 100, max: 500, unit: 'bytes', decimals: 0 },
    signal_strength: { min: -70, max: -30, unit: 'dBm', decimals: 0 }
  }
};

module.exports = temperatureSensorProfile;

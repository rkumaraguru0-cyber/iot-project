const medicalMonitorProfile = {
  type: 'medical_monitor',
  name: 'Medical Monitor',
  reportingIntervalSeconds: 30,
  metrics: {
    cpu_usage: { min: 10, max: 40, unit: '%', decimals: 1 },
    memory_usage: { min: 25, max: 60, unit: '%', decimals: 1 },
    temperature: { min: 20.0, max: 35.0, unit: '°C', decimals: 1, isContinuous: true, maxDelta: 0.3 },
    battery_level: { min: 0, max: 100, unit: '%', decimals: 2, isBattery: true, drainRatePerInterval: 0.05 },
    signal_strength: { min: -60, max: -20, unit: 'dBm', decimals: 0 },
    error_count: { min: 0, max: 0, unit: 'count', decimals: 0 }
  }
};

module.exports = medicalMonitorProfile;

const smartLockProfile = {
  type: 'smart_lock',
  name: 'Smart Lock',
  reportingIntervalSeconds: 60,
  metrics: {
    cpu_usage: { min: 2, max: 15, unit: '%', decimals: 1 },
    memory_usage: { min: 10, max: 30, unit: '%', decimals: 1 },
    battery_level: { min: 0, max: 100, unit: '%', decimals: 2, isBattery: true, drainRatePerInterval: 0.02 },
    signal_strength: { min: -80, max: -40, unit: 'dBm', decimals: 0 },
    error_count: { min: 0, max: 1, unit: 'count', decimals: 0 }
  }
};

module.exports = smartLockProfile;

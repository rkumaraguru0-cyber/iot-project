const smartCameraProfile = {
  type: 'smart_camera',
  name: 'Smart Camera',
  reportingIntervalSeconds: 30,
  metrics: {
    cpu_usage: { min: 20, max: 60, unit: '%', decimals: 1 },
    memory_usage: { min: 40, max: 75, unit: '%', decimals: 1 },
    temperature: { min: 25.0, max: 45.0, unit: '°C', decimals: 1, isContinuous: true, maxDelta: 0.3 },
    network_out: { min: 5000, max: 50000, unit: 'bytes', decimals: 0 },
    disk_usage: { min: 30, max: 80, unit: '%', decimals: 1 },
    error_count: { min: 0, max: 2, unit: 'count', decimals: 0 }
  }
};

module.exports = smartCameraProfile;

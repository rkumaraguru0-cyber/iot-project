const industrialGatewayProfile = {
  type: 'industrial_gateway',
  name: 'Industrial Gateway',
  reportingIntervalSeconds: 15,
  metrics: {
    cpu_usage: { min: 30, max: 70, unit: '%', decimals: 1 },
    memory_usage: { min: 50, max: 85, unit: '%', decimals: 1 },
    temperature: { min: 20.0, max: 55.0, unit: '°C', decimals: 1, isContinuous: true, maxDelta: 0.3 },
    network_in: { min: 10000, max: 100000, unit: 'bytes', decimals: 0 },
    network_out: { min: 10000, max: 100000, unit: 'bytes', decimals: 0 }
  }
};

module.exports = industrialGatewayProfile;

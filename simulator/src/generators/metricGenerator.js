const { gaussianRandom, randomWalk, clamp, round } = require('./math');

/**
 * Generates normal metrics for a device given its profile and current persistent state.
 * 
 * @param {Object} profile - Device profile definition
 * @param {Object} currentState - Current device state (battery, uptime, current_temp)
 * @param {Object} [options={}] - Options including elapsedSeconds, randomFn
 * @returns {{ metrics: Object, stateUpdates: Object }}
 */
function generateMetrics(profile, currentState, options = {}) {
  if (!profile || !profile.metrics) {
    throw new Error('Valid device profile with metrics configuration is required');
  }

  const randomFn = options.randomFn || Math.random;
  const elapsedSeconds = typeof options.elapsedSeconds === 'number' && options.elapsedSeconds > 0
    ? options.elapsedSeconds
    : (profile.reportingIntervalSeconds || 30);

  const metrics = {};
  const stateUpdates = {};

  // Process all configured metrics in profile
  for (const [metricKey, config] of Object.entries(profile.metrics)) {
    const decimals = config.decimals !== undefined ? config.decimals : 1;

    if (config.isBattery) {
      // Battery calculation: Drain proportionally to elapsed time
      const currentBattery = currentState.battery_level !== undefined ? currentState.battery_level : 100.0;
      
      let newBattery = currentBattery;
      if (currentBattery > 0) {
        const intervalRatio = elapsedSeconds / (profile.reportingIntervalSeconds || 30);
        const drainAmount = (config.drainRatePerInterval || 0.1) * intervalRatio;
        newBattery = Math.max(0, currentBattery - drainAmount);
      } else {
        newBattery = 0;
      }

      newBattery = round(clamp(newBattery, 0, 100), decimals);
      metrics[metricKey] = newBattery;
      stateUpdates.battery_level = newBattery;
    } else if (config.isContinuous && metricKey === 'temperature') {
      // Temperature calculation: Smooth random walk
      const currentTemp = currentState.current_temperature !== undefined
        ? currentState.current_temperature
        : (config.min + config.max) / 2.0;

      const maxDelta = config.maxDelta || 0.3;
      const nextTemp = randomWalk(currentTemp, maxDelta, config.min, config.max, randomFn, decimals);

      metrics[metricKey] = nextTemp;
      stateUpdates.current_temperature = nextTemp;
    } else {
      // Standard Gaussian normal metric
      const value = gaussianRandom(config.min, config.max, randomFn, decimals);
      metrics[metricKey] = value;
    }
  }

  // Uptime progression: update logical elapsed simulation time
  const currentUptime = currentState.uptime !== undefined ? currentState.uptime : 0;
  const nextUptime = Math.round(currentUptime + elapsedSeconds);
  stateUpdates.uptime = nextUptime;

  return {
    metrics,
    stateUpdates
  };
}

module.exports = {
  generateMetrics
};

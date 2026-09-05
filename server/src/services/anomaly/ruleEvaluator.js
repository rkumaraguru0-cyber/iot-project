/**
 * Pure, deterministic rule evaluation engine for IoT telemetry (Phase 7).
 */

/**
 * Checks a single metric reading against a scalar operator.
 * 
 * @param {string} operator
 * @param {any} observed
 * @param {any} threshold
 * @returns {boolean}
 */
function evaluateScalarCondition(operator, observed, threshold) {
  if (observed === undefined || observed === null) {
    return false;
  }

  // Handle set membership operator
  if (operator === 'not_in_list') {
    if (!Array.isArray(threshold)) return false;
    return !threshold.includes(observed);
  }

  // Handle numeric comparison operators
  if (typeof observed !== 'number' || !Number.isFinite(observed)) {
    return false;
  }

  const numThreshold = Number(threshold);
  if (typeof numThreshold !== 'number' || !Number.isFinite(numThreshold)) {
    return false;
  }

  switch (operator) {
    case 'gt':
      return observed > numThreshold;
    case 'gte':
      return observed >= numThreshold;
    case 'lt':
      return observed < numThreshold;
    case 'lte':
      return observed <= numThreshold;
    case 'eq':
      return observed === numThreshold;
    case 'neq':
      return observed !== numThreshold;
    default:
      return false;
  }
}

/**
 * Evaluates rate of change between two consecutive readings.
 * Rate is calculated in units per minute: (delta_metric / delta_minutes).
 * 
 * @param {Object} current - { timestamp, value }
 * @param {Object} previous - { timestamp, value }
 * @param {number} threshold - Rate limit in units/minute
 * @returns {{ isBreach: boolean, rate: number|null }}
 */
function evaluateRateOfChange(current, previous, threshold) {
  if (!current || !previous || current.value === undefined || previous.value === undefined) {
    return { isBreach: false, rate: null };
  }

  if (typeof current.value !== 'number' || !Number.isFinite(current.value) ||
      typeof previous.value !== 'number' || !Number.isFinite(previous.value)) {
    return { isBreach: false, rate: null };
  }

  const currentMs = new Date(current.timestamp).getTime();
  const previousMs = new Date(previous.timestamp).getTime();

  if (Number.isNaN(currentMs) || Number.isNaN(previousMs)) {
    return { isBreach: false, rate: null };
  }

  const deltaSeconds = (currentMs - previousMs) / 1000;
  if (deltaSeconds <= 0 || !Number.isFinite(deltaSeconds)) {
    return { isBreach: false, rate: null };
  }

  // Rate in units per minute
  const deltaMinutes = deltaSeconds / 60;
  const ratePerMinute = Math.abs(current.value - previous.value) / deltaMinutes;

  const numThreshold = Number(threshold);
  if (!Number.isFinite(numThreshold)) {
    return { isBreach: false, rate: ratePerMinute };
  }

  return {
    isBreach: ratePerMinute > numThreshold,
    rate: Number(ratePerMinute.toFixed(2))
  };
}

/**
 * Formats the explanation template with contextual values.
 * 
 * @param {string} template
 * @param {Object} params - { actual, threshold, deviceId, metric }
 * @returns {string}
 */
function formatExplanation(template, params) {
  if (!template) {
    return `Anomaly detected on metric ${params.metric}: observed ${params.actual} vs threshold ${params.threshold}`;
  }

  return template
    .replace(/\{actual\}/g, params.actual !== undefined ? String(params.actual) : 'N/A')
    .replace(/\{threshold\}/g, params.threshold !== undefined ? String(params.threshold) : 'N/A')
    .replace(/\{deviceId\}/g, params.deviceId || 'Unknown Device')
    .replace(/\{metric\}/g, params.metric || 'unknown_metric');
}

/**
 * Evaluates a detection rule against the current telemetry reading and recent history.
 * 
 * @param {Object} rule - AnomalyRule specification
 * @param {Object} currentTelemetry - { timestamp, metrics: {}, deviceId }
 * @param {Array<Object>} [history=[]] - Recent telemetry history (newest first, excluding or including current)
 * @returns {{ isAnomaly: boolean, observedValue: any, thresholdValue: any, explanation: string }}
 */
function evaluateRule(rule, currentTelemetry, history = []) {
  if (!rule || !currentTelemetry || !currentTelemetry.metrics) {
    return {
      isAnomaly: false,
      observedValue: null,
      thresholdValue: rule ? rule.value : null,
      explanation: ''
    };
  }

  const metricName = rule.metric;
  const observedValue = currentTelemetry.metrics[metricName];
  const thresholdValue = rule.value;
  const operator = rule.operator;
  const windowConfig = rule.window || { type: 'none', size: 1, minOccurrences: 1 };
  const deviceId = currentTelemetry.deviceId || (currentTelemetry.device && currentTelemetry.device.deviceId) || 'Device';

  // If the target metric is not present in current payload, rule cannot trigger
  if (observedValue === undefined || observedValue === null) {
    return {
      isAnomaly: false,
      observedValue: null,
      thresholdValue,
      explanation: ''
    };
  }

  // Combine current reading with history: readings ordered newest to oldest
  const fullSeries = [
    { timestamp: currentTelemetry.timestamp, value: observedValue },
    ...history
      .filter((h) => h && h.metrics && h.metrics[metricName] !== undefined && h.metrics[metricName] !== null)
      .map((h) => ({ timestamp: h.timestamp, value: h.metrics[metricName] }))
  ];

  // 1. Rate-of-change operator evaluation
  if (operator === 'rate_exceeds') {
    if (fullSeries.length < 2) {
      // Insufficient history to calculate rate
      return {
        isAnomaly: false,
        observedValue,
        thresholdValue,
        explanation: ''
      };
    }

    const { isBreach, rate } = evaluateRateOfChange(fullSeries[0], fullSeries[1], thresholdValue);

    if (isBreach) {
      const explanation = formatExplanation(rule.explanationTemplate, {
        actual: rate,
        threshold: thresholdValue,
        deviceId,
        metric: metricName
      });

      return {
        isAnomaly: true,
        observedValue: rate,
        thresholdValue,
        explanation
      };
    }

    return {
      isAnomaly: false,
      observedValue: rate !== null ? rate : observedValue,
      thresholdValue,
      explanation: ''
    };
  }

  // 2. Windowed vs Instantaneous scalar evaluation
  const windowType = windowConfig.type || 'none';
  const windowSize = Math.max(1, windowConfig.size || 1);
  const minOccurrences = Math.max(1, windowConfig.minOccurrences || 1);

  if (windowType === 'none' || windowSize === 1) {
    // Instantaneous single-reading evaluation
    const isAnomaly = evaluateScalarCondition(operator, observedValue, thresholdValue);

    const explanation = isAnomaly
      ? formatExplanation(rule.explanationTemplate, {
          actual: observedValue,
          threshold: thresholdValue,
          deviceId,
          metric: metricName
        })
      : '';

    return {
      isAnomaly,
      observedValue,
      thresholdValue,
      explanation
    };
  }

  if (windowType === 'consecutive') {
    if (fullSeries.length < windowSize) {
      return {
        isAnomaly: false,
        observedValue,
        thresholdValue,
        explanation: ''
      };
    }

    // Check if the first `windowSize` consecutive readings all satisfy condition
    const targetSlice = fullSeries.slice(0, windowSize);
    const allMatch = targetSlice.every((item) => evaluateScalarCondition(operator, item.value, thresholdValue));

    if (allMatch) {
      const explanation = formatExplanation(rule.explanationTemplate, {
        actual: observedValue,
        threshold: thresholdValue,
        deviceId,
        metric: metricName
      });

      return {
        isAnomaly: true,
        observedValue,
        thresholdValue,
        explanation
      };
    }

    return {
      isAnomaly: false,
      observedValue,
      thresholdValue,
      explanation: ''
    };
  }

  if (windowType === 'sliding') {
    if (fullSeries.length < windowSize) {
      return {
        isAnomaly: false,
        observedValue,
        thresholdValue,
        explanation: ''
      };
    }

    const targetSlice = fullSeries.slice(0, windowSize);

    if (windowConfig.minOccurrences !== undefined) {
      const breachCount = targetSlice.filter((item) => evaluateScalarCondition(operator, item.value, thresholdValue)).length;
      const isAnomaly = breachCount >= minOccurrences;
      const explanation = isAnomaly
        ? formatExplanation(rule.explanationTemplate, {
            actual: observedValue,
            threshold: thresholdValue,
            deviceId,
            metric: metricName
          })
        : '';

      return {
        isAnomaly,
        observedValue,
        thresholdValue,
        explanation
      };
    }

    // Default sliding window: evaluate sliding average of numeric values
    const numericValues = targetSlice.map((item) => Number(item.value)).filter((v) => !Number.isNaN(v));
    if (numericValues.length === 0) {
      return { isAnomaly: false, observedValue, thresholdValue, explanation: '' };
    }

    const avgValue = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
    const roundedAvg = Number(avgValue.toFixed(2));
    const isAnomaly = evaluateScalarCondition(operator, roundedAvg, thresholdValue);

    const explanation = isAnomaly
      ? formatExplanation(rule.explanationTemplate, {
          actual: roundedAvg,
          threshold: thresholdValue,
          deviceId,
          metric: metricName
        })
      : '';

    return {
      isAnomaly,
      observedValue: roundedAvg,
      thresholdValue,
      explanation
    };
  }

  return {
    isAnomaly: false,
    observedValue,
    thresholdValue,
    explanation: ''
  };
}

module.exports = {
  evaluateScalarCondition,
  evaluateRateOfChange,
  formatExplanation,
  evaluateRule
};

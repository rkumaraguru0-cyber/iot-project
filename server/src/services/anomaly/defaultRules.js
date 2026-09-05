/**
 * Baseline System Anomaly Rules (Phase 7)
 * Seeded as immutable system rules (isSystem: true, organizationId: null)
 */
const DEFAULT_SYSTEM_RULES = [
  {
    ruleId: 'RULE-CPU-HIGH',
    name: 'High CPU Utilization',
    description: 'Triggers when CPU utilization exceeds 85% for 2 consecutive readings',
    category: 'threshold',
    metric: 'cpu_usage',
    operator: 'gt',
    value: 85,
    window: {
      type: 'consecutive',
      size: 2,
      minOccurrences: 2
    },
    cooldownSeconds: 300,
    severity: 'high',
    confidence: 'high',
    deviceTypes: ['*'],
    explanationTemplate: 'CPU utilization of {actual}% exceeded threshold of {threshold}% on device {deviceId}',
    isSystem: true,
    enabled: true,
    organizationId: null
  },
  {
    ruleId: 'RULE-MEM-HIGH',
    name: 'High Memory Consumption',
    description: 'Triggers when memory utilization exceeds 90% for 2 consecutive readings',
    category: 'threshold',
    metric: 'memory_usage',
    operator: 'gt',
    value: 90,
    window: {
      type: 'consecutive',
      size: 2,
      minOccurrences: 2
    },
    cooldownSeconds: 300,
    severity: 'high',
    confidence: 'high',
    deviceTypes: ['*'],
    explanationTemplate: 'Memory consumption of {actual}% exceeded threshold of {threshold}% on device {deviceId}',
    isSystem: true,
    enabled: true,
    organizationId: null
  },
  {
    ruleId: 'RULE-TEMP-CRITICAL',
    name: 'Extreme Operating Temperature',
    description: 'Triggers immediately when hardware operating temperature exceeds 60°C',
    category: 'threshold',
    metric: 'temperature',
    operator: 'gt',
    value: 60,
    window: {
      type: 'none',
      size: 1,
      minOccurrences: 1
    },
    cooldownSeconds: 300,
    severity: 'critical',
    confidence: 'high',
    deviceTypes: [
      'temperature_sensor',
      'smart_camera',
      'industrial_gateway',
      'medical_monitor'
    ],
    explanationTemplate: 'Critical temperature of {actual}°C exceeded maximum safety threshold of {threshold}°C on device {deviceId}',
    isSystem: true,
    enabled: true,
    organizationId: null
  },
  {
    ruleId: 'RULE-TEMP-SPIKE',
    name: 'Rapid Temperature Spike',
    description: 'Triggers when temperature rate of change exceeds 10°C/minute across a 3-sample sliding window',
    category: 'rate',
    metric: 'temperature',
    operator: 'rate_exceeds',
    value: 10,
    window: {
      type: 'sliding',
      size: 3,
      minOccurrences: 1
    },
    cooldownSeconds: 300,
    severity: 'high',
    confidence: 'medium',
    deviceTypes: [
      'temperature_sensor',
      'smart_camera',
      'industrial_gateway',
      'medical_monitor'
    ],
    explanationTemplate: 'Rapid temperature spike of {actual}°C/min exceeded allowable rate threshold of {threshold}°C/min on device {deviceId}',
    isSystem: true,
    enabled: true,
    organizationId: null
  },
  {
    ruleId: 'RULE-BATTERY-LOW',
    name: 'Critical Battery Level',
    description: 'Triggers immediately when battery level drops below 15%',
    category: 'threshold',
    metric: 'battery_level',
    operator: 'lt',
    value: 15,
    window: {
      type: 'none',
      size: 1,
      minOccurrences: 1
    },
    cooldownSeconds: 600,
    severity: 'medium',
    confidence: 'high',
    deviceTypes: [
      'temperature_sensor',
      'medical_monitor',
      'smart_lock'
    ],
    explanationTemplate: 'Battery level depleted to {actual}% below minimum threshold of {threshold}% on device {deviceId}',
    isSystem: true,
    enabled: true,
    organizationId: null
  }
];

module.exports = {
  DEFAULT_SYSTEM_RULES
};

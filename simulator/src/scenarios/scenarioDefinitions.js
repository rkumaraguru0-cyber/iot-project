/**
 * Declarative Scenario Definitions for Simulator v3 (PRD §11.6)
 */

const SCENARIO_DEFINITIONS = {
  1: {
    id: 1,
    name: 'Normal Fleet',
    description: '10 mixed-type devices operating with standard Gaussian baseline telemetry for 30 minutes with zero intentional anomalies.',
    deviceCount: 10,
    durationSeconds: 1800, // 30 minutes
    isMultiDevice: true,
    stages: [
      {
        startOffsetSeconds: 0,
        endOffsetSeconds: 1800,
        type: 'normal'
      }
    ]
  },
  2: {
    id: 2,
    name: 'Single Device Compromise',
    description: '1 smart camera undergoes a 4-stage sequential compromise timeline: auth brute force -> off-schedule reporting -> network egress spike -> firmware version tamper.',
    deviceCount: 5,
    targetDeviceIndex: 1, // smart_camera (DEV-SC-002 / index 1)
    targetDeviceType: 'smart_camera',
    durationSeconds: 1200, // 20 minutes
    stages: [
      {
        startOffsetSeconds: 0,
        endOffsetSeconds: 300,
        name: 'Auth Brute Force',
        authBruteForce: true,
        authAttemptsCount: 10,
        timeWindowMinutes: 2
      },
      {
        startOffsetSeconds: 300,
        endOffsetSeconds: 600,
        name: 'Off-Schedule Reporting',
        offSchedule: true,
        overrideHourUtc: 3, // 03:15 UTC
        overrideMinuteUtc: 15
      },
      {
        startOffsetSeconds: 600,
        endOffsetSeconds: 900,
        name: 'Network Egress Spike',
        anomalyMode: 'network-spike'
      },
      {
        startOffsetSeconds: 900,
        endOffsetSeconds: 1200,
        name: 'Firmware Version Tamper',
        anomalyMode: 'firmware-tamper'
      }
    ]
  },
  3: {
    id: 3,
    name: 'Firmware Exploit',
    description: '1 industrial gateway running vulnerable firmware shows escalating resource exhaustion: CPU ramp (45% -> 95%) -> memory exhaustion (>90%) -> network egress spike.',
    deviceCount: 5,
    targetDeviceIndex: 2, // industrial_gateway (DEV-IG-003 / index 2)
    targetDeviceType: 'industrial_gateway',
    initialFirmwareVersion: '1.0.3',
    durationSeconds: 1500, // 25 minutes
    stages: [
      {
        startOffsetSeconds: 0,
        endOffsetSeconds: 900, // T+0 to T+15m
        name: 'Gradual CPU Ramp',
        cpuRamp: {
          startPercent: 45.0,
          endPercent: 95.0
        }
      },
      {
        startOffsetSeconds: 900, // T+15m to T+20m
        endOffsetSeconds: 1200,
        name: 'Memory Exhaustion',
        cpuRamp: {
          startPercent: 95.0,
          endPercent: 97.0
        },
        memoryOverride: 96.5
      },
      {
        startOffsetSeconds: 1200, // T+20m to T+25m
        endOffsetSeconds: 1500,
        name: 'Network Egress Spike',
        cpuRamp: {
          startPercent: 95.0,
          endPercent: 97.0
        },
        memoryOverride: 96.5,
        anomalyMode: 'network-spike'
      }
    ]
  },
  4: {
    id: 4,
    name: 'Gradual Degradation',
    description: '1 temperature sensor temperature drifts +0.5°C/min from 25°C to 40°C at 30m, crosses 60°C at 70m, crosses 85°C at 120m, and reaches 90°C at 130m.',
    deviceCount: 5,
    targetDeviceIndex: 0, // temperature_sensor (DEV-TS-001 / index 0)
    targetDeviceType: 'temperature_sensor',
    durationSeconds: 7800, // 130 minutes (7,800s)
    stages: [
      {
        startOffsetSeconds: 0,
        endOffsetSeconds: 7800,
        name: 'Linear Temperature Drift',
        tempDrift: {
          startTemp: 25.0,
          ratePerMinute: 0.5,
          maxTemp: 90.0
        }
      }
    ]
  },
  5: {
    id: 5,
    name: 'Fleet-Wide Attack',
    description: '5 devices simultaneously subjected to auth brute force (10 failed attempts each) followed by simultaneous network egress spikes (50x baseline).',
    deviceCount: 5,
    isMultiDeviceAttack: true,
    targetDeviceIndices: [0, 1, 2, 3, 4],
    durationSeconds: 600, // 10 minutes
    stages: [
      {
        startOffsetSeconds: 0,
        endOffsetSeconds: 120, // T+0m to T+2m
        name: 'Synchronized Auth Brute Force',
        authBruteForce: true,
        authAttemptsCount: 10
      },
      {
        startOffsetSeconds: 120, // T+2m to T+10m
        endOffsetSeconds: 600,
        name: 'Synchronized Network Spikes',
        anomalyMode: 'network-spike'
      }
    ]
  },
  6: {
    id: 6,
    name: 'False Positive Validation',
    description: 'Generates borderline metric values strictly within safe thresholds (CPU: 80-84%, Temp: 55-58°C, Memory: 85-88%, Battery: 20-25%, 4 auth failures) with zero rules triggered.',
    deviceCount: 5,
    isBorderlineSafe: true,
    durationSeconds: 600, // 10 minutes
    stages: [
      {
        startOffsetSeconds: 0,
        endOffsetSeconds: 600,
        name: 'Borderline Safe Operations',
        borderlineValues: {
          cpu_usage: [80.0, 84.0],
          temperature: [55.0, 58.0],
          memory_usage: [85.0, 88.0],
          battery_level: [20.0, 25.0]
        },
        authFailuresCount: 4 // Exactly 4 failed attempts (< 5 in 10 min window)
      }
    ]
  }
};

/**
 * Returns scenario definition by ID (1 to 6).
 * 
 * @param {number|string} scenarioId
 * @returns {Object|null}
 */
function getScenarioDefinition(scenarioId) {
  const num = parseInt(scenarioId, 10);
  return SCENARIO_DEFINITIONS[num] || null;
}

module.exports = {
  SCENARIO_DEFINITIONS,
  getScenarioDefinition
};

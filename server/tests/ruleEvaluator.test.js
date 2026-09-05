const { evaluateRule } = require('../src/services/anomaly/ruleEvaluator');

describe('RuleEvaluator (Phase 7)', () => {
  const baseTimestamp = new Date('2026-03-01T12:00:00.000Z');

  describe('Comparison Operators (Instant / none window)', () => {
    it('should evaluate gt (greater than) operator correctly', () => {
      const rule = {
        ruleId: 'RULE-GT',
        metric: 'cpu_usage',
        operator: 'gt',
        value: 80,
        window: { type: 'none' }
      };

      const triggered = evaluateRule(rule, {
        timestamp: baseTimestamp,
        metrics: { cpu_usage: 85 }
      });
      expect(triggered.isAnomaly).toBe(true);
      expect(triggered.observedValue).toBe(85);
      expect(triggered.thresholdValue).toBe(80);

      const notTriggered = evaluateRule(rule, {
        timestamp: baseTimestamp,
        metrics: { cpu_usage: 75 }
      });
      expect(notTriggered.isAnomaly).toBe(false);
      expect(notTriggered.observedValue).toBe(75);
    });

    it('should evaluate gte (greater than or equal) operator correctly', () => {
      const rule = {
        ruleId: 'RULE-GTE',
        metric: 'temperature',
        operator: 'gte',
        value: 60,
        window: { type: 'none' }
      };

      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { temperature: 60 } }).isAnomaly).toBe(true);
      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { temperature: 60.1 } }).isAnomaly).toBe(true);
      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { temperature: 59.9 } }).isAnomaly).toBe(false);
    });

    it('should evaluate lt (less than) operator correctly', () => {
      const rule = {
        ruleId: 'RULE-LT',
        metric: 'battery_level',
        operator: 'lt',
        value: 15,
        window: { type: 'none' }
      };

      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { battery_level: 10 } }).isAnomaly).toBe(true);
      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { battery_level: 15 } }).isAnomaly).toBe(false);
    });

    it('should evaluate lte (less than or equal) operator correctly', () => {
      const rule = {
        ruleId: 'RULE-LTE',
        metric: 'disk_space',
        operator: 'lte',
        value: 10,
        window: { type: 'none' }
      };

      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { disk_space: 10 } }).isAnomaly).toBe(true);
      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { disk_space: 9 } }).isAnomaly).toBe(true);
      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { disk_space: 11 } }).isAnomaly).toBe(false);
    });

    it('should evaluate eq (equal) operator correctly', () => {
      const rule = {
        ruleId: 'RULE-EQ',
        metric: 'error_code',
        operator: 'eq',
        value: 500,
        window: { type: 'none' }
      };

      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { error_code: 500 } }).isAnomaly).toBe(true);
      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { error_code: 200 } }).isAnomaly).toBe(false);
    });

    it('should evaluate neq (not equal) operator correctly', () => {
      const rule = {
        ruleId: 'RULE-NEQ',
        metric: 'status_code',
        operator: 'neq',
        value: 1,
        window: { type: 'none' }
      };

      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { status_code: 0 } }).isAnomaly).toBe(true);
      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { status_code: 1 } }).isAnomaly).toBe(false);
    });

    it('should evaluate not_in_list operator correctly', () => {
      const rule = {
        ruleId: 'RULE-NOT-IN-LIST',
        metric: 'operational_mode',
        operator: 'not_in_list',
        value: ['normal', 'standby', 'charging'],
        window: { type: 'none' }
      };

      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { operational_mode: 'overheating' } }).isAnomaly).toBe(true);
      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { operational_mode: 'normal' } }).isAnomaly).toBe(false);
    });
  });

  describe('Rate Calculation (rate_exceeds)', () => {
    const rule = {
      ruleId: 'RULE-TEMP-SPIKE',
      metric: 'temperature',
      operator: 'rate_exceeds',
      value: 10, // 10 degrees per minute
      window: { type: 'sliding', size: 3 }
    };

    it('should trigger when rate exceeds threshold', () => {
      const prevTimestamp = new Date(baseTimestamp.getTime() - 60000); // 1 minute ago
      const history = [
        { timestamp: prevTimestamp, metrics: { temperature: 25 } }
      ];

      const current = {
        timestamp: baseTimestamp,
        metrics: { temperature: 40 } // +15 in 1 minute -> rate = 15/min > 10/min
      };

      const result = evaluateRule(rule, current, history);
      expect(result.isAnomaly).toBe(true);
      expect(result.observedValue).toBe(15);
      expect(result.thresholdValue).toBe(10);
      expect(result.explanation).toContain('temperature');
      expect(result.explanation).toContain('15');
    });

    it('should not trigger when rate is below threshold', () => {
      const prevTimestamp = new Date(baseTimestamp.getTime() - 60000);
      const history = [
        { timestamp: prevTimestamp, metrics: { temperature: 25 } }
      ];

      const current = {
        timestamp: baseTimestamp,
        metrics: { temperature: 30 } // +5 in 1 minute -> rate = 5/min <= 10/min
      };

      const result = evaluateRule(rule, current, history);
      expect(result.isAnomaly).toBe(false);
    });

    it('should handle zero or invalid time delta cleanly without division by zero', () => {
      const history = [
        { timestamp: baseTimestamp, metrics: { temperature: 25 } }
      ];

      const current = {
        timestamp: baseTimestamp, // Same timestamp -> deltaMs = 0
        metrics: { temperature: 40 }
      };

      const result = evaluateRule(rule, current, history);
      expect(result.isAnomaly).toBe(false);
    });

    it('should return isAnomaly: false when no previous telemetry history exists', () => {
      const current = {
        timestamp: baseTimestamp,
        metrics: { temperature: 50 }
      };

      const result = evaluateRule(rule, current, []);
      expect(result.isAnomaly).toBe(false);
    });
  });

  describe('Consecutive Window Evaluation', () => {
    const rule = {
      ruleId: 'RULE-CONSEC-CPU',
      metric: 'cpu_usage',
      operator: 'gt',
      value: 85,
      window: { type: 'consecutive', size: 2 }
    };

    it('should trigger when current + previous readings all exceed threshold', () => {
      const history = [
        { timestamp: new Date(baseTimestamp.getTime() - 30000), metrics: { cpu_usage: 90 } }
      ];

      const current = {
        timestamp: baseTimestamp,
        metrics: { cpu_usage: 88 }
      };

      const result = evaluateRule(rule, current, history);
      expect(result.isAnomaly).toBe(true);
      expect(result.observedValue).toBe(88);
      expect(result.explanation).toContain('cpu_usage');
      expect(result.explanation).toContain('88');
    });

    it('should not trigger if previous reading was within normal range', () => {
      const history = [
        { timestamp: new Date(baseTimestamp.getTime() - 30000), metrics: { cpu_usage: 40 } }
      ];

      const current = {
        timestamp: baseTimestamp,
        metrics: { cpu_usage: 88 }
      };

      const result = evaluateRule(rule, current, history);
      expect(result.isAnomaly).toBe(false);
    });

    it('should not trigger if history is insufficient for window size', () => {
      const current = {
        timestamp: baseTimestamp,
        metrics: { cpu_usage: 95 }
      };

      const result = evaluateRule(rule, current, []);
      expect(result.isAnomaly).toBe(false);
    });
  });

  describe('Sliding Window Evaluation', () => {
    const rule = {
      ruleId: 'RULE-SLIDING-TEMP',
      metric: 'temperature',
      operator: 'gt',
      value: 50,
      window: { type: 'sliding', size: 3 }
    };

    it('should trigger when sliding window average exceeds threshold', () => {
      const history = [
        { timestamp: new Date(baseTimestamp.getTime() - 60000), metrics: { temperature: 48 } },
        { timestamp: new Date(baseTimestamp.getTime() - 30000), metrics: { temperature: 52 } }
      ];

      const current = {
        timestamp: baseTimestamp,
        metrics: { temperature: 56 } // Avg: (48 + 52 + 56)/3 = 52 > 50
      };

      const result = evaluateRule(rule, current, history);
      expect(result.isAnomaly).toBe(true);
      expect(result.observedValue).toBe(52);
    });

    it('should not trigger when sliding window average is below threshold', () => {
      const history = [
        { timestamp: new Date(baseTimestamp.getTime() - 60000), metrics: { temperature: 30 } },
        { timestamp: new Date(baseTimestamp.getTime() - 30000), metrics: { temperature: 40 } }
      ];

      const current = {
        timestamp: baseTimestamp,
        metrics: { temperature: 55 } // Avg: (30 + 40 + 55)/3 = 41.67 <= 50
      };

      const result = evaluateRule(rule, current, history);
      expect(result.isAnomaly).toBe(false);
    });
  });

  describe('Edge Cases and Malformed Data Handling', () => {
    const rule = {
      ruleId: 'RULE-TEST',
      metric: 'cpu_usage',
      operator: 'gt',
      value: 80,
      window: { type: 'none' }
    };

    it('should return isAnomaly: false when metric is missing in telemetry', () => {
      const result = evaluateRule(rule, {
        timestamp: baseTimestamp,
        metrics: { memory_usage: 95 } // cpu_usage missing
      });

      expect(result.isAnomaly).toBe(false);
      expect(result.observedValue).toBeNull();
    });

    it('should return isAnomaly: false when metric value is null or undefined', () => {
      const result = evaluateRule(rule, {
        timestamp: baseTimestamp,
        metrics: { cpu_usage: null }
      });

      expect(result.isAnomaly).toBe(false);
    });

    it('should return isAnomaly: false when metric value is NaN or Infinity', () => {
      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { cpu_usage: NaN } }).isAnomaly).toBe(false);
      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { cpu_usage: Infinity } }).isAnomaly).toBe(false);
      expect(evaluateRule(rule, { timestamp: baseTimestamp, metrics: { cpu_usage: -Infinity } }).isAnomaly).toBe(false);
    });

    it('should handle null/missing telemetry or rule gracefully', () => {
      expect(evaluateRule(null, null).isAnomaly).toBe(false);
      expect(evaluateRule(rule, null).isAnomaly).toBe(false);
      expect(evaluateRule(null, { metrics: { cpu_usage: 90 } }).isAnomaly).toBe(false);
    });
  });
});

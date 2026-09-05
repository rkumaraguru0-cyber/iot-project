const mongoose = require('mongoose');
const anomalyService = require('../src/services/anomaly.service');
const { AnomalyRule, Anomaly, Device, Telemetry } = require('../src/models');
const telemetryService = require('../src/services/telemetry.service');

describe('AnomalyService Integration (Phase 7)', () => {
  const orgId = new mongoose.Types.ObjectId();
  const deviceId = 'DEV-ANOM-001';

  beforeEach(() => {
    anomalyService.buffer.clear();
    anomalyService.cooldown.clear();
    jest.clearAllMocks();
  });

  describe('seedDefaultRules', () => {
    it('should seed 5 default system rules idempotently', async () => {
      const mockFindOneAndUpdate = jest.spyOn(AnomalyRule, 'findOneAndUpdate').mockResolvedValue({});

      await anomalyService.seedDefaultRules();

      expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(5);
    });
  });

  describe('resolveActiveRules', () => {
    it('should resolve both system rules and organization-owned rules matching device type', async () => {
      const mockRules = [
        { ruleId: 'RULE-CPU-HIGH', isSystem: true, deviceTypes: ['*'], enabled: true },
        { ruleId: 'RULE-TEMP-CRITICAL', isSystem: true, deviceTypes: ['temperature_sensor'], enabled: true },
        { ruleId: 'RULE-CUSTOM-01', organizationId: orgId, isSystem: false, deviceTypes: ['temperature_sensor'], enabled: true }
      ];

      const mockFind = jest.spyOn(AnomalyRule, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRules)
      });

      const rules = await anomalyService.resolveActiveRules({
        _id: new mongoose.Types.ObjectId(),
        organizationId: orgId,
        type: 'temperature_sensor',
        deviceId
      });

      expect(rules).toHaveLength(3);
      expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
        enabled: true,
        $or: [
          { isSystem: true },
          { organizationId: orgId }
        ]
      }));
    });
  });

  describe('processTelemetry & Anomaly Persistence', () => {
    const mockDeviceContext = {
      _id: new mongoose.Types.ObjectId(),
      organizationId: orgId,
      deviceId: 'DEV-ANOM-001',
      type: 'temperature_sensor'
    };

    it('should detect anomaly and persist immutable Anomaly record', async () => {
      const activeRules = [
        {
          _id: new mongoose.Types.ObjectId(),
          ruleId: 'RULE-TEMP-CRITICAL',
          name: 'Critical Temperature Threshold',
          category: 'threshold',
          metric: 'temperature',
          operator: 'gt',
          value: 60,
          window: { type: 'none' },
          cooldownSeconds: 300,
          severity: 'critical',
          confidence: 'high',
          explanationTemplate: 'Temperature exceeded critical safety limits'
        }
      ];

      jest.spyOn(anomalyService, 'resolveActiveRules').mockResolvedValue(activeRules);
      const mockAnomalyCreate = jest.spyOn(Anomaly, 'create').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        ruleId: 'RULE-TEMP-CRITICAL',
        severity: 'critical'
      });
      jest.spyOn(AnomalyRule, 'updateOne').mockResolvedValue({ acknowledged: true });

      const rawTelemetry = {
        _id: new mongoose.Types.ObjectId(),
        timestamp: new Date(),
        metrics: { temperature: 75.5 }
      };

      const created = await anomalyService.processTelemetry(mockDeviceContext, rawTelemetry);

      expect(created).toHaveLength(1);
      expect(mockAnomalyCreate).toHaveBeenCalledWith(expect.objectContaining({
        organizationId: orgId,
        deviceId: mockDeviceContext._id,
        ruleId: 'RULE-TEMP-CRITICAL',
        severity: 'critical',
        observedValue: 75.5,
        thresholdValue: 60
      }));
    });

    it('should suppress duplicate anomalies during configured cooldown', async () => {
      const activeRules = [
        {
          _id: new mongoose.Types.ObjectId(),
          ruleId: 'RULE-TEMP-CRITICAL',
          name: 'Critical Temperature',
          category: 'threshold',
          metric: 'temperature',
          operator: 'gt',
          value: 60,
          window: { type: 'none' },
          cooldownSeconds: 300,
          severity: 'critical',
          confidence: 'high'
        }
      ];

      jest.spyOn(anomalyService, 'resolveActiveRules').mockResolvedValue(activeRules);
      const mockAnomalyCreate = jest.spyOn(Anomaly, 'create').mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
      jest.spyOn(AnomalyRule, 'updateOne').mockResolvedValue({ acknowledged: true });

      const rawTelemetry = {
        _id: new mongoose.Types.ObjectId(),
        timestamp: new Date(),
        metrics: { temperature: 75.5 }
      };

      // 1st time -> created
      const first = await anomalyService.processTelemetry(mockDeviceContext, rawTelemetry);
      expect(first).toHaveLength(1);
      expect(mockAnomalyCreate).toHaveBeenCalledTimes(1);

      // 2nd time within cooldown -> suppressed
      const second = await anomalyService.processTelemetry(mockDeviceContext, rawTelemetry);
      expect(second).toHaveLength(0);
      expect(mockAnomalyCreate).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should buffer telemetry history for consecutive window evaluation', async () => {
      const activeRules = [
        {
          _id: new mongoose.Types.ObjectId(),
          ruleId: 'RULE-CPU-HIGH',
          name: 'High CPU',
          metric: 'cpu_usage',
          operator: 'gt',
          value: 85,
          window: { type: 'consecutive', size: 2 },
          cooldownSeconds: 300,
          severity: 'high'
        }
      ];

      jest.spyOn(anomalyService, 'resolveActiveRules').mockResolvedValue(activeRules);
      const mockAnomalyCreate = jest.spyOn(Anomaly, 'create').mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
      jest.spyOn(AnomalyRule, 'updateOne').mockResolvedValue({ acknowledged: true });

      // First reading > 85 -> Not enough history for consecutive 2 -> 0 anomalies
      await anomalyService.processTelemetry(mockDeviceContext, {
        _id: new mongoose.Types.ObjectId(),
        timestamp: new Date('2026-03-01T12:00:00Z'),
        metrics: { cpu_usage: 90 }
      });
      expect(mockAnomalyCreate).not.toHaveBeenCalled();

      // Second reading > 85 -> consecutive 2 met -> 1 anomaly created
      await anomalyService.processTelemetry(mockDeviceContext, {
        _id: new mongoose.Types.ObjectId(),
        timestamp: new Date('2026-03-01T12:00:30Z'),
        metrics: { cpu_usage: 92 }
      });
      expect(mockAnomalyCreate).toHaveBeenCalledTimes(1);
    });
  });
});

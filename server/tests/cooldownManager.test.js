const cooldownManager = require('../src/services/anomaly/cooldownManager');

describe('CooldownManager (Phase 7)', () => {
  beforeEach(() => {
    cooldownManager.clear();
  });

  it('should not suppress on initial trigger and record it', () => {
    const deviceId = 'DEV-001';
    const ruleId = 'RULE-CPU-HIGH';

    expect(cooldownManager.isSuppressed(deviceId, ruleId, 300)).toBe(false);

    cooldownManager.recordTrigger(deviceId, ruleId);

    expect(cooldownManager.isSuppressed(deviceId, ruleId, 300)).toBe(true);
  });

  it('should suppress repeated triggers within cooldown window', () => {
    const deviceId = 'DEV-001';
    const ruleId = 'RULE-CPU-HIGH';

    cooldownManager.recordTrigger(deviceId, ruleId);

    expect(cooldownManager.isSuppressed(deviceId, ruleId, 300)).toBe(true);
    expect(cooldownManager.isSuppressed(deviceId, ruleId, 60)).toBe(true);
  });

  it('should not suppress when cooldown has expired', () => {
    const deviceId = 'DEV-001';
    const ruleId = 'RULE-CPU-HIGH';

    // Record trigger 10 minutes ago
    const pastTime = Date.now() - (600 * 1000);
    cooldownManager.cooldowns.set(`${deviceId.toUpperCase()}:${ruleId.toUpperCase()}`, pastTime);

    // Cooldown is 300s (5m) -> expired
    expect(cooldownManager.isSuppressed(deviceId, ruleId, 300)).toBe(false);
  });

  it('should isolate cooldowns per device and rule combination', () => {
    cooldownManager.recordTrigger('DEV-001', 'RULE-A');

    expect(cooldownManager.isSuppressed('DEV-001', 'RULE-A', 300)).toBe(true);
    expect(cooldownManager.isSuppressed('DEV-001', 'RULE-B', 300)).toBe(false);
    expect(cooldownManager.isSuppressed('DEV-002', 'RULE-A', 300)).toBe(false);
  });

  it('should clean up expired entries correctly', () => {
    const pastTime = Date.now() - (1000 * 1000);
    cooldownManager.cooldowns.set('DEV-OLD:RULE-1', pastTime);
    cooldownManager.cooldowns.set('DEV-NEW:RULE-1', Date.now());

    expect(cooldownManager.size()).toBe(2);

    cooldownManager.cleanupExpired(300);

    expect(cooldownManager.size()).toBe(1);
    expect(cooldownManager.cooldowns.has('DEV-NEW:RULE-1')).toBe(true);
  });
});

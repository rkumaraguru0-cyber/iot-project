/**
 * In-memory cooldown manager for alert storm suppression (Phase 7).
 * Prevents redundant anomaly persistence during configured rule cooldown periods.
 */

const MAX_COOLDOWN_ENTRIES = 10000;

class CooldownManager {
  constructor() {
    // Map<`${deviceId}:${ruleId}`, lastTriggeredTimestampMs>
    this.cooldowns = new Map();
  }

  /**
   * Builds the lookup key for device and rule.
   * @param {string} deviceId
   * @param {string} ruleId
   * @returns {string}
   */
  makeKey(deviceId, ruleId) {
    return `${(deviceId || '').toString().toUpperCase()}:${(ruleId || '').toString().toUpperCase()}`;
  }

  /**
   * Checks if an anomaly trigger is currently suppressed by cooldown.
   * 
   * @param {string} deviceId
   * @param {string} ruleId
   * @param {number} cooldownSeconds
   * @param {number} [nowMs=Date.now()]
   * @returns {boolean} True if suppressed (in cooldown), False if allowed
   */
  isSuppressed(deviceId, ruleId, cooldownSeconds = 300, nowMs = Date.now()) {
    const key = this.makeKey(deviceId, ruleId);
    const lastTriggered = this.cooldowns.get(key);

    if (!lastTriggered) {
      return false;
    }

    const cooldownDurationMs = Math.max(0, cooldownSeconds) * 1000;
    return (nowMs - lastTriggered) < cooldownDurationMs;
  }

  /**
   * Records a new triggered anomaly timestamp.
   * 
   * @param {string} deviceId
   * @param {string} ruleId
   * @param {number} [nowMs=Date.now()]
   */
  recordTrigger(deviceId, ruleId, nowMs = Date.now()) {
    const key = this.makeKey(deviceId, ruleId);

    // Bounded map protection
    if (!this.cooldowns.has(key) && this.cooldowns.size >= MAX_COOLDOWN_ENTRIES) {
      this.evictOldest();
    }

    this.cooldowns.set(key, nowMs);
  }

  /**
   * Evicts the oldest entries from the cache when nearing capacity.
   */
  evictOldest() {
    const firstKey = this.cooldowns.keys().next().value;
    if (firstKey) {
      this.cooldowns.delete(firstKey);
    }
  }

  /**
   * Cleans up expired cooldown entries based on their maximum age.
   * @param {number} [cooldownSeconds=300]
   * @param {number} [nowMs=Date.now()]
   */
  cleanupExpired(cooldownSeconds = 300, nowMs = Date.now()) {
    const maxAgeMs = Math.max(0, cooldownSeconds) * 1000;
    for (const [key, timestamp] of this.cooldowns.entries()) {
      if (nowMs - timestamp >= maxAgeMs) {
        this.cooldowns.delete(key);
      }
    }
  }

  /**
   * Clears the in-memory cooldown state (for testing).
   */
  clear() {
    this.cooldowns.clear();
  }

  /**
   * Returns current count of active cooldown entries.
   * @returns {number}
   */
  size() {
    return this.cooldowns.size;
  }
}

module.exports = new CooldownManager();

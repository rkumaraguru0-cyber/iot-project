/**
 * In-memory rolling history buffer for device telemetry readings (Phase 7).
 * Maintains up to 20 most recent readings per device for windowed & rate-of-change evaluations.
 */

const MAX_READINGS_PER_DEVICE = 20;
const MAX_DEVICES_IN_BUFFER = 5000;

class TelemetryBuffer {
  constructor(maxReadings = MAX_READINGS_PER_DEVICE) {
    this.maxReadings = maxReadings;
    // Map<deviceId, Array<{ timestamp, metrics, metadata }>>
    this.buffer = new Map();
  }

  /**
   * Appends a new telemetry reading to the device's rolling buffer.
   * Readings are stored newest-first.
   * 
   * @param {string} deviceId
   * @param {Object} telemetry - { timestamp, metrics, metadata }
   */
  push(deviceId, telemetry) {
    if (!deviceId || !telemetry || !telemetry.metrics) {
      return;
    }

    const key = deviceId.toString().toUpperCase();

    // Guard total buffer memory size
    if (!this.buffer.has(key) && this.buffer.size >= MAX_DEVICES_IN_BUFFER) {
      const firstKey = this.buffer.keys().next().value;
      if (firstKey) this.buffer.delete(firstKey);
    }

    const existing = this.buffer.get(key) || [];
    const entry = {
      timestamp: telemetry.timestamp ? new Date(telemetry.timestamp) : new Date(),
      metrics: { ...telemetry.metrics },
      metadata: telemetry.metadata ? { ...telemetry.metadata } : {}
    };

    // Store newest reading at index 0
    const updated = [entry, ...existing].slice(0, this.maxReadings);
    this.buffer.set(key, updated);
  }

  /**
   * Gets recent telemetry history for a device (excluding or including the current tick).
   * 
   * @param {string} deviceId
   * @returns {Array<Object>} Array of recent telemetry readings (newest first)
   */
  getHistory(deviceId) {
    if (!deviceId) return [];
    const key = deviceId.toString().toUpperCase();
    return this.buffer.get(key) || [];
  }

  /**
   * Clears history for a device or entire buffer.
   * @param {string} [deviceId]
   */
  clear(deviceId) {
    if (deviceId) {
      this.buffer.delete(deviceId.toString().toUpperCase());
    } else {
      this.buffer.clear();
    }
  }

  /**
   * Returns current count of devices tracked in buffer.
   * @returns {number}
   */
  size() {
    return this.buffer.size;
  }
}

module.exports = new TelemetryBuffer();

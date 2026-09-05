class DeviceStateStore {
  constructor() {
    this.store = new Map();
  }

  /**
   * Generates a unique compound key for tenant/device isolation.
   * @param {string} organizationId
   * @param {string} deviceId
   * @returns {string}
   */
  getDeviceKey(organizationId, deviceId) {
    const org = (organizationId || 'default-org').toString();
    const dev = (deviceId || 'UNKNOWN').toString().toUpperCase();
    return `${org}:${dev}`;
  }

  /**
   * Retrieves or initializes the state for a specific device.
   * @param {string} organizationId
   * @param {string} deviceId
   * @param {Object} profile
   * @param {Object} [initialOptions={}]
   * @returns {Object} Device state object
   */
  getOrCreateState(organizationId, deviceId, profile, initialOptions = {}) {
    const key = this.getDeviceKey(organizationId, deviceId);
    let state = this.store.get(key);

    if (!state) {
      // Determine initial temperature from profile if available
      let initialTemp = 25.0;
      if (profile && profile.metrics && profile.metrics.temperature) {
        const { min, max } = profile.metrics.temperature;
        initialTemp = (min + max) / 2.0;
      }

      state = {
        organizationId: organizationId || 'default-org',
        deviceId: (deviceId || 'UNKNOWN').toUpperCase(),
        deviceType: profile ? profile.type : 'unknown',
        battery_level: initialOptions.battery_level !== undefined ? initialOptions.battery_level : 100.0,
        uptime: initialOptions.uptime !== undefined ? initialOptions.uptime : 0,
        current_temperature: initialOptions.temperature !== undefined ? initialOptions.temperature : initialTemp,
        ip: initialOptions.ip || '192.168.1.100',
        firmware_version: initialOptions.firmware_version || '1.0.0',
        lastEmittedTimestamp: initialOptions.lastEmittedTimestamp || null,
        lastSimulatedAt: null
      };

      this.store.set(key, state);
    }

    return state;
  }

  /**
   * Gets existing state or null.
   * @param {string} organizationId
   * @param {string} deviceId
   * @returns {Object|null}
   */
  getState(organizationId, deviceId) {
    const key = this.getDeviceKey(organizationId, deviceId);
    return this.store.get(key) || null;
  }

  /**
   * Updates partial state fields for a device.
   * @param {string} organizationId
   * @param {string} deviceId
   * @param {Object} updates
   * @returns {Object} Updated state
   */
  updateState(organizationId, deviceId, updates) {
    const key = this.getDeviceKey(organizationId, deviceId);
    const existing = this.store.get(key);
    if (!existing) {
      throw new Error(`Cannot update state: Device '${key}' does not exist in state store.`);
    }

    const updated = {
      ...existing,
      ...updates
    };

    this.store.set(key, updated);
    return updated;
  }

  /**
   * Deletes a device from the state store.
   * @param {string} organizationId
   * @param {string} deviceId
   * @returns {boolean}
   */
  deleteState(organizationId, deviceId) {
    const key = this.getDeviceKey(organizationId, deviceId);
    return this.store.delete(key);
  }

  /**
   * Clears all device states.
   */
  clear() {
    this.store.clear();
  }

  /**
   * Returns total count of tracked devices.
   * @returns {number}
   */
  get size() {
    return this.store.size;
  }
}

module.exports = DeviceStateStore;

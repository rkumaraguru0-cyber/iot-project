const { getProfile, getSupportedProfileTypes, PROFILES } = require('../src/profiles');

describe('Device Profiles Definition & Registry (Phase 5)', () => {
  it('should register all 5 supported device profiles', () => {
    const supportedTypes = getSupportedProfileTypes();
    expect(supportedTypes).toEqual([
      'temperature_sensor',
      'smart_camera',
      'industrial_gateway',
      'medical_monitor',
      'smart_lock'
    ]);
  });

  describe('1. Temperature Sensor Profile', () => {
    it('should have valid reporting interval and metric bounds', () => {
      const profile = getProfile('temperature_sensor');
      expect(profile).toBeDefined();
      expect(profile.reportingIntervalSeconds).toBe(30);
      expect(profile.metrics.cpu_usage).toEqual(expect.objectContaining({ min: 5, max: 30 }));
      expect(profile.metrics.memory_usage).toEqual(expect.objectContaining({ min: 20, max: 50 }));
      expect(profile.metrics.temperature).toEqual(expect.objectContaining({ min: 18.0, max: 28.0, isContinuous: true }));
      expect(profile.metrics.battery_level).toEqual(expect.objectContaining({ min: 0, max: 100, isBattery: true, drainRatePerInterval: 0.1 }));
      expect(profile.metrics.network_out).toEqual(expect.objectContaining({ min: 100, max: 500 }));
      expect(profile.metrics.signal_strength).toEqual(expect.objectContaining({ min: -70, max: -30 }));
    });
  });

  describe('2. Smart Camera Profile', () => {
    it('should have valid reporting interval and metric bounds', () => {
      const profile = getProfile('smart_camera');
      expect(profile).toBeDefined();
      expect(profile.reportingIntervalSeconds).toBe(30);
      expect(profile.metrics.cpu_usage).toEqual(expect.objectContaining({ min: 20, max: 60 }));
      expect(profile.metrics.memory_usage).toEqual(expect.objectContaining({ min: 40, max: 75 }));
      expect(profile.metrics.temperature).toEqual(expect.objectContaining({ min: 25.0, max: 45.0, isContinuous: true }));
      expect(profile.metrics.network_out).toEqual(expect.objectContaining({ min: 5000, max: 50000 }));
      expect(profile.metrics.disk_usage).toEqual(expect.objectContaining({ min: 30, max: 80 }));
      expect(profile.metrics.error_count).toEqual(expect.objectContaining({ min: 0, max: 2 }));
    });
  });

  describe('3. Industrial Gateway Profile', () => {
    it('should have valid reporting interval and metric bounds', () => {
      const profile = getProfile('industrial_gateway');
      expect(profile).toBeDefined();
      expect(profile.reportingIntervalSeconds).toBe(15);
      expect(profile.metrics.cpu_usage).toEqual(expect.objectContaining({ min: 30, max: 70 }));
      expect(profile.metrics.memory_usage).toEqual(expect.objectContaining({ min: 50, max: 85 }));
      expect(profile.metrics.temperature).toEqual(expect.objectContaining({ min: 20.0, max: 55.0, isContinuous: true }));
      expect(profile.metrics.network_in).toEqual(expect.objectContaining({ min: 10000, max: 100000 }));
      expect(profile.metrics.network_out).toEqual(expect.objectContaining({ min: 10000, max: 100000 }));
    });
  });

  describe('4. Medical Monitor Profile', () => {
    it('should have valid reporting interval and metric bounds', () => {
      const profile = getProfile('medical_monitor');
      expect(profile).toBeDefined();
      expect(profile.reportingIntervalSeconds).toBe(30);
      expect(profile.metrics.cpu_usage).toEqual(expect.objectContaining({ min: 10, max: 40 }));
      expect(profile.metrics.memory_usage).toEqual(expect.objectContaining({ min: 25, max: 60 }));
      expect(profile.metrics.temperature).toEqual(expect.objectContaining({ min: 20.0, max: 35.0, isContinuous: true }));
      expect(profile.metrics.battery_level).toEqual(expect.objectContaining({ min: 0, max: 100, isBattery: true, drainRatePerInterval: 0.05 }));
      expect(profile.metrics.signal_strength).toEqual(expect.objectContaining({ min: -60, max: -20 }));
      expect(profile.metrics.error_count).toEqual(expect.objectContaining({ min: 0, max: 0 }));
    });
  });

  describe('5. Smart Lock Profile', () => {
    it('should have valid reporting interval and metric bounds', () => {
      const profile = getProfile('smart_lock');
      expect(profile).toBeDefined();
      expect(profile.reportingIntervalSeconds).toBe(60);
      expect(profile.metrics.cpu_usage).toEqual(expect.objectContaining({ min: 2, max: 15 }));
      expect(profile.metrics.memory_usage).toEqual(expect.objectContaining({ min: 10, max: 30 }));
      expect(profile.metrics.battery_level).toEqual(expect.objectContaining({ min: 0, max: 100, isBattery: true, drainRatePerInterval: 0.02 }));
      expect(profile.metrics.signal_strength).toEqual(expect.objectContaining({ min: -80, max: -40 }));
      expect(profile.metrics.error_count).toEqual(expect.objectContaining({ min: 0, max: 1 }));
    });
  });

  describe('Profile Lookup & Error Handling', () => {
    it('should return null for unknown or invalid profile types', () => {
      expect(getProfile('quantum_laser_drone')).toBeNull();
      expect(getProfile('')).toBeNull();
      expect(getProfile(null)).toBeNull();
      expect(getProfile(undefined)).toBeNull();
      expect(getProfile(123)).toBeNull();
    });

    it('should perform case-insensitive profile lookup', () => {
      expect(getProfile('TEMPERATURE_SENSOR')).toBeDefined();
      expect(getProfile('Smart_Camera')).toBeDefined();
    });
  });
});

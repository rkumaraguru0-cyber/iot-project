const logger = require('../utils/logger');

class RestTransport {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || 'http://localhost:5000/api/v1';
  }

  /**
   * Sends telemetry payload via REST POST /telemetry/ingest.
   * @param {Object} payload
   * @param {Object} device
   * @returns {Promise<{ success: boolean, status?: number, data?: Object, error?: string }>}
   */
  async send(deviceOrPayload, payloadOrDevice) {
    const device = deviceOrPayload && deviceOrPayload.deviceId ? deviceOrPayload : (payloadOrDevice || {});
    const payload = deviceOrPayload && deviceOrPayload.deviceId ? payloadOrDevice : deviceOrPayload;

    const url = `${this.apiUrl}/telemetry/ingest`;
    const apiKey = device.apiKey || 'default-mock-api-key';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-API-Key': apiKey
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        logger.warn(`[Simulator REST] Ingest failed (${response.status}) for '${device.deviceId}': ${responseData?.error?.message || response.statusText}`);
        return {
          success: false,
          status: response.status,
          error: responseData?.error?.message || response.statusText
        };
      }

      logger.debug(`[Simulator REST] Telemetry sent successfully for '${device.deviceId}' (${responseData?.status})`);
      return {
        success: true,
        status: response.status,
        data: responseData
      };
    } catch (err) {
      logger.error(`[Simulator REST] Network error sending telemetry for '${device.deviceId}': ${err.message}`);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Simulates failed REST authentication attempts by sending requests with invalid API keys.
   * Expects HTTP 401 Unauthorized or failure, never logs valid credentials.
   *
   * @param {Object} device - { deviceId, organizationId }
   * @param {number} [count=10]
   * @param {string} [invalidKeyPrefix='invalid_api_key_']
   * @returns {Promise<{ attempts: number, rejected: number }>}
   */
  async simulateAuthFailures(device, count = 10, invalidKeyPrefix = 'invalid_api_key_') {
    const deviceId = (device && device.deviceId) || 'DEV-UNKNOWN';
    const orgId = (device && device.organizationId) || 'default-org';
    const url = `${this.apiUrl}/telemetry/ingest`;
    let rejectedCount = 0;

    for (let i = 0; i < count; i++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-API-Key': `${invalidKeyPrefix}${i}_${Date.now()}`
          },
          body: JSON.stringify({
            deviceId,
            organizationId: orgId,
            timestamp: new Date().toISOString(),
            metrics: { cpu_usage: 10.0 },
            metadata: { ip: '192.168.1.100', firmware_version: '1.0.0', uptime: 10 }
          })
        });

        if (response.status === 401 || response.status === 403 || !response.ok) {
          rejectedCount++;
        }
      } catch (err) {
        // Network error / unreachable also counts as rejection
        rejectedCount++;
      }
    }

    logger.debug(`[Simulator REST] Auth brute force simulation on '${deviceId}': ${rejectedCount}/${count} rejected.`);
    return { attempts: count, rejected: rejectedCount };
  }
}

RestTransport.RestTransport = RestTransport;
module.exports = RestTransport;

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
}

RestTransport.RestTransport = RestTransport;
module.exports = RestTransport;

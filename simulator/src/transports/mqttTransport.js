const mqtt = require('mqtt');
const logger = require('../utils/logger');

class MqttTransport {
  constructor(options = {}) {
    this.mqttUrl = options.mqttUrl || 'mqtt://localhost:1883';
    this.orgSlug = options.orgSlug || 'default-org';
    this.clients = new Map(); // Map<deviceId, MqttClient>
  }

  /**
   * Gets or establishes an MQTT connection for a specific device.
   * @param {Object} device - { deviceId, apiKey, organizationId }
   * @returns {Promise<Object>} MQTT client instance
   */
  async getClientForDevice(device) {
    const deviceId = (device.deviceId || '').toUpperCase();
    if (this.clients.has(deviceId)) {
      const existing = this.clients.get(deviceId);
      if (existing.connected) {
        return existing;
      }
    }

    return new Promise((resolve, reject) => {
      const client = mqtt.connect(this.mqttUrl, {
        username: deviceId,
        password: device.apiKey || 'default-mock-api-key',
        clientId: `sim_${deviceId}_${Math.random().toString(16).substring(2, 8)}`,
        connectTimeout: 5000,
        reconnectPeriod: 2000
      });

      client.on('connect', () => {
        logger.debug(`[Simulator MQTT] Connected as device '${deviceId}'`);
        this.clients.set(deviceId, client);
        resolve(client);
      });

      client.on('error', (err) => {
        logger.warn(`[Simulator MQTT] Error on device '${deviceId}': ${err.message}`);
        // If not yet resolved, reject
        if (!client.connected) {
          reject(err);
        }
      });
    });
  }

  /**
   * Publishes telemetry payload to device topic.
   * @param {Object} payload
   * @param {Object} device
   * @returns {Promise<boolean>}
   */
  async publish(deviceOrPayload, payloadOrDevice) {
    const device = deviceOrPayload && deviceOrPayload.deviceId ? deviceOrPayload : payloadOrDevice;
    const payload = deviceOrPayload && deviceOrPayload.deviceId ? payloadOrDevice : deviceOrPayload;

    try {
      const client = await this.getClientForDevice(device);
      const topic = `${this.orgSlug}/devices/${device.deviceId}/telemetry`;
      const message = JSON.stringify(payload);

      return new Promise((resolve) => {
        client.publish(topic, message, { qos: 0 }, (err) => {
          if (err) {
            logger.error(`[Simulator MQTT] Publish failed for '${device.deviceId}': ${err.message}`);
            return resolve(false);
          }
          logger.debug(`[Simulator MQTT] Published telemetry to '${topic}'`);
          resolve(true);
        });
      });
    } catch (err) {
      logger.error(`[Simulator MQTT] Failed to get connection for '${device.deviceId}': ${err.message}`);
      return false;
    }
  }

  /**
   * Closes all active device MQTT connections.
   */
  close() {
    for (const [deviceId, client] of this.clients.entries()) {
      try {
        client.end(true);
      } catch (err) {
        // ignore
      }
    }
    this.clients.clear();
  }
}

MqttTransport.MqttTransport = MqttTransport;
module.exports = MqttTransport;

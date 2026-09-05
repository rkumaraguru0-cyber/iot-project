const net = require('net');
const Aedes = require('aedes');
const { authenticateMqttClient } = require('./auth');
const { authorizePublish, authorizeSubscribe } = require('./authorizer');
const { handleMqttTelemetryPublish } = require('./messageHandler');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Initializes and configures an Aedes MQTT broker instance.
 * @param {Object} [customOptions={}]
 * @returns {{ aedes: Object, server: net.Server }}
 */
function createMqttBroker(customOptions = {}) {
  const aedes = new Aedes(customOptions);

  // Wire security and authorization hooks
  aedes.authenticate = authenticateMqttClient;
  aedes.authorizePublish = authorizePublish;
  aedes.authorizeSubscribe = authorizeSubscribe;

  // Wire message processing
  aedes.on('publish', handleMqttTelemetryPublish);

  // Operational event logging
  aedes.on('client', (client) => {
    logger.debug(`[MQTT Broker] Client connected: ${client.id}`);
  });

  aedes.on('clientDisconnect', (client) => {
    logger.debug(`[MQTT Broker] Client disconnected: ${client.id}`);
  });

  aedes.on('clientError', (client, err) => {
    logger.warn(`[MQTT Broker] Client error (${client?.id || 'unknown'}): ${err.message}`);
  });

  aedes.on('connectionError', (client, err) => {
    logger.warn(`[MQTT Broker] Connection error (${client?.id || 'unknown'}): ${err.message}`);
  });

  const server = net.createServer(aedes.handle);

  return {
    aedes,
    server
  };
}

let activeBrokerInstance = null;

/**
 * Starts the MQTT broker listening on configured port and host.
 * @param {number} [port=config.mqtt.port]
 * @param {string} [host=config.mqtt.host]
 * @returns {Promise<{ aedes: Object, server: net.Server, close: Function }>}
 */
function startMqttBroker(port = config.mqtt.port, host = config.mqtt.host) {
  return new Promise((resolve, reject) => {
    const { aedes, server } = createMqttBroker();

    server.listen(port, host, (err) => {
      if (err) {
        logger.error(`[MQTT Broker] Failed to start MQTT broker on ${host}:${port}: ${err.message}`);
        return reject(err);
      }

      const boundAddress = server.address();
      const boundPort = boundAddress ? boundAddress.port : port;
      logger.info(`[MQTT Broker] Aedes MQTT broker running on ${host}:${boundPort}`);

      const closeBroker = () => {
        return new Promise((res) => {
          logger.info('[MQTT Broker] Stopping Aedes MQTT broker...');
          aedes.close(() => {
            server.close(() => {
              logger.info('[MQTT Broker] MQTT broker stopped.');
              activeBrokerInstance = null;
              res();
            });
          });
        });
      };

      activeBrokerInstance = {
        aedes,
        server,
        close: closeBroker
      };

      resolve(activeBrokerInstance);
    });

    server.on('error', (err) => {
      logger.error(`[MQTT Broker] Server error: ${err.message}`);
    });
  });
}

/**
 * Gracefully shuts down active MQTT broker if running.
 */
async function closeBroker() {
  if (activeBrokerInstance && typeof activeBrokerInstance.close === 'function') {
    await activeBrokerInstance.close();
    activeBrokerInstance = null;
  }
}

module.exports = {
  createMqttBroker,
  startMqttBroker,
  closeBroker
};

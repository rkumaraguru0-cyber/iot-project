const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const { startMqttBroker } = require('./mqtt/aedesBroker');

const startServer = async () => {
  try {
    // Attempt database connection in non-test mode
    if (config.env !== 'test') {
      try {
        await connectDatabase();
      } catch (dbErr) {
        logger.warn(`Database connection initial attempt failed: ${dbErr.message}. Server starting in degraded/standalone mode.`);
      }
    }

    // Start Express HTTP Server
    const server = app.listen(config.port, config.host, () => {
      logger.info(`SecureWatch IoT Server running in ${config.env} mode on http://${config.host}:${config.port}`);
      logger.info(`Health check available at http://${config.host}:${config.port}/api/v1/health`);
    });

    // Start Embedded Aedes MQTT Broker in non-test mode
    let mqttBrokerInstance = null;
    if (config.env !== 'test') {
      try {
        mqttBrokerInstance = await startMqttBroker(config.mqtt.port, config.mqtt.host);
      } catch (mqttErr) {
        logger.error(`Failed to initialize embedded MQTT broker: ${mqttErr.message}`);
      }
    }

    // Graceful shutdown handlers
    const handleShutdown = async (signal) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);

      // 1. Close MQTT broker
      if (mqttBrokerInstance && typeof mqttBrokerInstance.close === 'function') {
        try {
          await mqttBrokerInstance.close();
        } catch (mErr) {
          logger.error('Error closing MQTT broker: %s', mErr.message);
        }
      }

      // 2. Close HTTP Server
      server.close(async () => {
        logger.info('HTTP server closed.');

        // 3. Disconnect Database
        try {
          await disconnectDatabase();
        } catch (err) {
          logger.error('Error disconnecting database: %s', err.message);
        }
        process.exit(0);
      });

      // Force exit after 10s timeout
      setTimeout(() => {
        logger.error('Forcing shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    return { server, mqttBroker: mqttBrokerInstance };
  } catch (error) {
    logger.error('Failed to start server: %s', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { startServer };

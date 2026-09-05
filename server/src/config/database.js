const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

let isConnected = false;

const connectDatabase = async () => {
  if (isConnected) {
    return mongoose.connection;
  }

  try {
    const connection = await mongoose.connect(config.mongodb.uri, config.mongodb.options);
    isConnected = connection.connections[0].readyState === 1;
    logger.info(`MongoDB connected successfully to ${connection.connection.host}:${connection.connection.port}/${connection.connection.name}`);
    return connection;
  } catch (error) {
    logger.error('MongoDB connection error: %s', error.message);
    throw error;
  }
};

const disconnectDatabase = async () => {
  if (!isConnected) {
    return;
  }
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected');
};

const isDatabaseConnected = () => {
  return mongoose.connection.readyState === 1;
};

module.exports = {
  connectDatabase,
  disconnectDatabase,
  isDatabaseConnected
};

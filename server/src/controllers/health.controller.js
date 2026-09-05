const { isDatabaseConnected } = require('../config/database');

const getHealthStatus = (req, res) => {
  const healthData = {
    status: 'ok',
    service: 'securewatch-server',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    dbConnected: isDatabaseConnected(),
    environment: process.env.NODE_ENV || 'development'
  };

  res.status(200).json(healthData);
};

module.exports = {
  getHealthStatus
};

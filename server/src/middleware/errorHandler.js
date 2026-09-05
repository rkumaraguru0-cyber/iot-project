const logger = require('../utils/logger');
const config = require('../config');

const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled API Error: %s', err.message, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const message = config.isProduction && statusCode === 500
    ? 'An unexpected internal server error occurred'
    : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message,
      ...(config.isProduction ? {} : { stack: err.stack })
    }
  });
};

module.exports = errorHandler;

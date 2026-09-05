const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for authentication endpoints: max 10 requests per minute per IP
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again after 1 minute.'
      }
    });
  }
});

/**
 * General API rate limiter: max 100 requests per minute per IP
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please slow down.'
      }
    });
  }
});

/**
 * Telemetry ingestion rate limiter: max 600 requests per minute per device key / IP
 */
const telemetryIngestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  keyGenerator: (req) => req.headers['x-device-api-key'] || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Telemetry ingestion rate limit exceeded (600 req/min). Please slow down.'
      }
    });
  }
});

module.exports = {
  authLimiter,
  apiLimiter,
  telemetryIngestLimiter
};


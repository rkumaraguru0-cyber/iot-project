require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || '0.0.0.0',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/securewatch_iot',
    options: {
      autoIndex: process.env.NODE_ENV !== 'production'
    }
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_development_secret_key_hs256_32_chars_min',
    accessExpiry: process.env.JWT_EXPIRY || '15m',
    refreshExpiryDays: parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS, 10) || 7
  },
  mqtt: {
    port: parseInt(process.env.MQTT_PORT, 10) || 1883,
    host: process.env.MQTT_HOST || '0.0.0.0'
  }
};

module.exports = config;

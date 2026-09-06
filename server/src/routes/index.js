const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const deviceRoutes = require('./device.routes');
const userRoutes = require('./user.routes');
const organizationRoutes = require('./organization.routes');
const telemetryRoutes = require('./telemetry.routes');
const anomalyRuleRoutes = require('./anomalyRule.routes');
const anomalyRoutes = require('./anomaly.routes');
const securityEventRoutes = require('./securityEvent.routes');
const riskRoutes = require('./risk.routes');
const incidentRoutes = require('./incident.routes');
const firmwareRoutes = require('./firmware.routes');
const dashboardRoutes = require('./dashboard.routes');
const auditLogRoutes = require('./auditLog.routes');
const notificationRoutes = require('./notification.routes');

const { apiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Mount global API rate limiter on all /api/v1 routes
router.use(apiLimiter);

// Mount foundational routes
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/devices', deviceRoutes);
router.use('/users', userRoutes);
router.use('/organizations', organizationRoutes);
router.use('/telemetry', telemetryRoutes);
router.use('/rules', anomalyRuleRoutes);
router.use('/anomalies', anomalyRoutes);
router.use('/security-events', securityEventRoutes);
router.use('/risk', riskRoutes);
router.use('/incidents', incidentRoutes);
router.use('/firmware', firmwareRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;

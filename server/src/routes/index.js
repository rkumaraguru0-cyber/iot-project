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

const router = express.Router();

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

module.exports = router;

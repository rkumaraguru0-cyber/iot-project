const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const deviceRoutes = require('./device.routes');
const userRoutes = require('./user.routes');
const organizationRoutes = require('./organization.routes');
const telemetryRoutes = require('./telemetry.routes');

const router = express.Router();

// Mount foundational routes
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/devices', deviceRoutes);
router.use('/users', userRoutes);
router.use('/organizations', organizationRoutes);
router.use('/telemetry', telemetryRoutes);

module.exports = router;

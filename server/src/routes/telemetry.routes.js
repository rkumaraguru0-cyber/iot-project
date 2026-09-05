const express = require('express');
const telemetryController = require('../controllers/telemetry.controller');
const validate = require('../middleware/validate');
const { ingestTelemetrySchema } = require('../validators/telemetry.validator');
const { telemetryIngestLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   POST /api/v1/telemetry/ingest
 * @desc    REST fallback endpoint for device telemetry ingestion
 * @access  Device API Key (X-Device-API-Key header)
 */
router.post(
  '/ingest',
  telemetryIngestLimiter,
  validate(ingestTelemetrySchema),
  telemetryController.ingestTelemetry
);

module.exports = router;

const express = require('express');
const { getHealthStatus } = require('../controllers/health.controller');

const router = express.Router();

router.get('/', getHealthStatus);

module.exports = router;

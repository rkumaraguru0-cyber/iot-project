const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLog.controller');
const authenticate = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const { requireRole } = require('../middleware/rbac');

router.get(
  '/',
  authenticate,
  orgScope,
  requireRole('security_analyst'),
  auditLogController.listAuditLogs
);

module.exports = router;

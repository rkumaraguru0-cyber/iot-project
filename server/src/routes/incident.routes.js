const express = require('express');
const incidentController = require('../controllers/incident.controller');
const authenticate = require('../middleware/auth');
const orgScope = require('../middleware/orgScope');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const {
  queryIncidentsSchema,
  updateIncidentStatusSchema,
  assignIncidentSchema,
  addIncidentNoteSchema,
  recordResponseActionSchema,
  addIncidentEvidenceSchema,
  resolveIncidentSchema
} = require('../validators/incident.validator');

const router = express.Router();

// Enforce authentication and tenant scoping across all incident routes
router.use(authenticate, orgScope);

/**
 * @route   GET /api/v1/incidents
 * @desc    List incidents with filtering and pagination
 * @access  viewer+
 */
router.get(
  '/',
  requireRole('viewer'),
  validate(queryIncidentsSchema, 'query'),
  incidentController.listIncidents
);

/**
 * @route   GET /api/v1/incidents/stats
 * @desc    Get aggregate incident statistics, MTTA, and MTTR
 * @access  viewer+
 */
router.get(
  '/stats',
  requireRole('viewer'),
  incidentController.getIncidentStats
);

/**
 * @route   GET /api/v1/incidents/:id
 * @desc    Get full incident details by ID
 * @access  viewer+
 */
router.get(
  '/:id',
  requireRole('viewer'),
  incidentController.getIncidentById
);

/**
 * @route   PATCH /api/v1/incidents/:id/status
 * @desc    Transition incident lifecycle state
 * @access  operator+ (close requires security_analyst+)
 */
router.patch(
  '/:id/status',
  requireRole('operator'),
  validate(updateIncidentStatusSchema),
  incidentController.updateIncidentStatus
);

/**
 * @route   PATCH /api/v1/incidents/:id/assign
 * @desc    Assign incident to user
 * @access  operator+
 */
router.patch(
  '/:id/assign',
  requireRole('operator'),
  validate(assignIncidentSchema),
  incidentController.assignIncident
);

/**
 * @route   POST /api/v1/incidents/:id/notes
 * @desc    Add investigation note to incident
 * @access  operator+
 */
router.post(
  '/:id/notes',
  requireRole('operator'),
  validate(addIncidentNoteSchema),
  incidentController.addNote
);

/**
 * @route   POST /api/v1/incidents/:id/actions
 * @desc    Record response action (quarantine, key revoke, escalate)
 * @access  operator+
 */
router.post(
  '/:id/actions',
  requireRole('operator'),
  validate(recordResponseActionSchema),
  incidentController.recordResponseAction
);

/**
 * @route   POST /api/v1/incidents/:id/evidence
 * @desc    Attach supporting evidence item
 * @access  operator+
 */
router.post(
  '/:id/evidence',
  requireRole('operator'),
  validate(addIncidentEvidenceSchema),
  incidentController.addEvidence
);

/**
 * @route   POST /api/v1/incidents/:id/resolve
 * @desc    Submit formal resolution details
 * @access  operator+
 */
router.post(
  '/:id/resolve',
  requireRole('operator'),
  validate(resolveIncidentSchema),
  incidentController.resolveIncident
);

module.exports = router;

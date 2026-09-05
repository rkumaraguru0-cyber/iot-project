const Joi = require('joi');

const INCIDENT_STATUSES = [
  'detected',
  'triaged',
  'investigating',
  'containment',
  'resolved',
  'false_positive',
  'closed'
];

const SEVERITIES = ['low', 'medium', 'high', 'critical'];

const RESPONSE_ACTIONS = [
  'quarantine_device',
  'revoke_key',
  'rollback_firmware',
  'escalate',
  'other'
];

const EVIDENCE_TYPES = [
  'security_event',
  'telemetry',
  'device_state',
  'audit_entry'
];

const queryIncidentsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(...INCIDENT_STATUSES).optional(),
  severity: Joi.string().valid(...SEVERITIES).optional(),
  assignedTo: Joi.string().optional(),
  deviceId: Joi.string().optional(),
  slaBreached: Joi.boolean().optional(),
  search: Joi.string().trim().max(100).optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  sortBy: Joi.string()
    .valid('detectedAt', 'severity', 'status', 'createdAt', 'slaResolveDeadline', 'slaTriageDeadline')
    .default('detectedAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const updateIncidentStatusSchema = Joi.object({
  status: Joi.string().valid(...INCIDENT_STATUSES).required().messages({
    'any.only': `Status must be one of: ${INCIDENT_STATUSES.join(', ')}`,
    'any.required': 'Incident status is required'
  }),
  note: Joi.string().trim().max(1000).allow('', null).optional()
});

const assignIncidentSchema = Joi.object({
  assignedTo: Joi.string().allow(null, '').required().messages({
    'any.required': 'Assigned user ID is required (or null to unassign)'
  })
});

const addIncidentNoteSchema = Joi.object({
  content: Joi.string().trim().min(1).max(2000).required().messages({
    'string.empty': 'Note content cannot be empty',
    'any.required': 'Note content is required'
  })
});

const recordResponseActionSchema = Joi.object({
  action: Joi.string().valid(...RESPONSE_ACTIONS).required().messages({
    'any.only': `Action must be one of: ${RESPONSE_ACTIONS.join(', ')}`,
    'any.required': 'Response action type is required'
  }),
  details: Joi.string().trim().max(1000).allow('').default('')
});

const addIncidentEvidenceSchema = Joi.object({
  type: Joi.string().valid(...EVIDENCE_TYPES).required().messages({
    'any.only': `Evidence type must be one of: ${EVIDENCE_TYPES.join(', ')}`,
    'any.required': 'Evidence type is required'
  }),
  entityId: Joi.alternatives().try(Joi.string(), Joi.object()).required().messages({
    'any.required': 'Evidence entity reference is required'
  }),
  note: Joi.string().trim().max(500).allow(null, '').optional()
});

const resolveIncidentSchema = Joi.object({
  summary: Joi.string().trim().min(5).max(2000).required().messages({
    'string.empty': 'Resolution summary cannot be empty',
    'any.required': 'Resolution summary is required'
  }),
  rootCause: Joi.string().trim().min(5).max(2000).required().messages({
    'string.empty': 'Root cause explanation cannot be empty',
    'any.required': 'Root cause is required'
  }),
  preventiveMeasures: Joi.string().trim().max(2000).allow('').optional()
});

module.exports = {
  queryIncidentsSchema,
  updateIncidentStatusSchema,
  assignIncidentSchema,
  addIncidentNoteSchema,
  recordResponseActionSchema,
  addIncidentEvidenceSchema,
  resolveIncidentSchema,
  INCIDENT_STATUSES,
  SEVERITIES,
  RESPONSE_ACTIONS,
  EVIDENCE_TYPES
};

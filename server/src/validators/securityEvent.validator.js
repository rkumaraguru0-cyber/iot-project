const Joi = require('joi');

const EVENT_STATUSES = ['open', 'acknowledged', 'resolved', 'false_positive'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const CATEGORIES = ['threshold', 'rate', 'security', 'operational', 'behavioral'];

const querySecurityEventsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(...EVENT_STATUSES).optional(),
  severity: Joi.string().valid(...SEVERITIES).optional(),
  category: Joi.string().valid(...CATEGORIES).optional(),
  deviceId: Joi.string().optional(),
  ruleId: Joi.string().optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  search: Joi.string().trim().max(100).optional(),
  sortBy: Joi.string().valid('firstOccurrence', 'lastOccurrence', 'severity', 'occurrenceCount', 'createdAt').default('lastOccurrence'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const updateSecurityEventStatusSchema = Joi.object({
  status: Joi.string().valid(...EVENT_STATUSES).required().messages({
    'any.only': `Status must be one of: ${EVENT_STATUSES.join(', ')}`,
    'any.required': 'Event status is required'
  }),
  resolutionNote: Joi.string().trim().max(500).allow('', null).optional()
});

module.exports = {
  querySecurityEventsSchema,
  updateSecurityEventStatusSchema,
  EVENT_STATUSES,
  SEVERITIES,
  CATEGORIES
};

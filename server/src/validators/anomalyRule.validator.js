const Joi = require('joi');
const { DEVICE_TYPES } = require('./device.validator');

const OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'rate_exceeds', 'not_in_list'];
const WINDOW_TYPES = ['none', 'consecutive', 'sliding'];
const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const CONFIDENCES = ['low', 'medium', 'high'];
const CATEGORIES = ['operational', 'security', 'behavioral', 'threshold'];

const windowSchema = Joi.object({
  type: Joi.string().valid(...WINDOW_TYPES).default('none'),
  size: Joi.number().integer().min(1).max(20).default(1)
}).default({ type: 'none', size: 1 });

const createAnomalyRuleSchema = Joi.object({
  ruleId: Joi.string().trim().uppercase().max(50).optional(),
  name: Joi.string().trim().min(1).max(100).required().messages({
    'string.min': 'Rule name is required',
    'string.max': 'Rule name cannot exceed 100 characters',
    'any.required': 'Rule name is required'
  }),
  description: Joi.string().trim().max(500).allow('').optional(),
  category: Joi.string().valid(...CATEGORIES).default('threshold'),
  deviceTypes: Joi.array()
    .items(Joi.string().valid(...DEVICE_TYPES, '*'))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one device type or "*" is required',
      'any.required': 'Device types are required'
    }),
  metric: Joi.string().trim().min(1).max(50).required().messages({
    'string.min': 'Metric is required',
    'any.required': 'Metric is required'
  }),
  operator: Joi.string().valid(...OPERATORS).required().messages({
    'any.only': `Operator must be one of: ${OPERATORS.join(', ')}`,
    'any.required': 'Operator is required'
  }),
  value: Joi.any().required().messages({
    'any.required': 'Threshold value is required'
  }),
  window: windowSchema,
  cooldownSeconds: Joi.number().integer().min(0).max(86400).default(300),
  severity: Joi.string().valid(...SEVERITIES).default('medium'),
  confidence: Joi.string().valid(...CONFIDENCES).default('high'),
  enabled: Joi.boolean().default(true),
  explanationTemplate: Joi.string().trim().max(200).allow('').optional()
});

const updateAnomalyRuleSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().trim().max(500).allow('').optional(),
  category: Joi.string().valid(...CATEGORIES).optional(),
  deviceTypes: Joi.array().items(Joi.string().valid(...DEVICE_TYPES, '*')).min(1).optional(),
  metric: Joi.string().trim().min(1).max(50).optional(),
  operator: Joi.string().valid(...OPERATORS).optional(),
  value: Joi.any().optional(),
  window: windowSchema.optional(),
  cooldownSeconds: Joi.number().integer().min(0).max(86400).optional(),
  severity: Joi.string().valid(...SEVERITIES).optional(),
  confidence: Joi.string().valid(...CONFIDENCES).optional(),
  enabled: Joi.boolean().optional(),
  explanationTemplate: Joi.string().trim().max(200).allow('').optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

const dryRunTestSchema = Joi.object({
  rule: Joi.object({
    ruleId: Joi.string().trim().optional(),
    name: Joi.string().trim().optional(),
    metric: Joi.string().trim().min(1).max(50).required(),
    operator: Joi.string().valid(...OPERATORS).required(),
    value: Joi.any().required(),
    window: windowSchema.optional(),
    severity: Joi.string().valid(...SEVERITIES).optional(),
    confidence: Joi.string().valid(...CONFIDENCES).optional(),
    explanationTemplate: Joi.string().trim().max(200).allow('').optional()
  }).required().messages({
    'any.required': 'Rule specification is required for dry-run testing'
  }),
  telemetry: Joi.object({
    deviceId: Joi.string().optional(),
    timestamp: Joi.date().iso().default(() => new Date()),
    metrics: Joi.object().required().messages({
      'any.required': 'Sample metrics object is required'
    }),
    metadata: Joi.object().optional()
  }).required().messages({
    'any.required': 'Sample telemetry is required'
  })
});

const listRulesQuerySchema = Joi.object({
  category: Joi.string().valid(...CATEGORIES).optional(),
  severity: Joi.string().valid(...SEVERITIES).optional(),
  enabled: Joi.boolean().optional(),
  deviceType: Joi.string().optional()
});

const listAnomaliesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  deviceId: Joi.string().optional(),
  ruleId: Joi.string().optional(),
  severity: Joi.string().valid(...SEVERITIES).optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional()
});

module.exports = {
  createAnomalyRuleSchema,
  updateAnomalyRuleSchema,
  dryRunTestSchema,
  listRulesQuerySchema,
  listAnomaliesQuerySchema,
  OPERATORS,
  WINDOW_TYPES,
  SEVERITIES,
  CONFIDENCES,
  CATEGORIES
};

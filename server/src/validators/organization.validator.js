const Joi = require('joi');

const slaThresholdSchema = Joi.object({
  critical: Joi.object({
    triage: Joi.number().min(1).max(10080).optional(),
    resolve: Joi.number().min(1).max(10080).optional()
  }).optional(),
  high: Joi.object({
    triage: Joi.number().min(1).max(10080).optional(),
    resolve: Joi.number().min(1).max(10080).optional()
  }).optional(),
  medium: Joi.object({
    triage: Joi.number().min(1).max(10080).optional(),
    resolve: Joi.number().min(1).max(10080).optional()
  }).optional(),
  low: Joi.object({
    triage: Joi.number().min(1).max(10080).optional(),
    resolve: Joi.number().min(1).max(10080).optional()
  }).optional()
});

const updateOrgSettingsSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().optional(),
  settings: Joi.object({
    slaThresholds: slaThresholdSchema.optional(),
    autoQuarantine: Joi.object({
      enabled: Joi.boolean().optional(),
      threshold: Joi.number().min(1).max(100).optional()
    }).optional(),
    alertPreferences: Joi.object({
      minSeverity: Joi.string().valid('low', 'medium', 'high', 'critical').optional()
    }).optional()
  }).optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for organization update'
});

const createOrgSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().required().messages({
    'string.min': 'Organization name must be at least 2 characters',
    'string.max': 'Organization name cannot exceed 100 characters',
    'any.required': 'Organization name is required'
  }),
  slug: Joi.string().min(2).max(50).trim().lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Organization slug may only contain lowercase alphanumeric characters and hyphens',
      'any.required': 'Organization slug is required'
    })
});

module.exports = {
  updateOrgSettingsSchema,
  createOrgSchema
};

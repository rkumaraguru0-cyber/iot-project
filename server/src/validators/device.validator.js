const Joi = require('joi');

const DEVICE_TYPES = ['temperature_sensor', 'smart_camera', 'industrial_gateway', 'medical_monitor', 'smart_lock'];
const DEVICE_STATUSES = ['registered', 'active', 'maintenance', 'quarantined', 'decommissioned'];
const HEALTH_STATUSES = ['healthy', 'degraded', 'offline', 'unknown'];

const tagSchema = Joi.object({
  key: Joi.string().trim().min(1).max(50).required(),
  value: Joi.string().trim().min(1).max(100).required()
});

const registerDeviceSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'string.min': 'Device name is required',
    'string.max': 'Device name cannot exceed 100 characters',
    'any.required': 'Device name is required'
  }),
  type: Joi.string().valid(...DEVICE_TYPES).required().messages({
    'any.only': `Device type must be one of: ${DEVICE_TYPES.join(', ')}`,
    'any.required': 'Device type is required'
  }),
  manufacturer: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'Manufacturer is required'
  }),
  model: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'Model is required'
  }),
  location: Joi.string().trim().max(200).allow('').optional(),
  tags: Joi.array().items(tagSchema).max(20).optional(),
  firmwareVersion: Joi.string().trim().max(50).allow('', null).optional()
});

const updateDeviceSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  location: Joi.string().trim().max(200).allow('').optional(),
  tags: Joi.array().items(tagSchema).max(20).optional(),
  status: Joi.string().valid(...DEVICE_STATUSES).optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

const listDevicesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  type: Joi.string().valid(...DEVICE_TYPES).optional(),
  status: Joi.string().valid(...DEVICE_STATUSES).optional(),
  healthStatus: Joi.string().valid(...HEALTH_STATUSES).optional(),
  riskMin: Joi.number().min(0).max(100).optional(),
  riskMax: Joi.number().min(0).max(100).optional(),
  tag: Joi.string().optional(),
  search: Joi.string().trim().max(100).optional(),
  sortBy: Joi.string().valid('name', 'riskScore', 'lastSeenAt', 'createdAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

module.exports = {
  registerDeviceSchema,
  updateDeviceSchema,
  listDevicesQuerySchema,
  DEVICE_TYPES,
  DEVICE_STATUSES,
  HEALTH_STATUSES
};

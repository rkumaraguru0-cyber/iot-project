const Joi = require('joi');

const createFirmwareVersionSchema = Joi.object({
  version: Joi.string().trim().required().messages({
    'string.empty': 'Firmware version is required',
    'any.required': 'Firmware version is required'
  }),
  deviceType: Joi.string()
    .valid(
      'temperature_sensor',
      'smart_camera',
      'industrial_gateway',
      'medical_monitor',
      'smart_lock'
    )
    .required()
    .messages({
      'any.only': 'Invalid device type specified',
      'any.required': 'Device type is required'
    }),
  checksum: Joi.string()
    .trim()
    .length(64)
    .hex()
    .required()
    .messages({
      'string.length': 'Firmware binary checksum must be a 64-character SHA-256 hex string',
      'string.hex': 'Firmware binary checksum must be a valid hexadecimal SHA-256 string',
      'any.required': 'Firmware binary SHA-256 checksum is required'
    }),
  fileSize: Joi.number().min(0).optional(),
  releaseDate: Joi.date().iso().required().messages({
    'any.required': 'Release date is required',
    'date.format': 'Release date must be an ISO 8601 date string'
  }),
  changelog: Joi.string().allow('').optional(),
  securityStatus: Joi.string()
    .valid('secure', 'under_review', 'vulnerable', 'recalled')
    .default('under_review')
    .optional(),
  deploymentPolicy: Joi.string()
    .valid('allowed', 'blocked', 'restricted')
    .default('restricted')
    .optional(),
  vulnerabilities: Joi.array()
    .items(
      Joi.object({
        cveId: Joi.string().trim().uppercase().required().messages({
          'any.required': 'CVE ID is required'
        }),
        severity: Joi.string()
          .valid('low', 'medium', 'high', 'critical')
          .required(),
        description: Joi.string().allow('').optional(),
        cvssScore: Joi.number().min(0).max(10).optional(),
        reportedAt: Joi.date().iso().optional()
      })
    )
    .optional()
});

const queryFirmwareVersionsSchema = Joi.object({
  deviceType: Joi.string()
    .valid(
      'temperature_sensor',
      'smart_camera',
      'industrial_gateway',
      'medical_monitor',
      'smart_lock'
    )
    .optional(),
  securityStatus: Joi.string()
    .valid('secure', 'under_review', 'vulnerable', 'recalled')
    .optional(),
  deploymentPolicy: Joi.string()
    .valid('allowed', 'blocked', 'restricted')
    .optional(),
  search: Joi.string().trim().allow('').optional(),
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(20).optional(),
  sortBy: Joi.string()
    .valid('releaseDate', 'version', 'createdAt', 'deviceType')
    .default('releaseDate')
    .optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc').optional()
});

const updateFirmwareVersionSchema = Joi.object({
  securityStatus: Joi.string()
    .valid('secure', 'under_review', 'vulnerable', 'recalled')
    .optional(),
  deploymentPolicy: Joi.string()
    .valid('allowed', 'blocked', 'restricted')
    .optional(),
  changelog: Joi.string().allow('').optional(),
  vulnerabilities: Joi.array()
    .items(
      Joi.object({
        cveId: Joi.string().trim().uppercase().required(),
        severity: Joi.string()
          .valid('low', 'medium', 'high', 'critical')
          .required(),
        description: Joi.string().allow('').optional(),
        cvssScore: Joi.number().min(0).max(10).optional(),
        reportedAt: Joi.date().iso().optional()
      })
    )
    .optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

const createDeploymentsSchema = Joi.object({
  firmwareVersionId: Joi.string().required().messages({
    'any.required': 'Firmware version ID is required'
  }),
  deviceIds: Joi.array()
    .items(Joi.string().required())
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one target device ID is required',
      'any.required': 'Target device IDs array is required'
    })
});

const queryDeploymentsSchema = Joi.object({
  status: Joi.string()
    .valid(
      'pending',
      'downloading',
      'installing',
      'verifying',
      'success',
      'failed',
      'rolled_back'
    )
    .optional(),
  firmwareVersionId: Joi.string().optional(),
  deviceId: Joi.string().optional(),
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(20).optional(),
  sortBy: Joi.string()
    .valid('initiatedAt', 'createdAt', 'status')
    .default('initiatedAt')
    .optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc').optional()
});

const updateDeploymentStatusSchema = Joi.object({
  status: Joi.string()
    .valid(
      'pending',
      'downloading',
      'installing',
      'verifying',
      'success',
      'failed',
      'rolled_back'
    )
    .required()
    .messages({
      'any.required': 'Deployment status is required',
      'any.only': 'Invalid deployment status specified'
    }),
  result: Joi.object({
    success: Joi.boolean().optional(),
    message: Joi.string().allow('', null).optional(),
    verificationChecksum: Joi.string().allow('', null).optional()
  }).optional()
});

module.exports = {
  createFirmwareVersionSchema,
  queryFirmwareVersionsSchema,
  updateFirmwareVersionSchema,
  createDeploymentsSchema,
  queryDeploymentsSchema,
  updateDeploymentStatusSchema
};

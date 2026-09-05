const Joi = require('joi');
const { PASSWORD_REGEX } = require('../utils/password');

const ROLES = ['super_admin', 'org_admin', 'security_analyst', 'operator', 'viewer'];

const passwordValidation = Joi.string()
  .min(8)
  .pattern(PASSWORD_REGEX)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special character',
    'any.required': 'Password is required'
  });

const inviteUserSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required().messages({
    'string.email': 'A valid email address is required',
    'any.required': 'Email is required'
  }),
  displayName: Joi.string().min(2).max(100).trim().required().messages({
    'string.min': 'Display name must be at least 2 characters',
    'string.max': 'Display name cannot exceed 100 characters',
    'any.required': 'Display name is required'
  }),
  role: Joi.string().valid(...ROLES).required().messages({
    'any.only': `Role must be one of: ${ROLES.join(', ')}`,
    'any.required': 'Role is required'
  })
});

const updateUserSchema = Joi.object({
  role: Joi.string().valid(...ROLES).optional(),
  isActive: Joi.boolean().optional()
}).min(1).messages({
  'object.min': 'At least one field (role or isActive) must be provided for update'
});

const updateProfileSchema = Joi.object({
  displayName: Joi.string().min(2).max(100).trim().required().messages({
    'string.min': 'Display name must be at least 2 characters',
    'string.max': 'Display name cannot exceed 100 characters',
    'any.required': 'Display name is required'
  })
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required'
  }),
  newPassword: passwordValidation
});

const listUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  role: Joi.string().valid(...ROLES).optional(),
  isActive: Joi.boolean().optional(),
  search: Joi.string().trim().max(100).optional()
});

module.exports = {
  inviteUserSchema,
  updateUserSchema,
  updateProfileSchema,
  changePasswordSchema,
  listUsersQuerySchema,
  ROLES
};

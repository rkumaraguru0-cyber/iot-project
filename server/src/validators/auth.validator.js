const Joi = require('joi');
const { PASSWORD_REGEX } = require('../utils/password');

const passwordValidation = Joi.string()
  .min(8)
  .pattern(PASSWORD_REGEX)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special character (@$!%*?&)',
    'any.required': 'Password is required'
  });

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required().messages({
    'string.email': 'A valid email address is required',
    'any.required': 'Email is required'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  })
});

const registerSchema = Joi.object({
  organizationName: Joi.string().min(2).max(100).trim().required().messages({
    'string.min': 'Organization name must be at least 2 characters',
    'string.max': 'Organization name cannot exceed 100 characters',
    'any.required': 'Organization name is required'
  }),
  email: Joi.string().email().lowercase().trim().required().messages({
    'string.email': 'A valid email address is required',
    'any.required': 'Email is required'
  }),
  password: passwordValidation,
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

module.exports = {
  loginSchema,
  registerSchema,
  changePasswordSchema
};

/**
 * Generic Joi schema validation middleware
 * @param {Object} schema - Joi object schema
 * @param {string} [property='body'] - Request property to validate ('body', 'query', 'params')
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/['"]/g, '')
      }));

      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request payload',
          details
        }
      });
    }

    // Replace request property with sanitized/casted value
    req[property] = value;
    next();
  };
};

module.exports = validate;

const { verifyAccessToken } = require('../utils/token');
const { User } = require('../models');

/**
 * Authentication middleware: verifies Bearer JWT and sets authenticated user context
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token is required. Format: Bearer <token>'
        }
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Malformed authorization header'
        }
      });
    }

    // Verify token cryptographic signature and expiry
    const decoded = verifyAccessToken(token);

    // Optional DB verification to ensure user has not been deactivated since token issue
    const user = await User.findById(decoded.userId).select('role organizationId isActive displayName email');
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The user associated with this token no longer exists'
        }
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Your account has been deactivated. Please contact your organization administrator.'
        }
      });
    }

    // Establish immutable authenticated context on request
    req.user = {
      userId: user._id.toString(),
      organizationId: user.organizationId.toString(),
      role: user.role,
      email: user.email,
      displayName: user.displayName
    };

    // Explicit tenant context anchor: client cannot override this
    req.organizationId = user.organizationId.toString();

    next();
  } catch (error) {
    const statusCode = error.statusCode || 401;
    const errorCode = error.code || 'UNAUTHORIZED';
    return res.status(statusCode).json({
      error: {
        code: errorCode,
        message: error.message || 'Authentication failed'
      }
    });
  }
};

module.exports = authenticate;

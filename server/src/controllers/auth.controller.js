const authService = require('../services/auth.service');
const config = require('../config');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'lax',
  maxAge: (config.jwt.refreshExpiryDays || 7) * 24 * 60 * 60 * 1000 // 7 days in ms
};

/**
 * Handle user login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    // Set opaque refresh token in httpOnly secure cookie
    res.cookie('refreshToken', result.rawRefreshToken, COOKIE_OPTIONS);

    res.status(200).json({
      accessToken: result.accessToken,
      user: result.user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle access token refresh with token rotation
 */
const refreshToken = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    if (!rawRefreshToken) {
      return res.status(401).json({
        error: {
          code: 'REFRESH_TOKEN_REQUIRED',
          message: 'Refresh token cookie is required'
        }
      });
    }

    const result = await authService.refresh(rawRefreshToken);

    // Set rotated refresh token in httpOnly secure cookie
    res.cookie('refreshToken', result.rawRefreshToken, COOKIE_OPTIONS);

    res.status(200).json({
      accessToken: result.accessToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle user logout and refresh token revocation
 */
const logout = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    const userId = req.user?.userId;

    await authService.logout(userId, rawRefreshToken);

    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax'
    });

    res.status(200).json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle initial platform registration (bootstrap only)
 */
const register = async (req, res, next) => {
  try {
    const result = await authService.registerInitialOrg(req.body);

    res.cookie('refreshToken', result.rawRefreshToken, COOKIE_OPTIONS);

    res.status(201).json({
      organization: result.organization,
      user: result.user,
      accessToken: result.accessToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get currently authenticated user profile
 */
const getMe = async (req, res, next) => {
  try {
    const userProfile = await authService.getCurrentUser(req.user.userId);
    res.status(200).json({
      user: userProfile
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  refreshToken,
  logout,
  register,
  getMe
};

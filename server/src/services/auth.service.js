const { User, Organization, RefreshToken } = require('../models');
const { hashPassword, comparePassword } = require('../utils/password');
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiryDate
} = require('../utils/token');

class AuthService {
  /**
   * Authenticates user with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ accessToken: string, rawRefreshToken: string, user: Object }>}
   */
  async login(email, password) {
    const normalizedEmail = email.toLowerCase().trim();

    // Query user by email
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      const err = new Error('Invalid credentials');
      err.code = 'INVALID_CREDENTIALS';
      err.statusCode = 401;
      throw err;
    }

    // Check password hash
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      const err = new Error('Invalid credentials');
      err.code = 'INVALID_CREDENTIALS';
      err.statusCode = 401;
      throw err;
    }

    // Check account status
    if (!user.isActive) {
      const err = new Error('Your account has been deactivated. Please contact your administrator.');
      err.code = 'ACCOUNT_DEACTIVATED';
      err.statusCode = 403;
      throw err;
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);

    // Persist hashed refresh token with TTL
    await RefreshToken.create({
      userId: user._id,
      tokenHash,
      expiresAt: getRefreshTokenExpiryDate(7)
    });

    return {
      accessToken,
      rawRefreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        organizationId: user.organizationId.toString(),
        lastLoginAt: user.lastLoginAt
      }
    };
  }

  /**
   * Refreshes access token and rotates refresh token
   * @param {string} rawRefreshToken
   * @returns {Promise<{ accessToken: string, rawRefreshToken: string }>}
   */
  async refresh(rawRefreshToken) {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      const err = new Error('Refresh token is required');
      err.code = 'INVALID_REFRESH_TOKEN';
      err.statusCode = 401;
      throw err;
    }

    const tokenHash = hashToken(rawRefreshToken);

    // Look up active token
    const tokenDoc = await RefreshToken.findOne({
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    });

    if (!tokenDoc) {
      const err = new Error('Invalid, expired, or revoked refresh token');
      err.code = 'INVALID_REFRESH_TOKEN';
      err.statusCode = 401;
      throw err;
    }

    // Revoke used refresh token (Token Rotation)
    tokenDoc.revokedAt = new Date();
    await tokenDoc.save();

    // Fetch user
    const user = await User.findById(tokenDoc.userId);
    if (!user || !user.isActive) {
      const err = new Error('User not found or account deactivated');
      err.code = 'UNAUTHORIZED';
      err.statusCode = 401;
      throw err;
    }

    // Issue new pair
    const accessToken = generateAccessToken(user);
    const newRawRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRawRefreshToken);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: newTokenHash,
      expiresAt: getRefreshTokenExpiryDate(7)
    });

    return {
      accessToken,
      rawRefreshToken: newRawRefreshToken
    };
  }

  /**
   * Revokes refresh tokens for user on logout
   * @param {string} userId
   * @param {string} [rawRefreshToken]
   */
  async logout(userId, rawRefreshToken) {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await RefreshToken.updateMany(
        { tokenHash, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    } else if (userId) {
      await RefreshToken.updateMany(
        { userId, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }
    return { message: 'Logged out successfully' };
  }

  /**
   * Creates initial organization and admin user during first-time platform bootstrap
   * @param {Object} data
   * @returns {Promise<{ organization: Object, user: Object, accessToken: string, rawRefreshToken: string }>}
   */
  async registerInitialOrg(data) {
    const orgCount = await Organization.countDocuments();
    if (orgCount > 0) {
      const err = new Error('Initial registration is closed. Organizations already exist in the platform.');
      err.code = 'REGISTRATION_CLOSED';
      err.statusCode = 409;
      throw err;
    }

    const existingUser = await User.findOne({ email: data.email.toLowerCase().trim() });
    if (existingUser) {
      const err = new Error('Email is already registered');
      err.code = 'EMAIL_EXISTS';
      err.statusCode = 409;
      throw err;
    }

    // Generate slug from organization name
    const slug = data.organizationName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const organization = await Organization.create({
      name: data.organizationName.trim(),
      slug
    });

    const passwordHash = await hashPassword(data.password);

    const user = await User.create({
      email: data.email.toLowerCase().trim(),
      passwordHash,
      displayName: data.displayName.trim(),
      role: 'org_admin',
      organizationId: organization._id,
      isActive: true
    });

    const accessToken = generateAccessToken(user);
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);

    await RefreshToken.create({
      userId: user._id,
      tokenHash,
      expiresAt: getRefreshTokenExpiryDate(7)
    });

    return {
      organization: {
        id: organization._id.toString(),
        name: organization.name,
        slug: organization.slug
      },
      user: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        organizationId: organization._id.toString()
      },
      accessToken,
      rawRefreshToken
    };
  }

  /**
   * Retrieves sanitized profile for current user
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getCurrentUser(userId) {
    const user = await User.findById(userId).populate('organizationId', 'name slug');
    if (!user) {
      const err = new Error('User not found');
      err.code = 'USER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return {
      id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      organizationId: user.organizationId ? user.organizationId._id.toString() : null,
      organization: user.organizationId ? {
        id: user.organizationId._id.toString(),
        name: user.organizationId.name,
        slug: user.organizationId.slug
      } : null,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt
    };
  }
}

module.exports = new AuthService();

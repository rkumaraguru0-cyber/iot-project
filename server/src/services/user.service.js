const crypto = require('crypto');
const mongoose = require('mongoose');
const { User } = require('../models');
const { hashPassword, comparePassword } = require('../utils/password');
const { logAuditEvent } = require('./audit.service');

class UserService {
  /**
   * Generates a strong cryptographically random temporary password
   * Meets: min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char
   * @returns {string}
   */
  generateTemporaryPassword() {
    const randomPart = crypto.randomBytes(12).toString('base64url');
    // Ensure complexity constraints are guaranteed
    return `Tmp#${randomPart}9!`;
  }

  /**
   * Lists users in an organization with pagination and filters
   * @param {string} organizationId
   * @param {Object} queryParams
   * @returns {Promise<{ users: Array, total: number, page: number, limit: number }>}
   */
  async listUsers(organizationId, queryParams = {}) {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {
      organizationId: new mongoose.Types.ObjectId(organizationId)
    };

    if (queryParams.role) {
      filter.role = queryParams.role;
    }

    if (queryParams.isActive !== undefined) {
      filter.isActive = queryParams.isActive === true || queryParams.isActive === 'true';
    }

    if (queryParams.search) {
      const escaped = queryParams.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { email: { $regex: escaped, $options: 'i' } },
        { displayName: { $regex: escaped, $options: 'i' } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter)
    ]);

    const formattedUsers = users.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt
    }));

    return {
      users: formattedUsers,
      total,
      page,
      limit
    };
  }

  /**
   * Gets single user details by ID within organization scope
   * @param {string} id
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async getUserById(id, organizationId) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const err = new Error('User not found in this organization');
      err.code = 'USER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const user = await User.findOne({
      _id: new mongoose.Types.ObjectId(id),
      organizationId: new mongoose.Types.ObjectId(organizationId)
    })
      .select('-passwordHash')
      .lean();

    if (!user) {
      const err = new Error('User not found in this organization');
      err.code = 'USER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return {
      id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt
    };
  }

  /**
   * Invites a new user to the organization with a one-time temporary password
   * @param {Object} data
   * @param {string} organizationId
   * @param {Object} actorUser
   * @param {string} clientIp
   * @returns {Promise<Object>}
   */
  async inviteUser(data, organizationId, actorUser, clientIp) {
    const normalizedEmail = data.email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      const err = new Error('Email is already registered in the platform');
      err.code = 'EMAIL_EXISTS';
      err.statusCode = 409;
      throw err;
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const user = await User.create({
      email: normalizedEmail,
      displayName: data.displayName.trim(),
      role: data.role,
      passwordHash,
      organizationId: new mongoose.Types.ObjectId(organizationId),
      isActive: true
    });

    await logAuditEvent({
      action: 'user.invited',
      actor: actorUser.userId,
      actorName: actorUser.displayName,
      actorIp: clientIp,
      targetType: 'user',
      targetId: user._id,
      organizationId,
      details: {
        email: user.email,
        role: user.role,
        displayName: user.displayName
      }
    });

    return {
      id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
      temporaryPassword
    };
  }

  /**
   * Updates user role or active status
   * @param {string} id
   * @param {Object} data
   * @param {string} organizationId
   * @param {Object} actorUser
   * @param {string} clientIp
   * @returns {Promise<Object>}
   */
  async updateUser(id, data, organizationId, actorUser, clientIp) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const err = new Error('User not found in this organization');
      err.code = 'USER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const user = await User.findOne({
      _id: new mongoose.Types.ObjectId(id),
      organizationId: new mongoose.Types.ObjectId(organizationId)
    });

    if (!user) {
      const err = new Error('User not found in this organization');
      err.code = 'USER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const beforeState = { role: user.role, isActive: user.isActive };

    if (data.role !== undefined) user.role = data.role;
    if (data.isActive !== undefined) user.isActive = data.isActive;

    await user.save();

    await logAuditEvent({
      action: 'user.updated',
      actor: actorUser.userId,
      actorName: actorUser.displayName,
      actorIp: clientIp,
      targetType: 'user',
      targetId: user._id,
      organizationId,
      details: {
        before: beforeState,
        after: { role: user.role, isActive: user.isActive }
      }
    });

    return {
      id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      updatedAt: user.updatedAt
    };
  }

  /**
   * Updates current user's profile
   * @param {string} userId
   * @param {Object} data
   * @param {string} clientIp
   * @returns {Promise<Object>}
   */
  async updateProfile(userId, data, clientIp) {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.code = 'USER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (data.displayName !== undefined) {
      user.displayName = data.displayName.trim();
    }

    await user.save();

    await logAuditEvent({
      action: 'user.profile.updated',
      actor: userId,
      actorName: user.displayName,
      actorIp: clientIp,
      targetType: 'user',
      targetId: user._id,
      organizationId: user.organizationId,
      details: { displayName: user.displayName }
    });

    return {
      id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      organizationId: user.organizationId.toString(),
      lastLoginAt: user.lastLoginAt
    };
  }

  /**
   * Changes current user's password
   * @param {string} userId
   * @param {string} currentPassword
   * @param {string} newPassword
   * @param {string} clientIp
   * @returns {Promise<{ message: string }>}
   */
  async changePassword(userId, currentPassword, newPassword, clientIp) {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.code = 'USER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const isValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isValid) {
      const err = new Error('Current password is incorrect');
      err.code = 'INVALID_CREDENTIALS';
      err.statusCode = 401;
      throw err;
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    await logAuditEvent({
      action: 'user.password.changed',
      actor: userId,
      actorName: user.displayName,
      actorIp: clientIp,
      targetType: 'user',
      targetId: user._id,
      organizationId: user.organizationId,
      details: { method: 'self_service' }
    });

    return { message: 'Password updated successfully' };
  }
}

module.exports = new UserService();

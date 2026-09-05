const userService = require('../services/user.service');

/**
 * List users in the organization
 */
const listUsers = async (req, res, next) => {
  try {
    const result = await userService.listUsers(req.organizationId, req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single user details by ID
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id, req.organizationId);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

/**
 * Invite a new user to the organization (returns one-time temporary password)
 */
const inviteUser = async (req, res, next) => {
  try {
    const result = await userService.inviteUser(
      req.body,
      req.organizationId,
      req.user,
      req.ip
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Update user role or active status
 */
const updateUser = async (req, res, next) => {
  try {
    const updatedUser = await userService.updateUser(
      req.params.id,
      req.body,
      req.organizationId,
      req.user,
      req.ip
    );
    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated user profile
 */
const getMe = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.user.userId, req.user.organizationId);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

/**
 * Update current user's profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const updated = await userService.updateProfile(req.user.userId, req.body, req.ip);
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * Change current user's password
 */
const changePassword = async (req, res, next) => {
  try {
    const result = await userService.changePassword(
      req.user.userId,
      req.body.currentPassword,
      req.body.newPassword,
      req.ip
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listUsers,
  getUserById,
  inviteUser,
  updateUser,
  getMe,
  updateProfile,
  changePassword
};

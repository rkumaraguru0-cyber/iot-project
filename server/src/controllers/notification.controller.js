const notificationService = require('../services/notification.service');

/**
 * List paginated notifications for the authenticated user
 */
const listNotifications = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;
    const result = await notificationService.listNotifications(
      userId,
      req.organizationId,
      req.query
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get count of unread notifications for the authenticated user
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;
    const result = await notificationService.getUnreadCount(
      userId,
      req.organizationId
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a single notification as read
 */
const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;
    const result = await notificationService.markAsRead(
      req.params.id,
      userId,
      req.organizationId
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read for the authenticated user
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;
    const result = await notificationService.markAllAsRead(
      userId,
      req.organizationId
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
};

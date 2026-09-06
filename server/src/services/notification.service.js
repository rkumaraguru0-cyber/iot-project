const mongoose = require('mongoose');
const { Notification, User } = require('../models');
const emitter = require('../socket/emitter');
const logger = require('../utils/logger');

class NotificationService {
  /**
   * Retrieves paginated notifications for the authenticated user with optional read/unread filtering.
   * Enforces strict user-ownership and organization scoping.
   *
   * @param {string} userId
   * @param {string} organizationId
   * @param {Object} queryParams
   * @returns {Promise<{ notifications: Array, total: number, unreadCount: number, page: number, limit: number, totalPages: number }>}
   */
  async listNotifications(userId, organizationId, queryParams = {}) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);

    const filter = {
      userId: userObjectId,
      organizationId: orgObjectId
    };

    if (queryParams.read !== undefined) {
      filter.read = queryParams.read === 'true' || queryParams.read === true;
    } else if (queryParams.unread === 'true' || queryParams.unread === true) {
      filter.read = false;
    }

    if (queryParams.type) {
      filter.type = queryParams.type.trim();
    }

    if (queryParams.severity) {
      filter.severity = queryParams.severity.trim();
    }

    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({
        userId: userObjectId,
        organizationId: orgObjectId,
        read: false
      })
    ]);

    return {
      notifications,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Returns the count of unread notifications for the authenticated user.
   *
   * @param {string} userId
   * @param {string} organizationId
   * @returns {Promise<{ unreadCount: number }>}
   */
  async getUnreadCount(userId, organizationId) {
    const count = await Notification.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      organizationId: new mongoose.Types.ObjectId(organizationId),
      read: false
    });
    return { unreadCount: count };
  }

  /**
   * Marks a specific notification as read. Verifies user ownership and organization.
   *
   * @param {string} notificationId
   * @param {string} userId
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async markAsRead(notificationId, userId, organizationId) {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      const error = new Error('Invalid notification ID format');
      error.statusCode = 400;
      error.code = 'INVALID_ID';
      throw error;
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(notificationId),
        userId: new mongoose.Types.ObjectId(userId),
        organizationId: new mongoose.Types.ObjectId(organizationId)
      },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      const error = new Error('Notification not found or access denied');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    return notification;
  }

  /**
   * Marks all unread notifications for the authenticated user as read.
   *
   * @param {string} userId
   * @param {string} organizationId
   * @returns {Promise<{ success: boolean, updatedCount: number }>}
   */
  async markAllAsRead(userId, organizationId) {
    const result = await Notification.updateMany(
      {
        userId: new mongoose.Types.ObjectId(userId),
        organizationId: new mongoose.Types.ObjectId(organizationId),
        read: false
      },
      { $set: { read: true } }
    );

    return {
      success: true,
      updatedCount: result.modifiedCount || 0
    };
  }

  /**
   * Dispatches a domain notification to all active operational users in an organization
   * (operators, security analysts, and org admins).
   * Persists documents in MongoDB and emits 'notification:new' via Socket.IO.
   *
   * @param {string} organizationId
   * @param {Object} payload
   * @param {string} payload.type
   * @param {string} payload.title
   * @param {string} payload.message
   * @param {string} payload.severity - 'low' | 'medium' | 'high' | 'critical'
   * @param {string} [payload.relatedEntityType]
   * @param {*} [payload.relatedEntityId]
   * @returns {Promise<Array>}
   */
  async dispatchOrgNotification(organizationId, payload) {
    try {
      const orgObjectId = new mongoose.Types.ObjectId(organizationId);

      // Query active operational personnel in the target organization
      const targetUsers = await User.find({
        organizationId: orgObjectId,
        isActive: true,
        role: { $in: ['operator', 'security_analyst', 'org_admin', 'super_admin'] }
      }).select('_id');

      if (!targetUsers || targetUsers.length === 0) {
        return [];
      }

      const docsToInsert = targetUsers.map((u) => ({
        userId: u._id,
        organizationId: orgObjectId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        severity: payload.severity || 'medium',
        relatedEntityType: payload.relatedEntityType || null,
        relatedEntityId: payload.relatedEntityId || null,
        read: false,
        createdAt: new Date()
      }));

      const createdNotifications = await Notification.insertMany(docsToInsert);

      // Emit real-time Socket.IO notification to each target user's personal room
      createdNotifications.forEach((notif) => {
        emitter.emitNotificationNew(notif.userId.toString(), notif);
      });

      return createdNotifications;
    } catch (err) {
      logger.error(`[NotificationService] Error dispatching org notification: ${err.message}`);
      return [];
    }
  }

  // ==========================================
  // EXACT FIVE DOMAIN NOTIFICATION TRIGGERS
  // ==========================================

  /**
   * Trigger 1: Critical or High Security Event
   */
  async notifySecurityEvent(organizationId, event) {
    if (!event || !['high', 'critical'].includes(event.severity)) {
      return [];
    }

    const title = `Security Alert: ${event.severity.toUpperCase()} Event Detected`;
    const message = event.explanation || `Event ${event.eventId} (${event.category}) detected on device.`;

    return this.dispatchOrgNotification(organizationId, {
      type: 'security_event',
      title,
      message,
      severity: event.severity === 'critical' ? 'critical' : 'high',
      relatedEntityType: 'SecurityEvent',
      relatedEntityId: event.eventId || event._id
    });
  }

  /**
   * Trigger 2: Incident Creation
   */
  async notifyIncidentCreated(organizationId, incident) {
    if (!incident) return [];

    const title = `New Incident Opened: [${incident.severity.toUpperCase()}] ${incident.title}`;
    const message = `Incident ${incident.incidentId || incident._id} opened with severity ${incident.severity}.`;

    return this.dispatchOrgNotification(organizationId, {
      type: 'incident_created',
      title,
      message,
      severity: incident.severity === 'critical' ? 'critical' : (incident.severity === 'high' ? 'high' : 'medium'),
      relatedEntityType: 'Incident',
      relatedEntityId: incident.incidentId || incident._id
    });
  }

  /**
   * Trigger 3: Incident State Change
   */
  async notifyIncidentUpdated(organizationId, incident) {
    if (!incident) return [];

    const title = `Incident Updated: ${incident.incidentId || incident._id}`;
    const message = `Incident is now ${incident.status} (Severity: ${incident.severity}).`;

    return this.dispatchOrgNotification(organizationId, {
      type: 'incident_updated',
      title,
      message,
      severity: incident.severity === 'critical' ? 'critical' : (incident.severity === 'high' ? 'high' : 'medium'),
      relatedEntityType: 'Incident',
      relatedEntityId: incident.incidentId || incident._id
    });
  }

  /**
   * Trigger 4: Device Risk Escalation into Critical/Severe
   */
  async notifyRiskEscalated(organizationId, device, riskScore, riskSeverity) {
    if (!['critical', 'severe'].includes(riskSeverity)) return [];

    const devName = device?.name || device?.deviceId || 'IoT Device';
    const title = `Risk Escalation: ${devName} entered ${riskSeverity.toUpperCase()}`;
    const message = `Device risk score escalated to ${riskScore} (${riskSeverity.toUpperCase()}).`;

    return this.dispatchOrgNotification(organizationId, {
      type: 'risk_escalated',
      title,
      message,
      severity: 'critical',
      relatedEntityType: 'Device',
      relatedEntityId: device?.deviceId || device?._id
    });
  }

  /**
   * Trigger 5: Device Quarantine
   */
  async notifyDeviceQuarantined(organizationId, device) {
    const devName = device?.name || device?.deviceId || 'IoT Device';
    const title = `Device Quarantined: ${devName}`;
    const message = `Device ${devName} has been quarantined and isolated from the operational network.`;

    return this.dispatchOrgNotification(organizationId, {
      type: 'device_quarantined',
      title,
      message,
      severity: 'high',
      relatedEntityType: 'Device',
      relatedEntityId: device?.deviceId || device?._id
    });
  }
}

module.exports = new NotificationService();

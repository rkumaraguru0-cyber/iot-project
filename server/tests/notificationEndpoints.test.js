const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/token');
const { User, Notification } = require('../src/models');
const notificationService = require('../src/services/notification.service');
const emitter = require('../src/socket/emitter');

describe('Notifications REST Endpoints & Service Triggers (Phase 11)', () => {
  const orgId = new mongoose.Types.ObjectId();
  const otherOrgId = new mongoose.Types.ObjectId();

  const user1 = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'security_analyst',
    displayName: 'Analyst Jane',
    email: 'jane@soc.org',
    isActive: true
  };

  const user2 = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'operator',
    displayName: 'Operator Bob',
    email: 'bob@soc.org',
    isActive: true
  };

  const otherOrgUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: otherOrgId,
    role: 'security_analyst',
    displayName: 'Other Analyst',
    email: 'other@soc.org',
    isActive: true
  };

  let user1Token, user2Token, otherOrgUserToken;

  beforeAll(() => {
    user1Token = generateAccessToken(user1);
    user2Token = generateAccessToken(user2);
    otherOrgUserToken = generateAccessToken(otherOrgUser);
  });

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      let matched = user1;
      if (idStr === user2._id.toString()) matched = user2;
      else if (idStr === otherOrgUser._id.toString()) matched = otherOrgUser;

      return {
        select: jest.fn().mockResolvedValue({
          ...matched,
          isActive: true
        })
      };
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await new Promise((resolve) => setImmediate(resolve));
  });

  describe('REST Endpoints - Listing, Unread Count, and Read State', () => {
    it('GET /api/v1/notifications returns paginated list of user notifications', async () => {
      jest.spyOn(notificationService, 'listNotifications').mockResolvedValue({
        notifications: [
          { _id: 'notif-1', title: 'Critical Alert', read: false }
        ],
        total: 1,
        unreadCount: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      });

      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.notifications[0].title).toBe('Critical Alert');
      expect(notificationService.listNotifications).toHaveBeenCalledWith(
        user1._id.toString(),
        orgId.toString(),
        expect.any(Object)
      );
    });

    it('GET /api/v1/notifications/unread-count returns unread count for authenticated user', async () => {
      jest.spyOn(notificationService, 'getUnreadCount').mockResolvedValue({
        unreadCount: 3
      });

      const res = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.unreadCount).toBe(3);
    });

    it('PATCH /api/v1/notifications/:id/read marks a single notification as read', async () => {
      const notifId = new mongoose.Types.ObjectId();
      jest.spyOn(notificationService, 'markAsRead').mockResolvedValue({
        _id: notifId.toString(),
        read: true
      });

      const res = await request(app)
        .patch(`/api/v1/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.read).toBe(true);
      expect(notificationService.markAsRead).toHaveBeenCalledWith(
        notifId.toString(),
        user1._id.toString(),
        orgId.toString()
      );
    });

    it('PATCH /api/v1/notifications/:id/read returns 404 when notification not found or access denied', async () => {
      const notifId = new mongoose.Types.ObjectId();
      const notFoundErr = new Error('Notification not found or access denied');
      notFoundErr.statusCode = 404;
      notFoundErr.code = 'NOT_FOUND';

      jest.spyOn(notificationService, 'markAsRead').mockRejectedValue(notFoundErr);

      const res = await request(app)
        .patch(`/api/v1/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(404);
    });

    it('PATCH /api/v1/notifications/read-all marks all unread notifications as read', async () => {
      jest.spyOn(notificationService, 'markAllAsRead').mockResolvedValue({
        success: true,
        updatedCount: 5
      });

      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.updatedCount).toBe(5);
    });
  });

  describe('Exact Five Domain Notification Triggers', () => {
    beforeEach(() => {
      jest.spyOn(User, 'find').mockImplementation(() => ({
        select: jest.fn().mockResolvedValue([
          { _id: user1._id },
          { _id: user2._id }
        ])
      }));
      jest.spyOn(Notification, 'insertMany').mockImplementation((docs) =>
        Promise.resolve(
          docs.map((d, i) => ({
            ...d,
            _id: new mongoose.Types.ObjectId()
          }))
        )
      );
      jest.spyOn(emitter, 'emitNotificationNew').mockImplementation(() => {});
    });

    it('Trigger 1: creates notifications for critical/high SecurityEvent', async () => {
      const event = {
        _id: new mongoose.Types.ObjectId(),
        eventId: 'EVT-TEST-1',
        severity: 'critical',
        category: 'auth_attack',
        explanation: 'Multiple failed logins'
      };

      const notifs = await notificationService.notifySecurityEvent(orgId, event);
      expect(notifs.length).toBe(2);
      expect(notifs[0].type).toBe('security_event');
      expect(notifs[0].severity).toBe('critical');
      expect(emitter.emitNotificationNew).toHaveBeenCalledTimes(2);
    });

    it('Trigger 1 (ignored): does NOT create notification for low/medium SecurityEvent', async () => {
      const event = {
        _id: new mongoose.Types.ObjectId(),
        eventId: 'EVT-TEST-LOW',
        severity: 'low',
        category: 'telemetry'
      };

      const notifs = await notificationService.notifySecurityEvent(orgId, event);
      expect(notifs.length).toBe(0);
      expect(emitter.emitNotificationNew).not.toHaveBeenCalled();
    });

    it('Trigger 2: creates notifications for Incident creation', async () => {
      const incident = {
        _id: new mongoose.Types.ObjectId(),
        incidentId: 'INC-NEW-1',
        title: 'Ransomware Outbreak',
        severity: 'critical'
      };

      const notifs = await notificationService.notifyIncidentCreated(orgId, incident);
      expect(notifs.length).toBe(2);
      expect(notifs[0].type).toBe('incident_created');
      expect(notifs[0].severity).toBe('critical');
    });

    it('Trigger 3: creates notifications for Incident update', async () => {
      const incident = {
        _id: new mongoose.Types.ObjectId(),
        incidentId: 'INC-NEW-1',
        status: 'contained',
        severity: 'high'
      };

      const notifs = await notificationService.notifyIncidentUpdated(orgId, incident);
      expect(notifs.length).toBe(2);
      expect(notifs[0].type).toBe('incident_updated');
      expect(notifs[0].severity).toBe('high');
    });

    it('Trigger 4: creates notifications for Device risk escalation to Critical or Severe', async () => {
      const device = {
        _id: new mongoose.Types.ObjectId(),
        deviceId: 'DEV-001',
        name: 'Critical Pump'
      };

      const notifs = await notificationService.notifyRiskEscalated(orgId, device, 92, 'severe');
      expect(notifs.length).toBe(2);
      expect(notifs[0].type).toBe('risk_escalated');
      expect(notifs[0].severity).toBe('critical');
    });

    it('Trigger 4 (ignored): does NOT create notification for Low or Medium risk', async () => {
      const device = {
        _id: new mongoose.Types.ObjectId(),
        deviceId: 'DEV-001',
        name: 'Safe Pump'
      };

      const notifs = await notificationService.notifyRiskEscalated(orgId, device, 35, 'medium');
      expect(notifs.length).toBe(0);
    });

    it('Trigger 5: creates notifications for Device quarantine', async () => {
      const device = {
        _id: new mongoose.Types.ObjectId(),
        deviceId: 'DEV-001',
        name: 'Compromised Sensor'
      };

      const notifs = await notificationService.notifyDeviceQuarantined(orgId, device);
      expect(notifs.length).toBe(2);
      expect(notifs[0].type).toBe('device_quarantined');
      expect(notifs[0].severity).toBe('high');
    });
  });
});

const http = require('http');
const ioClient = require('socket.io-client');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const config = require('../src/config');
const { generateAccessToken } = require('../src/utils/token');
const { User, Device, Incident } = require('../src/models');
const { initSocketServer, closeSocketServer } = require('../src/socket');
const emitter = require('../src/socket/emitter');

describe('Socket.IO Real-Time Engine & Domain Events (Phase 11)', () => {
  let server, io, serverUrl;

  const org1Id = new mongoose.Types.ObjectId();
  const org2Id = new mongoose.Types.ObjectId();

  const userOrg1 = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: org1Id,
    role: 'security_analyst',
    displayName: 'Analyst Org1',
    email: 'analyst@org1.com',
    isActive: true
  };

  const userOrg2 = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: org2Id,
    role: 'security_analyst',
    displayName: 'Analyst Org2',
    email: 'analyst@org2.com',
    isActive: true
  };

  const inactiveUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: org1Id,
    role: 'viewer',
    displayName: 'Inactive User',
    email: 'inactive@org1.com',
    isActive: false
  };

  let tokenOrg1, tokenOrg2, tokenInactive;

  beforeAll(async () => {
    tokenOrg1 = generateAccessToken(userOrg1);
    tokenOrg2 = generateAccessToken(userOrg2);
    tokenInactive = generateAccessToken(inactiveUser);

    server = http.createServer(app);
    io = initSocketServer(server);

    await new Promise((resolve) => {
      server.listen(0, () => {
        const port = server.address().port;
        serverUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await closeSocketServer();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      let matched = null;
      if (idStr === userOrg1._id.toString()) matched = userOrg1;
      else if (idStr === userOrg2._id.toString()) matched = userOrg2;
      else if (idStr === inactiveUser._id.toString()) matched = inactiveUser;

      return {
        select: jest.fn().mockResolvedValue(matched)
      };
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await new Promise((resolve) => setImmediate(resolve));
  });

  const createClientSocket = (token) => {
    return ioClient(serverUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false
    });
  };

  describe('Socket.IO Handshake Authentication', () => {
    it('authenticates and connects with a valid JWT', (done) => {
      const client = createClientSocket(tokenOrg1);
      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        done();
      });
      client.on('connect_error', (err) => {
        done(err);
      });
    });

    it('rejects connection when token is missing', (done) => {
      const client = createClientSocket(null);
      client.on('connect_error', (err) => {
        expect(err.message).toMatch(/Authentication token required/i);
        client.disconnect();
        done();
      });
    });

    it('rejects connection when token is invalid', (done) => {
      const client = createClientSocket('invalid.jwt.token');
      client.on('connect_error', (err) => {
        expect(err.message).toMatch(/Invalid authentication token/i);
        client.disconnect();
        done();
      });
    });

    it('rejects connection when token is expired', (done) => {
      const expiredToken = jwt.sign(
        { userId: userOrg1._id, organizationId: org1Id, role: userOrg1.role },
        config.jwt.secret,
        { expiresIn: '-1s' }
      );
      const client = createClientSocket(expiredToken);
      client.on('connect_error', (err) => {
        expect(err.message).toMatch(/Token expired/i);
        client.disconnect();
        done();
      });
    });

    it('rejects connection when user is inactive', (done) => {
      const client = createClientSocket(tokenInactive);
      client.on('connect_error', (err) => {
        expect(err.message).toMatch(/User account inactive/i);
        client.disconnect();
        done();
      });
    });
  });

  describe('Exact Four Rooms & Tenant Room Isolation', () => {
    beforeEach(() => {
      jest.spyOn(Device, 'findOne').mockImplementation((filter) => {
        if (filter.organizationId?.toString() === org1Id.toString() && filter.deviceId === 'DEV-ORG1-100') {
          return Promise.resolve({
            _id: new mongoose.Types.ObjectId(),
            deviceId: 'DEV-ORG1-100',
            name: 'Pump 100',
            organizationId: org1Id
          });
        }
        return Promise.resolve(null);
      });

      jest.spyOn(Incident, 'findOne').mockImplementation((filter) => {
        if (filter.organizationId?.toString() === org1Id.toString() && filter.incidentId === 'INC-ORG1-500') {
          return Promise.resolve({
            _id: new mongoose.Types.ObjectId(),
            incidentId: 'INC-ORG1-500',
            title: 'Exploit attempt',
            organizationId: org1Id
          });
        }
        return Promise.resolve(null);
      });
    });

    it('allows client in Org 1 to join device room in Org 1', (done) => {
      const client = createClientSocket(tokenOrg1);
      client.on('connect', () => {
        client.emit('join:device', { deviceId: 'DEV-ORG1-100' }, (res) => {
          expect(res.success).toBe(true);
          expect(res.room).toBe('device:DEV-ORG1-100');
          client.disconnect();
          done();
        });
      });
    });

    it('rejects client in Org 2 attempting to join Org 1 device room (Cross-Tenant Rejection)', (done) => {
      const clientOrg2 = createClientSocket(tokenOrg2);
      clientOrg2.on('connect', () => {
        clientOrg2.emit('join:device', { deviceId: 'DEV-ORG1-100' }, (res) => {
          expect(res.success).toBe(false);
          expect(res.error).toMatch(/Device not found in organization/i);
          clientOrg2.disconnect();
          done();
        });
      });
    });

    it('allows client in Org 1 to join incident room in Org 1', (done) => {
      const client = createClientSocket(tokenOrg1);
      client.on('connect', () => {
        client.emit('join:incident', { incidentId: 'INC-ORG1-500' }, (res) => {
          expect(res.success).toBe(true);
          expect(res.room).toBe('incident:INC-ORG1-500');
          client.disconnect();
          done();
        });
      });
    });

    it('rejects client in Org 2 attempting to join Org 1 incident room (Cross-Tenant Rejection)', (done) => {
      const clientOrg2 = createClientSocket(tokenOrg2);
      clientOrg2.on('connect', () => {
        clientOrg2.emit('join:incident', { incidentId: 'INC-ORG1-500' }, (res) => {
          expect(res.success).toBe(false);
          expect(res.error).toMatch(/Incident not found in organization/i);
          clientOrg2.disconnect();
          done();
        });
      });
    });
  });

  describe('Exact Six Domain Events Verification', () => {
    let client1, client2;

    beforeEach((done) => {
      client1 = createClientSocket(tokenOrg1);
      client2 = createClientSocket(tokenOrg2);

      let connectedCount = 0;
      const checkDone = () => {
        connectedCount++;
        if (connectedCount === 2) done();
      };

      client1.on('connect', checkDone);
      client2.on('connect', checkDone);
    });

    afterEach(() => {
      if (client1 && client1.connected) client1.disconnect();
      if (client2 && client2.connected) client2.disconnect();
    });

    it('Event 1: emits security-event:new to org:{orgId} with exact payload', (done) => {
      const eventData = {
        eventId: 'EVT-999',
        severity: 'critical',
        category: 'auth_attack',
        deviceId: 'dev-123',
        deviceName: 'Gateway Node',
        explanation: 'Multiple failed password attempts'
      };

      let org2Received = false;
      client2.on('security-event:new', () => {
        org2Received = true;
      });

      client1.on('security-event:new', (payload) => {
        expect(payload).toEqual(eventData);
        expect(org2Received).toBe(false);
        done();
      });

      emitter.emitSecurityEventNew(org1Id.toString(), eventData);
    });

    it('Event 2: emits incident:new to org:{orgId} with exact payload', (done) => {
      const incidentData = {
        incidentId: 'INC-888',
        title: 'Firmware Tampering',
        severity: 'critical',
        deviceId: 'dev-456',
        deviceName: 'Smart Meter'
      };

      client1.on('incident:new', (payload) => {
        expect(payload).toEqual(incidentData);
        done();
      });

      emitter.emitIncidentNew(org1Id.toString(), incidentData);
    });

    it('Event 3: emits incident:updated to incident:{id} and org:{orgId} with exact payload', (done) => {
      const updateData = {
        status: 'contained',
        severity: 'high'
      };

      client1.on('incident:updated', (payload) => {
        expect(payload).toEqual({
          incidentId: 'INC-888',
          status: 'contained',
          severity: 'high'
        });
        done();
      });

      emitter.emitIncidentUpdated(org1Id.toString(), 'INC-888', updateData);
    });

    it('Event 4: emits device:status-changed only for quarantined, offline, decommissioned', (done) => {
      const statusData = {
        deviceId: 'dev-777',
        status: 'quarantined',
        previousStatus: 'active'
      };

      client1.on('device:status-changed', (payload) => {
        expect(payload).toEqual(statusData);
        done();
      });

      emitter.emitDeviceStatusChanged(org1Id.toString(), statusData);
    });

    it('Event 5: emits device:risk-escalated when risk enters critical or severe', (done) => {
      const riskData = {
        deviceId: 'dev-777',
        riskScore: 88,
        riskSeverity: 'critical'
      };

      client1.on('device:risk-escalated', (payload) => {
        expect(payload).toEqual(riskData);
        done();
      });

      emitter.emitDeviceRiskEscalated(org1Id.toString(), riskData);
    });

    it('Event 6: emits notification:new to user:{userId} with exact payload', (done) => {
      const notifData = {
        notificationId: 'notif-111',
        type: 'security_event',
        title: 'Security Alert',
        severity: 'critical'
      };

      let client2Received = false;
      client2.on('notification:new', () => {
        client2Received = true;
      });

      client1.on('notification:new', (payload) => {
        expect(payload).toEqual(notifData);
        expect(client2Received).toBe(false);
        done();
      });

      emitter.emitNotificationNew(userOrg1._id.toString(), notifData);
    });
  });
});

const mongoose = require('mongoose');
const { createAedesAuth } = require('../src/mqtt/auth');
const { createTopicAuthorizer } = require('../src/mqtt/authorizer');
const { parseTelemetryTopic, isTelemetryTopic } = require('../src/mqtt/topicParser');
const { createMessageHandler } = require('../src/mqtt/messageHandler');
const { startMqttBroker, closeBroker } = require('../src/mqtt/aedesBroker');
const telemetryService = require('../src/services/telemetry.service');
const { Device, Organization, Telemetry } = require('../src/models');
const { hashToken } = require('../src/utils/token');

describe('Aedes MQTT Broker Handlers & Authorization (Phase 6)', () => {
  const dummyOrgId = new mongoose.Types.ObjectId();
  const rawApiKey = 'device_mqtt_secret_key_999999';
  const apiKeyHash = hashToken(rawApiKey);

  const mockOrg = {
    _id: dummyOrgId,
    name: 'Acme Corp',
    slug: 'acme-corp'
  };

  const mockDevice = {
    _id: new mongoose.Types.ObjectId(),
    deviceId: 'DEV-MQTT-001',
    name: 'MQTT Test Sensor',
    organizationId: dummyOrgId,
    apiKeyHash,
    status: 'registered',
    healthStatus: 'unknown',
    expectedReportingInterval: 30,
    lastSeenAt: null
  };

  beforeEach(() => {
    telemetryService.clearDeduplicationCache();
    jest.clearAllMocks();
    jest.spyOn(Device, 'updateOne').mockResolvedValue({ acknowledged: true });
  });

  describe('MQTT Topic Parser', () => {
    it('should correctly parse canonical telemetry topic', () => {
      const topic = 'acme-corp/devices/DEV-MQTT-001/telemetry';
      const parsed = parseTelemetryTopic(topic);
      expect(parsed).toEqual({
        orgSlug: 'acme-corp',
        deviceId: 'DEV-MQTT-001'
      });
      expect(isTelemetryTopic(topic)).toBe(true);
    });

    it('7. should reject invalid, wildcard, or future-phase topics', () => {
      expect(parseTelemetryTopic('acme-corp/devices/DEV-MQTT-001/status')).toBeNull();
      expect(parseTelemetryTopic('acme-corp/devices/DEV-MQTT-001/commands')).toBeNull();
      expect(parseTelemetryTopic('acme-corp/devices/+/telemetry')).toBeNull();
      expect(parseTelemetryTopic('+/devices/#')).toBeNull();
      expect(parseTelemetryTopic('invalid/topic')).toBeNull();
    });
  });

  describe('MQTT Authentication Hook', () => {
    const authenticate = createAedesAuth();

    it('1. should accept valid deviceId username and raw API key password', (done) => {
      jest.spyOn(Device, 'findOne').mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...mockDevice,
          organizationId: mockOrg
        })
      });

      const client = { id: 'client-1', req: { socket: { remoteAddress: '127.0.0.1' } } };

      authenticate(client, 'DEV-MQTT-001', Buffer.from(rawApiKey), (err, success) => {
        expect(err).toBeNull();
        expect(success).toBe(true);
        expect(client.session).toBeDefined();
        expect(client.session.deviceId).toBe('DEV-MQTT-001');
        expect(client.session.orgSlug).toBe('acme-corp');
        done();
      });
    });

    it('2. should reject invalid API key password', (done) => {
      jest.spyOn(Device, 'findOne').mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      const client = { id: 'client-2', req: { socket: { remoteAddress: '127.0.0.1' } } };

      authenticate(client, 'DEV-MQTT-001', Buffer.from('wrong_secret_key'), (err, success) => {
        expect(err).toBeDefined();
        expect(err.returnCode).toBe(4); // Bad username or password
        expect(success).toBe(false);
        done();
      });
    });

    it('3. should reject missing username or password', (done) => {
      const client = { id: 'client-3', req: { socket: { remoteAddress: '127.0.0.1' } } };

      authenticate(client, null, null, (err, success) => {
        expect(err).toBeDefined();
        expect(err.returnCode).toBe(4);
        expect(success).toBe(false);
        done();
      });
    });
  });

  describe('MQTT Topic Authorization Hooks', () => {
    const { authorizePublish, authorizeSubscribe } = createTopicAuthorizer();

    const authenticatedClient = {
      id: 'client-1',
      session: {
        _id: mockDevice._id,
        deviceId: mockDevice.deviceId,
        organizationId: dummyOrgId,
        orgSlug: 'acme-corp',
        expectedReportingInterval: 30
      }
    };

    it('4. should authorize publish to exactly matched canonical telemetry topic', (done) => {
      const packet = { topic: 'acme-corp/devices/DEV-MQTT-001/telemetry' };

      authorizePublish(authenticatedClient, packet, (err) => {
        expect(err).toBeNull();
        done();
      });
    });

    it('5. should reject publish to wrong organization topic', (done) => {
      const packet = { topic: 'other-org/devices/DEV-MQTT-001/telemetry' };

      authorizePublish(authenticatedClient, packet, (err) => {
        expect(err).toBeDefined();
        expect(err.message).toMatch(/forbidden|cross-tenant/i);
        done();
      });
    });

    it('6. should reject publish to wrong deviceId topic', (done) => {
      const packet = { topic: 'acme-corp/devices/DEV-OTHER-999/telemetry' };

      authorizePublish(authenticatedClient, packet, (err) => {
        expect(err).toBeDefined();
        expect(err.message).toMatch(/impersonation|forbidden/i);
        done();
      });
    });

    it('7. should reject subscription to any topic (Phase 6 only supports telemetry publish)', (done) => {
      const sub = { topic: 'acme-corp/devices/DEV-MQTT-001/telemetry' };

      authorizeSubscribe(authenticatedClient, sub, (err) => {
        expect(err).toBeDefined();
        expect(err.message).toMatch(/not permitted|subscriptions/i);
        done();
      });
    });
  });

  describe('MQTT Message Handler & Validation', () => {
    const handler = createMessageHandler();

    const authenticatedClient = {
      id: 'client-test-rate',
      session: {
        _id: mockDevice._id,
        deviceId: mockDevice.deviceId,
        organizationId: dummyOrgId,
        orgSlug: 'acme-corp',
        expectedReportingInterval: 30
      }
    };

    it('8. should parse valid JSON telemetry payload and ingest into database', async () => {
      const nowIso = new Date().toISOString();
      const payloadObj = {
        timestamp: nowIso,
        metrics: { cpu_usage: 44.2, temperature: 31.0 },
        metadata: { firmwareVersion: '1.0.0' }
      };

      const packet = {
        topic: 'acme-corp/devices/DEV-MQTT-001/telemetry',
        payload: Buffer.from(JSON.stringify(payloadObj))
      };

      jest.spyOn(Telemetry, 'create').mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
      jest.spyOn(Device, 'updateOne').mockResolvedValue({ acknowledged: true });

      await handler(packet, authenticatedClient);

      expect(Telemetry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: mockDevice._id,
          organizationId: dummyOrgId
        })
      );
    });

    it('9. should handle malformed JSON cleanly without throwing or crashing', async () => {
      const packet = {
        topic: 'acme-corp/devices/DEV-MQTT-001/telemetry',
        payload: Buffer.from('{ bad json, not valid ...')
      };

      // Should not throw
      await expect(handler(packet, authenticatedClient)).resolves.not.toThrow();
    });

    it('14. should handle excessive message rate (> 10 msg/sec) and throttle cleanly', async () => {
      const nowIso = new Date().toISOString();
      const packet = {
        topic: 'acme-corp/devices/DEV-MQTT-001/telemetry',
        payload: Buffer.from(JSON.stringify({ timestamp: nowIso, metrics: { cpu_usage: 10 } }))
      };

      jest.spyOn(Telemetry, 'create').mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
      jest.spyOn(Device, 'updateOne').mockResolvedValue({ acknowledged: true });

      // Send 15 messages in the same second window
      for (let i = 0; i < 15; i++) {
        await handler(packet, authenticatedClient);
      }

      // Max 10 messages should be ingested per second per client
      expect(Telemetry.create.mock.calls.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Broker Lifecycle Management', () => {
    it('15. should start and gracefully shut down Aedes broker on test port', async () => {
      const originalPort = process.env.MQTT_PORT;
      process.env.MQTT_PORT = '18884'; // use dedicated test port

      const { aedes, server } = await startMqttBroker(18884, '127.0.0.1');
      expect(aedes).toBeDefined();
      expect(server).toBeDefined();

      await closeBroker();

      process.env.MQTT_PORT = originalPort;
    });
  });
});

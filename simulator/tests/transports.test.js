const MqttTransport = require('../src/transports/mqttTransport');
const RestTransport = require('../src/transports/restTransport');
const FleetSimulator = require('../src/engine/fleetSimulator');

describe('Simulator Transports & Modes (Phase 6)', () => {
  const mockConfig = {
    orgSlug: 'acme-corp',
    mqttUrl: 'mqtt://localhost:1883',
    apiUrl: 'http://localhost:5000/api/v1',
    devices: [
      {
        deviceId: 'DEV-SIM-001',
        type: 'temperature_sensor',
        apiKey: 'sim_api_key_12345'
      }
    ]
  };

  const sampleReading = {
    deviceId: 'DEV-SIM-001',
    timestamp: new Date().toISOString(),
    metrics: {
      temperature: 23.4,
      cpu_usage: 12.0
    },
    metadata: {
      firmwareVersion: '1.0.0'
    }
  };

  describe('34. MQTT Transport', () => {
    it('should build canonical topic and serialize payload for device', async () => {
      const transport = new MqttTransport(mockConfig);
      
      const mockClient = {
        publish: jest.fn((topic, payloadStr, opts, cb) => cb && cb(null)),
        end: jest.fn((force, cb) => cb && cb()),
        connected: true
      };

      transport.clients.set('DEV-SIM-001', mockClient);

      const success = await transport.publish(mockConfig.devices[0], sampleReading);
      expect(success).toBe(true);

      expect(mockClient.publish).toHaveBeenCalledWith(
        'acme-corp/devices/DEV-SIM-001/telemetry',
        expect.any(String),
        { qos: 0 },
        expect.any(Function)
      );

      const publishedPayload = JSON.parse(mockClient.publish.mock.calls[0][1]);
      expect(publishedPayload.timestamp).toBe(sampleReading.timestamp);
      expect(publishedPayload.metrics.temperature).toBe(23.4);
    });
  });

  describe('35. REST Transport', () => {
    it('should send POST request with X-Device-API-Key header to ingestion endpoint', async () => {
      const transport = new RestTransport(mockConfig);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ status: 'stored' })
      });

      const res = await transport.send(mockConfig.devices[0], sampleReading);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/v1/telemetry/ingest',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-API-Key': 'sim_api_key_12345'
          },
          body: JSON.stringify(sampleReading)
        }
      );
      expect(res.success).toBe(true);
      expect(res.status).toBe(201);
    });
  });

  describe('36. Existing Phase 5 Engine & Dry-Run Integration', () => {
    it('should run fleet simulator in dry-run mode without errors', () => {
      const simulator = new FleetSimulator();

      const readings = simulator.tick();
      expect(readings).toHaveLength(5);
      expect(readings[0].deviceId).toBe('DEV-TS-001');
      expect(readings[0].metrics).toBeDefined();
      expect(readings[0].metrics.temperature).toBeGreaterThanOrEqual(18.0);
      expect(readings[0].metrics.temperature).toBeLessThanOrEqual(28.0);
    });
  });
});

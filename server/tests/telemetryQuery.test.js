const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/token');
const { User, Device, Telemetry } = require('../src/models');

describe('Device Telemetry Query API (Phase 6)', () => {
  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();

  const analystOrgA = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgAId,
    role: 'security_analyst',
    displayName: 'Analyst Org A',
    email: 'analyst@orga.com'
  };

  const deviceOrgA = {
    _id: new mongoose.Types.ObjectId(),
    deviceId: 'DEV-A-001',
    name: 'Sensor A',
    organizationId: orgAId,
    type: 'temperature_sensor'
  };

  const deviceOrgB = {
    _id: new mongoose.Types.ObjectId(),
    deviceId: 'DEV-B-001',
    name: 'Sensor B',
    organizationId: orgBId,
    type: 'smart_camera'
  };

  let tokenOrgA;

  beforeAll(() => {
    tokenOrgA = generateAccessToken(analystOrgA);
  });

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      return {
        select: jest.fn().mockResolvedValue({
          ...analystOrgA,
          isActive: true
        })
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/v1/devices/:id/telemetry', () => {
    it('30 & 33. should return chronological telemetry records respecting limit for authorized tenant device', async () => {
      jest.spyOn(Device, 'findOne').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(deviceOrgA)
        })
      });
      jest.spyOn(Telemetry, 'countDocuments').mockResolvedValue(2);

      const mockTelemetry = [
        {
          _id: new mongoose.Types.ObjectId(),
          deviceId: deviceOrgA._id,
          organizationId: orgAId,
          timestamp: new Date(Date.now() - 60000),
          metrics: { cpu_usage: 10, temperature: 20 }
        },
        {
          _id: new mongoose.Types.ObjectId(),
          deviceId: deviceOrgA._id,
          organizationId: orgAId,
          timestamp: new Date(),
          metrics: { cpu_usage: 12, temperature: 21 }
        }
      ];

      const leanMock = jest.fn().mockResolvedValue(mockTelemetry);
      const limitMock = jest.fn().mockReturnValue({ lean: leanMock });
      const sortMock = jest.fn().mockReturnValue({ limit: limitMock });
      jest.spyOn(Telemetry, 'find').mockReturnValue({ sort: sortMock });

      const response = await request(app)
        .get(`/api/v1/devices/${deviceOrgA._id}/telemetry?limit=50&sort=asc`)
        .set('Authorization', `Bearer ${tokenOrgA}`);

      expect(response.status).toBe(200);
      expect(response.body.telemetry).toHaveLength(2);
      expect(Telemetry.find).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: deviceOrgA._id,
          organizationId: orgAId
        })
      );
      expect(limitMock).toHaveBeenCalledWith(50);
      expect(sortMock).toHaveBeenCalledWith({ timestamp: 1 });
    });

    it('31 & 32. should return 404 when querying device belonging to a different organization', async () => {
      // Device.findOne with tenant filter returns null because org does not match
      jest.spyOn(Device, 'findOne').mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/devices/${deviceOrgB._id}/telemetry`)
        .set('Authorization', `Bearer ${tokenOrgA}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('DEVICE_NOT_FOUND');
    });

    it('should reject unauthenticated request with 401', async () => {
      const response = await request(app)
        .get(`/api/v1/devices/${deviceOrgA._id}/telemetry`);

      expect(response.status).toBe(401);
    });
  });
});

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const authService = require('../src/services/auth.service');
const { generateAccessToken } = require('../src/utils/token');

describe('Auth API Endpoints Integration (Phase 3)', () => {
  const dummyUserId = new mongoose.Types.ObjectId();
  const dummyOrgId = new mongoose.Types.ObjectId();

  const mockUser = {
    _id: dummyUserId,
    email: 'operator@acme.com',
    displayName: 'SOC Operator Alex',
    role: 'operator',
    organizationId: dummyOrgId,
    isActive: true,
    lastLoginAt: new Date()
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should authenticate valid credentials, return accessToken and set httpOnly cookie', async () => {
      jest.spyOn(authService, 'login').mockResolvedValue({
        accessToken: 'mock_jwt_access_token_xyz',
        rawRefreshToken: 'mock_refresh_token_80_char_string',
        user: {
          id: dummyUserId.toString(),
          email: mockUser.email,
          displayName: mockUser.displayName,
          role: mockUser.role,
          organizationId: dummyOrgId.toString(),
          lastLoginAt: mockUser.lastLoginAt
        }
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'operator@acme.com',
          password: 'CorrectPassword123!'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken', 'mock_jwt_access_token_xyz');
      expect(res.body.user).toHaveProperty('email', 'operator@acme.com');
      expect(res.body.user).toHaveProperty('role', 'operator');
      expect(res.body.user).not.toHaveProperty('passwordHash');

      // Verify Set-Cookie header contains refreshToken
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.includes('refreshToken='))).toBe(true);
      expect(cookies.some(c => c.includes('HttpOnly'))).toBe(true);
    });

    it('should return 401 with generic INVALID_CREDENTIALS for invalid password', async () => {
      const err = new Error('Invalid credentials');
      err.code = 'INVALID_CREDENTIALS';
      err.statusCode = 401;
      jest.spyOn(authService, 'login').mockRejectedValue(err);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'operator@acme.com',
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'INVALID_CREDENTIALS');
      expect(res.body.error).toHaveProperty('message', 'Invalid credentials');
    });

    it('should return 403 if account is deactivated', async () => {
      const err = new Error('Your account has been deactivated. Please contact your administrator.');
      err.code = 'ACCOUNT_DEACTIVATED';
      err.statusCode = 403;
      jest.spyOn(authService, 'login').mockRejectedValue(err);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'deactivated@acme.com',
          password: 'ValidPassword123!'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'ACCOUNT_DEACTIVATED');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should issue new access token and rotate cookie when valid refresh cookie is sent', async () => {
      jest.spyOn(authService, 'refresh').mockResolvedValue({
        accessToken: 'new_rotated_jwt_access_token',
        rawRefreshToken: 'new_rotated_refresh_token'
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', ['refreshToken=old_valid_refresh_token_string']);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken', 'new_rotated_jwt_access_token');

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.includes('refreshToken=new_rotated_refresh_token'))).toBe(true);
    });

    it('should return 401 if refresh token cookie is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'REFRESH_TOKEN_REQUIRED');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should revoke token, clear cookie, and return 200 for authenticated user', async () => {
      const validToken = generateAccessToken(mockUser);
      jest.spyOn(authService, 'logout').mockResolvedValue({ message: 'Logged out successfully' });

      // Mock User.findById for authenticate middleware
      const { User } = require('../src/models');
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Cookie', ['refreshToken=valid_refresh_token_to_clear']);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Logged out successfully');

      // Verify clear cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.includes('refreshToken=;') || c.includes('refreshToken=0') || c.includes('Expires='))).toBe(true);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return sanitized user profile for authenticated user', async () => {
      const validToken = generateAccessToken(mockUser);

      const { User } = require('../src/models');
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      jest.spyOn(authService, 'getCurrentUser').mockResolvedValue({
        id: dummyUserId.toString(),
        email: mockUser.email,
        displayName: mockUser.displayName,
        role: mockUser.role,
        organizationId: dummyOrgId.toString(),
        organization: { id: dummyOrgId.toString(), name: 'Acme Corp', slug: 'acme' },
        isActive: true,
        lastLoginAt: mockUser.lastLoginAt
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('id', dummyUserId.toString());
      expect(res.body.user).toHaveProperty('email', 'operator@acme.com');
      expect(res.body.user).toHaveProperty('role', 'operator');
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('should return 401 if Authorization header is missing', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });
});

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/token');
const userService = require('../src/services/user.service');

describe('User Management & Profile Endpoints (Phase 4)', () => {
  const orgId = new mongoose.Types.ObjectId();
  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'org_admin',
    displayName: 'Admin User',
    email: 'admin@soc.org'
  };

  const operatorUser = {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    role: 'operator',
    displayName: 'Operator User',
    email: 'operator@soc.org'
  };

  let adminToken, operatorToken;

  beforeAll(() => {
    adminToken = generateAccessToken(adminUser);
    operatorToken = generateAccessToken(operatorUser);
  });

  const { User } = require('../src/models');

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      let matched = operatorUser;
      if (idStr === adminUser._id.toString()) matched = adminUser;

      return {
        select: jest.fn().mockResolvedValue({
          ...matched,
          isActive: true
        })
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/v1/users', () => {
    it('should list users scoped to organization', async () => {
      jest.spyOn(userService, 'listUsers').mockResolvedValue({
        users: [
          { id: adminUser._id.toString(), email: adminUser.email, displayName: adminUser.displayName, role: 'org_admin', isActive: true },
          { id: operatorUser._id.toString(), email: operatorUser.email, displayName: operatorUser.displayName, role: 'operator', isActive: true }
        ],
        total: 2,
        page: 1,
        limit: 20
      });

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(2);
      expect(res.body.users[0]).not.toHaveProperty('passwordHash');
    });
  });

  describe('GET /api/v1/users/me & PATCH /api/v1/users/me', () => {
    it('GET /api/v1/users/me should return current user profile', async () => {
      jest.spyOn(userService, 'getUserById').mockResolvedValue({
        id: operatorUser._id.toString(),
        email: operatorUser.email,
        displayName: operatorUser.displayName,
        role: 'operator',
        organizationId: orgId.toString()
      });

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(operatorUser.email);
      expect(res.body.role).toBe('operator');
    });

    it('PATCH /api/v1/users/me should update display name', async () => {
      jest.spyOn(userService, 'updateProfile').mockResolvedValue({
        id: operatorUser._id.toString(),
        email: operatorUser.email,
        displayName: 'Operator John Doe Updated',
        role: 'operator',
        organizationId: orgId.toString()
      });

      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ displayName: 'Operator John Doe Updated' });

      expect(res.status).toBe(200);
      expect(res.body.displayName).toBe('Operator John Doe Updated');
    });
  });

  describe('PATCH /api/v1/users/me/password', () => {
    it('should change password when current password matches', async () => {
      jest.spyOn(userService, 'changePassword').mockResolvedValue({
        message: 'Password updated successfully'
      });

      const res = await request(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewSecurePassword456#'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Password updated successfully');
    });

    it('should return 401 when current password is wrong', async () => {
      const err = new Error('Current password is incorrect');
      err.code = 'INVALID_CREDENTIALS';
      err.statusCode = 401;
      jest.spyOn(userService, 'changePassword').mockRejectedValue(err);

      const res = await request(app)
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          currentPassword: 'WrongOldPassword123!',
          newPassword: 'NewSecurePassword456#'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/v1/users/invite', () => {
    it('should allow org_admin to invite user and receive temporary password', async () => {
      jest.spyOn(userService, 'inviteUser').mockResolvedValue({
        id: new mongoose.Types.ObjectId().toString(),
        email: 'analyst.new@soc.org',
        displayName: 'New Analyst',
        role: 'security_analyst',
        isActive: true,
        temporaryPassword: 'Tmp#xyz123456789!'
      });

      const res = await request(app)
        .post('/api/v1/users/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'analyst.new@soc.org',
          displayName: 'New Analyst',
          role: 'security_analyst'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('temporaryPassword', 'Tmp#xyz123456789!');
      expect(res.body.email).toBe('analyst.new@soc.org');
    });

    it('should deny non-org_admin from inviting users (403)', async () => {
      const res = await request(app)
        .post('/api/v1/users/invite')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          email: 'hacker@soc.org',
          displayName: 'Hacker User',
          role: 'org_admin'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
    });

    it('should fail with 409 when email is already registered', async () => {
      const err = new Error('Email is already registered in the platform');
      err.code = 'EMAIL_EXISTS';
      err.statusCode = 409;
      jest.spyOn(userService, 'inviteUser').mockRejectedValue(err);

      const res = await request(app)
        .post('/api/v1/users/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'existing@soc.org',
          displayName: 'Existing User',
          role: 'operator'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toHaveProperty('code', 'EMAIL_EXISTS');
    });
  });

  describe('PATCH /api/v1/users/:id (Role & Status Update)', () => {
    it('should allow org_admin to update user role or deactivate user', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      jest.spyOn(userService, 'updateUser').mockResolvedValue({
        id: dummyId.toString(),
        email: 'user@soc.org',
        role: 'security_analyst',
        isActive: false
      });

      const res = await request(app)
        .patch(`/api/v1/users/${dummyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'security_analyst',
          isActive: false
        });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('security_analyst');
      expect(res.body.isActive).toBe(false);
    });

    it('should deny operator from updating other user (403)', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/v1/users/${dummyId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ role: 'super_admin' });

      expect(res.status).toBe(403);
    });
  });
});

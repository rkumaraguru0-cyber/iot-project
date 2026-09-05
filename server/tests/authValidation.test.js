const request = require('supertest');
const express = require('express');
const validate = require('../src/middleware/validate');
const { loginSchema, registerSchema } = require('../src/validators/auth.validator');

describe('Auth Joi Validation Middleware (Phase 3)', () => {
  const app = express();
  app.use(express.json());

  app.post('/test-login-validation', validate(loginSchema), (req, res) => {
    res.status(200).json({ success: true, body: req.body });
  });

  app.post('/test-register-validation', validate(registerSchema), (req, res) => {
    res.status(200).json({ success: true, body: req.body });
  });

  describe('Login Validation', () => {
    it('should pass validation with valid email and password', async () => {
      const res = await request(app)
        .post('/test-login-validation')
        .send({
          email: 'analyst@acme.com',
          password: 'SomePassword123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should fail with 400 when email is invalid or missing', async () => {
      const res = await request(app)
        .post('/test-login-validation')
        .send({
          email: 'invalid-email-format',
          password: 'SomePassword123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.error.details.some(d => d.field === 'email')).toBe(true);
    });

    it('should fail with 400 when password is missing', async () => {
      const res = await request(app)
        .post('/test-login-validation')
        .send({
          email: 'analyst@acme.com'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details.some(d => d.field === 'password')).toBe(true);
    });
  });

  describe('Register Validation', () => {
    it('should pass validation with valid organization, user, and strong password', async () => {
      const res = await request(app)
        .post('/test-register-validation')
        .send({
          organizationName: 'Acme Security Corp',
          email: 'admin@acme.com',
          password: 'AdminPassword123!',
          displayName: 'Admin User'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should fail validation when password does not meet complexity requirements', async () => {
      const res = await request(app)
        .post('/test-register-validation')
        .send({
          organizationName: 'Acme Security Corp',
          email: 'admin@acme.com',
          password: 'weakpassword', // no uppercase, no digit, no special char
          displayName: 'Admin User'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details.some(d => d.field === 'password')).toBe(true);
    });
  });
});

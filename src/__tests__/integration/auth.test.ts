import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import authRoutes from '../../routes/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Setup test app
const app = express();
app.use(bodyParser.json());
app.use('/api/v1/auth', authRoutes);

// Utilidad para limpiar usuarios de test
const TEST_EMAIL = 'testuser@example.com';

describe('Auth Endpoints Integration Tests', () => {
  beforeAll(async () => {
    // Elimina sesiones y usuario de test si existen
    const user = await prisma.user.findFirst({ where: { email: TEST_EMAIL } });
    if (user) {
      await prisma.userSession.deleteMany({ where: { userId: user.id } });
      await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    }
  });

  beforeEach(async () => {
    // Elimina todas las sesiones del usuario de test antes de cada test
    const user = await prisma.user.findFirst({ where: { email: TEST_EMAIL } });
    if (user) {
      await prisma.userSession.deleteMany({ where: { userId: user.id } });
    }
  });

  afterAll(async () => {
    // Limpia sesiones y usuario de test
    const user = await prisma.user.findFirst({ where: { email: TEST_EMAIL } });
    if (user) {
      await prisma.userSession.deleteMany({ where: { userId: user.id } });
      await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    }
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: TEST_EMAIL,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User'
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user).toHaveProperty('email', TEST_EMAIL);
    });

    it('should not allow duplicate registration', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: TEST_EMAIL,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User'
        });
      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: TEST_EMAIL,
          password: 'TestPassword123!'
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('tokens');
      expect(res.body.data.tokens).toHaveProperty('accessToken');
      expect(res.body.data.tokens).toHaveProperty('refreshToken');
    });

    it('should not login with wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: TEST_EMAIL,
          password: 'WrongPassword!'
        });
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });

    it('should not login with non-existent user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nouser@example.com',
          password: 'AnyPassword123!'
        });
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Login to get a refresh token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: TEST_EMAIL,
          password: 'TestPassword123!'
        });
      refreshToken = loginRes.body.data.tokens.refreshToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('should not refresh with invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' });
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });

    it('should not refresh without refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Login to get an access token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: TEST_EMAIL,
          password: 'TestPassword123!'
        });
      accessToken = loginRes.body.data.tokens.accessToken;
    });

    it('should get current user with valid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user).toHaveProperty('email', TEST_EMAIL);
    });

    it('should not get current user without token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });

    it('should not get current user with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Login to get an access token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: TEST_EMAIL,
          password: 'TestPassword123!'
        });
      accessToken = loginRes.body.data.tokens.accessToken;
    });

    it('should logout successfully with valid token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('should not logout without token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });

    it('should not logout with invalid token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/auth/logout-all', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Login to get an access token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: TEST_EMAIL,
          password: 'TestPassword123!'
        });
      accessToken = loginRes.body.data.tokens.accessToken;
    });

    it('should logout from all devices with valid token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('should not logout from all devices without token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout-all');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });

    it('should not logout from all devices with invalid token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('POST /refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      // First register a user
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: TEST_EMAIL,
          password: 'testpassword123',
          firstName: 'Test',
          lastName: 'User'
        });

      expect(registerRes.status).toBe(201);
      const { refreshToken } = registerRes.body.data.tokens;

      // Now test refresh
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body).toHaveProperty('data');
      expect(refreshRes.body.data).toHaveProperty('accessToken');
      expect(refreshRes.body.data).toHaveProperty('refreshToken');
      expect(refreshRes.body.data.accessToken).toBeDefined();
      expect(refreshRes.body.data.refreshToken).toBeDefined();
    });

    it('should return 401 with invalid refresh token', async () => {
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(refreshRes.status).toBe(401);
      expect(refreshRes.body).toHaveProperty('error');
    });

    it('should return 400 when refresh token is missing', async () => {
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(refreshRes.status).toBe(400);
      expect(refreshRes.body).toHaveProperty('error');
    });
  });

  describe('POST /logout', () => {
    it('should logout user with valid access token', async () => {
      // First register and login
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: TEST_EMAIL,
          password: 'testpassword123',
          firstName: 'Test',
          lastName: 'User'
        });

      expect(registerRes.status).toBe(201);
      const { accessToken } = registerRes.body.data.tokens;

      // Test logout
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body).toHaveProperty('message');
    });

    it('should return 401 without access token', async () => {
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout');

      expect(logoutRes.status).toBe(401);
    });

    it('should return 401 with invalid access token', async () => {
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer invalid-token');

      expect(logoutRes.status).toBe(401);
    });
  });

  describe('POST /logout-all', () => {
    it('should logout user from all devices with valid access token', async () => {
      // First register and login
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: TEST_EMAIL,
          password: 'testpassword123',
          firstName: 'Test',
          lastName: 'User'
        });

      expect(registerRes.status).toBe(201);
      const { accessToken } = registerRes.body.data.tokens;

      // Test logout-all
      const logoutAllRes = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(logoutAllRes.status).toBe(200);
      expect(logoutAllRes.body).toHaveProperty('message');
    });

    it('should return 401 without access token', async () => {
      const logoutAllRes = await request(app)
        .post('/api/v1/auth/logout-all');

      expect(logoutAllRes.status).toBe(401);
    });
  });

  describe('GET /me', () => {
    it('should return user profile with valid access token', async () => {
      // First register and login
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: TEST_EMAIL,
          password: 'testpassword123',
          firstName: 'Test',
          lastName: 'User'
        });

      expect(registerRes.status).toBe(201);
      const { accessToken } = registerRes.body.data.tokens;

      // Test get profile
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body).toHaveProperty('data');
      expect(meRes.body.data).toHaveProperty('user');
      expect(meRes.body.data.user).toHaveProperty('id');
      expect(meRes.body.data.user).toHaveProperty('email', TEST_EMAIL);
      expect(meRes.body.data.user).toHaveProperty('firstName', 'Test');
      expect(meRes.body.data.user).toHaveProperty('lastName', 'User');
      expect(meRes.body.data.user).not.toHaveProperty('password');
    });

    it('should return 401 without access token', async () => {
      const meRes = await request(app)
        .get('/api/v1/auth/me');

      expect(meRes.status).toBe(401);
    });

    it('should return 401 with invalid access token', async () => {
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(meRes.status).toBe(401);
    });
  });
}); 
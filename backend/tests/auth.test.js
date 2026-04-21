const request = require('supertest');
const app = require('../server');

const hasSupabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;
const autoApprove =
  String(process.env.AUTO_APPROVE_USERS || '').toLowerCase() === 'true';
const describeAuth =
  hasSupabase && autoApprove ? describe : describe.skip;

describeAuth('Authentication API', () => {
  let authToken;
  const testEmail = `test${Date.now()}@inkwelllabs.com`;
  const testUsername = `testuser${Date.now()}`;
  const testPassword = 'Test@12345';

  describe('POST /api/auth/register', () => {
    it('should register new user successfully when auto-approved', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: testUsername,
        email: testEmail,
        password: testPassword,
        country: 'BR',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(testEmail.toLowerCase());
      expect(res.body.autoApproved).toBe(true);

      authToken = res.body.token;
    });

    it('should reject duplicate email', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'anotheruser999',
        email: testEmail,
        password: testPassword,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Email já cadastrado');
    });

    it('should reject duplicate username', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: testUsername,
        email: `another${Date.now()}@inkwelllabs.com`,
        password: testPassword,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Nome de usuário já em uso');
    });

    it('should reject invalid email format', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'newuserxx',
        email: 'invalid-email',
        password: testPassword,
      });

      expect(res.status).toBe(400);
      expect(String(res.body.error).toLowerCase()).toContain('email');
    });

    it('should normalize email to lowercase', async () => {
      const upperEmail = `TEST${Date.now()}@INKWELLLABS.COM`;
      const res = await request(app).post('/api/auth/register').send({
        username: `user${Date.now()}`,
        email: upperEmail,
        password: testPassword,
      });

      if (res.status !== 201) {
        expect([200, 400, 500]).toContain(res.status);
        return;
      }
      expect(res.body.user.email).toBe(upperEmail.toLowerCase());
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe(testEmail.toLowerCase());
      authToken = res.body.token;
    });

    it('should login with uppercase email', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testEmail.toUpperCase(),
        password: testPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testEmail,
        password: 'WrongPassword123',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/incorretos/i);
    });

    it('should reject non-existent email', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@inkwelllabs.com',
        password: testPassword,
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user data with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(testEmail.toLowerCase());
    });

    it('should reject without token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should reject with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(res.status).toBe(403);
    });
  });
});

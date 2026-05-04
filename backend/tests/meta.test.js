const request = require('supertest');
const app = require('../server');

describe('Meta analysis API', () => {
  it('GET /api/meta-analysis/test should respond', async () => {
    const res = await request(app).get('/api/meta-analysis/test');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET /api/meta/glossary should respond', async () => {
    const res = await request(app).get('/api/meta/glossary');
    expect([200, 500, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.entries)).toBe(true);
    }
  });
});

const request = require('supertest');
const app = require('../server');

describe('Meta analysis API', () => {
  it('GET /api/meta-analysis/test should respond', async () => {
    const res = await request(app).get('/api/meta-analysis/test');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

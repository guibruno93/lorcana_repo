const request = require('supertest');
const app = require('../server');

describe('Integration smoke', () => {
  it('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('meta-analysis + cards search chain', async () => {
    const meta = await request(app).get('/api/meta-analysis/test');
    expect(meta.status).toBe(200);

    const cards = await request(app).get('/api/cards/search').query({ q: 'be', limit: 3 });
    expect(cards.status).toBe(200);
    expect(Array.isArray(cards.body)).toBe(true);
  });
});

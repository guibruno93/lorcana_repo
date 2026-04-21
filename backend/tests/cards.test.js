const request = require('supertest');
const app = require('../server');

describe('Cards API', () => {
  it('GET /api/cards/search should return array for q>=2', async () => {
    const res = await request(app).get('/api/cards/search').query({ q: 'ar', limit: 5 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should return empty array for short query', async () => {
    const res = await request(app).get('/api/cards/search').query({ q: 'a', limit: 5 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });
});

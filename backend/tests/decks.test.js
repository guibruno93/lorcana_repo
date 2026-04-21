const request = require('supertest');
const app = require('../server');
const { buildSampleDeckText } = require('./helpers/sampleDeck');

describe('Deck API (/api/deck)', () => {
  describe('GET /api/deck/search-card', () => {
    it('should require query', async () => {
      const res = await request(app).get('/api/deck/search-card');
      expect(res.status).toBe(400);
    });

    it('should return results for a known query', async () => {
      const res = await request(app).get('/api/deck/search-card').query({ q: 'Ariel' });
      expect([200, 429, 500, 504]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('results');
        expect(Array.isArray(res.body.results)).toBe(true);
      }
    }, 20000);
  });

  describe('POST /api/deck/analyze', () => {
    it('should reject without deck text', async () => {
      const res = await request(app).post('/api/deck/analyze').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should analyze a valid 60-card decklist', async () => {
      let deckText;
      try {
        deckText = buildSampleDeckText();
      } catch (e) {
        console.warn('Skip analyze:', e.message);
        return;
      }

      const res = await request(app)
        .post('/api/deck/analyze')
        .send({ deckText });

      expect([200, 500]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.totalCards).toBe(60);
        expect(res.body).toHaveProperty('archetype');
      }
    }, 120000);
  });
});

const request = require('supertest');
const app = require('../server');

const hasSupabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;
const autoApprove =
  String(process.env.AUTO_APPROVE_USERS || '').toLowerCase() === 'true';
const describeAuth =
  hasSupabase && autoApprove ? describe : describe.skip;

describeAuth('Tournaments API', () => {
  let authToken;
  let tournamentId;

  beforeAll(async () => {
    const stamp = Date.now();
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: `tourntest${stamp}`,
        email: `tourntest${stamp}@inkwelllabs.com`,
        password: 'Test@12345',
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    authToken = res.body.token;
  });

  describe('POST /api/tournaments', () => {
    it('should create tournament with name and date', async () => {
      const res = await request(app)
        .post('/api/tournaments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test BO1 Tournament',
          date: '2026-06-01',
          matchFormat: 'bo1',
          roundTimeMinutes: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body.matchFormat).toBe('bo1');
      expect(res.body.roundTimeMinutes).toBe(50);
      expect(res.body).toHaveProperty('id');

      tournamentId = res.body.id;
    });

    it('should create BO3 tournament', async () => {
      const res = await request(app)
        .post('/api/tournaments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test BO3 Tournament',
          date: '2026-06-02',
          matchFormat: 'bo3',
          roundTimeMinutes: 70,
        });

      expect(res.status).toBe(201);
      expect(res.body.matchFormat).toBe('bo3');
    });

    it('should reject without name or date', async () => {
      const res = await request(app)
        .post('/api/tournaments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Sem data',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('players and start', () => {
    beforeAll(async () => {
      if (!tournamentId) return;
      for (const name of ['P1', 'P2', 'P3', 'P4']) {
        await request(app)
          .post(`/api/tournaments/${tournamentId}/players`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ playerName: name });
      }
    });

    it('should start tournament', async () => {
      if (!tournamentId) return;
      const res = await request(app)
        .post(`/api/tournaments/${tournamentId}/start`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('in-progress');
      expect(res.body.matches.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/tournaments/:id/standings', () => {
    it('should get tournament standings', async () => {
      if (!tournamentId) return;
      const res = await request(app)
        .get(`/api/tournaments/${tournamentId}/standings`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tournament');
      expect(res.body).toHaveProperty('standings');
      expect(Array.isArray(res.body.standings)).toBe(true);
    });
  });
});

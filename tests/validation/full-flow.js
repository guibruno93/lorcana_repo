const axios = require('axios');
const path = require('path');
const fs = require('fs');

const backendRoot = path.join(__dirname, '..', '..', 'backend');
try {
  const dotenv = require('dotenv');
  // Igual ao Jest: .env.test primeiro, depois .env — o servidor (npm start) usa só .env, que deve ganhar aqui.
  dotenv.config({ path: path.join(backendRoot, '.env.test') });
  dotenv.config({ path: path.join(backendRoot, '.env') });
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') throw e;
}

/**
 * BACKEND_URL = origem do Express (sem /api).
 * API_URL no .env costuma ser só o host (ex.: REACT_APP_API_URL=http://localhost:3002);
 * as rotas reais são sempre /api/...
 */
function resolveBackendAndApi() {
  const def = 'http://localhost:3002';
  let backend = String(process.env.BACKEND_URL || '').trim().replace(/\/$/, '');
  const apiEnv = String(process.env.API_URL || '').trim().replace(/\/$/, '');

  if (!backend && apiEnv) {
    backend = apiEnv.replace(/\/api$/i, '');
  }
  if (!backend) {
    backend = def;
  }
  backend = backend.replace(/\/api$/i, '');

  const api = `${backend.replace(/\/$/, '')}/api`;
  return { BACKEND_URL: backend, API_URL: api };
}

const { BACKEND_URL, API_URL } = resolveBackendAndApi();

function buildSampleDeckTextFromRepo() {
  const cardsPath = path.join(backendRoot, 'db', 'cards.json');
  if (!fs.existsSync(cardsPath)) return null;
  const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
  const names = [];
  for (const c of cards) {
    if (c && c.name && names.length < 15) names.push(c.name);
  }
  if (names.length < 15) return null;
  return names.map((n) => `4 ${n}`).join('\n');
}

async function testFullUserFlow() {
  const hasSupabase =
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

  const testEmail = `fullflow${Date.now()}@inkwelllabs.com`;
  const testUsername = `fullflow${Date.now()}`;
  const testPassword = 'Test@12345';

  let token = null;
  const results = {
    steps: [],
    success: false,
    timestamp: new Date().toISOString(),
  };

  function logStep(name, success, details = '') {
    const status = success ? 'OK' : 'FAIL';
    console.log(`[${status}] ${name}${details ? `: ${details}` : ''}`);
    results.steps.push({ name, success, details });
  }

  try {
    if (hasSupabase) {
      const registerRes = await axios.post(
        `${API_URL}/auth/register`,
        {
          username: testUsername,
          email: testEmail,
          password: testPassword,
          country: 'BR',
        },
        { validateStatus: () => true }
      );

      token = registerRes.data?.token || null;

      if (registerRes.status === 201 && token) {
        logStep('Register', true);

        const loginRes = await axios.post(
          `${API_URL}/auth/login`,
          { email: testEmail, password: testPassword },
          { validateStatus: () => true }
        );
        logStep(
          'Login',
          loginRes.status === 200,
          loginRes.status !== 200
            ? `HTTP ${loginRes.status} ${loginRes.data?.error || ''}`
            : ''
        );

        const meRes = await axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          validateStatus: () => true,
        });
        logStep(
          'Get user info',
          meRes.status === 200,
          meRes.status !== 200
            ? `HTTP ${meRes.status} ${meRes.data?.error || ''}`
            : ''
        );
      } else if (
        registerRes.status === 200 &&
        registerRes.data?.success &&
        !token
      ) {
        logStep(
          'Register',
          true,
          'fluxo com email (sem JWT): o processo do backend em execução tem AUTO_APPROVE_USERS≠true — para testar registo+login+torneio aqui, reinicia o backend com AUTO_APPROVE_USERS=true no backend/.env'
        );
        logStep('Login', true, 'skipped (sem token no registo)');
        logStep('Get user info', true, 'skipped (sem token no registo)');
      } else {
        logStep(
          'Register',
          false,
          `HTTP ${registerRes.status} ${
            registerRes.data?.error ||
            JSON.stringify(registerRes.data || {}).slice(0, 200)
          }`
        );
        logStep('Login', true, 'skipped (registo não devolveu token)');
        logStep('Get user info', true, 'skipped (registo não devolveu token)');
      }
    } else {
      logStep(
        'Register/Login/Me',
        true,
        'skipped (SUPABASE_URL / SUPABASE_SERVICE_KEY não carregados neste script)'
      );
    }

    const deckText = buildSampleDeckTextFromRepo();
    if (!deckText) {
      logStep('Analyze deck', true, 'skipped (cards.json ausente)');
    } else {
      const analyzeRes = await axios.post(
        `${BACKEND_URL}/api/deck/analyze`,
        { deckText },
        { validateStatus: () => true, timeout: 120000 }
      );
      const ok =
        analyzeRes.status === 200 && analyzeRes.data?.success === true;
      logStep(
        'Analyze deck',
        ok,
        ok ? '' : `HTTP ${analyzeRes.status} ${analyzeRes.data?.error || ''}`
      );
    }

    const cardsRes = await axios.get(`${API_URL}/cards/search`, {
      params: { q: 'ar', limit: 10 },
      validateStatus: () => true,
    });
    logStep(
      'Get cards',
      cardsRes.status === 200 &&
        Array.isArray(cardsRes.data) &&
        cardsRes.data.length > 0
    );

    if (hasSupabase && token) {
      const tournRes = await axios.post(
        `${API_URL}/tournaments`,
        {
          name: 'Full Flow Tournament',
          date: '2026-07-01',
          matchFormat: 'bo1',
          roundTimeMinutes: 50,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      logStep('Create tournament', tournRes.status === 201);
      const tournamentId = tournRes.data?.id;

      if (tournamentId) {
        for (const p of ['P1', 'P2', 'P3', 'P4']) {
          await axios.post(
            `${API_URL}/tournaments/${tournamentId}/players`,
            { playerName: p },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
        const startRes = await axios.post(
          `${API_URL}/tournaments/${tournamentId}/start`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        logStep('Start tournament', startRes.status === 200);
      }
    } else {
      logStep('Tournament flow', true, 'skipped');
    }

    results.success = results.steps.every((s) => s.success);
  } catch (error) {
    logStep('Full flow', false, error.message);
    results.success = false;
  }

  return results;
}

module.exports = { testFullUserFlow };

if (require.main === module) {
  console.log('\nFULL USER FLOW TEST\n');

  testFullUserFlow().then((results) => {
    console.log(
      `\n${results.success ? 'ALL STEPS PASSED' : 'SOME STEPS FAILED'}`
    );
    console.log(`\nTimestamp: ${results.timestamp}\n`);

    process.exit(results.success ? 0 : 1);
  });
}

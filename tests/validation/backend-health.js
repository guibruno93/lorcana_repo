const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002';

async function checkBackendHealth() {
  const results = {
    server: false,
    database: false,
    auth: false,
    timestamp: new Date().toISOString(),
  };

  try {
    const healthRes = await axios.get(`${BACKEND_URL}/api/health`, { timeout: 8000 });
    results.server = healthRes.status === 200 && healthRes.data?.ok === true;

    const cardsRes = await axios.get(`${BACKEND_URL}/api/cards/search`, {
      params: { q: 'ar', limit: 1 },
      timeout: 8000,
    });
    results.database = cardsRes.status === 200 && Array.isArray(cardsRes.data);

    const authRes = await axios
      .post(
        `${BACKEND_URL}/api/auth/login`,
        { email: 'naoexiste@inkwelllabs.com', password: 'wrong' },
        { validateStatus: () => true, timeout: 8000 }
      )
      .catch((err) => err.response);
    results.auth = authRes.status === 401;
  } catch (error) {
    console.error('[ERROR] Backend health check failed:', error.message);
  }

  return results;
}

module.exports = { checkBackendHealth };

if (require.main === module) {
  checkBackendHealth().then((results) => {
    console.log('\nBACKEND HEALTH CHECK\n');
    console.log(`Server Running: ${results.server ? 'OK' : 'FAIL'}`);
    console.log(`Cards index: ${results.database ? 'OK' : 'FAIL'}`);
    console.log(`Auth Working: ${results.auth ? 'OK' : 'FAIL'}`);
    console.log(`\nTimestamp: ${results.timestamp}\n`);

    process.exit(results.server && results.database && results.auth ? 0 : 1);
  });
}

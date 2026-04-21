const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002';
const THRESHOLD_MS = parseInt(process.env.API_PERF_THRESHOLD_MS || '3000', 10);

async function measure(label, fn) {
  const t0 = Date.now();
  await fn();
  const ms = Date.now() - t0;
  console.log(`${label}: ${ms}ms ${ms <= THRESHOLD_MS ? 'OK' : 'LENTO'}`);
  return ms;
}

async function main() {
  await measure('GET /api/health', () =>
    axios.get(`${BACKEND_URL}/api/health`, { timeout: 10000 })
  );
  await measure('GET /api/cards/search', () =>
    axios.get(`${BACKEND_URL}/api/cards/search`, {
      params: { q: 'ar', limit: 10 },
      timeout: 15000,
    })
  );
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { main };

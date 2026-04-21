const axios = require('axios');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const THRESHOLD_MS = parseInt(process.env.PAGE_LOAD_THRESHOLD_MS || '5000', 10);

async function main() {
  const t0 = Date.now();
  await axios.get(FRONTEND_URL, { timeout: 15000 });
  const ms = Date.now() - t0;
  console.log(`GET / (${FRONTEND_URL}): ${ms}ms ${ms <= THRESHOLD_MS ? 'OK' : 'LENTO'}`);
  if (ms > THRESHOLD_MS) process.exit(1);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { main };

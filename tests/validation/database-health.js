const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002';

/**
 * Validação leve: API de cartas + endpoint meta (sem credenciais).
 */
async function checkDatabaseHealth() {
  const results = {
    cardsSearch: false,
    metaTest: false,
    timestamp: new Date().toISOString(),
  };

  try {
    const cards = await axios.get(`${BACKEND_URL}/api/cards/search`, {
      params: { q: 'be', limit: 3 },
      timeout: 8000,
    });
    results.cardsSearch =
      cards.status === 200 && Array.isArray(cards.data) && cards.data.length > 0;

    const meta = await axios.get(`${BACKEND_URL}/api/meta-analysis/test`, {
      timeout: 8000,
    });
    results.metaTest = meta.status === 200 && meta.data?.ok === true;
  } catch (error) {
    console.error('[ERROR] Database/API health failed:', error.message);
  }

  return results;
}

module.exports = { checkDatabaseHealth };

if (require.main === module) {
  checkDatabaseHealth().then((results) => {
    console.log('\nDATABASE / API DATA CHECK\n');
    console.log(`Cards search: ${results.cardsSearch ? 'OK' : 'FAIL'}`);
    console.log(`Meta test route: ${results.metaTest ? 'OK' : 'FAIL'}`);
    console.log(`\nTimestamp: ${results.timestamp}\n`);
    process.exit(results.cardsSearch && results.metaTest ? 0 : 1);
  });
}

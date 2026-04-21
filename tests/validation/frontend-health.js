const axios = require('axios');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

async function checkFrontendHealth() {
  const results = {
    accessible: false,
    routes: {
      home: false,
      login: false,
      deck: false,
      meta: false,
      tournaments: false,
      deckBuilder: false,
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const homeRes = await axios.get(FRONTEND_URL, { timeout: 8000 });
    results.accessible = homeRes.status === 200;

    const routeMap = [
      ['/', 'home'],
      ['/login', 'login'],
      ['/deck', 'deck'],
      ['/meta', 'meta'],
      ['/tournaments', 'tournaments'],
      ['/deck-builder', 'deckBuilder'],
    ];

    for (const [route, key] of routeMap) {
      try {
        const res = await axios.get(`${FRONTEND_URL}${route}`, {
          maxRedirects: 5,
          validateStatus: () => true,
          timeout: 8000,
        });
        results.routes[key] = [200, 301, 302, 304].includes(res.status);
      } catch (err) {
        if (err.response && [200, 301, 302].includes(err.response.status)) {
          results.routes[key] = true;
        }
      }
    }
  } catch (error) {
    console.error('[ERROR] Frontend health check failed:', error.message);
  }

  return results;
}

module.exports = { checkFrontendHealth };

if (require.main === module) {
  checkFrontendHealth().then((results) => {
    console.log('\nFRONTEND HEALTH CHECK\n');
    console.log(`Accessible: ${results.accessible ? 'OK' : 'FAIL'}`);
    console.log('\nRoutes:');
    Object.entries(results.routes).forEach(([route, status]) => {
      console.log(`  ${route}: ${status ? 'OK' : 'FAIL'}`);
    });
    console.log(`\nTimestamp: ${results.timestamp}\n`);

    const allOk =
      results.accessible && Object.values(results.routes).every((r) => r);
    process.exit(allOk ? 0 : 1);
  });
}

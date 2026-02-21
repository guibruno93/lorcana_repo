// test-shuffle-endpoint.js
// Execute: node test-shuffle-endpoint.js

const http = require('http');

const testDeck = `4 Tipo - Growing Son
4 Hades - Infernal Schemer
4 Sail the Azurite Sea
4 Goliath - Clan Leader`;

function testEndpoint() {
  const data = JSON.stringify({ decklist: testDeck });
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/ai/shuffle',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  console.log('\n🧪 Testing /api/ai/shuffle endpoint...\n');

  const req = http.request(options, (res) => {
    let responseData = '';

    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);
    console.log('');

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      console.log('Response Body:');
      console.log(responseData);
      console.log('');

      if (res.statusCode === 200) {
        try {
          const json = JSON.parse(responseData);
          console.log('✅ SUCCESS - JSON parsed correctly');
          console.log('Hand:', json.hand);
        } catch (e) {
          console.log('❌ ERROR - Response is not valid JSON');
          console.log('Parse error:', e.message);
        }
      } else {
        console.log('❌ ERROR - HTTP', res.statusCode);
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Request error:', e.message);
  });

  req.write(data);
  req.end();
}

// Test all AI endpoints
function testAllEndpoints() {
  const endpoints = [
    '/api/ai/ping',
    '/api/ai/health',
    '/api/ai/shuffle',
    '/api/ai/mulligan',
    '/api/ai/matchups'
  ];

  console.log('\n🔍 Checking which endpoints exist...\n');

  endpoints.forEach((endpoint, i) => {
    setTimeout(() => {
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: endpoint,
        method: endpoint.includes('ping') || endpoint.includes('health') ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        const exists = res.statusCode !== 404;
        const icon = exists ? '✅' : '❌';
        console.log(`${icon} ${endpoint} - HTTP ${res.statusCode}`);
        
        if (i === endpoints.length - 1) {
          console.log('\n');
          setTimeout(testEndpoint, 500);
        }
      });

      req.on('error', () => {
        console.log(`❌ ${endpoint} - Connection error`);
      });

      if (options.method === 'POST') {
        req.write(JSON.stringify({ decklist: testDeck }));
      }
      req.end();
    }, i * 200);
  });
}

testAllEndpoints();

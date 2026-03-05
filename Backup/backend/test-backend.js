// test-backend.js - Teste rápido do backend
// Execute: node test-backend.js

const http = require('http');

const decklist = `4 Tipo - Growing Son
4 Hades - Infernal Schemer
4 Sail the Azurite Sea`;

function testEndpoint(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    console.log(`\n🧪 Testing: ${path}`);
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', chunk => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`   ✅ OK (${res.statusCode})`);
          try {
            const json = JSON.parse(responseData);
            console.log(`   Response: ${Object.keys(json).join(', ')}`);
          } catch {
            console.log(`   Response: ${responseData.slice(0, 100)}`);
          }
          resolve();
        } else {
          console.log(`   ❌ FAIL (${res.statusCode})`);
          console.log(`   Error: ${responseData.slice(0, 200)}`);
          reject(new Error(`Status ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      console.log(`   ❌ CONNECTION ERROR: ${err.message}`);
      console.log(`   Verifique se o backend está rodando na porta 5000`);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('\n════════════════════════════════════════');
  console.log('  LORCANA AI - Backend Tests');
  console.log('════════════════════════════════════════');

  try {
    // Test 1: Health check
    await new Promise((resolve, reject) => {
      http.get('http://localhost:5000/api/health', (res) => {
        console.log(`\n🧪 Testing: GET /api/health`);
        if (res.statusCode === 200) {
          console.log(`   ✅ OK - Backend is running`);
          resolve();
        } else {
          console.log(`   ❌ FAIL (${res.statusCode})`);
          reject();
        }
      }).on('error', (err) => {
        console.log(`\n🧪 Testing: GET /api/health`);
        console.log(`   ❌ Backend NOT running`);
        console.log(`   Execute: npm start`);
        reject(err);
      });
    });

    // Test 2: Deck analyze (NEW endpoint)
    await testEndpoint('/api/deck/analyze', { 
      decklist, 
      compare: true, 
      top: 32, 
      sameFormat: true 
    });

    // Test 3: AI Matchups
    await testEndpoint('/api/ai/matchups', { decklist });

    // Test 4: AI Shuffle
    await testEndpoint('/api/ai/shuffle', { decklist });

    console.log('\n════════════════════════════════════════');
    console.log('  ✅ ALL TESTS PASSED');
    console.log('════════════════════════════════════════\n');
    console.log('O backend está funcionando corretamente!');
    console.log('Agora pode iniciar o frontend com: npm start\n');

  } catch (err) {
    console.log('\n════════════════════════════════════════');
    console.log('  ❌ TESTS FAILED');
    console.log('════════════════════════════════════════\n');
    console.log('Problemas encontrados. Siga os passos:\n');
    console.log('1. Certifique-se que o backend está rodando:');
    console.log('   cd backend');
    console.log('   npm start\n');
    console.log('2. Verifique os arquivos copiados:');
    console.log('   - server.js');
    console.log('   - routes/deck.js');
    console.log('   - routes/ai.js\n');
    console.log('3. Leia o TROUBLESHOOTING.md para mais ajuda\n');
    process.exit(1);
  }
}

runTests();

/**
 * test-deck-comparison-verbose.js
 * Teste com logging detalhado
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3002';

async function testConnection() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔌 TEST 0: Connection to Backend');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    const response = await axios.get(`${API_BASE}/api/health`, { timeout: 5000 });
    console.log('✅ Backend is running');
    console.log(`   Status: ${response.status}`);
    return true;
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error('❌ Backend is NOT running!');
      console.error('   Start it with: npm start');
      return false;
    } else if (err.response?.status === 404) {
      console.log('⚠️  /api/health not found, but server is running');
      return true;
    } else {
      console.error('❌ Connection error:', err.message);
      return false;
    }
  }
}

async function testStats() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 TEST 1: GET /api/deck-comparison/stats');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    console.log(`Requesting: ${API_BASE}/api/deck-comparison/stats`);
    const response = await axios.get(`${API_BASE}/api/deck-comparison/stats`, { timeout: 10000 });
    
    console.log('✅ Status:', response.status);
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));
    
    return true;
  } catch (err) {
    console.error('❌ Error Details:');
    console.error('   Code:', err.code);
    console.error('   Message:', err.message);
    if (err.response) {
      console.error('   Status:', err.response.status);
      console.error('   Data:', JSON.stringify(err.response.data, null, 2));
    }
    if (err.config) {
      console.error('   URL:', err.config.url);
    }
    console.error('\n   Full Error:', err);
    return false;
  }
}

async function testSimpleCompare() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔍 TEST 2: Simple Compare (minimal deck)');
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Deck mínimo de 60 cards
  const minimalDeck = [];
  for (let i = 0; i < 15; i++) {
    minimalDeck.push({
      name: `Card ${i}`,
      quantity: 4,
      cost: 1,
      type: 'character',
      ink: 'Sapphire',
      inkable: true,
    });
  }
  
  try {
    console.log('Requesting: POST /api/deck-comparison/compare');
    console.log('Total cards:', minimalDeck.reduce((s, c) => s + c.quantity, 0));
    
    const response = await axios.post(`${API_BASE}/api/deck-comparison/compare`, {
      cards: minimalDeck,
      filter: 'all',
    }, { timeout: 10000 });
    
    console.log('✅ Status:', response.status);
    console.log('📊 Response:', JSON.stringify(response.data, null, 2));
    
    return true;
  } catch (err) {
    console.error('❌ Error Details:');
    console.error('   Code:', err.code);
    console.error('   Message:', err.message);
    if (err.response) {
      console.error('   Status:', err.response.status);
      console.error('   Data:', JSON.stringify(err.response.data, null, 2));
    }
    console.error('\n   Full Error:', err);
    return false;
  }
}

async function checkEnvVars() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('⚙️  Environment Variables Check');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
  ];
  
  let allSet = true;
  
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      console.log(`✅ ${varName}: ${process.env[varName].substring(0, 20)}...`);
    } else {
      console.log(`❌ ${varName}: NOT SET`);
      allSet = false;
    }
  }
  
  if (!allSet) {
    console.log('\n⚠️  Missing environment variables!');
    console.log('   Create backend/.env file with:');
    console.log('   SUPABASE_URL=your-url');
    console.log('   SUPABASE_SERVICE_KEY=your-key');
  }
  
  return allSet;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   Deck Comparison API - Verbose Test                ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  
  // Check env vars
  const envOk = await checkEnvVars();
  
  // Check connection
  const connected = await testConnection();
  
  if (!connected) {
    console.log('\n❌ Cannot proceed: Backend is not running');
    console.log('\n💡 Start backend with:');
    console.log('   cd backend');
    console.log('   npm start\n');
    process.exit(1);
  }
  
  if (!envOk) {
    console.log('\n⚠️  Environment variables not set');
    console.log('   Tests may fail without Supabase credentials\n');
  }
  
  // Run tests
  await testStats();
  await testSimpleCompare();
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 Test Complete');
  console.log('═══════════════════════════════════════════════════════\n');
}

main();

/**
 * test-deck-comparison.js
 * Script para testar API de comparação
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3002';

// Deck de exemplo para teste
const SAMPLE_DECK = {
  cards: [
    { name: 'Basil - Practiced Detective', quantity: 4, cost: 1, type: 'character', ink: 'Sapphire', inkable: true },
    { name: 'Rafiki - Mystical Fighter', quantity: 2, cost: 1, type: 'character', ink: 'Amethyst', inkable: true },
    { name: 'Royal Guard - Octopus Soldier', quantity: 3, cost: 1, type: 'character', ink: 'Amethyst', inkable: true },
    { name: 'Tipo - Growing Son', quantity: 4, cost: 2, type: 'character', ink: 'Sapphire', inkable: true },
    { name: 'Cheshire Cat - Inexplicable', quantity: 4, cost: 3, type: 'character', ink: 'Amethyst', inkable: true },
    { name: 'Dumbo - Ninth Wonder of the Universe', quantity: 4, cost: 4, type: 'character', ink: 'Amethyst', inkable: true },
    { name: 'Genie - Wish Fulfilled', quantity: 4, cost: 4, type: 'character', ink: 'Sapphire', inkable: true },
    { name: 'Iago - Giant Spectral Parrot', quantity: 2, cost: 4, type: 'character', ink: 'Amethyst', inkable: true },
    { name: 'Tigger - Bouncing All the Way', quantity: 3, cost: 5, type: 'character', ink: 'Amethyst', inkable: false },
    { name: 'Elsa - The Fifth Spirit', quantity: 4, cost: 6, type: 'character', ink: 'Amethyst', inkable: false },
    { name: 'Hades - Looking for a Deal', quantity: 2, cost: 6, type: 'character', ink: 'Sapphire', inkable: false },
    { name: 'Demona - Scourge of the Wyvern Clan', quantity: 2, cost: 7, type: 'character', ink: 'Amethyst', inkable: false },
    { name: 'Hades - Infernal Schemer', quantity: 4, cost: 8, type: 'character', ink: 'Amethyst', inkable: false },
    { name: 'Junior Woodchuck Guidebook', quantity: 4, cost: 2, type: 'item', ink: 'Sapphire', inkable: true },
    { name: 'Sail the Azurite Sea', quantity: 4, cost: 3, type: 'song', ink: 'Sapphire', inkable: true },
    { name: 'Into the Unknown', quantity: 3, cost: 5, type: 'song', ink: 'Amethyst', inkable: false },
    { name: 'Let It Go', quantity: 3, cost: 8, type: 'song', ink: 'Amethyst', inkable: false },
  ],
  filter: 'all',
};

async function testStats() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 TEST 1: GET /api/deck-comparison/stats');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    const response = await axios.get(`${API_BASE}/api/deck-comparison/stats`);
    
    console.log('✅ Status:', response.status);
    console.log('📊 Stats:', JSON.stringify(response.data, null, 2));
    
    return true;
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    return false;
  }
}

async function testCompare(filter) {
  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`🔍 TEST 2: POST /api/deck-comparison/compare (filter: ${filter})`);
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    const response = await axios.post(`${API_BASE}/api/deck-comparison/compare`, {
      cards: SAMPLE_DECK.cards,
      filter,
    });
    
    console.log('✅ Status:', response.status);
    console.log('\n📊 Result:');
    console.log(`   Score: ${response.data.comparison.score}/10`);
    console.log(`   Confidence: ${response.data.comparison.confidence}`);
    console.log(`   Avg Similarity: ${response.data.comparison.avgSimilarity}%`);
    console.log(`   Matches Found: ${response.data.comparison.matchesFound}`);
    console.log(`   User Inks: ${response.data.userDeck.inks.join(', ')}`);
    console.log(`   Meta Total: ${response.data.meta.totalDecks} decks`);
    console.log(`   Same Inks: ${response.data.meta.sameInks} decks`);
    
    if (response.data.comparison.top5Matches) {
      console.log('\n🏆 Top 5 Similar Decks:');
      response.data.comparison.top5Matches.forEach((match, i) => {
        console.log(`   ${i + 1}. ${match.similarity}% similar - Placement: ${match.placement} - ${match.tournament}`);
      });
    }
    
    return true;
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    return false;
  }
}

async function testTopDecks() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🏆 TEST 3: GET /api/deck-comparison/top-decks');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    const response = await axios.get(`${API_BASE}/api/deck-comparison/top-decks`, {
      params: {
        inks: 'Amethyst,Sapphire',
        limit: 5,
      },
    });
    
    console.log('✅ Status:', response.status);
    console.log(`📊 Found ${response.data.count} decks`);
    
    if (response.data.decks && response.data.decks.length > 0) {
      console.log('\nTop 5 Decks:');
      response.data.decks.slice(0, 5).forEach((deck, i) => {
        console.log(`   ${i + 1}. Placement ${deck.placement} - ${deck.tournament}`);
      });
    }
    
    return true;
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    return false;
  }
}

async function testInvalidDeck() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('⚠️  TEST 4: Invalid Deck (should fail)');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    await axios.post(`${API_BASE}/api/deck-comparison/compare`, {
      cards: [{ name: 'Test', quantity: 10 }], // Only 10 cards
      filter: 'all',
    });
    
    console.log('❌ Should have failed but didn\'t!');
    return false;
  } catch (err) {
    if (err.response?.status === 400) {
      console.log('✅ Correctly rejected invalid deck');
      console.log(`   Error: ${err.response.data.error}`);
      return true;
    } else {
      console.error('❌ Unexpected error:', err.message);
      return false;
    }
  }
}

async function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   Deck Comparison API - Test Suite                  ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  
  const results = {
    stats: false,
    compareAll: false,
    compareTop16: false,
    topDecks: false,
    invalidDeck: false,
  };
  
  // Run tests
  results.stats = await testStats();
  results.compareAll = await testCompare('all');
  results.compareTop16 = await testCompare('top16');
  results.topDecks = await testTopDecks();
  results.invalidDeck = await testInvalidDeck();
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(r => r).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${test}`);
  });
  
  console.log(`\n   Total: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed! API is working correctly.\n');
  } else {
    console.log(`\n⚠️  ${total - passed} test(s) failed.\n`);
  }
  
  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests();

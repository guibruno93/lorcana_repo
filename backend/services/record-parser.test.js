/**
 * backend/services/record-parser.test.js
 * Testes para record parser
 */

const {
  parseRecord,
  calculateWinRate,
  extractRecordFromDeck,
  estimateRecordFromPlacement
} = require('./record-parser');

console.log('🧪 Testing Record Parser...\n');

// ═══════════════════════════════════════════════════════════
// Test 1: parseRecord
// ═══════════════════════════════════════════════════════════

console.log('Test 1: parseRecord()');

const tests = [
  { input: '5-2', expected: { wins: 5, losses: 2, draws: 0, record: '5-2' } },
  { input: '4-1-1', expected: { wins: 4, losses: 1, draws: 1, record: '4-1-1' } },
  { input: '3-0', expected: { wins: 3, losses: 0, draws: 0, record: '3-0' } },
  { input: 'X-Drop', expected: { wins: 0, losses: 0, draws: 0, record: null } },
  { input: null, expected: { wins: 0, losses: 0, draws: 0, record: null } },
  { input: '', expected: { wins: 0, losses: 0, draws: 0, record: null } },
  { input: '10-2-1', expected: { wins: 10, losses: 2, draws: 1, record: '10-2-1' } }
];

for (const test of tests) {
  const result = parseRecord(test.input);
  const pass = JSON.stringify(result) === JSON.stringify(test.expected);
  
  console.log(`  ${pass ? '✅' : '❌'} parseRecord("${test.input}")`);
  
  if (!pass) {
    console.log(`     Expected: ${JSON.stringify(test.expected)}`);
    console.log(`     Got:      ${JSON.stringify(result)}`);
  }
}

console.log('');

// ═══════════════════════════════════════════════════════════
// Test 2: calculateWinRate
// ═══════════════════════════════════════════════════════════

console.log('Test 2: calculateWinRate()');

const winRateTests = [
  { wins: 5, losses: 2, expected: 71.43 },
  { wins: 4, losses: 1, expected: 80 },
  { wins: 3, losses: 0, expected: 100 },
  { wins: 0, losses: 3, expected: 0 },
  { wins: 0, losses: 0, expected: null }
];

for (const test of winRateTests) {
  const result = calculateWinRate(test.wins, test.losses);
  const pass = result === test.expected;
  
  console.log(`  ${pass ? '✅' : '❌'} calculateWinRate(${test.wins}, ${test.losses}) = ${result}`);
  
  if (!pass) {
    console.log(`     Expected: ${test.expected}`);
  }
}

console.log('');

// ═══════════════════════════════════════════════════════════
// Test 3: extractRecordFromDeck
// ═══════════════════════════════════════════════════════════

console.log('Test 3: extractRecordFromDeck()');

const deckTests = [
  {
    deck: { record: '5-2' },
    expected: { wins: 5, losses: 2, draws: 0, record: '5-2' }
  },
  {
    deck: { name: 'My Deck (4-1)' },
    expected: { wins: 4, losses: 1, draws: 0, record: '4-1' }
  },
  {
    deck: { description: 'Went 3-0 in tournament' },
    expected: { wins: 3, losses: 0, draws: 0, record: '3-0' }
  },
  {
    deck: { name: 'Deck', description: 'No record' },
    expected: { wins: 0, losses: 0, draws: 0, record: null }
  }
];

for (const test of deckTests) {
  const result = extractRecordFromDeck(test.deck);
  const pass = JSON.stringify(result) === JSON.stringify(test.expected);
  
  console.log(`  ${pass ? '✅' : '❌'} extractRecordFromDeck(...)`);
  
  if (!pass) {
    console.log(`     Input:    ${JSON.stringify(test.deck)}`);
    console.log(`     Expected: ${JSON.stringify(test.expected)}`);
    console.log(`     Got:      ${JSON.stringify(result)}`);
  }
}

console.log('');

// ═══════════════════════════════════════════════════════════
// Test 4: estimateRecordFromPlacement
// ═══════════════════════════════════════════════════════════

console.log('Test 4: estimateRecordFromPlacement()');

const placementTests = [
  { placement: 1, totalPlayers: 32, expectedWins: 5 },
  { placement: 2, totalPlayers: 32, expectedWins: 4 },
  { placement: 5, totalPlayers: 32, expectedWins: 3 },
  { placement: 16, totalPlayers: 32, expectedWins: 0 }
];

for (const test of placementTests) {
  const result = estimateRecordFromPlacement(test.placement, test.totalPlayers);
  const pass = result.wins === test.expectedWins;
  
  console.log(`  ${pass ? '✅' : '❌'} Place ${test.placement} → ${result.wins} wins`);
  
  if (!pass) {
    console.log(`     Expected: ${test.expectedWins} wins`);
  }
}

console.log('\n✅ All tests complete!');

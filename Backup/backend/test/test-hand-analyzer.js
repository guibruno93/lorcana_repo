// test-hand-analyzer.js
// Script para testar hand analyzer isoladamente
// Execute: node backend/test-hand-analyzer.js

'use strict';

console.log('🧪 Testing Hand Analyzer...\n');

// Test 1: Check files exist
console.log('📁 Test 1: Checking files...');
const fs = require('fs');
const path = require('path');

const files = [
  'services/ai/handAnalyzer.js',
  'services/ai/mulliganAdvisor.js',
  'services/ai/matchupAnalyzer.js',
  'routes/ai.js',
  'db/cards.json',
];

let allExist = true;
files.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allExist = false;
});

if (!allExist) {
  console.error('\n❌ Some files are missing! Copy them first.');
  process.exit(1);
}

console.log('\n✅ All files exist!\n');

// Test 2: Load modules
console.log('📦 Test 2: Loading modules...');

try {
  const handAnalyzer = require('./services/ai/handAnalyzer');
  console.log('  ✅ handAnalyzer loaded');
  
  const mulliganAdvisor = require('./services/ai/mulliganAdvisor');
  console.log('  ✅ mulliganAdvisor loaded');
  
  const matchupAnalyzer = require('./services/ai/matchupAnalyzer');
  console.log('  ✅ matchupAnalyzer loaded');
  
  console.log('\n✅ All modules loaded!\n');
} catch (err) {
  console.error('\n❌ Error loading modules:', err.message);
  console.error(err.stack);
  process.exit(1);
}

// Test 3: Test deckParser
console.log('🃏 Test 3: Testing deckParser...');

try {
  const deckParser = require('./services/deckParser');
  console.log('  ✅ deckParser loaded');
  
  if (typeof deckParser.analyzeDeck !== 'function') {
    throw new Error('analyzeDeck is not a function');
  }
  console.log('  ✅ analyzeDeck exists');
  
  if (typeof deckParser.buildIndex !== 'function') {
    console.warn('  ⚠️  buildIndex not found - this might cause issues');
  } else {
    console.log('  ✅ buildIndex exists');
  }
  
  console.log('\n✅ deckParser OK!\n');
} catch (err) {
  console.error('\n❌ Error with deckParser:', err.message);
  console.error(err.stack);
  process.exit(1);
}

// Test 4: Analyze sample deck
console.log('📊 Test 4: Analyzing sample deck...');

const sampleDecklist = `
4 Tipo - Growing Son
4 Hades - Infernal Schemer
4 Goliath - Clan Leader
4 Tinker Bell - Giant Fairy
4 Develop Your Brain
4 Be Prepared
4 Sail The Azurite Sea
4 Vision of the Future
2 Spooky Sight
4 Mulan - Disguised Soldier
4 Vincenzo Santorini - The Explosives Expert
4 He Hurled His Thunderbolt
4 Namaari - Single-Minded Rival
2 Beyond the Horizon
1 Pluto - Steel Champion
1 Arthur - King Victorious
4 Cinderella - Dream Come True
2 Jasmine - Fearless Princess
2 Inkrunner
3 Jafar - Tyrannical Hypnotist
`;

try {
  const { analyzeDeck } = require('./services/deckParser');
  const deckAnalysis = analyzeDeck(sampleDecklist);
  
  console.log('  ✅ Deck analyzed');
  console.log(`     Total cards: ${deckAnalysis.totalCards}`);
  console.log(`     Recognized: ${deckAnalysis.recognizedQty}`);
  console.log(`     Format: ${deckAnalysis.format}`);
  
  console.log('\n✅ Deck analysis OK!\n');
} catch (err) {
  console.error('\n❌ Error analyzing deck:', err.message);
  console.error(err.stack);
  process.exit(1);
}

// Test 5: Analyze sample hand
console.log('🎴 Test 5: Analyzing sample hand...');

const sampleHand = [
  "Tipo - Growing Son",
  "Sail The Azurite Sea",
  "Hades - Infernal Schemer",
  "Goliath - Clan Leader",
  "Tinker Bell - Giant Fairy",
  "Develop Your Brain",
  "Be Prepared"
];

try {
  const { analyzeDeck } = require('./services/deckParser');
  const { analyzeHand } = require('./services/ai/handAnalyzer');
  
  const deckAnalysis = analyzeDeck(sampleDecklist);
  const handAnalysis = analyzeHand(sampleHand, deckAnalysis);
  
  console.log('  ✅ Hand analyzed');
  console.log(`     Score: ${handAnalysis.score}/100`);
  console.log(`     Rating: ${handAnalysis.rating}`);
  console.log(`     Verdict: ${handAnalysis.verdict.decision}`);
  console.log(`     Confidence: ${Math.round(handAnalysis.verdict.confidence * 100)}%`);
  
  console.log('\n✅ Hand analysis OK!\n');
  
  console.log('📋 Full analysis result:');
  console.log(JSON.stringify(handAnalysis, null, 2));
  
} catch (err) {
  console.error('\n❌ Error analyzing hand:', err.message);
  console.error(err.stack);
  process.exit(1);
}

console.log('\n🎉 All tests passed! Backend should work now.\n');
console.log('💡 If frontend still fails, check:');
console.log('   1. Backend is running: npm start');
console.log('   2. Port is correct: http://localhost:5000');
console.log('   3. CORS is enabled');
console.log('   4. Check browser console (F12) for errors\n');

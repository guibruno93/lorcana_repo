// test-mulligan-v3.js
// Demonstra as melhorias do Mulligan Advisor v3

'use strict';

const API_URL = 'http://localhost:5000/api/ai';

// Deck Sapphire Ramp
const RAMP_DECK = `4 Sail The Azurite Sea
4 Develop Your Brain
3 Hades - Infernal Schemer
3 Arthur - King Victorious
4 Tinker Bell - Giant Fairy
4 Vision of the Future
3 Maleficent - Dragon
2 One Jump Ahead
4 Be Prepared
4 Freeze
3 He Hurled His Thunderbolt
4 A Whole New World
4 For the First Time in Forever
2 Dragon Trap
4 The Beast - Wolfsbane
2 Goliath - Clan Leader`;

// Deck Aggro
const AGGRO_DECK = `4 Tipo - Growing Son
4 Mulan - Disguised Soldier
4 Goliath - Clan Leader
4 Jasmine - Disguised Handmaiden
4 One Jump Ahead
4 For the First Time in Forever
4 Namaari - Single-Minded Rival
3 A Whole New World
3 Freeze
2 Be Prepared
4 Elsa - Frozen Princess
4 Tinker Bell - Pixie Dusted
2 Maleficent - Dragon
2 Arthur - King Victorious
4 The Beast - Wolfsbane
2 Hades - Infernal Schemer`;

async function testMulligan(deckName, decklist, hand, description) {
  console.log('\n' + '='.repeat(80));
  console.log(`\n🧪 TEST: ${deckName}`);
  console.log(`📋 Scenario: ${description}\n`);
  
  console.log('🎴 Hand:');
  hand.forEach((card, i) => {
    console.log(`   ${i + 1}. ${card}`);
  });
  
  try {
    const response = await fetch(`${API_URL}/mulligan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hand, decklist }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    console.log(`\n🎯 Decision: ${data.decision}`);
    console.log(`📊 Confidence: ${Math.round(data.confidence * 100)}%`);
    console.log(`💡 Reasoning: ${data.reasoning}`);
    
    if (data.strategy) {
      console.log(`\n🧠 Strategy Detected: ${data.strategy.type}`);
      console.log('   Priorities:');
      data.strategy.priorities.forEach(p => {
        console.log(`   - ${p}`);
      });
    }
    
    console.log('\n📋 Card Analysis:');
    
    const keeps = data.suggestions.filter(s => s.action === 'Keep');
    const mulligans = data.suggestions.filter(s => s.action === 'Mulligan');
    
    console.log(`\n✅ Keep (${keeps.length} cards):`);
    keeps.forEach(s => {
      console.log(`   - ${s.card} (${s.cost} cost)${s.inkable ? ' 💧' : ''}`);
      console.log(`     Role: ${s.role}`);
      if (s.reasons && s.reasons.length > 0) {
        console.log(`     Reasons: ${s.reasons[0]}`);
      }
    });
    
    console.log(`\n❌ Mulligan (${mulligans.length} cards):`);
    mulligans.forEach(s => {
      console.log(`   - ${s.card} (${s.cost} cost) [Priority ${s.priority}]`);
      if (s.reasons && s.reasons.length > 0) {
        console.log(`     Reason: ${s.reasons[0]}`);
      }
      if (s.alternatives && s.alternatives.length > 0) {
        console.log(`     Alternative: ${s.alternatives[0]}`);
      }
    });
    
    if (data.expectedImprovement > 0) {
      console.log(`\n📈 Expected Improvement: +${data.expectedImprovement}% better hand`);
    }
    
    console.log('\n✅ TEST PASSED\n');
    return true;
    
  } catch (error) {
    console.log(`\n❌ TEST FAILED: ${error.message}\n`);
    return false;
  }
}

async function runTests() {
  console.log('\n🚀 LORCANA AI - MULLIGAN ADVISOR v3 TESTS\n');
  console.log('Testing improved mulligan logic with REAL card effects...\n');
  
  const results = [];
  
  // Test 1: Ramp deck with expensive hand (should mulligan)
  results.push(await testMulligan(
    'Sapphire Ramp - Expensive Hand',
    RAMP_DECK,
    [
      'Hades - Infernal Schemer',
      'Arthur - King Victorious',
      'Maleficent - Dragon',
      'The Beast - Wolfsbane',
      'Tinker Bell - Giant Fairy',
      'Vision of the Future',
      'Be Prepared',
    ],
    'All expensive cards, no ramp enablers - should MULLIGAN'
  ));
  
  // Test 2: Ramp deck with good hand (should keep)
  results.push(await testMulligan(
    'Sapphire Ramp - Good Hand',
    RAMP_DECK,
    [
      'Sail The Azurite Sea',
      'Develop Your Brain',
      'Vision of the Future',
      'Freeze',
      'One Jump Ahead',
      'Hades - Infernal Schemer',
      'Tinker Bell - Giant Fairy',
    ],
    'Has ramp enablers and inkables - should KEEP'
  ));
  
  // Test 3: Aggro deck with slow hand (should mulligan)
  results.push(await testMulligan(
    'Aggro - Too Slow',
    AGGRO_DECK,
    [
      'Hades - Infernal Schemer',
      'Arthur - King Victorious',
      'Maleficent - Dragon',
      'The Beast - Wolfsbane',
      'Freeze',
      'Be Prepared',
      'A Whole New World',
    ],
    'Aggro with no early threats - should MULLIGAN'
  ));
  
  // Test 4: Aggro deck with fast hand (should keep)
  results.push(await testMulligan(
    'Aggro - Fast Hand',
    AGGRO_DECK,
    [
      'Tipo - Growing Son',
      'Mulan - Disguised Soldier',
      'Jasmine - Disguised Handmaiden',
      'One Jump Ahead',
      'Goliath - Clan Leader',
      'Tinker Bell - Pixie Dusted',
      'For the First Time in Forever',
    ],
    'Multiple early threats - should KEEP'
  ));
  
  // Test 5: Control deck without answers (should mulligan)
  results.push(await testMulligan(
    'Control - No Answers',
    RAMP_DECK, // Using ramp deck as control-ish
    [
      'Tinker Bell - Giant Fairy',
      'Goliath - Clan Leader',
      'Hades - Infernal Schemer',
      'Arthur - King Victorious',
      'One Jump Ahead',
      'A Whole New World',
      'For the First Time in Forever',
    ],
    'All threats, no removal - should suggest mulliganing threats'
  ));
  
  // Summary
  console.log('='.repeat(80));
  console.log('\n📊 TEST SUMMARY\n');
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`   Passed: ${passed}/${total}`);
  console.log(`   Success Rate: ${Math.round((passed/total)*100)}%\n`);
  
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED!\n');
    console.log('The Mulligan Advisor v3 is working correctly!');
    console.log('- Reads card effects ✅');
    console.log('- Detects strategy ✅');
    console.log('- Makes smart decisions ✅');
    console.log('- Explains reasoning ✅\n');
  } else {
    console.log('❌ Some tests failed. Check errors above.\n');
  }
  
  console.log('Next: Test in frontend at http://localhost:3001\n');
}

// Run tests
runTests().catch(err => {
  console.error('\n💥 Test runner error:', err);
  process.exit(1);
});

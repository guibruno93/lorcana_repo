// ═══════════════════════════════════════════════════════════════════════════
// update-cards.js - Copiar para backend/scripts/update-cards.js
// ═══════════════════════════════════════════════════════════════════════════
#!/usr/bin/env node
'use strict';

const { updateCards } = require('../services/cards/cardUpdater');

updateCards({ force: process.argv.includes('--force') })
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Error:', err.message);
    process.exit(1);
  });

// ═══════════════════════════════════════════════════════════════════════════
// sync-tournaments.js - Copiar para backend/scripts/sync-tournaments.js
// ═══════════════════════════════════════════════════════════════════════════
#!/usr/bin/env node
'use strict';

const { aggregateTournaments } = require('../services/tournaments/tournamentAggregator');

aggregateTournaments()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Error:', err.message);
    process.exit(1);
  });

// ═══════════════════════════════════════════════════════════════════════════
// analyze-meta.js - Copiar para backend/scripts/analyze-meta.js
// ═══════════════════════════════════════════════════════════════════════════
#!/usr/bin/env node
'use strict';

const { analyzeMetaState } = require('../services/tournaments/metaAnalyzer');

const result = analyzeMetaState();

if (!result.available) {
  console.log(`⚠️  ${result.note}`);
  process.exit(0);
}

// JSON mode
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

// Pretty print mode
console.log('\n═══════════════════════════════════════════════');
console.log('  META STATE REPORT');
console.log('═══════════════════════════════════════════════\n');

console.log(`📊 Health: ${result.health.health}`);
console.log(`   Diversity: ${result.health.diversity}%`);
console.log(`   Viable archetypes: ${result.health.viableArchetypes}`);
console.log(`   Top archetype share: ${result.health.concentration}%\n`);

console.log('🏆 TOP 5 ARCHETYPES (Last 7 days):\n');
for (const arch of result.archetypes.slice(0, 5)) {
  const trend = arch.trend === 'rising' ? '📈' : arch.trend === 'falling' ? '📉' : '➡️';
  console.log(`   ${trend} ${arch.weekShare}% ${arch.archetype}`);
  console.log(`      Change: ${arch.change > 0 ? '+' : ''}${arch.change}%`);
  console.log(`      Avg placement: #${arch.avgPlacement || 'N/A'}\n`);
}

console.log('🃏 TOP 10 CARDS (Last 7 days):\n');
for (const card of result.cards.slice(0, 10)) {
  const trend = card.trend === 'rising' ? '📈' : card.trend === 'falling' ? '📉' : '➡️';
  console.log(`   ${trend} ${card.weekShare}% ${card.card}`);
}

console.log('');
process.exit(0);

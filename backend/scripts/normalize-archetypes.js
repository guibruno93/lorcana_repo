require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Função de normalização (mesma do script original)
function normalizeArchetype(rawArchetype, inks) {
  if (!rawArchetype || rawArchetype === 'Unknown') return 'Unknown';
  
  const name = rawArchetype.toLowerCase().trim();
  const cleanName = name
    .replace(/^[a-z]\/[a-z]\s+/i, '')
    .replace(/^[a-z][a-z]\s+/i, '')
    .trim();
  
  const archetypeMap = {
    'aggro': 'Aggro', 'agro': 'Aggro', 'rush': 'Aggro',
    'midrange': 'Midrange', 'mid range': 'Midrange', 'mid': 'Midrange',
    'control': 'Control', 'ctrl': 'Control',
    'evasive': 'Evasive', 'evasives': 'Evasive',
    'songs': 'Songs', 'song': 'Songs',
    'ramp': 'Ramp', 'ramping': 'Ramp',
    'bounce': 'Bounce',
    'locations': 'Locations', 'location': 'Locations',
    'allies': 'Allies', 'ally': 'Allies',
    'challengers': 'Challengers', 'challenger': 'Challengers',
    'detectives': 'Detectives', 'detective': 'Detectives',
    'princesses': 'Princesses', 'princess': 'Princesses',
    'dumbo': 'Dumbo',
    'brainiac': 'Brainiac',
    'steelsong': 'Steelsong', 'steel song': 'Steelsong',
    'combo': 'Combo',
    'tempo': 'Tempo',
    'burn': 'Burn',
    'discard': 'Discard'
  };
  
  if (archetypeMap[cleanName]) return archetypeMap[cleanName];
  
  for (const [key, value] of Object.entries(archetypeMap)) {
    if (cleanName.includes(key)) return value;
  }
  
  return 'Unknown';
}

// FETCH ALL DECKS COM PAGINAÇÃO
async function fetchAllDecks() {
  console.log('🔍 Fetching all decks with pagination...');
  
  let allDecks = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    
    console.log(`   📄 Fetching page ${page + 1} (${from}-${to})...`);
    
    const { data: decks, error, count } = await supabase
      .from('decks')
      .select('id, archetype, inks', { count: 'exact' })
      .eq('format', 'core')
      .range(from, to);
    
    if (error) throw error;
    
    if (decks && decks.length > 0) {
      allDecks = allDecks.concat(decks);
      console.log(`   ✅ Got ${decks.length} decks (total: ${allDecks.length})`);
    }
    
    // Se retornou menos que pageSize, não há mais páginas
    if (!decks || decks.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }
  
  console.log(`\n✅ Total fetched: ${allDecks.length} decks\n`);
  return allDecks;
}

// NORMALIZAR
async function normalizeDatabaseArchetypes() {
  // Buscar TODOS os decks com paginação
  const decks = await fetchAllDecks();
  
  // Contar arquétipos originais
  const originalArchetypes = new Map();
  for (const deck of decks) {
    const arch = deck.archetype || 'Unknown';
    originalArchetypes.set(arch, (originalArchetypes.get(arch) || 0) + 1);
  }
  
  console.log(`📊 Original: ${originalArchetypes.size} unique archetypes`);
  
  // Normalizar
  const updates = [];
  const normalizedArchetypes = new Map();
  
  for (const deck of decks) {
    const normalized = normalizeArchetype(deck.archetype, deck.inks);
    
    if (normalized !== deck.archetype) {
      updates.push({
        id: deck.id,
        original: deck.archetype,
        normalized
      });
    }
    
    normalizedArchetypes.set(normalized, (normalizedArchetypes.get(normalized) || 0) + 1);
  }
  
  console.log(`📊 After normalization: ${normalizedArchetypes.size} unique archetypes`);
  console.log(`📝 Need to update: ${updates.length} decks\n`);
  
  // Mostrar distribuição
  console.log('📊 Top archetypes after normalization:');
  const sorted = Array.from(normalizedArchetypes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  
  for (const [arch, count] of sorted) {
    console.log(`   ${arch.padEnd(20)} ${count.toString().padStart(4)} decks`);
  }
  
  if (updates.length === 0) {
    console.log('\n✅ No updates needed! All decks already normalized.');
    return { updated: 0, errors: 0, beforeCount: originalArchetypes.size, afterCount: normalizedArchetypes.size };
  }
  
  // Confirmar
  console.log('\n⚠️  This will update', updates.length, 'decks.');
  console.log('⚠️  Backup your database before proceeding!');
  console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Atualizar em lotes
  console.log('🔄 Updating database...');
  
  let updated = 0;
  let errors = 0;
  
  for (const update of updates) {
    const { error } = await supabase
      .from('decks')
      .update({ archetype: update.normalized })
      .eq('id', update.id);
    
    if (error) {
      console.error(`❌ Error updating deck ${update.id}:`, error.message);
      errors++;
    } else {
      updated++;
      
      if (updated % 100 === 0) {
        console.log(`   ✅ Updated ${updated}/${updates.length}...`);
      }
    }
  }
  
  console.log(`\n✅ Normalization completed!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Unique archetypes: ${originalArchetypes.size} → ${normalizedArchetypes.size}`);
  
  return {
    updated,
    errors,
    beforeCount: originalArchetypes.size,
    afterCount: normalizedArchetypes.size,
    distribution: normalizedArchetypes
  };
}

// MAIN
async function main() {
  try {
    console.log('🤖 ARCHETYPE NORMALIZER (WITH PAGINATION)\n');
    
    await normalizeDatabaseArchetypes();
    
    console.log('\n✅ Done! Now you can re-train the ML model.');
    console.log('   Expected accuracy: 80-90%');
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();

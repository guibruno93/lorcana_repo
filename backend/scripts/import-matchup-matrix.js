/**
 * backend/scripts/import-matchup-matrix.js
 * 
 * Importa matriz de matchups do arquivo tietlist.html do InkDecks
 * 
 * Uso: node scripts/import-matchup-matrix.js [path/to/tietlist.html]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ═══════════════════════════════════════════════════════════════════
// PARSE HTML
// ═══════════════════════════════════════════════════════════════════

function parseMatchupTable(html) {
  console.log('📊 Parsing matchup table from HTML...');
  
  const matchups = [];
  
  // Regex para encontrar linhas da tabela
  const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const cellRegex = /<td[^>]*>(.*?)<\/td>/gi;
  
  const rows = html.match(rowRegex) || [];
  
  console.log(`   Found ${rows.length} rows in HTML`);
  
  if (rows.length === 0) {
    throw new Error('No table rows found in HTML. Check if file is correct.');
  }
  
  // Primeira linha = header
  const headerCells = [];
  let headerMatch;
  const headerRow = rows[0];
  
  while ((headerMatch = cellRegex.exec(headerRow)) !== null) {
    const cell = headerMatch[1].trim();
    if (cell) headerCells.push(cell);
  }
  
  console.log(`   Header: ${headerCells.length} archetypes`);
  
  // Processar cada linha
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const cells = [];
    
    cellRegex.lastIndex = 0;
    let match;
    
    while ((match = cellRegex.exec(row)) !== null) {
      cells.push(match[1].trim());
    }
    
    if (cells.length === 0) continue;
    
    const archetype = cells[0];
    
    for (let j = 1; j < cells.length && j < headerCells.length + 1; j++) {
      const opponent = headerCells[j - 1];
      const winrateStr = cells[j];
      
      const winrateMatch = winrateStr.match(/(\d+)%?/);
      if (!winrateMatch) continue;
      
      const winrate = parseInt(winrateMatch[1]);
      
      if (winrate >= 0 && winrate <= 100 && archetype !== opponent) {
        matchups.push({ archetype, opponent, winrate });
      }
    }
  }
  
  console.log(`✅ Parsed ${matchups.length} matchups`);
  
  return matchups;
}

// ═══════════════════════════════════════════════════════════════════
// NORMALIZAR NOMES
// ═══════════════════════════════════════════════════════════════════

function normalizeArchetypeName(name) {
  let clean = name.replace(/^[A-Z]\/[A-Z]\s+/i, '').trim();
  
  const map = {
    'evasive': 'Evasive',
    'aggro': 'Aggro',
    'control': 'Control',
    'midrange': 'Midrange',
    'dumbo': 'Dumbo',
    'songs': 'Songs',
    'ramp': 'Ramp',
    'allies': 'Allies',
    'challengers': 'Challengers'
  };
  
  return map[clean.toLowerCase()] || clean;
}

// ═══════════════════════════════════════════════════════════════════
// IMPORTAR
// ═══════════════════════════════════════════════════════════════════

async function importToSupabase(matchups) {
  console.log('\n🚀 Importing to Supabase...');
  
  const normalized = matchups.map(m => ({
    ...m,
    archetype: normalizeArchetypeName(m.archetype),
    opponent: normalizeArchetypeName(m.opponent)
  }));
  
  // Limpar tabela
  await supabase
    .from('matchup_matrix')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  // Inserir em lotes
  let imported = 0;
  const batchSize = 100;
  
  for (let i = 0; i < normalized.length; i += batchSize) {
    const batch = normalized.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('matchup_matrix')
      .insert(batch.map(m => ({
        archetype: m.archetype,
        opponent: m.opponent,
        winrate: m.winrate,
        matches: 100,
        wins: m.winrate,
        losses: 100 - m.winrate,
        format: 'core'
      })));
    
    if (!error) {
      imported += batch.length;
      console.log(`   ✅ Batch ${i / batchSize + 1}: ${batch.length} imported`);
    }
  }
  
  console.log(`\n✅ Imported: ${imported} matchups`);
  return imported;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log('🎴 MATCHUP MATRIX IMPORTER\n');
  
  try {
    const filePath = process.argv[2];
    
    if (!filePath) {
      console.error('Usage: node scripts/import-matchup-matrix.js path/to/tietlist.html');
      process.exit(1);
    }
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }
    
    const html = fs.readFileSync(filePath, 'utf-8');
    const matchups = parseMatchupTable(html);
    
    await importToSupabase(matchups);
    
    console.log('\n✅ Done! Use /api/deck/matchups endpoint now.');
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

main();

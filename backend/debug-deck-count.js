/**
 * debug-deck-count.js
 * Script para debugar por que deck_count está retornando 0
 * 
 * COMO USAR:
 * node debug-deck-count.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function debug() {
  console.log('🔍 DEBUGGING DECK COUNT ISSUE...\n');
  
  // 1. Total de decks
  console.log('📊 1. Total de decks no banco:');
  const { data: allDecks, error: allError } = await supabase
    .from('decks')
    .select('id', { count: 'exact', head: true });
  
  if (allError) {
    console.error('❌ Error:', allError.message);
  } else {
    console.log(`   ✅ Total: ${allDecks?.length || 0} decks\n`);
  }
  
  // 2. Decks por formato
  console.log('📊 2. Decks por formato:');
  const { data: byFormat, error: formatError } = await supabase
    .from('decks')
    .select('format');
  
  if (formatError) {
    console.error('❌ Error:', formatError.message);
  } else {
    const formatCounts = {};
    byFormat.forEach(deck => {
      const fmt = deck.format || 'NULL';
      formatCounts[fmt] = (formatCounts[fmt] || 0) + 1;
    });
    
    Object.entries(formatCounts).forEach(([format, count]) => {
      console.log(`   ${format}: ${count} decks`);
    });
    console.log('');
  }
  
  // 3. Arquétipos disponíveis
  console.log('📊 3. Arquétipos disponíveis:');
  const { data: byArchetype, error: archError } = await supabase
    .from('decks')
    .select('archetype, format');
  
  if (archError) {
    console.error('❌ Error:', archError.message);
  } else {
    const archetypeCounts = {};
    byArchetype.forEach(deck => {
      if (deck.archetype) {
        const key = `${deck.archetype} (${deck.format || 'NO FORMAT'})`;
        archetypeCounts[key] = (archetypeCounts[key] || 0) + 1;
      }
    });
    
    const sorted = Object.entries(archetypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    
    sorted.forEach(([name, count]) => {
      console.log(`   ${name}: ${count} decks`);
    });
    console.log(`   ... (${Object.keys(archetypeCounts).length} arquétipos no total)\n`);
  }
  
  // 4. Arquétipos na tabela archetype_meta
  console.log('📊 4. Arquétipos em archetype_meta:');
  const { data: metaArchetypes, error: metaError } = await supabase
    .from('archetype_meta')
    .select('archetype_name, format, meta_share, tier')
    .order('meta_share', { ascending: false })
    .limit(15);
  
  if (metaError) {
    console.error('❌ Error:', metaError.message);
  } else {
    metaArchetypes.forEach(arch => {
      console.log(`   ${arch.archetype_name} (${arch.format}) - Tier ${arch.tier} - ${arch.meta_share?.toFixed(1)}%`);
    });
    console.log('');
  }
  
  // 5. Teste de query específica (como o dashboard faz)
  console.log('📊 5. Teste de query (dashboard style):');
  const days = 30;
  const format = 'CORE';
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  console.log(`   Filtros: format='${format}', date >= ${cutoffDate.toISOString().split('T')[0]}`);
  
  const { data: testDecks, error: testError } = await supabase
    .from('decks')
    .select('id, archetype, format, date')
    .eq('format', format)
    .gte('date', cutoffDate.toISOString().split('T')[0])
    .limit(10);
  
  if (testError) {
    console.error('❌ Error:', testError.message);
  } else {
    console.log(`   ✅ Encontrados: ${testDecks?.length || 0} decks`);
    if (testDecks && testDecks.length > 0) {
      console.log('   Amostra:');
      testDecks.slice(0, 5).forEach(deck => {
        console.log(`     - ${deck.archetype || 'NULL'} | ${deck.format} | ${deck.date}`);
      });
    }
    console.log('');
  }
  
  // 6. Teste com formato diferente
  console.log('📊 6. Teste com formato "core" (minúsculo):');
  const { data: testDecks2, error: testError2 } = await supabase
    .from('decks')
    .select('id, archetype, format, date')
    .eq('format', 'core')
    .gte('date', cutoffDate.toISOString().split('T')[0])
    .limit(10);
  
  if (testError2) {
    console.error('❌ Error:', testError2.message);
  } else {
    console.log(`   ✅ Encontrados: ${testDecks2?.length || 0} decks\n`);
  }
  
  // 7. Verificar contagem por arquétipo específico
  console.log('📊 7. Teste de contagem por arquétipo (Evasive):');
  
  // Tentar "Evasive"
  const { data: evasiveDecks, error: evasiveError } = await supabase
    .from('decks')
    .select('id', { count: 'exact', head: true })
    .eq('archetype', 'Evasive')
    .eq('format', 'CORE');
  
  if (evasiveError) {
    console.error('❌ Error:', evasiveError.message);
  } else {
    console.log(`   "Evasive" + "CORE": ${evasiveDecks?.length || 0} decks`);
  }
  
  // Tentar sem filtro de formato
  const { data: evasiveDecks2, error: evasiveError2 } = await supabase
    .from('decks')
    .select('id', { count: 'exact', head: true })
    .eq('archetype', 'Evasive');
  
  if (evasiveError2) {
    console.error('❌ Error:', evasiveError2.message);
  } else {
    console.log(`   "Evasive" (any format): ${evasiveDecks2?.length || 0} decks\n`);
  }
  
  // 8. Conclusão
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 CONCLUSÃO:\n');
  console.log('Possíveis problemas:');
  console.log('1. ❓ Formato está errado? (CORE vs core vs Core)');
  console.log('2. ❓ Nome dos arquétipos não corresponde?');
  console.log('3. ❓ Filtro de data muito restritivo?');
  console.log('4. ❓ Decks não têm arquétipo atribuído?\n');
  
  console.log('💡 Verifique as contagens acima e compare:');
  console.log('   - Total de decks vs Decks encontrados com filtros');
  console.log('   - Nomes dos arquétipos em "decks" vs "archetype_meta"');
  console.log('   - Formato usado (case-sensitive!)');
}

debug().catch(console.error);

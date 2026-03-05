/**
 * scripts/import-cards-PERFECT.js
 * Mapeia cards.json para schema EXATO do banco
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function importCards() {
  console.log('🔄 Starting cards import (SCHEMA-PERFECT VERSION)...');
  
  // 1. Ler cards.json
  const cardsPath = path.join(__dirname, '../cards.json');
  if (!fs.existsSync(cardsPath)) {
    console.error('❌ cards.json not found at:', cardsPath);
    console.log('📁 Expected location:', cardsPath);
    process.exit(1);
  }
  
  console.log('📖 Reading cards.json...');
  const cardsData = JSON.parse(fs.readFileSync(cardsPath, 'utf-8'));
  
  console.log(`✅ Found ${cardsData.length} cards in JSON`);
  
  // 2. Mapear para schema EXATO do banco
  const cards = cardsData.map(c => ({
    // IDs e Nomes
    id: c.id || c.fullIdentifier || `${c.setCode}/${c.number}`,
    code: c.fullIdentifier || c.id,
    name: c.name,
    full_name: c.name, // Mesmo valor (banco separa por alguma razão)
    simple_name: c.simpleName || (c.name || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
    name_lower: (c.name || '').toLowerCase(),
    
    // Card properties
    ink: c.ink || c.color,
    type: c.type,
    cost: c.cost,
    inkable: c.inkable === true,
    lore: c.lore,
    strength: c.strength,
    willpower: c.willpower,
    
    // Set info
    set_code: c.setCode,
    set_name: c.set || c.setName,
    
    // Rarity
    rarity: c.rarity,
    
    // Abilities (converter subtypes para abilities se necessário)
    abilities: c.abilities || (c.subtypes && c.subtypes.length > 0 ? { subtypes: c.subtypes } : null),
    
    // Metadata
    image_url: null, // JSON não tem, deixar null
    source: 'cards.json',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
  
  console.log('🔍 Sample card (mapped to schema):');
  console.log(JSON.stringify(cards[0], null, 2));
  
  // 3. Verificar campos obrigatórios
  const missingRequired = cards.filter(c => !c.id || !c.name);
  if (missingRequired.length > 0) {
    console.warn(`⚠️  ${missingRequired.length} cards missing required fields (id or name)`);
    console.log('First missing:', missingRequired[0]);
  }
  
  // 4. UPSERT em batches
  const batchSize = 500;
  const batches = Math.ceil(cards.length / batchSize);
  
  console.log(`\n📦 Upserting ${cards.length} cards in ${batches} batches...`);
  console.log('💡 Using UPSERT (updates existing, inserts new)');
  console.log('');
  
  let upserted = 0;
  let errors = 0;
  
  for (let i = 0; i < batches; i++) {
    const start = i * batchSize;
    const end = Math.min((i + 1) * batchSize, cards.length);
    const batch = cards.slice(start, end);
    
    process.stdout.write(`  Batch ${i + 1}/${batches}: ${start}-${end}... `);
    
    const { error } = await supabase
      .from('cards')
      .upsert(batch, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.log('❌');
      console.error(`     Error:`, error.message);
      console.error(`     First card:`, JSON.stringify(batch[0], null, 2));
      errors++;
    } else {
      upserted += batch.length;
      console.log('✅');
    }
  }
  
  console.log('');
  console.log('🎉 Import completed!');
  console.log(`✅ ${upserted} cards upserted`);
  console.log(`❌ ${errors} batch errors`);
  
  // 5. Verificar resultado
  console.log('');
  console.log('📊 Verification:');
  
  const { count, error: countError } = await supabase
    .from('cards')
    .select('id', { count: 'exact', head: true });
  
  if (countError) {
    console.error('❌ Count error:', countError);
  } else {
    console.log(`   Total cards in database: ${count}`);
  }
  
  // 6. Verificar inkable distribution
  const { data: inkableCount, error: inkErr } = await supabase
    .from('cards')
    .select('inkable', { count: 'exact' })
    .eq('inkable', true);
  
  if (!inkErr) {
    console.log(`   Inkable cards: ${inkableCount.length || 0}`);
  }
  
  const { data: nonInkableCount, error: nonInkErr } = await supabase
    .from('cards')
    .select('inkable', { count: 'exact' })
    .eq('inkable', false);
  
  if (!nonInkErr) {
    console.log(`   Non-inkable cards: ${nonInkableCount.length || 0}`);
  }
  
  // 7. Sample cards
  console.log('');
  console.log('📊 Sample cards:');
  const { data: samples, error: sampleErr } = await supabase
    .from('cards')
    .select('name, ink, type, cost, inkable, rarity')
    .limit(5);
  
  if (!sampleErr && samples) {
    console.table(samples);
  }
  
  // 8. Verificar se cartas do deck de teste existem
  console.log('');
  console.log('🧪 Checking test deck cards:');
  
  const testCards = [
    'Lumpy - Playful Heffalump',
    'Hades - Infernal Schemer',
    'Elsa - Spirit of Winter',
    'Let It Go'
  ];
  
  for (const cardName of testCards) {
    const { data, error } = await supabase
      .from('cards')
      .select('name, inkable')
      .ilike('name', cardName)
      .limit(1);
    
    if (error || !data || data.length === 0) {
      console.log(`   ❌ ${cardName} - NOT FOUND`);
    } else {
      console.log(`   ✅ ${cardName} - inkable: ${data[0].inkable}`);
    }
  }
  
  console.log('');
  console.log('✅ Done! Cards imported successfully!');
  console.log('');
  console.log('🎯 Next steps:');
  console.log('   1. Test deck analyzer: POST /api/deck/analyze');
  console.log('   2. Check inkable % is correct (~63%)');
  console.log('   3. Verify all cards are found');
}

importCards().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

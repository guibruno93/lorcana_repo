/**
 * migrate-to-supabase.js
 * Migra dados de JSON para Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bjfxtfchfawvkaufdtdn.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZnh0ZmNoZmF3dmthdWZkdGRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTUwNywiZXhwIjoyMDg0NzU3NTA3fQ.hrQBIPoLZUN3wX9YeSyjnlEE06D0unfsQoZGHrC2i4E';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ═══════════════════════════════════════════════════════════
// MIGRATION FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Migrate cards from cards.json
 */
async function migrateCards() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📦 Migrating Cards');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const cardsPath = path.join(__dirname, './backend/db/cards.json');
  
  if (!fs.existsSync(cardsPath)) {
    console.log('⚠️  cards.json not found, skipping...');
    return;
  }
  
  const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
  
  console.log(`📊 Found ${cards.length} cards to migrate`);
  
  // Batch insert (1000 at a time)
  const batchSize = 1000;
  let inserted = 0;
  let errors = 0;
  
  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = cards.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('cards')
      .upsert(batch.map(card => ({
        id: card.id,
        code: card.code,
        name: card.name,
        full_name: card.fullName,
        simple_name: card.simpleName,
        ink: card.ink,
        type: card.type,
        cost: card.cost,
        inkable: card.inkable,
        lore: card.lore,
        strength: card.strength,
        willpower: card.willpower,
        set_code: card.setCode,
        set_name: card.setName,
        rarity: card.rarity,
        abilities: card.abilities,
        image_url: card.image,
        source: card.source,
      })), { onConflict: 'id' });
    
    if (error) {
      console.error(`   ❌ Batch ${i}-${i+batchSize} failed:`, error.message);
      errors++;
    } else {
      inserted += batch.length;
      console.log(`   ✅ Batch ${i}-${i+batchSize}: ${batch.length} cards`);
    }
  }
  
  console.log(`\n✅ Cards migration complete:`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Errors:   ${errors}`);
}

/**
 * Migrate tournaments and decks from inkdecks-scraped.json
 */
async function migrateDecks() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📦 Migrating Tournaments & Decks');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const decksPath = path.join(__dirname, './backend/data/inkdecks-scraped.json');
  
  if (!fs.existsSync(decksPath)) {
    console.log('⚠️  inkdecks-scraped.json not found, skipping...');
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(decksPath, 'utf8'));
  const decks = data.decks || [];
  
  console.log(`📊 Found ${decks.length} decks to migrate`);
  
  // Extract unique tournaments
  const tournaments = new Map();
  
  for (const deck of decks) {
    if (deck.tournamentId && !tournaments.has(deck.tournamentId)) {
      tournaments.set(deck.tournamentId, {
        id: deck.tournamentId,
        name: deck.tournament,
        url: deck.tournamentUrl,
        format: 'core',
        source: 'inkdecks',
      });
    }
  }
  
  console.log(`📊 Found ${tournaments.size} unique tournaments\n`);
  
  // Insert tournaments
  console.log('Inserting tournaments...');
  const { data: tournamentsData, error: tournamentsError } = await supabase
    .from('tournaments')
    .upsert(Array.from(tournaments.values()), { onConflict: 'id' });
  
  if (tournamentsError) {
    console.error('❌ Tournaments error:', tournamentsError.message);
  } else {
    console.log(`✅ ${tournaments.size} tournaments inserted`);
  }
  
  // Insert decks in batches
  console.log('\nInserting decks...');
  const batchSize = 500;
  let inserted = 0;
  let errors = 0;
  
  for (let i = 0; i < decks.length; i += batchSize) {
    const batch = decks.slice(i, i + batchSize);
    
    const { data: decksData, error: decksError } = await supabase
      .from('decks')
      .upsert(batch.map(deck => ({
        tournament_id: deck.tournamentId,
        name: deck.name,
        author: deck.author,
        placement: deck.placement,
        cards: deck.cards,
        inks: deck.inks,
        fingerprint: deck.fingerprint,
        url: deck.url,
        tournament_url: deck.tournamentUrl,
        source: 'inkdecks',
        scraped_at: deck.scrapedAt,
      })), { onConflict: 'fingerprint' });
    
    if (decksError) {
      console.error(`   ❌ Batch ${i}-${i+batchSize} failed:`, decksError.message);
      errors++;
    } else {
      inserted += batch.length;
      console.log(`   ✅ Batch ${i}-${i+batchSize}: ${batch.length} decks`);
    }
  }
  
  console.log(`\n✅ Decks migration complete:`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Errors:   ${errors}`);
}

/**
 * Verify migration
 */
async function verifyMigration() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🔍 Verifying Migration');
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Count cards
  const { count: cardsCount, error: cardsError } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true });
  
  if (!cardsError) {
    console.log(`✅ Cards in database: ${cardsCount}`);
  }
  
  // Count tournaments
  const { count: tournamentsCount, error: tournamentsError } = await supabase
    .from('tournaments')
    .select('*', { count: 'exact', head: true });
  
  if (!tournamentsError) {
    console.log(`✅ Tournaments in database: ${tournamentsCount}`);
  }
  
  // Count decks
  const { count: decksCount, error: decksError } = await supabase
    .from('decks')
    .select('*', { count: 'exact', head: true });
  
  if (!decksError) {
    console.log(`✅ Decks in database: ${decksCount}`);
  }
  
  // Test view
  const { data: metaStats, error: metaError } = await supabase
    .from('v_meta_stats')
    .select('*')
    .single();
  
  if (!metaError && metaStats) {
    console.log(`\n📊 Meta Statistics:`);
    console.log(`   Total decks: ${metaStats.total_decks}`);
    console.log(`   Tournaments: ${metaStats.total_tournaments}`);
    console.log(`   Top 4 decks: ${metaStats.top4_decks}`);
    console.log(`   Top 8 decks: ${metaStats.top8_decks}`);
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   Lorcana AI - Supabase Migration                   ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  
  try {
    await migrateCards();
    await migrateDecks();
    await verifyMigration();
    
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║   ✅ Migration Complete!                             ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  migrateCards,
  migrateDecks,
  verifyMigration,
};

/**
 * Teste direto do scraper (sem API / Supabase).
 */

const { InkdecksScraper } = require('./services/scrapers/inkdecks-scraper-v2');

async function test() {
  console.log('Testing Inkdecks scraper...\n');

  const scraper = new InkdecksScraper();

  const decks = await scraper.scrapeDecks(5, (event) => {
    console.log(`[${event.level}] ${event.message}`);
  });

  console.log(`\n✅ Scraped ${decks.length} decks:`);
  decks.forEach((deck, i) => {
    console.log(`${i + 1}. ${deck.title} (${deck.archetype})`);
    console.log(`   Cards: ${(deck.cards || []).length}`);
    console.log(`   Colors: ${(deck.inks || []).join(', ')}`);
  });
}

test().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

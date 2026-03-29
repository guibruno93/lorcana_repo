/**
 * test-scraper-integration.js
 * Teste completo do scraper (sem gravar no Supabase).
 */

const { InkdecksScraper } = require('./services/scrapers/inkdecks-scraper-v2');

async function test() {
  console.log('🔍 Testing Inkdecks Scraper Integration\n');

  try {
    const scraper = new InkdecksScraper();

    console.log('📥 Scraping 5 decks...\n');

    const decks = await scraper.scrapeDecks(5, (event) => {
      const emoji = {
        info: 'ℹ️',
        success: '✅',
        error: '❌',
        warning: '⚠️',
      }[event.level] || '📝';

      console.log(`${emoji} ${event.message}`);
    });

    console.log(`\n📊 Results: ${decks.length} decks scraped\n`);

    decks.forEach((deck, i) => {
      console.log(`${i + 1}. ${deck.title}`);
      console.log(`   Archetype: ${deck.archetype || 'Unknown'}`);
      console.log(`   Colors: ${deck.inks?.join(', ') || 'Unknown'}`);
      console.log(`   Cards: ${(deck.cards || []).length}`);
      console.log(`   W/L: ${deck.wins || 0}-${deck.losses || 0}`);
      console.log('');
    });

    if (decks.length === 0) {
      console.error('❌ FAILED: Scraper returned 0 decks');
      console.error('Possible causes:');
      console.error('  - Wrong CSS selectors');
      console.error('  - Website structure changed');
      console.error('  - Rate limiting / blocked');
      process.exit(1);
    }

    console.log('✅ Integration test PASSED!');
    console.log('Next step: POST /api/meta-analysis/scrape with token');
  } catch (err) {
    console.error('❌ Test FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

test();

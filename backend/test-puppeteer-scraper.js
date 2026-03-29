/**
 * Teste local do scraper Puppeteer (Cloudflare).
 */

const { InkdecksPuppeteerScraper } = require('./services/scrapers/inkdecks-puppeteer-scraper');

async function test() {
  console.log('🔍 Testing Puppeteer Scraper (Cloudflare bypass)\n');

  const scraper = new InkdecksPuppeteerScraper();

  try {
    const decks = await scraper.scrapeDecks(3, (event) => {
      const emoji = {
        info: 'ℹ️',
        success: '✅',
        error: '❌',
        warning: '⚠️',
      }[event.level] || '📝';

      console.log(`${emoji} ${event.message}`);
    });

    console.log(`\n📊 Scraped ${decks.length} decks\n`);

    decks.forEach((deck, i) => {
      const rows = (deck.cards || []).length;
      const copies = (deck.cards || []).reduce((s, c) => s + (c.quantity || 0), 0);
      console.log(`${i + 1}. ${deck.title}`);
      console.log(`   Archetype: ${deck.archetype}`);
      console.log(`   Linhas (tipos): ${rows} | Cópias no baralho: ${copies}`);
      console.log('');
    });

    if (decks.length === 0) {
      console.error('❌ 0 decks (Cloudflare ou seletores).');
      process.exit(1);
    }

    console.log('✅ Puppeteer scraper retornou dados.');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

test();

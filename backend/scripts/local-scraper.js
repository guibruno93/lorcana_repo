#!/usr/bin/env node
'use strict';

/**
 * Scraper CLI para GitHub Actions e execução local.
 * Grava em Supabase (scraped_decks) via service role.
 *
 * Uso: node scripts/local-scraper.js [limit]
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const {
  InkdecksPuppeteerScraper,
  deckToScrapedDeckRow,
} = require('../services/scrapers/inkdecks-puppeteer-scraper');

async function main() {
  const startTime = Date.now();
  const limit = parseInt(process.argv[2] || '50', 10);

  console.log('🚀 Inkwell Labs Scraper - Starting...');
  console.log(
    '📍 Environment:',
    process.env.GITHUB_ACTIONS === 'true' ? 'GitHub Actions' : 'Local'
  );
  console.log('📊 Target limit:', limit, 'decks\n');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  let scrapedDecks = [];
  let savedIncremental = 0;
  try {
    const scraper = new InkdecksPuppeteerScraper();
    scrapedDecks = await scraper.scrapeDecks(limit, async (event) => {
      if (event.type === 'pageComplete') {
        if (event.decks && event.decks.length > 0) {
          const rows = event.decks.map(deckToScrapedDeckRow);
          const { error } = await supabase.from('scraped_decks').insert(rows);
          if (error) {
            console.error(
              `❌ Supabase insert (página ${event.page}):`,
              error.message
            );
            throw error;
          }
          savedIncremental += rows.length;
          console.log(
            `[success] Página ${event.page}: ${rows.length} deck(s) guardados no Supabase`
          );
        }
        return;
      }
      const level = event.level || 'info';
      const msg = event.message || JSON.stringify(event);
      console.log(`[${level}] ${msg}`);
    });
  } catch (e) {
    console.error('❌ Scraper failed:', e.message || e);
    process.exit(1);
  }

  let saved = savedIncremental;
  if (savedIncremental === 0 && scrapedDecks.length > 0) {
    const rows = scrapedDecks.map(deckToScrapedDeckRow);
    const { error } = await supabase.from('scraped_decks').insert(rows);
    if (error) {
      console.error('❌ Supabase insert error:', error.message);
      process.exit(1);
    }
    saved = rows.length;
  }

  let count = null;
  try {
    const { count: c } = await supabase
      .from('scraped_decks')
      .select('*', { count: 'exact', head: true });
    count = c;
  } catch {
    count = null;
  }

  const decksWithWinLoss = scrapedDecks.filter(
    (deck) => deck.wins != null && deck.losses != null
  ).length;
  const decksWithStanding = scrapedDecks.filter(
    (deck) => deck.standing != null
  ).length;
  const decksWithEvent = scrapedDecks.filter(
    (deck) => deck.event != null
  ).length;
  const totalScraped = scrapedDecks.length;
  const pct = (n) =>
    totalScraped > 0 ? Math.round((n / totalScraped) * 100) : 0;
  const executionTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 SCRAPING SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log(`✅ Decks scraped: ${totalScraped}`);
  console.log(`💾 Decks saved to Supabase: ${saved}`);
  console.log(
    `📊 Decks with W-L data: ${decksWithWinLoss}/${totalScraped} (${pct(decksWithWinLoss)}%)`
  );
  console.log(
    `🏆 Decks with standing: ${decksWithStanding}/${totalScraped} (${pct(decksWithStanding)}%)`
  );
  console.log(
    `🎪 Decks with event name: ${decksWithEvent}/${totalScraped} (${pct(decksWithEvent)}%)`
  );
  console.log(`📈 Total decks in database: ${count ?? 'unknown'}`);
  console.log(`⏱️  Execution time: ${executionTime}s`);
  console.log('═══════════════════════════════════════════════════');
  if (process.env.SCRAPER_DEBUG_PERF !== 'true') {
    console.log(
      '💡 Tip: Set SCRAPER_DEBUG_PERF=true for detailed performance extraction debug'
    );
  }
  console.log('');
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});

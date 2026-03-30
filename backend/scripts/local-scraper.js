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
  try {
    const scraper = new InkdecksPuppeteerScraper();
    scrapedDecks = await scraper.scrapeDecks(limit, (event) => {
      const level = event.level || 'info';
      const msg = event.message || JSON.stringify(event);
      console.log(`[${level}] ${msg}`);
    });
  } catch (e) {
    console.error('❌ Scraper failed:', e.message || e);
    process.exit(1);
  }

  let saved = 0;
  if (scrapedDecks.length > 0) {
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

  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 SCRAPING SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log(`✅ Decks scraped: ${scrapedDecks.length}`);
  console.log(`💾 Decks saved to Supabase: ${saved}`);
  console.log(`📈 Total decks in database: ${count ?? 'unknown'}`);
  console.log(
    `⏱️  Execution time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`
  );
  console.log('═══════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});

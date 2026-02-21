/**
 * multi-source-collector.js
 * Orquestrador principal - coleta de todas as fontes
 * 
 * Coordena: DreamBorn API + inkDecks + Melee.gg
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Import all scrapers/clients
const dreambornApi = require('./dreamborn-api');
const inkdecksScraper = require('./inkdecks-scraper-v2');
const meleeScraper = require('./melee-scraper');
const sourceAggregator = require('./source-aggregator');

const CONFIG = {
  outputDir: './backend/data',
  cardDbPath: './backend/db/cards.json',
  
  // Collection limits
  inkdecksMax: 100,
  meleeMaxTournaments: 10,
  
  // Aggregation
  aggregatedPath: './backend/data/aggregated.json',
};

// ── Utilities ────────────────────────────────────────────────────────────────

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dirPath}`);
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Step 1: Card Database ────────────────────────────────────────────────────

/**
 * Build or update card database from DreamBorn
 */
async function updateCardDatabase() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📚 STEP 1: Updating Card Database');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  try {
    // Check if database exists and is recent
    if (fs.existsSync(CONFIG.cardDbPath)) {
      const stats = fs.statSync(CONFIG.cardDbPath);
      const age = Date.now() - stats.mtimeMs;
      const ageHours = age / (1000 * 60 * 60);
      
      console.log(`📊 Existing database found (${ageHours.toFixed(1)} hours old)`);
      
      if (ageHours < 24) {
        console.log('   ℹ️  Database is recent, skipping update');
        console.log('   💡 Use --force to update anyway');
        return true;
      }
    }
    
    // Build new database
    console.log('🔨 Building card database from DreamBorn...');
    const db = await dreambornApi.buildCardDatabase();
    await dreambornApi.saveCardDatabase(db, CONFIG.cardDbPath);
    
    console.log('✅ Card database updated successfully');
    return true;
  } catch (err) {
    console.error('❌ Failed to update card database:', err.message);
    return false;
  }
}

// ── Step 2: Collect Tournament Data ─────────────────────────────────────────

/**
 * Collect data from inkDecks
 */
async function collectInkdecks() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📦 STEP 2a: Collecting from inkDecks');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  try {
    const outputPath = path.join(CONFIG.outputDir, 'tournamentMeta.json');
    
    console.log(`🎯 Scraping up to ${CONFIG.inkdecksMax} decks...`);
    
    // Check if inkdecks-scraper-v2 is available
    if (typeof inkdecksScraper.scrapeInkdecks !== 'function') {
      console.error('   ❌ inkdecks-scraper-v2 not available');
      console.log('   💡 Make sure inkdecks-scraper-v2.js is in the same directory');
      return false;
    }
    
    await inkdecksScraper.scrapeInkdecks({
      maxDecks: CONFIG.inkdecksMax,
      outputPath,
    });
    
    console.log('✅ inkDecks collection complete');
    return true;
  } catch (err) {
    console.error('❌ Failed to collect from inkDecks:', err.message);
    return false;
  }
}

/**
 * Collect data from Melee.gg
 */
async function collectMelee() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📦 STEP 2b: Collecting from Melee.gg');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  try {
    const outputPath = path.join(CONFIG.outputDir, 'melee.json');
    
    console.log(`🎯 Scraping up to ${CONFIG.meleeMaxTournaments} tournaments...`);
    
    const data = await meleeScraper.scrapeAll({
      maxTournaments: CONFIG.meleeMaxTournaments,
      maxPages: 3,
    });
    
    await meleeScraper.saveScrapedData(data, outputPath);
    
    console.log('✅ Melee.gg collection complete');
    return true;
  } catch (err) {
    console.error('❌ Failed to collect from Melee.gg:', err.message);
    console.log('   ℹ️  This is expected if Melee.gg is blocking requests');
    console.log('   💡 Try again later or adjust User-Agent rotation');
    return false;
  }
}

// ── Step 3: Aggregate & Deduplicate ──────────────────────────────────────────

/**
 * Aggregate all sources and deduplicate
 */
async function aggregateAndDeduplicate() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔄 STEP 3: Aggregating & Deduplicating');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  try {
    const sources = sourceAggregator.loadSources({
      inkdecks: path.join(CONFIG.outputDir, 'tournamentMeta.json'),
      melee: path.join(CONFIG.outputDir, 'melee.json'),
    });
    
    const aggregated = sourceAggregator.aggregateSources(sources);
    
    sourceAggregator.saveAggregated(aggregated, CONFIG.aggregatedPath);
    
    console.log('✅ Aggregation complete');
    console.log('');
    console.log('📊 Final Stats:');
    console.log(JSON.stringify(aggregated.stats, null, 2));
    
    return true;
  } catch (err) {
    console.error('❌ Failed to aggregate:', err.message);
    return false;
  }
}

// ── Main Orchestrator ────────────────────────────────────────────────────────

/**
 * Run full collection pipeline
 */
async function runFullCollection(options = {}) {
  const {
    skipCardDb = false,
    skipInkdecks = false,
    skipMelee = false,
    forceCardDb = false,
  } = options;
  
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   LORCANA AI - Multi-Source Collection Pipeline         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Ensure output directory exists
  ensureDir(CONFIG.outputDir);
  ensureDir(path.dirname(CONFIG.cardDbPath));
  
  const results = {
    cardDb: false,
    inkdecks: false,
    melee: false,
    aggregation: false,
  };
  
  // Step 1: Card Database
  if (!skipCardDb) {
    results.cardDb = await updateCardDatabase();
  } else {
    console.log('⏭️  Skipping card database update');
  }
  
  // Step 2a: inkDecks
  if (!skipInkdecks) {
    results.inkdecks = await collectInkdecks();
    await delay(2000); // Be nice to servers
  } else {
    console.log('⏭️  Skipping inkDecks collection');
  }
  
  // Step 2b: Melee.gg
  if (!skipMelee) {
    results.melee = await collectMelee();
    await delay(2000);
  } else {
    console.log('⏭️  Skipping Melee.gg collection');
  }
  
  // Step 3: Aggregate
  results.aggregation = await aggregateAndDeduplicate();
  
  // Summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 Pipeline Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('Card Database:', results.cardDb ? '✅' : '❌');
  console.log('inkDecks:     ', results.inkdecks ? '✅' : '❌');
  console.log('Melee.gg:     ', results.melee ? '✅' : '❌');
  console.log('Aggregation:  ', results.aggregation ? '✅' : '❌');
  console.log('');
  
  const success = Object.values(results).some(r => r);
  
  if (success) {
    console.log('✅ Pipeline completed with some successes');
    console.log('');
    console.log('📂 Output files:');
    console.log(`   - ${CONFIG.cardDbPath}`);
    console.log(`   - ${path.join(CONFIG.outputDir, 'tournamentMeta.json')}`);
    console.log(`   - ${path.join(CONFIG.outputDir, 'melee.json')}`);
    console.log(`   - ${CONFIG.aggregatedPath}`);
  } else {
    console.log('❌ Pipeline failed - no data collected');
  }
  
  console.log('');
  
  return results;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'collect';
  
  try {
    switch (command) {
      case 'collect': {
        // Parse flags
        const options = {
          skipCardDb: args.includes('--skip-cards'),
          skipInkdecks: args.includes('--skip-inkdecks'),
          skipMelee: args.includes('--skip-melee'),
          forceCardDb: args.includes('--force-cards'),
        };
        
        await runFullCollection(options);
        break;
      }
      
      case 'cards': {
        await updateCardDatabase();
        break;
      }
      
      case 'inkdecks': {
        await collectInkdecks();
        break;
      }
      
      case 'melee': {
        await collectMelee();
        break;
      }
      
      case 'aggregate': {
        await aggregateAndDeduplicate();
        break;
      }
      
      case 'help': {
        console.log('');
        console.log('Usage: node multi-source-collector.js [command] [options]');
        console.log('');
        console.log('Commands:');
        console.log('  collect     Run full collection pipeline (default)');
        console.log('  cards       Update card database only');
        console.log('  inkdecks    Collect from inkDecks only');
        console.log('  melee       Collect from Melee.gg only');
        console.log('  aggregate   Aggregate existing data only');
        console.log('  help        Show this help');
        console.log('');
        console.log('Options:');
        console.log('  --skip-cards     Skip card database update');
        console.log('  --skip-inkdecks  Skip inkDecks collection');
        console.log('  --skip-melee     Skip Melee.gg collection');
        console.log('  --force-cards    Force card database update');
        console.log('');
        console.log('Examples:');
        console.log('  node multi-source-collector.js collect');
        console.log('  node multi-source-collector.js collect --skip-melee');
        console.log('  node multi-source-collector.js inkdecks');
        console.log('');
        break;
      }
      
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Use "help" for usage information');
        process.exit(1);
    }
  } catch (err) {
    console.error('');
    console.error('❌ Fatal error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runFullCollection,
  updateCardDatabase,
  collectInkdecks,
  collectMelee,
  aggregateAndDeduplicate,
  CONFIG,
};

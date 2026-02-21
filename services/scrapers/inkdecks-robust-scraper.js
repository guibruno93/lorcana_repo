/**
 * inkdecks-robust-scraper.js
 * Versão robusta com múltiplos padrões e debug
 */

'use strict';

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: 'https://inkdecks.com',
  tournamentsUrl: 'https://inkdecks.com/lorcana-tournaments/core',
  requestDelay: 2000,
  timeout: 30000,
  maxRetries: 3,
  outputDir: './backend/data',
  debug: false, // Set to true to save HTML
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

let lastRequestTime = 0;
let requestCount = 0;

// ── HTTP Client ──────────────────────────────────────────────────────────────

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function respectRateLimit() {
  const now = Date.now();
  const timeSinceLastReq = now - lastRequestTime;
  
  if (timeSinceLastReq < CONFIG.requestDelay) {
    const waitTime = CONFIG.requestDelay - timeSinceLastReq;
    await delay(waitTime);
  }
  
  lastRequestTime = Date.now();
  requestCount++;
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const userAgent = getRandomUserAgent();
    
    const options = {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
      }
    };
    
    const req = https.get(url, options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ html: data, statusCode: res.statusCode });
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(CONFIG.timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function fetchWithRetry(url, retries = CONFIG.maxRetries) {
  for (let i = 0; i < retries; i++) {
    try {
      await respectRateLimit();
      console.log(`🌐 Fetching: ${url} (attempt ${i + 1}/${retries})`);
      return await httpsGet(url);
    } catch (err) {
      console.error(`   ❌ Attempt ${i + 1} failed:`, err.message);
      if (i < retries - 1) {
        const backoff = CONFIG.requestDelay * Math.pow(2, i);
        console.log(`   ⏳ Backoff: ${backoff}ms...`);
        await delay(backoff);
      } else {
        throw err;
      }
    }
  }
}

// ── HTML Parsing ─────────────────────────────────────────────────────────────

/**
 * Extract tournament links - SUPORTA URLs ABSOLUTAS E RELATIVAS
 * Padrão encontrado: href="https://inkdecks.com/lorcana-tournaments/[name]-tournament-decks-[id]"
 */
function extractTournamentLinks(html) {
  const tournaments = [];
  const seen = new Set();
  
  // Pattern que aceita AMBOS:
  // href="https://inkdecks.com/lorcana-tournaments/..." (absoluta)
  // href="/lorcana-tournaments/..." (relativa)
  const mainPattern = /href="(?:https?:\/\/inkdecks\.com)?(\/lorcana-tournaments\/[^"?]*tournament-decks-\d+)"/gi;
  
  let match;
  while ((match = mainPattern.exec(html)) !== null) {
    const path = match[1]; // Sempre pega a parte /lorcana-tournaments/...
    
    // Skip if already seen
    if (seen.has(path)) continue;
    seen.add(path);
    
    const url = CONFIG.baseUrl + path;
    
    // Extract name and ID
    // Pattern: /lorcana-tournaments/[name]-tournament-decks-[id]
    const nameMatch = path.match(/\/lorcana-tournaments\/(.+?)-tournament-decks-(\d+)$/);
    let name = 'Unknown';
    let id = null;
    
    if (nameMatch) {
      name = (nameMatch[1] || '').replace(/-/g, ' ');
      id = nameMatch[2] || null;
    }
    
    tournaments.push({ url, path, name, id });
  }
  
  console.log(`   🔍 Pattern: tournament-decks-[id] (absolute + relative URLs)`);
  console.log(`   🔍 Unique URLs found: ${tournaments.length}`);
  
  return tournaments;
}

/**
 * Extract deck links from tournament page
 */
function extractDeckLinks(html, tournamentUrl) {
  const decks = [];
  const seen = new Set();
  
  // Pattern 1: /lorcana-metagame/[deck-slug]
  const pattern1 = /href="(\/lorcana-metagame\/[^"]+)"/gi;
  
  // Pattern 2: /lorcana-tournament-result/[id]
  const pattern2 = /href="(\/lorcana-tournament-result\/\d+)"/gi;
  
  const patterns = [pattern1, pattern2];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const path = match[1];
      
      if (seen.has(path)) continue;
      seen.add(path);
      
      const url = CONFIG.baseUrl + path;
      decks.push({ url, path, tournament: tournamentUrl });
    }
  }
  
  return decks;
}

/**
 * Parse deck from HTML (mesmo código que funcionou no teste)
 */
function parseDeck(html) {
  const deck = {
    cards: [],
    name: null,
    author: null,
    placement: null,
    tournament: null,
    inks: [],
  };
  
  // Extract deck name
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (titleMatch) {
    deck.name = titleMatch[1].trim();
  }
  
  // Parse cards
  const cardRegex = /<tr[^>]*class="card-list-item"[^>]*data-card-type="([^"]+)"[^>]*data-quantity="(\d+)"[^>]*>([\s\S]*?)<\/tr>/gi;
  let cardMatch;
  
  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const cardType = cardMatch[1];
    const quantity = parseInt(cardMatch[2]);
    const rowHtml = cardMatch[3];
    
    // Extract cost
    let cost = null;
    const costMatch = rowHtml.match(/position:absolute[^>]*>(\d+)<\/div>/);
    if (costMatch) {
      cost = parseInt(costMatch[1]);
    }
    
    // Extract name
    let cardName = null;
    let nameMatch = rowHtml.match(/<a[^>]*href="\/cards\/details-[^"]*"[^>]*>[\s\S]*?<b>\s*([^<-]+)\s*-\s*<\/b>\s*([^<]+)/i);
    if (nameMatch) {
      const baseName = nameMatch[1].trim();
      const subtitle = nameMatch[2].trim();
      cardName = `${baseName} - ${subtitle}`;
    } else {
      nameMatch = rowHtml.match(/<a[^>]*href="\/cards\/details-[^"]*"[^>]*>[\s\S]*?<b>\s*([^<]+)\s*<\/b>/i);
      if (nameMatch) {
        cardName = nameMatch[1].trim();
      }
    }
    
    // Extract ink (versão corrigida)
    let ink = null;
    const allInkMatches = rowHtml.match(/\/symbols\/lorcana\/([^.\/]+)\.svg/g);
    if (allInkMatches) {
      for (const match of allInkMatches) {
        const inkNameMatch = match.match(/\/symbols\/lorcana\/([^.\/]+)\.svg/);
        if (inkNameMatch) {
          const inkRaw = inkNameMatch[1].toLowerCase();
          if (inkRaw !== 'inkpot' && inkRaw !== 'ink-cost') {
            ink = inkRaw.charAt(0).toUpperCase() + inkRaw.slice(1);
            break;
          }
        }
      }
    }
    
    const inkable = rowHtml.includes('inkpot.svg');
    
    if (cardName) {
      deck.cards.push({
        name: cardName,
        quantity,
        cost,
        type: cardType,
        ink,
        inkable,
      });
      
      if (ink && !deck.inks.includes(ink)) {
        deck.inks.push(ink);
      }
    }
  }
  
  return deck;
}

function generateFingerprint(cards) {
  const normalized = cards
    .map(c => ({ name: c.name.toLowerCase().trim(), quantity: c.quantity }))
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const deckString = normalized.map(c => `${c.quantity}x${c.name}`).join('|');
  
  return crypto
    .createHash('sha256')
    .update(deckString)
    .digest('hex');
}

// ── Scraper Functions ────────────────────────────────────────────────────────

async function scrapeTournaments(options = {}) {
  const { maxPages = 1, saveHtml = false } = options;
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 STEP 1: Scraping Tournaments List');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  const allTournaments = [];
  
  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = page === 1 
        ? CONFIG.tournamentsUrl 
        : `${CONFIG.tournamentsUrl}?page=${page}`;
      
      const { html } = await fetchWithRetry(url);
      
      // Debug: Save HTML to file
      if (saveHtml) {
        const debugPath = path.join(CONFIG.outputDir, `tournaments-page${page}.html`);
        fs.writeFileSync(debugPath, html, 'utf8');
        console.log(`   💾 Saved HTML to: ${debugPath}`);
      }
      
      const tournaments = extractTournamentLinks(html);
      
      console.log(`   ✅ Page ${page}: Found ${tournaments.length} tournaments`);
      
      // Show first 5 as sample
      if (tournaments.length > 0) {
        console.log('   📋 Sample tournaments:');
        for (let i = 0; i < Math.min(5, tournaments.length); i++) {
          console.log(`      ${i + 1}. ${tournaments[i].name} (${tournaments[i].id})`);
        }
      }
      
      allTournaments.push(...tournaments);
      
      if (tournaments.length === 0) {
        console.log('   ℹ️  No tournaments found on this page');
        break;
      }
    } catch (err) {
      console.error(`   ❌ Failed to scrape page ${page}:`, err.message);
    }
  }
  
  console.log(`\n✅ Total unique tournaments: ${allTournaments.length}\n`);
  return allTournaments;
}

async function scrapeTournamentDecks(tournament) {
  console.log(`\n📦 Scraping: ${tournament.name}`);
  console.log(`   URL: ${tournament.url}`);
  
  try {
    const { html } = await fetchWithRetry(tournament.url);
    const deckLinks = extractDeckLinks(html, tournament.url);
    
    console.log(`   ✅ Found ${deckLinks.length} decks`);
    
    const decks = [];
    
    for (let i = 0; i < deckLinks.length; i++) {
      const deckLink = deckLinks[i];
      console.log(`   📋 [${i + 1}/${deckLinks.length}] Parsing deck...`);
      
      try {
        const { html: deckHtml } = await fetchWithRetry(deckLink.url);
        const deck = parseDeck(deckHtml);
        
        deck.url = deckLink.url;
        deck.tournament = tournament.name;
        deck.tournamentUrl = tournament.url;
        deck.tournamentId = tournament.id;
        deck.fingerprint = generateFingerprint(deck.cards);
        deck.scrapedAt = new Date().toISOString();
        
        decks.push(deck);
        console.log(`      ✅ ${deck.cards.length} cards, inks: ${deck.inks.join(', ')}`);
      } catch (err) {
        console.error(`      ❌ Failed: ${err.message}`);
      }
    }
    
    return decks;
  } catch (err) {
    console.error(`   ❌ Failed to scrape tournament: ${err.message}`);
    return [];
  }
}

async function scrapeAll(options = {}) {
  const {
    maxTournaments = 10,
    maxPages = 3,
    saveHtml = false,
    outputPath = path.join(CONFIG.outputDir, 'inkdecks-scraped.json'),
  } = options;
  
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   inkDecks.com Robust Scraper                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Max tournaments: ${maxTournaments}`);
  console.log(`Max pages: ${maxPages}`);
  console.log(`Save HTML: ${saveHtml ? 'YES' : 'NO'}`);
  console.log('');
  
  // Step 1: Get tournaments
  const tournaments = await scrapeTournaments({ maxPages, saveHtml });
  
  if (tournaments.length === 0) {
    console.error('\n❌ No tournaments found!');
    console.error('💡 Try running with --save-html to debug');
    console.error('   node inkdecks-robust-scraper.js scrape 5 1 --save-html');
    process.exit(1);
  }
  
  // Step 2: Limit tournaments
  const limitedTournaments = tournaments.slice(0, maxTournaments);
  console.log(`Processing ${limitedTournaments.length} tournaments...\n`);
  
  // Step 3: Scrape each tournament
  const allDecks = [];
  
  for (let i = 0; i < limitedTournaments.length; i++) {
    const tournament = limitedTournaments[i];
    console.log(`\n[${i + 1}/${limitedTournaments.length}] ${tournament.name}`);
    
    const decks = await scrapeTournamentDecks(tournament);
    allDecks.push(...decks);
  }
  
  // Step 4: Deduplicate
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔄 Deduplicating...');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  const fingerprintMap = new Map();
  const unique = [];
  let duplicates = 0;
  
  for (const deck of allDecks) {
    if (!deck.fingerprint) continue;
    
    if (fingerprintMap.has(deck.fingerprint)) {
      duplicates++;
    } else {
      fingerprintMap.set(deck.fingerprint, deck);
      unique.push(deck);
    }
  }
  
  console.log(`   Total scraped: ${allDecks.length}`);
  console.log(`   Unique: ${unique.length}`);
  console.log(`   Duplicates: ${duplicates}`);
  
  // Step 5: Save
  const result = {
    decks: unique,
    stats: {
      totalScraped: allDecks.length,
      unique: unique.length,
      duplicates,
      tournaments: limitedTournaments.length,
      source: 'inkdecks',
      scrapedAt: new Date().toISOString(),
    },
  };
  
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Scraping Complete!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`💾 Saved to: ${outputPath}`);
  console.log(`📊 Total decks: ${unique.length}`);
  console.log(`🎯 Tournaments: ${limitedTournaments.length}`);
  console.log(`⏱️  Total requests: ${requestCount}`);
  console.log('');
  
  return result;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'scrape';
  
  try {
    switch (command) {
      case 'scrape': {
        const maxTournaments = parseInt(args[1]) || 10;
        const maxPages = parseInt(args[2]) || 3;
        const saveHtml = args.includes('--save-html');
        const output = args[3] && !args[3].startsWith('--') 
          ? args[3] 
          : path.join(CONFIG.outputDir, 'inkdecks-scraped.json');
        
        await scrapeAll({ maxTournaments, maxPages, saveHtml, outputPath: output });
        break;
      }
      
      case 'tournaments': {
        const maxPages = parseInt(args[1]) || 3;
        const saveHtml = args.includes('--save-html');
        const tournaments = await scrapeTournaments({ maxPages, saveHtml });
        console.log(JSON.stringify(tournaments, null, 2));
        break;
      }
      
      case 'test': {
        const url = args[1] || 'https://inkdecks.com/lorcana-metagame/emerald-sapphire-sapphire-control-100';
        console.log(`Testing deck parse: ${url}`);
        const { html } = await fetchWithRetry(url);
        const deck = parseDeck(html);
        console.log(JSON.stringify(deck, null, 2));
        break;
      }
      
      case 'help': {
        console.log('');
        console.log('Usage: node inkdecks-robust-scraper.js [command] [options]');
        console.log('');
        console.log('Commands:');
        console.log('  scrape [max] [pages] [--save-html]  Run full scrape');
        console.log('  tournaments [pages] [--save-html]   List tournaments only');
        console.log('  test [deckUrl]                       Test deck parsing');
        console.log('  help                                 Show this help');
        console.log('');
        console.log('Options:');
        console.log('  --save-html    Save HTML to files for debugging');
        console.log('');
        console.log('Examples:');
        console.log('  node inkdecks-robust-scraper.js scrape 5 1 --save-html');
        console.log('  node inkdecks-robust-scraper.js tournaments 1 --save-html');
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

if (require.main === module) {
  main();
}

module.exports = {
  scrapeTournaments,
  scrapeTournamentDecks,
  scrapeAll,
  parseDeck,
  CONFIG,
};

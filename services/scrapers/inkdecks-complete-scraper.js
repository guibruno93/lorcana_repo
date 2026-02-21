/**
 * inkdecks-complete-scraper.js
 * Scraper robusto para inkDecks.com
 * 
 * Acessa:
 * 1. https://inkdecks.com/lorcana-tournaments/core
 * 2. Pega links de torneios
 * 3. Para cada torneio, pega decks
 * 4. Parse completo de cada deck
 */

'use strict';

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: 'https://inkdecks.com',
  tournamentsUrl: 'https://inkdecks.com/lorcana-tournaments/core',
  requestDelay: 2000, // 2s between requests
  timeout: 30000,
  maxRetries: 3,
  outputDir: './backend/data',
};

// User-Agent rotation (bypass preventivo)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
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
 * Extract tournament links from tournaments page
 */
function extractTournamentLinks(html) {
  const tournaments = [];
  
  // Look for tournament links
  // Pattern: href="/lorcana-tournaments/[tournament-slug]-tournament-decks-[id]"
  const regex = /href="(\/lorcana-tournaments\/[^"]+tournament-decks-\d+)"/g;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    const path = match[1];
    const url = CONFIG.baseUrl + path;
    
    // Extract tournament name from path
    const nameMatch = path.match(/\/lorcana-tournaments\/(.+)-tournament-decks-(\d+)/);
    const name = nameMatch ? nameMatch[1].replace(/-/g, ' ') : 'Unknown';
    const id = nameMatch ? nameMatch[2] : null;
    
    tournaments.push({ url, path, name, id });
  }
  
  // Deduplicate
  const seen = new Set();
  return tournaments.filter(t => {
    if (seen.has(t.url)) return false;
    seen.add(t.url);
    return true;
  });
}

/**
 * Extract deck links from tournament page
 */
function extractDeckLinks(html, tournamentUrl) {
  const decks = [];
  
  // Pattern: href="/lorcana-metagame/[deck-slug]"
  const regex = /href="(\/lorcana-metagame\/[^"]+)"/g;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    const path = match[1];
    const url = CONFIG.baseUrl + path;
    
    decks.push({ url, path, tournament: tournamentUrl });
  }
  
  // Deduplicate
  const seen = new Set();
  return decks.filter(d => {
    if (seen.has(d.url)) return false;
    seen.add(d.url);
    return true;
  });
}

/**
 * Parse deck from HTML
 * Baseado na estrutura real: <tr class="card-list-item" data-card-type="..." data-quantity="...">
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
  
  // Extract deck name (usually in <h1> or title)
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (titleMatch) {
    deck.name = titleMatch[1].trim();
  }
  
  // Extract author/player
  const authorMatch = html.match(/(?:by|author|player)[^>]*>([^<]+)</i);
  if (authorMatch) {
    deck.author = authorMatch[1].trim();
  }
  
  // Extract placement
  const placementMatch = html.match(/(?:placement|place|position)[^>]*>(\d+)[^<]*</i);
  if (placementMatch) {
    deck.placement = parseInt(placementMatch[1]);
  }
  
  // Parse cards from table
  // Pattern: <tr class="card-list-item" data-card-type="character" data-quantity="4">
  const cardRegex = /<tr[^>]*class="card-list-item"[^>]*data-card-type="([^"]+)"[^>]*data-quantity="(\d+)"[^>]*>([\s\S]*?)<\/tr>/gi;
  let cardMatch;
  
  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const cardType = cardMatch[1]; // character, action, song, item, location
    const quantity = parseInt(cardMatch[2]);
    const rowHtml = cardMatch[3];
    
    // Extract card cost (number inside position:absolute div)
    let cost = null;
    const costMatch = rowHtml.match(/position:absolute[^>]*>(\d+)<\/div>/);
    if (costMatch) {
      cost = parseInt(costMatch[1]);
    }
    
    // Extract card name
    // Pattern: <a href="/cards/details-..."><b>Name -</b> Subtitle</a>
    // OR: <a href="/cards/details-..."><b>Name</b></a> (no subtitle)
    let cardName = null;
    
    // Try with subtitle first
    let nameMatch = rowHtml.match(/<a[^>]*href="\/cards\/details-[^"]*"[^>]*>[\s\S]*?<b>\s*([^<-]+)\s*-\s*<\/b>\s*([^<]+)</i);
    if (nameMatch) {
      const baseName = nameMatch[1].trim();
      const subtitle = nameMatch[2].trim();
      cardName = `${baseName} - ${subtitle}`;
    } else {
      // Try without subtitle
      nameMatch = rowHtml.match(/<a[^>]*href="\/cards\/details-[^"]*"[^>]*>[\s\S]*?<b>\s*([^<]+)\s*<\/b>/i);
      if (nameMatch) {
        cardName = nameMatch[1].trim();
      }
    }
    
    // Extract ink color from SVG path
    let ink = null;
    // Look for all SVGs, excluding inkpot and ink-cost
    const allInkMatches = rowHtml.match(/\/symbols\/lorcana\/([^.\/]+)\.svg/g);
    if (allInkMatches) {
      for (const match of allInkMatches) {
        const inkNameMatch = match.match(/\/symbols\/lorcana\/([^.\/]+)\.svg/);
        if (inkNameMatch) {
          const inkRaw = inkNameMatch[1].toLowerCase();
          // Skip inkpot and ink-cost, these are not colors
          if (inkRaw !== 'inkpot' && inkRaw !== 'ink-cost') {
            ink = inkRaw.charAt(0).toUpperCase() + inkRaw.slice(1);
            break; // Found the color, stop
          }
        }
      }
    }
    
    // Extract inkable status (inkpot.svg = inkable, ink-cost.svg = not inkable)
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
      
      // Track inks
      if (ink && !deck.inks.includes(ink)) {
        deck.inks.push(ink);
      }
    }
  }
  
  return deck;
}

/**
 * Generate deck fingerprint (SHA256)
 */
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

/**
 * Scrape tournaments list
 */
async function scrapeTournaments(options = {}) {
  const { maxPages = 1 } = options;
  
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
      const tournaments = extractTournamentLinks(html);
      
      console.log(`   ✅ Page ${page}: Found ${tournaments.length} tournaments`);
      allTournaments.push(...tournaments);
      
      if (tournaments.length === 0) {
        console.log('   ℹ️  No more tournaments found');
        break;
      }
    } catch (err) {
      console.error(`   ❌ Failed to scrape page ${page}:`, err.message);
    }
  }
  
  console.log(`\n✅ Total tournaments found: ${allTournaments.length}\n`);
  return allTournaments;
}

/**
 * Scrape decks from a tournament
 */
async function scrapeTournamentDecks(tournament) {
  console.log(`\n📦 Scraping tournament: ${tournament.name}`);
  console.log(`   URL: ${tournament.url}`);
  
  try {
    const { html } = await fetchWithRetry(tournament.url);
    const deckLinks = extractDeckLinks(html, tournament.url);
    
    console.log(`   ✅ Found ${deckLinks.length} decks`);
    
    const decks = [];
    
    for (let i = 0; i < deckLinks.length; i++) {
      const deckLink = deckLinks[i];
      console.log(`   📋 [${i + 1}/${deckLinks.length}] ${deckLink.url}`);
      
      try {
        const { html: deckHtml } = await fetchWithRetry(deckLink.url);
        const deck = parseDeck(deckHtml);
        
        // Add metadata
        deck.url = deckLink.url;
        deck.tournament = tournament.name;
        deck.tournamentUrl = tournament.url;
        deck.tournamentId = tournament.id;
        deck.fingerprint = generateFingerprint(deck.cards);
        deck.scrapedAt = new Date().toISOString();
        
        decks.push(deck);
        console.log(`      ✅ ${deck.cards.length} cards`);
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

/**
 * Full scrape pipeline
 */
async function scrapeAll(options = {}) {
  const {
    maxTournaments = 10,
    maxPages = 3,
    outputPath = path.join(CONFIG.outputDir, 'inkdecks-scraped.json'),
  } = options;
  
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   inkDecks.com Complete Scraper                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Max tournaments: ${maxTournaments}`);
  console.log(`Max pages: ${maxPages}`);
  console.log('');
  
  // Step 1: Get tournaments
  const tournaments = await scrapeTournaments({ maxPages });
  
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
  
  // Ensure output directory exists
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
        const output = args[3] || path.join(CONFIG.outputDir, 'inkdecks-scraped.json');
        
        await scrapeAll({ maxTournaments, maxPages, outputPath: output });
        break;
      }
      
      case 'tournaments': {
        const maxPages = parseInt(args[1]) || 3;
        const tournaments = await scrapeTournaments({ maxPages });
        console.log(JSON.stringify(tournaments, null, 2));
        break;
      }
      
      case 'test': {
        // Test single deck
        const url = args[1] || 'https://inkdecks.com/lorcana-metagame/emerald-sapphire-sapphire-control-100';
        console.log(`Testing deck parse: ${url}`);
        const { html } = await fetchWithRetry(url);
        const deck = parseDeck(html);
        console.log(JSON.stringify(deck, null, 2));
        break;
      }
      
      case 'help': {
        console.log('');
        console.log('Usage: node inkdecks-complete-scraper.js [command] [options]');
        console.log('');
        console.log('Commands:');
        console.log('  scrape [maxTournaments] [maxPages] [output]  Run full scrape');
        console.log('  tournaments [maxPages]                        List tournaments only');
        console.log('  test [deckUrl]                                Test deck parsing');
        console.log('  help                                          Show this help');
        console.log('');
        console.log('Examples:');
        console.log('  node inkdecks-complete-scraper.js scrape 5 2');
        console.log('  node inkdecks-complete-scraper.js tournaments 1');
        console.log('  node inkdecks-complete-scraper.js test https://inkdecks.com/lorcana-metagame/...');
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
  scrapeTournaments,
  scrapeTournamentDecks,
  scrapeAll,
  parseDeck,
  CONFIG,
};

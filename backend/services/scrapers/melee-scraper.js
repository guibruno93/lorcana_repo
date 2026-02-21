/**
 * melee-scraper.js
 * Scraper para Melee.gg com User-Agent rotation
 * 
 * Melee.gg bloqueia scrapers padrão, então usamos User-Agent rotation
 */

'use strict';

const https = require('https');
const crypto = require('crypto');

const CONFIG = {
  baseUrl: 'https://melee.gg',
  requestDelay: 3000, // 3s between requests
  timeout: 30000,
  maxRetries: 3,
};

// User-Agent rotation pool
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.2; rv:121.0) Gecko/20100101 Firefox/121.0',
];

let lastRequestTime = 0;
let requestCount = 0;

// ── HTTP Client with UA Rotation ─────────────────────────────────────────────

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
    console.log(`   ⏳ Rate limiting: waiting ${waitTime}ms...`);
    await delay(waitTime);
  }
  
  lastRequestTime = Date.now();
  requestCount++;
}

function httpsGetWithUA(url) {
  return new Promise((resolve, reject) => {
    const userAgent = getRandomUserAgent();
    
    const options = {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
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
      return await httpsGetWithUA(url);
    } catch (err) {
      console.error(`   ❌ Attempt ${i + 1} failed:`, err.message);
      if (i < retries - 1) {
        const backoff = CONFIG.requestDelay * Math.pow(2, i);
        console.log(`   ⏳ Exponential backoff: ${backoff}ms...`);
        await delay(backoff);
      } else {
        throw err;
      }
    }
  }
}

// ── HTML Parsing ─────────────────────────────────────────────────────────────

function extractTournaments(html) {
  // Simple regex-based extraction
  // In production, use cheerio or jsdom for robust parsing
  
  const tournaments = [];
  
  // Example: Extract tournament links
  const linkRegex = /href="(\/Tournament\/View\/\d+)"/g;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const path = match[1];
    const url = CONFIG.baseUrl + path;
    tournaments.push({ url, path });
  }
  
  return tournaments;
}

function extractDecklists(html) {
  // Extract decklists from tournament page
  // This is highly dependent on Melee.gg's HTML structure
  
  const decklists = [];
  
  // Example parsing (needs to be adapted to actual HTML structure)
  // Look for decklist sections
  const decklistRegex = /<div class="decklist">[\s\S]*?<\/div>/g;
  const matches = html.match(decklistRegex) || [];
  
  for (const match of matches) {
    // Extract player name, placement, cards
    const playerMatch = match.match(/Player:\s*([^<]+)/);
    const placementMatch = match.match(/Placement:\s*(\d+)/);
    
    if (playerMatch && placementMatch) {
      decklists.push({
        player: playerMatch[1].trim(),
        placement: parseInt(placementMatch[1]),
        html: match,
      });
    }
  }
  
  return decklists;
}

// ── Scraper Functions ────────────────────────────────────────────────────────

/**
 * Scrape Lorcana tournaments from Melee.gg
 * @param {Object} options - Scraping options
 * @returns {Promise<Array>} Tournament list
 */
async function scrapeLorcanaTournaments(options = {}) {
  const { maxPages = 1 } = options;
  
  console.log('🎯 Melee.gg: Scraping Lorcana tournaments...');
  
  const tournaments = [];
  
  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = `${CONFIG.baseUrl}/Game/Lorcana/Tournaments?page=${page}`;
      const { html } = await fetchWithRetry(url);
      
      const pageTournaments = extractTournaments(html);
      tournaments.push(...pageTournaments);
      
      console.log(`   ✅ Page ${page}: Found ${pageTournaments.length} tournaments`);
      
      if (pageTournaments.length === 0) {
        console.log('   ℹ️  No more tournaments found');
        break;
      }
    } catch (err) {
      console.error(`   ❌ Failed to scrape page ${page}:`, err.message);
    }
  }
  
  console.log(`✅ Melee.gg: Found ${tournaments.length} tournaments total`);
  return tournaments;
}

/**
 * Scrape decklists from a tournament
 * @param {string} tournamentUrl - Tournament URL
 * @returns {Promise<Array>} Decklists
 */
async function scrapeTournamentDecklists(tournamentUrl) {
  console.log(`🎯 Melee.gg: Scraping decklists from ${tournamentUrl}...`);
  
  try {
    const { html } = await fetchWithRetry(tournamentUrl);
    const decklists = extractDecklists(html);
    
    console.log(`   ✅ Found ${decklists.length} decklists`);
    return decklists;
  } catch (err) {
    console.error(`   ❌ Failed to scrape tournament:`, err.message);
    return [];
  }
}

/**
 * Scrape and aggregate all Lorcana data from Melee.gg
 * @param {Object} options - Options
 * @returns {Promise<Object>} Aggregated data
 */
async function scrapeAll(options = {}) {
  const { maxTournaments = 10, maxPages = 3 } = options;
  
  console.log('🚀 Melee.gg: Starting full scrape...');
  console.log(`   Max tournaments: ${maxTournaments}`);
  console.log(`   Max pages: ${maxPages}`);
  
  // Step 1: Get tournament list
  const tournaments = await scrapeLorcanaTournaments({ maxPages });
  
  // Step 2: Scrape each tournament
  const allDecklists = [];
  const limitedTournaments = tournaments.slice(0, maxTournaments);
  
  for (let i = 0; i < limitedTournaments.length; i++) {
    const tournament = limitedTournaments[i];
    console.log(`📋 [${i + 1}/${limitedTournaments.length}] ${tournament.url}`);
    
    const decklists = await scrapeTournamentDecklists(tournament.url);
    
    for (const decklist of decklists) {
      allDecklists.push({
        ...decklist,
        tournament: tournament.path,
        source: 'melee',
        scrapedAt: new Date().toISOString(),
      });
    }
  }
  
  console.log(`✅ Melee.gg: Scraped ${allDecklists.length} decklists total`);
  
  return {
    tournaments: limitedTournaments,
    decklists: allDecklists,
    count: allDecklists.length,
    source: 'melee',
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Save scraped data to file
 * @param {Object} data - Scraped data
 * @param {string} filepath - Output path
 */
async function saveScrapedData(data, filepath) {
  const fs = require('fs');
  const path = require('path');
  
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`💾 Saved ${data.count} items to ${filepath}`);
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'scrape';
  
  try {
    switch (command) {
      case 'scrape': {
        const maxTournaments = parseInt(args[1]) || 10;
        const output = args[2] || './backend/data/melee.json';
        
        const data = await scrapeAll({ maxTournaments, maxPages: 3 });
        await saveScrapedData(data, output);
        console.log('✅ Done!');
        break;
      }
      
      case 'tournaments': {
        const maxPages = parseInt(args[1]) || 3;
        const tournaments = await scrapeLorcanaTournaments({ maxPages });
        console.log(JSON.stringify(tournaments, null, 2));
        break;
      }
      
      case 'tournament': {
        const url = args[1];
        if (!url) {
          console.error('Usage: node melee-scraper.js tournament <url>');
          process.exit(1);
        }
        const decklists = await scrapeTournamentDecklists(url);
        console.log(JSON.stringify(decklists, null, 2));
        break;
      }
      
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Available commands: scrape, tournaments, tournament');
        process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
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
  scrapeLorcanaTournaments,
  scrapeTournamentDecklists,
  scrapeAll,
  saveScrapedData,
};

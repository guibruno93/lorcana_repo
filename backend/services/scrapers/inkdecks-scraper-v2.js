'use strict';

/**
 * inkdecks-scraper-v2.js
 * Scraper robusto baseado na análise da estrutura HTML real do inkDecks
 * 
 * Features:
 * - Scraping de listagem de decks
 * - Scraping de decklist individual
 * - Retry com backoff exponencial
 * - Rate limiting
 * - Deduplicação
 * - Logs detalhados
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// ── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  baseUrl: 'https://inkdecks.com',
  listingUrl: '/lorcana-decks/core',
  
  // Rate limiting (respeitar o servidor)
  requestDelay: 2000, // 2 segundos entre requests
  maxRetries: 3,
  retryDelay: 5000,
  
  // Paths
  outputDir: path.join(__dirname, '../db'),
  outputFile: 'tournamentMeta.json',
  logFile: 'scraper.log',
  
  // Limites
  maxDecksPerRun: 100, // Limitar para não sobrecarregar
  
  // User-Agent (importante!)
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// ── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  
  // Append to log file
  fs.appendFile(
    path.join(CONFIG.outputDir, CONFIG.logFile),
    logMessage + '\n',
    'utf8'
  ).catch(() => {});
}

function generateFingerprint(deck) {
  // Gerar fingerprint único para deduplicação
  const cards = (deck.cards || [])
    .map(c => `${c.name}:${c.quantity}`)
    .sort()
    .join('|');
  
  return crypto.createHash('sha256').update(cards).digest('hex');
}

// ── HTTP Client ──────────────────────────────────────────────────────────────

async function fetchWithRetry(url, retries = CONFIG.maxRetries) {
  for (let i = 0; i < retries; i++) {
    try {
      log(`Fetching: ${url} (attempt ${i + 1}/${retries})`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': CONFIG.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0',
        },
        timeout: 30000,
        maxRedirects: 5,
      });
      
      if (response.status === 200) {
        log(`Success: ${url}`, 'SUCCESS');
        return response.data;
      }
      
      throw new Error(`HTTP ${response.status}`);
      
    } catch (error) {
      log(`Error fetching ${url}: ${error.message}`, 'ERROR');
      
      if (i < retries - 1) {
        const delay = CONFIG.retryDelay * Math.pow(2, i);
        log(`Retrying in ${delay}ms...`, 'WARN');
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
}

// ── Scraping Functions ───────────────────────────────────────────────────────

/**
 * Scrape deck listing page
 */
async function scrapeDeckListing(maxDecks = CONFIG.maxDecksPerRun) {
  const url = CONFIG.baseUrl + CONFIG.listingUrl;
  const html = await fetchWithRetry(url);
  const $ = cheerio.load(html);
  
  const decks = [];
  
  // Encontrar todas as linhas de deck (baseado na estrutura real)
  $('tr[id^="desktop-deck-"]').each((index, element) => {
    if (index >= maxDecks) return false; // Limitar quantidade
    
    const $row = $(element);
    const deckUrl = $row.attr('data-href');
    
    if (!deckUrl) return;
    
    // Extrair dados da linha
    const placement = $row.find('td').eq(0).find('strong').text().trim();
    const deckName = $row.find('td').eq(1).find('strong').text().trim();
    const author = $row.find('td').eq(1).find('.small.text-secondary').text().replace('by', '').trim();
    const strategy = $row.find('td').eq(3).find('.text-muted.small').text().trim();
    const eventName = $row.find('td').eq(4).find('.text-truncate').text().trim();
    const organizer = $row.find('td').eq(4).find('.text-theme-light').text().replace('@', '').trim();
    const playersText = $row.find('td').eq(4).find('.text-muted').text().trim();
    const players = parseInt(playersText.match(/(\d+)/)?.[1] || 0);
    const dateText = $row.find('td').eq(7).text().trim();
    
    // Extrair inks (cores)
    const inks = [];
    $row.find('td').eq(3).find('img[alt]').each((_, img) => {
      const ink = $(img).attr('alt');
      if (ink) inks.push(ink.charAt(0).toUpperCase() + ink.slice(1));
    });
    
    // Verificar se URL já é completa
    const fullUrl = deckUrl.startsWith('http') ? deckUrl : CONFIG.baseUrl + deckUrl;
    
    decks.push({
      url: fullUrl,
      deckId: deckUrl.match(/deck-(.+?)$/)?.[1] || '',
      name: deckName,
      author,
      placement,
      strategy,
      inks,
      event: {
        name: eventName,
        organizer,
        players,
        date: dateText,
      }
    });
  });
  
  log(`Found ${decks.length} decks in listing`, 'SUCCESS');
  return decks;
}

/**
 * Scrape individual deck page
 */
async function scrapeDeckDetails(deckMeta) {
  await sleep(CONFIG.requestDelay); // Rate limiting
  
  try {
    const html = await fetchWithRetry(deckMeta.url);
    const $ = cheerio.load(html);
    
    const cards = [];
    
    // Extrair cards da decklist (baseado na estrutura real)
    $('tr.card-list-item').each((_, element) => {
      const $row = $(element);
      
      const quantity = parseInt($row.attr('data-quantity') || '0');
      const cardType = $row.attr('data-card-type') || 'character';
      
      // Nome da carta está no link
      const $link = $row.find('a[href*="/cards/details-"]');
      let cardName = $link.text().trim();
      
      // Limpar o nome (remover espaços extras)
      cardName = cardName.replace(/\s+/g, ' ').trim();
      
      // Ink color
      const inkImg = $row.find('img[alt][src*=".svg"]').attr('alt');
      const ink = inkImg ? inkImg.charAt(0).toUpperCase() + inkImg.slice(1) : 'Unknown';
      
      // Ink cost
      const inkCostDiv = $row.find('div[style*="position:absolute"]').text().trim();
      const inkCost = parseInt(inkCostDiv) || 0;
      
      if (cardName && quantity > 0) {
        cards.push({
          name: cardName,
          quantity,
          type: cardType,
          ink,
          cost: inkCost,
        });
      }
    });
    
    // Detectar arquétipo se não foi fornecido
    let archetype = deckMeta.strategy || 'Unknown';
    if (deckMeta.inks.length >= 2) {
      archetype = deckMeta.inks.slice(0, 2).join('/');
    }
    
    const deck = {
      source: 'inkdecks',
      deckId: deckMeta.deckId,
      url: deckMeta.url,
      title: deckMeta.name,
      author: deckMeta.author,
      archetype,
      strategy: deckMeta.strategy,
      inks: deckMeta.inks,
      cards,
      standing: deckMeta.placement,
      event: deckMeta.event.name,
      organizer: deckMeta.event.organizer,
      players: deckMeta.event.players,
      date: deckMeta.event.date,
      fetchedAt: new Date().toISOString(),
    };
    
    // Gerar fingerprint para deduplicação
    deck.fingerprint = generateFingerprint(deck);
    
    log(`Scraped deck: ${deck.title} (${cards.length} cards)`, 'SUCCESS');
    return deck;
    
  } catch (error) {
    log(`Failed to scrape deck ${deckMeta.url}: ${error.message}`, 'ERROR');
    return null;
  }
}

/**
 * Load existing decks
 */
async function loadExistingDecks() {
  try {
    const filepath = path.join(CONFIG.outputDir, CONFIG.outputFile);
    const data = await fs.readFile(filepath, 'utf8');
    const json = JSON.parse(data);
    
    // Suportar ambos os formatos
    const decks = Array.isArray(json) ? json : (json.decks || []);
    
    log(`Loaded ${decks.length} existing decks`, 'INFO');
    return decks;
  } catch (error) {
    log('No existing decks found, starting fresh', 'WARN');
    return [];
  }
}

/**
 * Save decks to file
 */
async function saveDecks(decks) {
  try {
    await fs.mkdir(CONFIG.outputDir, { recursive: true });
    
    const filepath = path.join(CONFIG.outputDir, CONFIG.outputFile);
    
    // Salvar como array simples
    await fs.writeFile(
      filepath,
      JSON.stringify(decks, null, 2),
      'utf8'
    );
    
    log(`Saved ${decks.length} decks to ${filepath}`, 'SUCCESS');
    return true;
  } catch (error) {
    log(`Failed to save decks: ${error.message}`, 'ERROR');
    return false;
  }
}

/**
 * Deduplicate decks by fingerprint
 */
function deduplicateDecks(decks) {
  const seen = new Set();
  const unique = [];
  
  for (const deck of decks) {
    if (!deck.fingerprint) {
      deck.fingerprint = generateFingerprint(deck);
    }
    
    if (!seen.has(deck.fingerprint)) {
      seen.add(deck.fingerprint);
      unique.push(deck);
    }
  }
  
  log(`Deduplicated: ${decks.length} → ${unique.length} decks`, 'INFO');
  return unique;
}

// ── Main Function ────────────────────────────────────────────────────────────

async function main() {
  log('='.repeat(60));
  log('INKDECKS SCRAPER v2.0 - Starting');
  log('='.repeat(60));
  
  try {
    // 1. Load existing decks
    const existingDecks = await loadExistingDecks();
    const existingFingerprints = new Set(existingDecks.map(d => d.fingerprint));
    
    // 2. Scrape deck listing
    log('Scraping deck listing...');
    const deckMetaList = await scrapeDeckListing(CONFIG.maxDecksPerRun);
    
    if (deckMetaList.length === 0) {
      log('No decks found in listing', 'WARN');
      return;
    }
    
    // 3. Scrape individual decks
    log(`Scraping ${deckMetaList.length} deck details...`);
    const newDecks = [];
    
    for (const deckMeta of deckMetaList) {
      const deck = await scrapeDeckDetails(deckMeta);
      
      if (deck) {
        // Verificar se já existe
        if (!existingFingerprints.has(deck.fingerprint)) {
          newDecks.push(deck);
        } else {
          log(`Deck already exists (fingerprint): ${deck.title}`, 'INFO');
        }
      }
    }
    
    log(`Found ${newDecks.length} new decks`, 'SUCCESS');
    
    // 4. Merge e deduplicate
    const allDecks = [...existingDecks, ...newDecks];
    const uniqueDecks = deduplicateDecks(allDecks);
    
    // 5. Sort by date (mais recente primeiro)
    uniqueDecks.sort((a, b) => {
      const dateA = new Date(a.date || a.fetchedAt);
      const dateB = new Date(b.date || b.fetchedAt);
      return dateB - dateA;
    });
    
    // 6. Save
    await saveDecks(uniqueDecks);
    
    log('='.repeat(60));
    log('SCRAPING COMPLETE', 'SUCCESS');
    log(`Total decks: ${uniqueDecks.length}`);
    log(`New decks added: ${newDecks.length}`);
    log('='.repeat(60));
    
  } catch (error) {
    log(`Fatal error: ${error.message}`, 'ERROR');
    console.error(error.stack);
    process.exit(1);
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  // Parse CLI args
  const args = process.argv.slice(2);
  
  if (args.includes('--max')) {
    const maxIndex = args.indexOf('--max');
    CONFIG.maxDecksPerRun = parseInt(args[maxIndex + 1]) || CONFIG.maxDecksPerRun;
  }
  
  if (args.includes('--help')) {
    console.log(`
InkDecks Scraper v2.0

Usage:
  node inkdecks-scraper-v2.js [options]

Options:
  --max N       Scrape max N decks (default: ${CONFIG.maxDecksPerRun})
  --help        Show this help

Examples:
  node inkdecks-scraper-v2.js
  node inkdecks-scraper-v2.js --max 50
`);
    process.exit(0);
  }
  
  main();
}

module.exports = { main, scrapeDeckListing, scrapeDeckDetails };

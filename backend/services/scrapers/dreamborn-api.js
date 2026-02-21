/**
 * dreamborn-api.js
 * Cliente para DreamBorn API (Lorcana oficial)
 * 
 * API: https://api.lorcana-api.com
 * Docs: https://lorcana-api.com/docs
 */

'use strict';

const https = require('https');

const CONFIG = {
  baseUrl: 'https://api.lorcana-api.com',
  timeout: 30000,
  retries: 3,
  retryDelay: 2000,
};

// ── HTTP Client ──────────────────────────────────────────────────────────────

function httpsGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Invalid JSON: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
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

async function retryFetch(url, retries = CONFIG.retries) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🌐 Fetching: ${url} (attempt ${i + 1}/${retries})`);
      return await httpsGet(url);
    } catch (err) {
      console.error(`   ❌ Attempt ${i + 1} failed:`, err.message);
      if (i < retries - 1) {
        const delay = CONFIG.retryDelay * (i + 1);
        console.log(`   ⏳ Waiting ${delay}ms before retry...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

// ── DreamBorn API ────────────────────────────────────────────────────────────

/**
 * Get all cards
 * @returns {Promise<Array>} Array of card objects
 */
async function getAllCards() {
  const url = `${CONFIG.baseUrl}/bulk/cards`;
  console.log('📦 DreamBorn: Fetching all cards...');
  
  const data = await retryFetch(url);
  
  if (!Array.isArray(data)) {
    throw new Error('API did not return an array');
  }
  
  console.log(`✅ DreamBorn: Fetched ${data.length} cards`);
  return data;
}

/**
 * Get card by ID
 * @param {string} cardId - Card ID
 * @returns {Promise<Object>} Card object
 */
async function getCardById(cardId) {
  const url = `${CONFIG.baseUrl}/cards/${encodeURIComponent(cardId)}`;
  console.log(`🔍 DreamBorn: Fetching card ${cardId}...`);
  
  return await retryFetch(url);
}

/**
 * Search cards by name
 * @param {string} name - Card name
 * @returns {Promise<Array>} Array of matching cards
 */
async function searchCards(name) {
  const url = `${CONFIG.baseUrl}/cards/search?name=${encodeURIComponent(name)}`;
  console.log(`🔍 DreamBorn: Searching for "${name}"...`);
  
  return await retryFetch(url);
}

/**
 * Get all sets
 * @returns {Promise<Array>} Array of set objects
 */
async function getAllSets() {
  const url = `${CONFIG.baseUrl}/bulk/sets`;
  console.log('📦 DreamBorn: Fetching all sets...');
  
  return await retryFetch(url);
}

/**
 * Normalize DreamBorn card to our format
 * @param {Object} card - DreamBorn card
 * @returns {Object} Normalized card
 */
function normalizeDreambornCard(card) {
  return {
    // IDs
    id: card.Culture_Invariant_Id || card.Unique_ID || null,
    code: card.Card_Num || card.Culture_Invariant_Id || null,
    
    // Names
    name: card.Name || '',
    fullName: card.Full_Name || card.Name || '',
    simpleName: card.Simple_Name || card.Name || '',
    
    // Core attributes
    ink: card.Ink || card.Color || null,
    type: card.Type || null,
    cost: parseInt(card.Cost) || 0,
    inkable: card.Inkable === true || card.Inkable === 'true',
    
    // Character stats
    lore: parseInt(card.Lore) || 0,
    strength: card.Strength != null ? parseInt(card.Strength) : null,
    willpower: card.Willpower != null ? parseInt(card.Willpower) : null,
    
    // Set info
    setCode: card.Set_Num || card.Set_ID || null,
    setName: card.Set_Name || null,
    
    // Rarity
    rarity: card.Rarity || null,
    
    // Abilities
    abilities: card.Abilities || [],
    
    // Images
    image: card.Image || null,
    
    // Meta
    source: 'dreamborn',
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Build card database from DreamBorn
 * @returns {Promise<Object>} Card database
 */
async function buildCardDatabase() {
  console.log('🏗️  Building card database from DreamBorn...');
  
  const cards = await getAllCards();
  const normalized = cards.map(normalizeDreambornCard);
  
  // Build indexes
  const byId = new Map();
  const byName = new Map();
  
  for (const card of normalized) {
    if (card.id) byId.set(card.id, card);
    if (card.code) byId.set(card.code, card);
    
    const nameKey = (card.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (nameKey) byName.set(nameKey, card);
    
    const simpleKey = (card.simpleName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (simpleKey && simpleKey !== nameKey) byName.set(simpleKey, card);
  }
  
  console.log(`✅ Database built: ${normalized.length} cards`);
  console.log(`   Index by ID: ${byId.size} entries`);
  console.log(`   Index by name: ${byName.size} entries`);
  
  return {
    cards: normalized,
    byId,
    byName,
    count: normalized.length,
    source: 'dreamborn',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Save card database to file
 * @param {Object} db - Card database
 * @param {string} filepath - Output path
 */
async function saveCardDatabase(db, filepath) {
  const fs = require('fs');
  const path = require('path');
  
  // Ensure directory exists
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Save as JSON
  fs.writeFileSync(filepath, JSON.stringify(db.cards, null, 2), 'utf8');
  console.log(`💾 Saved ${db.cards.length} cards to ${filepath}`);
  
  // Save metadata
  const metaPath = filepath.replace('.json', '.meta.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    count: db.count,
    source: db.source,
    updatedAt: db.updatedAt,
    byIdCount: db.byId.size,
    byNameCount: db.byName.size,
  }, null, 2), 'utf8');
  console.log(`💾 Saved metadata to ${metaPath}`);
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'build';
  
  try {
    switch (command) {
      case 'build': {
        const db = await buildCardDatabase();
        const output = args[1] || './backend/db/cards.json';
        await saveCardDatabase(db, output);
        console.log('✅ Done!');
        break;
      }
      
      case 'search': {
        const query = args[1];
        if (!query) {
          console.error('Usage: node dreamborn-api.js search "card name"');
          process.exit(1);
        }
        const results = await searchCards(query);
        console.log(JSON.stringify(results, null, 2));
        break;
      }
      
      case 'card': {
        const cardId = args[1];
        if (!cardId) {
          console.error('Usage: node dreamborn-api.js card <cardId>');
          process.exit(1);
        }
        const card = await getCardById(cardId);
        console.log(JSON.stringify(card, null, 2));
        break;
      }
      
      case 'sets': {
        const sets = await getAllSets();
        console.log(JSON.stringify(sets, null, 2));
        break;
      }
      
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Available commands: build, search, card, sets');
        process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  getAllCards,
  getCardById,
  searchCards,
  getAllSets,
  normalizeDreambornCard,
  buildCardDatabase,
  saveCardDatabase,
};

'use strict';

/**
 * Card Auto-Updater v4.1 - FIXED
 * Usa URLs REAIS e verificadas
 * Fontes: Dreamborn.ink (API real) + Fallback local
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CARDS_DB = path.join(__dirname, '../../db/cards.json');
const SETS_DB = path.join(__dirname, '../../db/sets.json');
const UPDATE_LOG = path.join(__dirname, '../../db/updateLog.json');

// ── FONTES REAIS ─────────────────────────────────────────────────────────────

const SOURCES = {
  dreamborn: {
    // URL REAL do Dreamborn.ink - API pública
    url: 'https://api.lorcana-api.com/bulk/cards',
    enabled: true,
    priority: 1,
  },
  // Alternativa: LorCast
  lorcast: {
    url: 'https://lorcast.com/api/sets/all',
    enabled: false, // Desabilitado por padrão (pode não ter API completa)
    priority: 2,
  },
};

// ── Fetch ────────────────────────────────────────────────────────────────────

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 30000,
    };

    https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJSON(res.headers.location).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    }).on('error', reject).on('timeout', () => {
      reject(new Error('Request timeout'));
    });
  });
}

// ── Card Normalization ───────────────────────────────────────────────────────

function normalizeCard(card, source) {
  // Formato Dreamborn/Lorcana-API
  return {
    id: card.id || card.card_identifier,
    name: card.name || card.Name,
    fullName: card.fullName || card.full_name || card.name,
    cost: parseInt(card.cost || card.Cost || card.ink_cost) || 0,
    inkable: card.inkable === true || card.Inkable === true || card.inkwell === true,
    type: card.type || card.Type || card.card_type || 'Character',
    classifications: card.classifications || card.Classifications || card.traits || [],
    color: card.color || card.Color || card.Ink || card.ink_color,
    set: card.set || card.Set_Num || card.Set_Name,
    setNumber: card.number || card.Card_Num || card.collector_number,
    rarity: card.rarity || card.Rarity,
    lore: parseInt(card.lore || card.Lore) || 0,
    strength: card.strength ? parseInt(card.strength) : null,
    willpower: card.willpower ? parseInt(card.willpower) : null,
    abilities: card.abilities || card.Body_Text || card.text || '',
    flavor: card.flavor || card.Flavor_Text || '',
    artist: card.artist || card.Artist,
    image: card.image || card.Image,
    source,
    lastUpdated: new Date().toISOString(),
  };
}

function cardFingerprint(card) {
  const key = `${card.name}|${card.set}|${card.setNumber}`.toLowerCase();
  return require('crypto').createHash('md5').update(key).digest('hex');
}

// ── Update Logic ─────────────────────────────────────────────────────────────

function loadLocalCards() {
  try {
    if (fs.existsSync(CARDS_DB)) {
      const raw = fs.readFileSync(CARDS_DB, 'utf8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : (data.cards || []);
    }
  } catch (e) {
    console.warn('Local cards DB not found or corrupted');
  }
  return [];
}

function saveCards(cards) {
  const dir = path.dirname(CARDS_DB);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(CARDS_DB, JSON.stringify(cards, null, 2));
  console.log(`✅ Saved ${cards.length} cards to ${CARDS_DB}`);
}

function mergeCards(localCards, remoteCards, source) {
  const cardMap = new Map();

  for (const card of localCards) {
    const fp = cardFingerprint(card);
    cardMap.set(fp, card);
  }

  let newCards = 0;
  let updatedCards = 0;

  for (const remote of remoteCards) {
    const normalized = normalizeCard(remote, source);
    const fp = cardFingerprint(normalized);

    if (!cardMap.has(fp)) {
      cardMap.set(fp, normalized);
      newCards++;
    } else {
      const existing = cardMap.get(fp);
      const sourcePriority = SOURCES[source]?.priority || 99;
      const existingPriority = SOURCES[existing.source]?.priority || 99;

      if (sourcePriority <= existingPriority) {
        cardMap.set(fp, {
          ...normalized,
          id: existing.id,
        });
        updatedCards++;
      }
    }
  }

  console.log(`  ${newCards} new, ${updatedCards} updated from ${source}`);
  return Array.from(cardMap.values());
}

async function updateFromSource(sourceName, localCards) {
  const source = SOURCES[sourceName];
  if (!source.enabled) {
    console.log(`⏭️  ${sourceName}: disabled`);
    return localCards;
  }

  console.log(`🔄 Fetching from ${sourceName}...`);

  try {
    const remoteCards = await fetchJSON(source.url);
    
    // Validar formato
    let cardsList = [];
    if (Array.isArray(remoteCards)) {
      cardsList = remoteCards;
    } else if (remoteCards.data && Array.isArray(remoteCards.data)) {
      cardsList = remoteCards.data;
    } else if (remoteCards.cards && Array.isArray(remoteCards.cards)) {
      cardsList = remoteCards.cards;
    } else {
      throw new Error('Invalid response format - expected array of cards');
    }

    if (cardsList.length === 0) {
      throw new Error('No cards returned from API');
    }

    console.log(`  Fetched ${cardsList.length} cards`);
    const merged = mergeCards(localCards, cardsList, sourceName);
    return merged;

  } catch (err) {
    console.error(`❌ ${sourceName} failed: ${err.message}`);
    console.log(`   Using local data only (${localCards.length} cards)`);
    return localCards;
  }
}

function detectNewSets(cards) {
  const sets = new Set();
  for (const card of cards) {
    if (card.set) sets.add(card.set);
  }
  return Array.from(sets).sort();
}

function logUpdate(stats) {
  const log = {
    timestamp: new Date().toISOString(),
    stats,
  };

  let history = [];
  try {
    if (fs.existsSync(UPDATE_LOG)) {
      history = JSON.parse(fs.readFileSync(UPDATE_LOG, 'utf8'));
    }
  } catch {}

  history.push(log);
  if (history.length > 100) {
    history = history.slice(-100);
  }

  fs.writeFileSync(UPDATE_LOG, JSON.stringify(history, null, 2));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function updateCards(opts = {}) {
  const { force = false, sources = ['dreamborn'] } = opts;

  console.log('\n🎴 Card Auto-Updater v4.1 (FIXED)\n');

  const startTime = Date.now();
  let localCards = loadLocalCards();
  const initialCount = localCards.length;

  console.log(`📦 Local database: ${initialCount} cards\n`);

  // Se já tem muitos cards locais, não precisa buscar
  if (initialCount >= 2000 && !force) {
    console.log('✅ Local database is up to date (use --force to update anyway)');
    const sets = detectNewSets(localCards);
    console.log(`   Sets: ${sets.length}`);
    return {
      initialCount,
      finalCount: initialCount,
      newCards: 0,
      sets: sets.length,
      duration: Date.now() - startTime,
    };
  }

  // Atualizar de cada fonte
  for (const sourceName of sources) {
    localCards = await updateFromSource(sourceName, localCards);
  }

  const finalCount = localCards.length;
  const newCards = finalCount - initialCount;

  // Detectar sets
  const sets = detectNewSets(localCards);

  // Salvar
  saveCards(localCards);

  // Salvar sets
  const setsData = {
    sets,
    count: sets.length,
    lastUpdated: new Date().toISOString(),
  };
  fs.writeFileSync(SETS_DB, JSON.stringify(setsData, null, 2));

  const stats = {
    initialCount,
    finalCount,
    newCards,
    sets: sets.length,
    duration: Date.now() - startTime,
  };

  logUpdate(stats);

  console.log(`\n✅ Update complete!`);
  console.log(`   Total cards: ${finalCount} (+${newCards})`);
  console.log(`   Sets: ${sets.length}`);
  console.log(`   Duration: ${Math.round(stats.duration / 1000)}s\n`);

  return stats;
}

function needsUpdate() {
  try {
    if (!fs.existsSync(UPDATE_LOG)) return true;
    const history = JSON.parse(fs.readFileSync(UPDATE_LOG, 'utf8'));
    if (history.length === 0) return true;
    const lastUpdate = new Date(history[history.length - 1].timestamp);
    const now = new Date();
    const hoursSince = (now - lastUpdate) / (1000 * 60 * 60);
    return hoursSince >= 24;
  } catch {
    return true;
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');

  if (!force && !needsUpdate()) {
    console.log('✅ Cards are up to date (last update < 24h ago)');
    console.log('   Use --force to update anyway');
    process.exit(0);
  }

  updateCards({ force })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('💥 Update failed:', err);
      process.exit(1);
    });
}

module.exports = { updateCards, needsUpdate };

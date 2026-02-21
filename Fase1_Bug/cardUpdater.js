'use strict';

/**
 * Card Auto-Updater
 * Sincroniza cards de múltiplas fontes públicas
 * Fontes: Dreamborn.ink, Lorcania.com
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CARDS_DB = path.join(__dirname, '../../db/cards.json');
const SETS_DB = path.join(__dirname, '../../db/sets.json');
const UPDATE_LOG = path.join(__dirname, '../../db/updateLog.json');

// ── Sources ──────────────────────────────────────────────────────────────────

const SOURCES = {
  dreamborn: {
    url: 'https://dreamborn.ink/api/cards',
    priority: 1,
    enabled: true,
  },
  lorcania: {
    url: 'https://api.lorcania.com/cards',
    priority: 2,
    enabled: true,
  },
};

// ── Fetch Helpers ────────────────────────────────────────────────────────────

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'LorcanaAI/4.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

// ── Card Normalization ───────────────────────────────────────────────────────

/**
 * Normaliza carta para formato padrão, independente da fonte
 */
function normalizeCard(card, source) {
  // Dreamborn format
  if (source === 'dreamborn') {
    return {
      id: card.id || card.cardId,
      name: card.name,
      fullName: card.fullName || `${card.name} - ${card.subtitle || ''}`.trim(),
      cost: parseInt(card.cost) || 0,
      inkable: card.inkable === true || card.inkwell === true,
      type: card.type || card.cardType || 'Character',
      classifications: card.classifications || [],
      color: card.color || card.ink,
      set: card.set || card.expansion,
      setNumber: card.number || card.collectorNumber,
      rarity: card.rarity,
      lore: parseInt(card.lore) || 0,
      strength: card.strength ? parseInt(card.strength) : null,
      willpower: card.willpower ? parseInt(card.willpower) : null,
      abilities: card.abilities || card.text || '',
      flavor: card.flavor || card.flavorText || '',
      artist: card.artist,
      image: card.image || card.imageUrl,
      source: 'dreamborn',
      lastUpdated: new Date().toISOString(),
    };
  }

  // Lorcania format
  if (source === 'lorcania') {
    return {
      id: card.card_identifier || card.id,
      name: card.name || card.title,
      fullName: card.full_name || card.name,
      cost: parseInt(card.ink_cost) || 0,
      inkable: card.inkwell || false,
      type: card.type,
      classifications: card.traits || [],
      color: card.ink_color,
      set: card.set_id,
      setNumber: card.card_num,
      rarity: card.rarity,
      lore: parseInt(card.lore) || 0,
      strength: card.strength ? parseInt(card.strength) : null,
      willpower: card.willpower ? parseInt(card.willpower) : null,
      abilities: card.body_text || '',
      flavor: card.flavor_text || '',
      artist: card.illustrator,
      image: card.image_urls?.digital,
      source: 'lorcania',
      lastUpdated: new Date().toISOString(),
    };
  }

  return card;
}

/**
 * Gera fingerprint único para detectar duplicatas
 */
function cardFingerprint(card) {
  const key = `${card.name}|${card.set}|${card.setNumber}`.toLowerCase();
  return require('crypto').createHash('md5').update(key).digest('hex');
}

// ── Update Logic ─────────────────────────────────────────────────────────────

/**
 * Carrega cards locais
 */
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

/**
 * Salva cards atualizados
 */
function saveCards(cards) {
  const dir = path.dirname(CARDS_DB);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(CARDS_DB, JSON.stringify(cards, null, 2));
  console.log(`✅ Saved ${cards.length} cards to ${CARDS_DB}`);
}

/**
 * Merge de cards de múltiplas fontes
 * Prioridade: Dreamborn > Lorcania > Local
 */
function mergeCards(localCards, remoteCards, source) {
  const cardMap = new Map();

  // Indexar cards locais
  for (const card of localCards) {
    const fp = cardFingerprint(card);
    cardMap.set(fp, card);
  }

  let newCards = 0;
  let updatedCards = 0;

  // Merge com cards remotos
  for (const remote of remoteCards) {
    const normalized = normalizeCard(remote, source);
    const fp = cardFingerprint(normalized);

    if (!cardMap.has(fp)) {
      // Nova carta
      cardMap.set(fp, normalized);
      newCards++;
    } else {
      const existing = cardMap.get(fp);
      
      // Atualizar se fonte tem prioridade maior
      const sourcePriority = SOURCES[source]?.priority || 99;
      const existingPriority = SOURCES[existing.source]?.priority || 99;

      if (sourcePriority <= existingPriority) {
        // Merge: manter IDs locais, atualizar dados
        cardMap.set(fp, {
          ...normalized,
          id: existing.id, // Preservar ID local se existir
        });
        updatedCards++;
      }
    }
  }

  console.log(`  ${newCards} new, ${updatedCards} updated from ${source}`);

  return Array.from(cardMap.values());
}

/**
 * Atualiza cards de uma fonte específica
 */
async function updateFromSource(sourceName, localCards) {
  const source = SOURCES[sourceName];
  if (!source.enabled) {
    console.log(`⏭️  ${sourceName}: disabled`);
    return localCards;
  }

  console.log(`🔄 Fetching from ${sourceName}...`);

  try {
    const remoteCards = await fetchJSON(source.url);
    
    if (!Array.isArray(remoteCards)) {
      throw new Error('Invalid response format');
    }

    console.log(`  Fetched ${remoteCards.length} cards`);
    
    const merged = mergeCards(localCards, remoteCards, sourceName);
    return merged;

  } catch (err) {
    console.error(`❌ ${sourceName} failed: ${err.message}`);
    return localCards; // Fallback to local
  }
}

/**
 * Log de atualização
 */
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
  
  // Manter últimas 100 atualizações
  if (history.length > 100) {
    history = history.slice(-100);
  }

  fs.writeFileSync(UPDATE_LOG, JSON.stringify(history, null, 2));
}

/**
 * Detecta sets novos
 */
function detectNewSets(cards) {
  const sets = new Set();
  for (const card of cards) {
    if (card.set) sets.add(card.set);
  }
  return Array.from(sets).sort();
}

// ── Main Update Function ─────────────────────────────────────────────────────

/**
 * Atualiza banco de cards de todas as fontes
 */
async function updateCards(opts = {}) {
  const { force = false, sources = ['dreamborn', 'lorcania'] } = opts;

  console.log('\n🎴 Card Auto-Updater v4.0\n');

  const startTime = Date.now();
  let localCards = loadLocalCards();
  const initialCount = localCards.length;

  console.log(`📦 Local database: ${initialCount} cards\n`);

  // Atualizar de cada fonte em ordem de prioridade
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

  // Log
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

/**
 * Verifica se atualização é necessária
 */
function needsUpdate() {
  try {
    if (!fs.existsSync(UPDATE_LOG)) return true;
    
    const history = JSON.parse(fs.readFileSync(UPDATE_LOG, 'utf8'));
    if (history.length === 0) return true;
    
    const lastUpdate = new Date(history[history.length - 1].timestamp);
    const now = new Date();
    const hoursSince = (now - lastUpdate) / (1000 * 60 * 60);
    
    // Atualizar se passou mais de 24h
    return hoursSince >= 24;
  } catch {
    return true;
  }
}

// ── CLI Interface ────────────────────────────────────────────────────────────

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

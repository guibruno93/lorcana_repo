'use strict';

/**
 * Tournament Aggregator v4.1 - FIXED
 * OFFLINE-FIRST: Usa dados locais existentes (440 decks)
 * Busca externa OPCIONAL (pode falhar sem problema)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '../../db/tournamentMeta.json');
const SOURCES_LOG = path.join(__dirname, '../../db/sourcesLog.json');

// ── Configuration ────────────────────────────────────────────────────────────

// Fontes externas DESABILITADAS por padrão (muitas APIs bloqueiam)
// Use apenas dados locais que já funcionam
const EXTERNAL_SOURCES_ENABLED = false;

// ── Helpers ──────────────────────────────────────────────────────────────────

function decklistFingerprint(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return null;

  const normalized = cards
    .map(c => ({
      name: (c.name || '').toLowerCase().trim(),
      qty: parseInt(c.quantity) || 1,
    }))
    .filter(c => c.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  const str = normalized.map(c => `${c.qty}x${c.name}`).join('|');
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

function eventFingerprint(event, source) {
  const key = `${source}|${event.name}|${event.date}|${event.players}`;
  return crypto.createHash('md5').update(key).digest('hex');
}

// ── Local Data ───────────────────────────────────────────────────────────────

function loadLocalData() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.log('📁 No local tournament data found');
      return [];
    }

    const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const decks = Array.isArray(raw) ? raw : (raw.decks || []);
    
    console.log(`📁 Loaded ${decks.length} decks from local database`);
    return decks;

  } catch (e) {
    console.warn('⚠️  Local tournament DB error:', e.message);
    return [];
  }
}

function saveToDb(decks) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const data = {
    format: 'core',
    updatedAt: new Date().toISOString(),
    decksCount: decks.length,
    decks,
  };

  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  console.log(`✅ Saved ${decks.length} decks to ${DB_PATH}`);
}

// ── Deduplication ────────────────────────────────────────────────────────────

function deduplicateDecks(decks) {
  const seen = new Map();

  for (const deck of decks) {
    // Tentar usar fingerprint
    let key = deck.decklistFingerprint;
    
    // Fallback: gerar fingerprint se não existir
    if (!key && deck.cards) {
      key = decklistFingerprint(deck.cards);
    }

    // Se ainda não tem key, usar evento + player
    if (!key) {
      key = `${deck.eventName || 'unknown'}_${deck.player || 'unknown'}_${deck.standing || ''}`;
    }

    if (!seen.has(key)) {
      seen.set(key, deck);
    }
  }

  return Array.from(seen.values());
}

function sortByDate(decks) {
  return decks.sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : new Date(a.fetchedAt || 0);
    const dateB = b.date ? new Date(b.date) : new Date(b.fetchedAt || 0);
    return dateB - dateA;
  });
}

// ── External Sources (OPTIONAL) ──────────────────────────────────────────────

async function fetchExternalSources() {
  if (!EXTERNAL_SOURCES_ENABLED) {
    console.log('⏭️  External sources disabled (using local data only)');
    return [];
  }

  console.log('🔄 Attempting to fetch from external sources...');
  console.log('   (This may fail - external APIs often block requests)');

  // TODO: Implementar busca externa apenas se necessário
  // Por ora, retorna vazio para não bloquear
  
  return [];
}

// ── Main Aggregator ──────────────────────────────────────────────────────────

async function aggregateTournaments(opts = {}) {
  console.log('\n🏆 Tournament Aggregator v4.1 (FIXED)\n');
  console.log('Strategy: OFFLINE-FIRST (prioritize local data)\n');

  const startTime = Date.now();

  // 1. Carregar dados locais (SEMPRE)
  const localDecks = loadLocalData();

  // 2. Tentar buscar dados externos (OPCIONAL)
  const externalDecks = await fetchExternalSources();

  // 3. Combinar
  const allDecks = [...localDecks, ...externalDecks];

  // 4. Deduplar
  const deduplicated = deduplicateDecks(allDecks);

  // 5. Ordenar por data
  const sorted = sortByDate(deduplicated);

  // 6. Salvar
  if (sorted.length > 0) {
    saveToDb(sorted);
  } else {
    console.log('⚠️  No tournament data available');
  }

  const stats = {
    localCount: localDecks.length,
    externalCount: externalDecks.length,
    totalAfterMerge: sorted.length,
    duration: Date.now() - startTime,
  };

  // Log
  logSources(stats);

  console.log(`\n✅ Aggregation complete!`);
  console.log(`   Local: ${localDecks.length} decks`);
  console.log(`   External: ${externalDecks.length} decks`);
  console.log(`   Total in DB: ${sorted.length} decks`);
  console.log(`   Duration: ${Math.round(stats.duration / 1000)}s\n`);

  if (sorted.length === 0) {
    console.log('💡 TIP: Make sure tournamentMeta.json exists with tournament data');
    console.log('   Expected location: backend/db/tournamentMeta.json\n');
  }

  return stats;
}

function logSources(stats) {
  let history = [];
  
  try {
    if (fs.existsSync(SOURCES_LOG)) {
      history = JSON.parse(fs.readFileSync(SOURCES_LOG, 'utf8'));
    }
  } catch {}

  history.push({
    timestamp: new Date().toISOString(),
    stats,
  });

  if (history.length > 50) {
    history = history.slice(-50);
  }

  const dir = path.dirname(SOURCES_LOG);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(SOURCES_LOG, JSON.stringify(history, null, 2));
}

// ── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  aggregateTournaments()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('💥 Aggregation failed:', err);
      process.exit(1);
    });
}

module.exports = { aggregateTournaments };

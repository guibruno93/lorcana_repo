'use strict';

/**
 * Tournament Aggregator v4.0
 * Busca torneios de múltiplas fontes públicas com procedência
 * Fontes: Melee.gg, Lorcania.com, TCGPlayer (futuro)
 * Features: Deduplicação, fingerprinting, procedência verificada
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const DB_PATH = path.join(__dirname, '../../db/tournamentMeta.json');
const SOURCES_LOG = path.join(__dirname, '../../db/sourcesLog.json');

// ── Configuration ────────────────────────────────────────────────────────────

const SOURCES = {
  'melee.gg': {
    enabled: true,
    priority: 1,
    fetchUrl: 'https://melee.gg/api/v1/tournaments?game=lorcana&status=completed&limit=100',
    verified: true,
    rateLimit: 3000, // ms
  },
  'lorcania.com': {
    enabled: true,
    priority: 2,
    fetchUrl: 'https://api.lorcania.com/tournaments?status=completed&limit=100',
    verified: true,
    rateLimit: 2000,
  },
  // Futuro:
  // 'tcgplayer.com': { ... },
  // 'official-events': { ... },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'LorcanaAI-Aggregator/4.0 (Educational)',
        'Accept': 'application/json',
        ...headers,
      },
      timeout: 15000,
    };

    https.get(url, options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      
      res.on('end', () => {
        if (res.statusCode === 429) {
          return reject(new Error('Rate limited'));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Gera fingerprint único para decklist
 * Usado para detectar duplicatas
 */
function decklistFingerprint(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return null;
  }

  // Normalizar e ordenar
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

/**
 * Gera ID único para evento
 */
function eventFingerprint(event, source) {
  const key = `${source}|${event.name}|${event.date}|${event.players}`;
  return crypto.createHash('md5').update(key).digest('hex');
}

// ── Source Parsers ───────────────────────────────────────────────────────────

/**
 * Parser Melee.gg
 */
async function fetchMeleeGG() {
  const source = SOURCES['melee.gg'];
  if (!source.enabled) return [];

  console.log('🔄 Fetching from Melee.gg...');

  try {
    const tournaments = await fetchJSON(source.fetchUrl);
    
    if (!Array.isArray(tournaments)) {
      console.warn('  Invalid response format');
      return [];
    }

    console.log(`  Found ${tournaments.length} tournaments`);

    const results = [];

    for (const tournament of tournaments.slice(0, 20)) {
      await sleep(source.rateLimit);

      const tid = tournament.id || tournament.ID;
      if (!tid) continue;

      try {
        // Buscar standings
        const standingsUrl = `https://melee.gg/api/v1/tournaments/${tid}/standings`;
        const standings = await fetchJSON(standingsUrl);

        const standingsList = Array.isArray(standings) ? standings : (standings.data || []);

        for (const standing of standingsList.slice(0, 32)) {
          const placement = standing.placement || standing.standing;
          if (!placement || placement > 32) continue;

          const decklist = extractMeleeDeck(standing);
          if (!decklist || decklist.length < 10) continue;

          const fingerprint = decklistFingerprint(decklist);
          const eventId = eventFingerprint(tournament, 'melee.gg');

          results.push({
            source: 'melee.gg',
            sourceUrl: `https://melee.gg/Tournament/View/${tid}`,
            eventId,
            eventName: tournament.name || 'Tournament',
            date: tournament.date || tournament.startDate || null,
            location: tournament.location || null,
            players: tournament.players || tournament.playerCount || null,
            format: 'Core',
            verified: true,
            
            player: standing.player?.username || standing.name || 'Unknown',
            standing: String(placement).toUpperCase(),
            
            cards: decklist,
            decklistFingerprint: fingerprint,
            
            archetype: null, // Será inferido depois
            inks: extractInks(decklist),
            
            fetchedAt: new Date().toISOString(),
          });
        }

        console.log(`  ✅ ${tournament.name}: ${results.length} decks`);

      } catch (err) {
        console.warn(`  ⚠️  Tournament ${tid}: ${err.message}`);
        continue;
      }
    }

    return results;

  } catch (err) {
    console.error(`❌ Melee.gg error: ${err.message}`);
    return [];
  }
}

function extractMeleeDeck(standing) {
  const deck = standing.deck || standing.decklist || {};
  const mainboard = deck.mainboard || deck.main || deck.cards || [];
  
  return mainboard
    .map(c => ({
      name: c.name || c.cardName || '',
      quantity: parseInt(c.quantity || c.count || c.qty) || 1,
    }))
    .filter(c => c.name);
}

/**
 * Parser Lorcania.com
 */
async function fetchLorcania() {
  const source = SOURCES['lorcania.com'];
  if (!source.enabled) return [];

  console.log('🔄 Fetching from Lorcania.com...');

  try {
    const tournaments = await fetchJSON(source.fetchUrl);

    if (!Array.isArray(tournaments) && !tournaments.data) {
      console.warn('  Invalid response format');
      return [];
    }

    const tournamentList = Array.isArray(tournaments) ? tournaments : tournaments.data;
    console.log(`  Found ${tournamentList.length} tournaments`);

    const results = [];

    for (const tournament of tournamentList.slice(0, 20)) {
      await sleep(source.rateLimit);

      const tid = tournament.id;
      if (!tid) continue;

      try {
        const detailUrl = `https://api.lorcania.com/tournaments/${tid}`;
        const detail = await fetchJSON(detailUrl);

        const standings = detail.standings || detail.decks || [];

        for (const standing of standings.slice(0, 32)) {
          const decklist = extractLorcaniaDeck(standing);
          if (!decklist || decklist.length < 10) continue;

          const fingerprint = decklistFingerprint(decklist);
          const eventId = eventFingerprint(tournament, 'lorcania.com');

          results.push({
            source: 'lorcania.com',
            sourceUrl: `https://lorcania.com/tournaments/${tid}`,
            eventId,
            eventName: tournament.name || 'Lorcana Tournament',
            date: tournament.date || null,
            location: tournament.location || null,
            players: tournament.players || null,
            format: 'Core',
            verified: true,
            
            player: standing.player || standing.username || 'Unknown',
            standing: String(standing.placement || standing.rank || '').toUpperCase(),
            
            cards: decklist,
            decklistFingerprint: fingerprint,
            
            archetype: standing.archetype || null,
            inks: extractInks(decklist),
            
            fetchedAt: new Date().toISOString(),
          });
        }

        console.log(`  ✅ ${tournament.name}: ${results.length} decks`);

      } catch (err) {
        console.warn(`  ⚠️  Tournament ${tid}: ${err.message}`);
        continue;
      }
    }

    return results;

  } catch (err) {
    console.error(`❌ Lorcania error: ${err.message}`);
    return [];
  }
}

function extractLorcaniaDeck(standing) {
  const cards = standing.deck || standing.decklist || standing.cards || [];
  
  return cards
    .map(c => ({
      name: c.name || c.card_name || '',
      quantity: parseInt(c.quantity || c.count) || 1,
    }))
    .filter(c => c.name);
}

/**
 * Extrai inks da decklist (heurística simples)
 */
function extractInks(cards) {
  // TODO: Buscar ink real do cards.json
  // Por ora, retorna vazio
  return [];
}

// ── Deduplication ────────────────────────────────────────────────────────────

/**
 * Remove duplicatas por fingerprint
 * Prioriza fonte com maior prioridade
 */
function deduplicateDecks(decks) {
  const seen = new Map();

  for (const deck of decks) {
    const key = deck.decklistFingerprint;
    if (!key) continue;

    if (!seen.has(key)) {
      seen.set(key, deck);
    } else {
      const existing = seen.get(key);
      const existingPriority = SOURCES[existing.source]?.priority || 99;
      const newPriority = SOURCES[deck.source]?.priority || 99;

      // Se nova fonte tem prioridade maior (número menor), substitui
      if (newPriority < existingPriority) {
        seen.set(key, deck);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Merge com dados locais
 */
function mergeWithLocal(newDecks) {
  let localDecks = [];

  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      localDecks = Array.isArray(raw) ? raw : (raw.decks || []);
    }
  } catch (e) {
    console.warn('Local tournament DB not found or corrupted');
  }

  // Combinar
  const allDecks = [...localDecks, ...newDecks];
  
  // Deduplar
  const deduplicated = deduplicateDecks(allDecks);

  // Ordenar por data (mais recente primeiro)
  deduplicated.sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : new Date(0);
    const dateB = b.date ? new Date(b.date) : new Date(0);
    return dateB - dateA;
  });

  return deduplicated;
}

/**
 * Salva no DB
 */
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

/**
 * Log de fontes
 */
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

  fs.writeFileSync(SOURCES_LOG, JSON.stringify(history, null, 2));
}

// ── Main Aggregator ──────────────────────────────────────────────────────────

/**
 * Agrega torneios de todas as fontes
 */
async function aggregateTournaments(opts = {}) {
  const { sources = ['melee.gg', 'lorcania.com'] } = opts;

  console.log('\n🏆 Tournament Aggregator v4.0\n');

  const startTime = Date.now();
  const allDecks = [];
  const stats = {};

  // Buscar de cada fonte
  for (const sourceName of sources) {
    if (!SOURCES[sourceName]?.enabled) continue;

    try {
      let decks = [];
      
      if (sourceName === 'melee.gg') {
        decks = await fetchMeleeGG();
      } else if (sourceName === 'lorcania.com') {
        decks = await fetchLorcania();
      }

      allDecks.push(...decks);
      stats[sourceName] = decks.length;

      console.log(`  ${sourceName}: ${decks.length} decks\n`);

    } catch (err) {
      console.error(`❌ ${sourceName} failed: ${err.message}\n`);
      stats[sourceName] = 0;
    }
  }

  // Merge com dados locais
  const merged = mergeWithLocal(allDecks);
  
  // Salvar
  saveToDb(merged);

  // Log
  const finalStats = {
    sources: stats,
    totalFetched: allDecks.length,
    totalAfterMerge: merged.length,
    duration: Date.now() - startTime,
  };

  logSources(finalStats);

  console.log(`\n✅ Aggregation complete!`);
  console.log(`   Fetched: ${allDecks.length} decks`);
  console.log(`   Total in DB: ${merged.length} decks`);
  console.log(`   Duration: ${Math.round(finalStats.duration / 1000)}s\n`);

  return finalStats;
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

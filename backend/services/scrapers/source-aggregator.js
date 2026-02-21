/**
 * source-aggregator.js
 * Agregador central de múltiplas fontes com deduplicação
 * 
 * Unifica dados de: inkDecks, Melee, DreamBorn
 * Deduplica usando fingerprint SHA256
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Fingerprint Generation ───────────────────────────────────────────────────

/**
 * Generate SHA256 fingerprint for a deck
 * @param {Array} cards - Array of cards with quantities
 * @returns {string} SHA256 hash
 */
function generateDeckFingerprint(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return null;
  }
  
  // Sort cards by name and quantity for consistent hashing
  const normalized = cards
    .map(c => ({
      name: (c.name || '').toLowerCase().trim(),
      quantity: parseInt(c.quantity) || 0,
    }))
    .filter(c => c.name && c.quantity > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  
  if (normalized.length === 0) return null;
  
  // Create string representation
  const deckString = normalized
    .map(c => `${c.quantity}x${c.name}`)
    .join('|');
  
  // Hash it
  return crypto
    .createHash('sha256')
    .update(deckString)
    .digest('hex');
}

/**
 * Check if two decks are similar (fuzzy match)
 * @param {Array} deck1 - First deck
 * @param {Array} deck2 - Second deck
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {boolean} Are decks similar?
 */
function areDecksSimilar(deck1, deck2, threshold = 0.90) {
  const cards1 = new Map();
  const cards2 = new Map();
  
  for (const card of deck1) {
    const name = (card.name || '').toLowerCase().trim();
    cards1.set(name, parseInt(card.quantity) || 0);
  }
  
  for (const card of deck2) {
    const name = (card.name || '').toLowerCase().trim();
    cards2.set(name, parseInt(card.quantity) || 0);
  }
  
  // Calculate Jaccard similarity
  const allCards = new Set([...cards1.keys(), ...cards2.keys()]);
  let matches = 0;
  let total = 0;
  
  for (const card of allCards) {
    const q1 = cards1.get(card) || 0;
    const q2 = cards2.get(card) || 0;
    matches += Math.min(q1, q2);
    total += Math.max(q1, q2);
  }
  
  const similarity = total > 0 ? matches / total : 0;
  return similarity >= threshold;
}

// ── Source Normalization ─────────────────────────────────────────────────────

/**
 * Normalize deck from any source to common format
 * @param {Object} deck - Deck from any source
 * @param {string} source - Source name
 * @returns {Object} Normalized deck
 */
function normalizeDeck(deck, source) {
  const normalized = {
    // Core info
    id: deck.id || deck.deckId || null,
    name: deck.name || deck.deckName || 'Unknown',
    author: deck.author || deck.player || deck.builder || 'Unknown',
    
    // Cards
    cards: deck.cards || deck.decklist || [],
    
    // Tournament info
    tournament: {
      name: deck.tournament?.name || deck.eventName || null,
      date: deck.tournament?.date || deck.eventDate || null,
      placement: deck.placement || deck.rank || null,
      format: deck.format || 'Core',
    },
    
    // Strategy
    inks: deck.inks || [],
    archetype: deck.archetype || null,
    strategy: deck.strategy || null,
    
    // Meta
    source,
    sourceUrl: deck.url || deck.sourceUrl || null,
    fingerprint: null, // Will be calculated
    fetchedAt: deck.fetchedAt || deck.scrapedAt || new Date().toISOString(),
  };
  
  // Generate fingerprint
  normalized.fingerprint = generateDeckFingerprint(normalized.cards);
  
  return normalized;
}

/**
 * Normalize inkDecks deck
 */
function normalizeInkdecksDeck(deck) {
  return normalizeDeck(deck, 'inkdecks');
}

/**
 * Normalize Melee deck
 */
function normalizeMeleeDeck(deck) {
  return normalizeDeck(deck, 'melee');
}

/**
 * Normalize DreamBorn deck (if they add tournament data in future)
 */
function normalizeDreambornDeck(deck) {
  return normalizeDeck(deck, 'dreamborn');
}

// ── Deduplication ────────────────────────────────────────────────────────────

/**
 * Deduplicate decks using fingerprints
 * @param {Array} decks - Array of normalized decks
 * @returns {Object} Deduplicated decks with metadata
 */
function deduplicateDecks(decks) {
  console.log(`🔍 Deduplicating ${decks.length} decks...`);
  
  const fingerprintMap = new Map();
  const unique = [];
  const duplicates = [];
  
  for (const deck of decks) {
    if (!deck.fingerprint) {
      console.warn(`   ⚠️  Deck ${deck.id} has no fingerprint, skipping`);
      continue;
    }
    
    if (fingerprintMap.has(deck.fingerprint)) {
      // Duplicate found
      const existing = fingerprintMap.get(deck.fingerprint);
      duplicates.push({
        deck,
        duplicateOf: existing.id,
        fingerprint: deck.fingerprint,
      });
    } else {
      // Unique deck
      fingerprintMap.set(deck.fingerprint, deck);
      unique.push(deck);
    }
  }
  
  console.log(`   ✅ Unique: ${unique.length}`);
  console.log(`   ❌ Duplicates: ${duplicates.length}`);
  
  return {
    unique,
    duplicates,
    totalProcessed: decks.length,
    uniqueCount: unique.length,
    duplicateCount: duplicates.length,
  };
}

/**
 * Merge duplicate decks (keep best placement, combine sources)
 * @param {Array} decks - Array of decks
 * @returns {Array} Merged decks
 */
function mergeDuplicates(decks) {
  console.log(`🔀 Merging duplicates from ${decks.length} decks...`);
  
  const fingerprintGroups = new Map();
  
  // Group by fingerprint
  for (const deck of decks) {
    if (!deck.fingerprint) continue;
    
    if (!fingerprintGroups.has(deck.fingerprint)) {
      fingerprintGroups.set(deck.fingerprint, []);
    }
    fingerprintGroups.get(deck.fingerprint).push(deck);
  }
  
  const merged = [];
  
  // Merge each group
  for (const [fingerprint, group] of fingerprintGroups) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    
    // Sort by placement (best first)
    group.sort((a, b) => {
      const placeA = a.tournament?.placement || 999;
      const placeB = b.tournament?.placement || 999;
      return placeA - placeB;
    });
    
    const best = group[0];
    const sources = [...new Set(group.map(d => d.source))];
    
    merged.push({
      ...best,
      sources, // Multiple sources for this deck
      duplicates: group.length - 1,
      allPlacements: group.map(d => ({
        source: d.source,
        placement: d.tournament?.placement,
        tournament: d.tournament?.name,
      })),
    });
  }
  
  console.log(`   ✅ Merged ${decks.length} → ${merged.length} decks`);
  return merged;
}

// ── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Aggregate decks from multiple sources
 * @param {Object} sources - Object with source data
 * @returns {Object} Aggregated data
 */
function aggregateSources(sources) {
  console.log('🌐 Aggregating sources...');
  
  const allDecks = [];
  const stats = {
    sources: {},
    total: 0,
  };
  
  // Normalize all sources
  if (sources.inkdecks) {
    console.log('   📦 Processing inkDecks...');
    const decks = Array.isArray(sources.inkdecks) 
      ? sources.inkdecks 
      : sources.inkdecks.decks || [];
    
    for (const deck of decks) {
      allDecks.push(normalizeInkdecksDeck(deck));
    }
    stats.sources.inkdecks = decks.length;
  }
  
  if (sources.melee) {
    console.log('   📦 Processing Melee...');
    const decks = Array.isArray(sources.melee)
      ? sources.melee
      : sources.melee.decklists || [];
    
    for (const deck of decks) {
      allDecks.push(normalizeMeleeDeck(deck));
    }
    stats.sources.melee = decks.length;
  }
  
  if (sources.dreamborn) {
    console.log('   📦 Processing DreamBorn...');
    const decks = Array.isArray(sources.dreamborn)
      ? sources.dreamborn
      : [];
    
    for (const deck of decks) {
      allDecks.push(normalizeDreambornDeck(deck));
    }
    stats.sources.dreamborn = decks.length;
  }
  
  stats.total = allDecks.length;
  console.log(`   ✅ Total decks before dedup: ${stats.total}`);
  
  // Deduplicate
  const dedupResult = deduplicateDecks(allDecks);
  
  // Merge duplicates
  const merged = mergeDuplicates(allDecks);
  
  return {
    decks: merged,
    stats: {
      ...stats,
      unique: dedupResult.uniqueCount,
      duplicates: dedupResult.duplicateCount,
      merged: merged.length,
    },
    metadata: {
      aggregatedAt: new Date().toISOString(),
      sourcesProcessed: Object.keys(stats.sources),
    },
  };
}

/**
 * Load source data from files
 * @param {Object} paths - Paths to source files
 * @returns {Object} Loaded sources
 */
function loadSources(paths) {
  console.log('📂 Loading sources...');
  
  const sources = {};
  
  for (const [name, filepath] of Object.entries(paths)) {
    if (!filepath || !fs.existsSync(filepath)) {
      console.warn(`   ⚠️  ${name}: File not found at ${filepath}`);
      continue;
    }
    
    try {
      const data = fs.readFileSync(filepath, 'utf8');
      sources[name] = JSON.parse(data);
      console.log(`   ✅ ${name}: Loaded`);
    } catch (err) {
      console.error(`   ❌ ${name}: Failed to load - ${err.message}`);
    }
  }
  
  return sources;
}

/**
 * Save aggregated data
 * @param {Object} data - Aggregated data
 * @param {string} filepath - Output path
 */
function saveAggregated(data, filepath) {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`💾 Saved ${data.decks.length} decks to ${filepath}`);
  
  // Save stats separately
  const statsPath = filepath.replace('.json', '.stats.json');
  fs.writeFileSync(statsPath, JSON.stringify(data.stats, null, 2), 'utf8');
  console.log(`💾 Saved stats to ${statsPath}`);
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'aggregate';
  
  try {
    switch (command) {
      case 'aggregate': {
        const sources = loadSources({
          inkdecks: args[1] || './backend/data/tournamentMeta.json',
          melee: args[2] || './backend/data/melee.json',
          dreamborn: args[3] || null, // Optional
        });
        
        const aggregated = aggregateSources(sources);
        
        const output = args[4] || './backend/data/aggregated.json';
        saveAggregated(aggregated, output);
        
        console.log('✅ Done!');
        console.log('');
        console.log('📊 Summary:');
        console.log(JSON.stringify(aggregated.stats, null, 2));
        break;
      }
      
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Usage: node source-aggregator.js aggregate [inkdecks] [melee] [dreamborn] [output]');
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
  generateDeckFingerprint,
  areDecksSimilar,
  normalizeDeck,
  normalizeInkdecksDeck,
  normalizeMeleeDeck,
  deduplicateDecks,
  mergeDuplicates,
  aggregateSources,
  loadSources,
  saveAggregated,
};

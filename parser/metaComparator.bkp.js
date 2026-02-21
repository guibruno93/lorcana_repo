'use strict';

/**
 * Meta comparison service - SIMPLIFIED VERSION
 * Compares deck analysis against tournament meta data
 * NO EXTERNAL DEPENDENCIES (logger, errors, parsers removed)
 */

const fs = require('fs');
const path = require('path');

// Simple normalizeName fallback
let normalizeName = (name) => String(name || '').toLowerCase().trim();

try {
  const deckParser = require('../services/deckParser');
  if (typeof deckParser.normalizeName === 'function') {
    normalizeName = deckParser.normalizeName;
  }
} catch (error) {
  // Use fallback
}

// Simple parseIntOr
function parseIntOr(value, defaultValue) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * Resolve path to tournamentMeta.json file
 */
function resolveTournamentMetaPath(explicitPath) {
  const envPath = process.env.TOURNAMENT_META_PATH;

  const candidates = [
    explicitPath,
    envPath,
    path.join(__dirname, '..', 'db', 'tournamentMeta.json'),
    path.join(__dirname, '..', 'data', 'tournamentMeta.json'),
    path.join(process.cwd(), 'tournamentMeta.json'),
  ].filter(Boolean);

  for (const candidatePath of candidates) {
    try {
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    } catch (error) {
      // Skip
    }
  }

  return null;
}

/**
 * Load tournament meta data from JSON file
 */
function loadTournamentMeta(metaPath) {
  const resolvedPath = resolveTournamentMetaPath(metaPath);
  
  if (!resolvedPath) {
    const note = 'tournamentMeta.json not found';
    return { decks: [], note };
  }

  try {
    const rawData = fs.readFileSync(resolvedPath, 'utf-8');
    const json = JSON.parse(rawData);

    const rawDecks = Array.isArray(json) ? json : json.decks || json.items || [];
    const cleanedDecks = [];

    for (const deck of rawDecks) {
      if (!deck) continue;

      const cards = Array.isArray(deck.cards) ? deck.cards : [];
      const format = deck.format ? String(deck.format) : 'Core';

      cleanedDecks.push({
        ...deck,
        format: format === 'Infinity' ? 'Core' : format,
        cards,
        finish: parseFinish(deck),
      });
    }

    return { decks: cleanedDecks, note: '' };

  } catch (error) {
    const errorMsg = `Failed to load tournamentMeta.json: ${error.message}`;
    return { decks: [], note: errorMsg };
  }
}

/**
 * Parse finish/standing from deck object
 */
function parseFinish(deck) {
  const value = deck.finish ?? 
                deck.placement ?? 
                deck.standing ?? 
                deck.rank ?? 
                null;

  if (value == null) return null;
  if (typeof value === 'number') return value;

  const str = String(value).trim().toUpperCase();
  const match = str.match(/(\d{1,4})/);
  if (!match) return null;

  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}

/**
 * Convert deck analysis to card count map
 */
function analysisToCounts(analysis) {
  const counts = new Map();
  
  const cards = Array.isArray(analysis.cards) ? analysis.cards : [];
  for (const card of cards) {
    const normalizedName = card.normalizedName || normalizeName(card.name);
    if (!normalizedName) continue;
    
    const currentQty = counts.get(normalizedName) || 0;
    const addQty = Number(card.quantity) || 0;
    counts.set(normalizedName, currentQty + addQty);
  }
  
  return counts;
}

/**
 * Convert deck object to card count map
 */
function deckToCounts(deck) {
  const counts = new Map();
  
  const cards = Array.isArray(deck.cards) ? deck.cards : [];
  for (const card of cards) {
    const name = card.normalizedName || card.name;
    const normalizedName = normalizeName(name);
    if (!normalizedName) continue;
    
    const quantity = Number(card.count ?? card.quantity ?? card.qty ?? 0) || 0;
    const currentQty = counts.get(normalizedName) || 0;
    counts.set(normalizedName, currentQty + quantity);
  }
  
  return counts;
}

/**
 * Calculate similarity score between two decks
 */
function similarityScore(countsA, countsB) {
  let intersection = 0;
  let totalA = 0;
  let totalB = 0;

  for (const [, qty] of countsB.entries()) {
    totalB += qty;
  }

  for (const [cardName, qtyA] of countsA.entries()) {
    totalA += qtyA;
    const qtyB = countsB.get(cardName) || 0;
    intersection += Math.min(qtyA, qtyB);
  }

  if (totalA === 0) return 0;

  const overlapA = intersection / totalA;
  const denominator = totalA + totalB - intersection;
  const jaccardQ = denominator > 0 ? intersection / denominator : 0;

  return 0.75 * overlapA + 0.25 * jaccardQ;
}

/**
 * Compute aggregate statistics
 */
function computeAggregate(decks) {
  const count = decks.length;
  
  if (count === 0) {
    return {
      count: 0,
      bestFinish: null,
      avgFinish: null,
      top8Rate: null,
      byArchetype: {}
    };
  }

  let bestFinish = Infinity;
  let finishSum = 0;
  let finishCount = 0;
  let top8Count = 0;
  const byArchetype = {};

  for (const deck of decks) {
    const archetype = deck.archetype || 'Unknown';
    byArchetype[archetype] = (byArchetype[archetype] || 0) + 1;

    const finish = deck.finish ?? parseFinish(deck);
    if (typeof finish === 'number' && Number.isFinite(finish)) {
      bestFinish = Math.min(bestFinish, finish);
      finishSum += finish;
      finishCount += 1;
      
      if (finish <= 8) {
        top8Count += 1;
      }
    }
  }

  const avgFinish = finishCount > 0 
    ? Math.round((finishSum / finishCount) * 100) / 100 
    : null;
    
  const finalBestFinish = bestFinish === Infinity ? null : bestFinish;
  const top8Rate = finishCount > 0 ? top8Count / finishCount : null;

  return {
    count,
    bestFinish: finalBestFinish,
    avgFinish,
    top8Rate,
    byArchetype
  };
}

/**
 * Compare deck analysis against tournament meta
 */
function compareWithMeta(analysis, meta, options = {}) {
  const requestedTop = parseIntOr(options.top, 32);
  const sameFormat = options.sameFormat !== undefined ? !!options.sameFormat : true;
  const topK = parseIntOr(options.topK, 10);
  const minSim = typeof options.minSim === 'number' ? options.minSim : 0.08;

  const analysisFormat = analysis && analysis.format 
    ? String(analysis.format) 
    : 'Core';
  const normalizedFormat = analysisFormat === 'Infinity' ? 'Core' : analysisFormat;

  const allDecks = Array.isArray(meta.decks) ? meta.decks : [];

  if (allDecks.length === 0) {
    return {
      enabled: true,
      available: false,
      note: 'No tournament data available',
      similarDecks: [],
      aggregate: computeAggregate([]),
    };
  }

  // Filter decks
  const filteredDecks = allDecks.filter((deck) => {
    if (requestedTop) {
      const finish = deck.finish ?? parseFinish(deck);
      if (typeof finish === 'number' && Number.isFinite(finish) && finish > requestedTop) {
        return false;
      }
    }

    if (sameFormat && deck.format && String(deck.format) !== normalizedFormat) {
      return false;
    }

    return true;
  });

  // Calculate similarity
  const userDeckCounts = analysisToCounts(analysis);
  
  const scoredDecks = filteredDecks.map((deck) => {
    const metaDeckCounts = deckToCounts(deck);
    const similarity = similarityScore(userDeckCounts, metaDeckCounts);
    return { deck, similarity };
  });

  scoredDecks.sort((a, b) => b.similarity - a.similarity);

  let selectedDecks = scoredDecks
    .filter((item) => item.similarity >= minSim)
    .slice(0, topK);

  if (selectedDecks.length === 0) {
    selectedDecks = scoredDecks.slice(0, Math.min(topK, scoredDecks.length));
  }

  const similarDecks = selectedDecks.map(({ deck, similarity }) => ({
    score: Math.round(similarity * 1000) / 10,
    url: deck.url || deck.link || null,
    name: deck.name || deck.title || deck.archetype || 'Deck',
    archetype: deck.archetype || null,
    event: deck.event || null,
    date: deck.date || null,
    finish: deck.finish ?? parseFinish(deck),
  }));

  const aggregate = computeAggregate(filteredDecks);

  return {
    enabled: true,
    available: true,
    filters: { 
      top: requestedTop, 
      sameFormat: !!sameFormat 
    },
    requestedTop,
    comparedCount: filteredDecks.length,
    decksCount: allDecks.length,
    note: meta.note || '',
    similarDecks,
    aggregate,
  };
}

module.exports = {
  loadTournamentMeta,
  compareWithMeta,
  parseFinish,
  analysisToCounts,
  deckToCounts,
  similarityScore,
  computeAggregate,
};

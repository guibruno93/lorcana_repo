'use strict';

/**
 * Meta comparison service
 * Compares deck analysis against tournament meta data
 * @module parser/metaComparator
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger').child('MetaComparator');
const { NotFoundError, ParsingError } = require('../utils/errors');
const { parseIntOr } = require('../utils/parsers');

/**
 * Cache for tournament meta data
 * @type {{path: string|null, mtimeMs: number, data: Object|null}}
 */
let _cache = { path: null, mtimeMs: 0, data: null };

/**
 * Normalize card name for matching
 * Reuses normalization from deckParser service if available
 * @param {string} name - Card name to normalize
 * @returns {string} Normalized name
 */
let normalizeName = (name) => String(name || '').toLowerCase().trim();

try {
  const deckParser = require('./deckParser');
  if (typeof deckParser.normalizeName === 'function') {
    normalizeName = deckParser.normalizeName;
  }
} catch (error) {
  logger.warn('Could not load deckParser normalizeName, using simple normalization');
}

/**
 * Resolve path to tournamentMeta.json file
 * Checks multiple candidate locations
 * @param {string} [explicitPath] - Explicit path provided by caller
 * @returns {string|null} Resolved path or null if not found
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
        logger.debug('Found tournamentMeta.json', { path: candidatePath });
        return candidatePath;
      }
    } catch (error) {
      logger.warn('Error checking path', { path: candidatePath, error: error.message });
    }
  }

  logger.warn('tournamentMeta.json not found in any candidate location', { candidates });
  return null;
}

/**
 * Load tournament meta data from JSON file
 * Uses file mtime-based caching to avoid redundant reads
 * 
 * @param {string} [metaPath] - Optional explicit path to meta file
 * @returns {{decks: Array<Object>, note: string}} Tournament meta data
 * 
 * @example
 * const { decks, note } = loadTournamentMeta();
 * console.log(`Loaded ${decks.length} decks`);
 */
function loadTournamentMeta(metaPath) {
  const resolvedPath = resolveTournamentMetaPath(metaPath);
  
  if (!resolvedPath) {
    const note = 'tournamentMeta.json not found. Set TOURNAMENT_META_PATH or place in backend/db/tournamentMeta.json';
    logger.error(note);
    return { decks: [], note };
  }

  try {
    const stats = fs.statSync(resolvedPath);
    
    // Check cache validity
    if (_cache.data && 
        _cache.path === resolvedPath && 
        _cache.mtimeMs === stats.mtimeMs) {
      logger.debug('Using cached meta data', { path: resolvedPath });
      return _cache.data;
    }

    logger.info('Loading tournament meta', { path: resolvedPath });
    const rawData = fs.readFileSync(resolvedPath, 'utf-8');
    const json = JSON.parse(rawData);

    const rawDecks = Array.isArray(json) ? json : json.decks || json.items || [];
    const cleanedDecks = [];

    for (const deck of rawDecks) {
      if (!deck) continue;

      const cards = Array.isArray(deck.cards) ? deck.cards : [];
      
      // Normalize format (Core-only for now)
      const format = deck.format ? String(deck.format) : 'Core';

      cleanedDecks.push({
        ...deck,
        format: format === 'Infinity' ? 'Core' : format,
        cards,
        finish: parseFinish(deck), // Pre-parse finish for filtering
      });
    }

    const result = { decks: cleanedDecks, note: '' };
    
    // Update cache
    _cache = {
      path: resolvedPath,
      mtimeMs: stats.mtimeMs,
      data: result
    };

    logger.info('Meta data loaded successfully', {
      path: resolvedPath,
      deckCount: cleanedDecks.length
    });

    return result;

  } catch (error) {
    const errorMsg = `Failed to load tournamentMeta.json: ${error.message}`;
    logger.error(errorMsg, { path: resolvedPath, error });
    return { decks: [], note: errorMsg };
  }
}

/**
 * Convert deck analysis to card count map
 * @param {Object} analysis - Deck analysis object
 * @returns {Map<string, number>} Map of normalized name to quantity
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
 * @param {Object} deck - Tournament deck object
 * @returns {Map<string, number>} Map of normalized name to quantity
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
 * Uses weighted overlap and Jaccard similarity
 * 
 * @param {Map<string, number>} countsA - Card counts for deck A
 * @param {Map<string, number>} countsB - Card counts for deck B
 * @returns {number} Similarity score (0-1)
 * 
 * Formula: 0.75 * overlapA + 0.25 * jaccardQ
 * - overlapA: Intersection weighted by quantity / total of deck A
 * - jaccardQ: Weighted Jaccard using min(qtyA, qtyB) for intersection
 */
function similarityScore(countsA, countsB) {
  let intersection = 0;
  let totalA = 0;
  let totalB = 0;

  // Calculate totals for B
  for (const [, qty] of countsB.entries()) {
    totalB += qty;
  }

  // Calculate intersection and totalA
  for (const [cardName, qtyA] of countsA.entries()) {
    totalA += qtyA;
    const qtyB = countsB.get(cardName) || 0;
    intersection += Math.min(qtyA, qtyB);
  }

  if (totalA === 0) {
    logger.warn('Deck A has zero total cards');
    return 0;
  }

  const overlapA = intersection / totalA;
  const denominator = totalA + totalB - intersection;
  const jaccardQ = denominator > 0 ? intersection / denominator : 0;

  return 0.75 * overlapA + 0.25 * jaccardQ;
}

/**
 * Parse finish/standing from deck object
 * Extracts numeric placement from various fields
 * 
 * @param {Object} deck - Deck object
 * @returns {number|null} Numeric finish position or null
 * 
 * @example
 * parseFinish({ standing: '2nd' }) // => 2
 * parseFinish({ standing: 'TOP 32' }) // => 32
 * parseFinish({ placement: 5 }) // => 5
 */
function parseFinish(deck) {
  const value = deck.finish ?? 
                deck.placement ?? 
                deck.standing ?? 
                deck.rank ?? 
                deck.rankLabel ?? 
                null;

  if (value == null) return null;
  if (typeof value === 'number') return value;

  const str = String(value).trim().toUpperCase();
  
  // Extract first number from string (e.g., "2ND", "TOP 32", "#12")
  const match = str.match(/(\d{1,4})/);
  if (!match) return null;

  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}

/**
 * Compute aggregate statistics for a set of decks
 * 
 * @param {Array<Object>} decks - Array of deck objects
 * @returns {Object} Aggregate statistics
 * @property {number} count - Number of decks
 * @property {number|null} bestFinish - Best (lowest) finish position
 * @property {number|null} avgFinish - Average finish position
 * @property {number|null} top8Rate - Percentage of Top 8 finishes
 * @property {Object<string, number>} byArchetype - Deck count by archetype
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
    // Count by archetype
    const archetype = deck.archetype || 'Unknown';
    byArchetype[archetype] = (byArchetype[archetype] || 0) + 1;

    // Process finish
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
 * Finds similar decks and computes aggregate statistics
 * 
 * @param {Object} analysis - Deck analysis from parser
 * @param {Object} [options] - Comparison options
 * @param {number} [options.top=32] - Filter to top N finishes
 * @param {boolean} [options.sameFormat=true] - Only compare same format
 * @param {number} [options.topK=10] - Number of similar decks to return
 * @param {number} [options.minSim=0.08] - Minimum similarity threshold
 * @param {string} [options.metaPath] - Path to meta file
 * @param {Array<Object>} [options.decks] - Pre-loaded decks (skip file load)
 * 
 * @returns {Object} Comparison result
 * @property {boolean} enabled - Comparison was enabled
 * @property {boolean} available - Meta data was available
 * @property {Object} filters - Applied filters
 * @property {number} requestedTop - Requested top N filter
 * @property {number} comparedCount - Number of decks compared
 * @property {number} decksCount - Total decks in meta
 * @property {string} note - Additional notes or errors
 * @property {Array<Object>} similarDecks - Most similar decks
 * @property {Object} aggregate - Aggregate statistics
 * 
 * @example
 * const analysis = analyzeDeck(decklistText);
 * const comparison = compareAnalysisToMeta(analysis, { top: 32, topK: 10 });
 * console.log(`Found ${comparison.similarDecks.length} similar decks`);
 */
function compareAnalysisToMeta(analysis, options = {}) {
  // Parse options with backward compatibility
  const requestedTop = parseIntOr(
    options.top ?? options.onlyTop ?? options.requestedTop,
    32
  );
  
  const sameFormat = options.sameFormat !== undefined ? !!options.sameFormat : true;
  const topK = parseIntOr(options.topK, 10);
  const minSim = typeof options.minSim === 'number' ? options.minSim : 0.08;

  logger.info('Starting meta comparison', {
    requestedTop,
    sameFormat,
    topK,
    minSim
  });

  // Normalize format (Core-only for now)
  const analysisFormat = analysis && analysis.format 
    ? String(analysis.format) 
    : 'Core';
  const normalizedFormat = analysisFormat === 'Infinity' ? 'Core' : analysisFormat;

  // Load decks from options or file
  const decksFromOptions = Array.isArray(options.decks) ? options.decks : null;
  const { decks: loadedDecks, note } = decksFromOptions 
    ? { decks: decksFromOptions, note: '' }
    : loadTournamentMeta(options.metaPath);

  const allDecks = Array.isArray(loadedDecks) ? loadedDecks : [];

  if (allDecks.length === 0) {
    logger.warn('No decks available for comparison');
  }

  // Apply filters
  const filteredDecks = allDecks.filter((deck) => {
    // Filter by top N finish
    if (requestedTop) {
      const finish = deck.finish ?? parseFinish(deck);
      if (typeof finish === 'number' && Number.isFinite(finish) && finish > requestedTop) {
        return false;
      }
    }

    // Filter by format
    if (sameFormat && deck.format && String(deck.format) !== normalizedFormat) {
      return false;
    }

    return true;
  });

  logger.debug('Decks filtered', {
    total: allDecks.length,
    filtered: filteredDecks.length,
    requestedTop,
    sameFormat
  });

  // Calculate similarity scores
  const userDeckCounts = analysisToCounts(analysis);
  
  const scoredDecks = filteredDecks.map((deck) => {
    const metaDeckCounts = deckToCounts(deck);
    const similarity = similarityScore(userDeckCounts, metaDeckCounts);
    return { deck, similarity };
  });

  // Sort by similarity (descending)
  scoredDecks.sort((a, b) => b.similarity - a.similarity);

  // Select top K decks above threshold
  let selectedDecks = scoredDecks
    .filter((item) => item.similarity >= minSim)
    .slice(0, topK);

  // If no decks above threshold, return top K anyway
  if (selectedDecks.length === 0) {
    selectedDecks = scoredDecks.slice(0, Math.min(topK, scoredDecks.length));
    logger.debug('No decks above similarity threshold, returning top K', { topK });
  }

  // Format similar decks for response
  const similarDecks = selectedDecks.map(({ deck, similarity }) => ({
    score: Math.round(similarity * 1000) / 10, // Convert to percentage
    url: deck.url || deck.link || null,
    name: deck.name || deck.title || deck.archetype || 'Deck',
    archetype: deck.archetype || null,
    event: deck.event || null,
    date: deck.date || null,
    finish: deck.finish ?? parseFinish(deck),
  }));

  // Compute aggregate statistics
  const aggregate = computeAggregate(filteredDecks);

  logger.info('Meta comparison complete', {
    similarDecksFound: similarDecks.length,
    aggregateCount: aggregate.count
  });

  return {
    enabled: true,
    available: allDecks.length > 0,
    filters: { 
      top: requestedTop, 
      sameFormat: !!sameFormat 
    },
    requestedTop,
    comparedCount: filteredDecks.length,
    decksCount: allDecks.length,
    note: note || '',
    similarDecks,
    aggregate,
  };
}

/**
 * Legacy compatibility wrapper
 * Supports both old and new calling conventions
 * 
 * @param {Object} analysis - Deck analysis
 * @param {Array<Object>|Object} decksOrOptions - Decks array or options object
 * @param {Object} [maybeOptions] - Options if second param is decks array
 * @returns {Object} Comparison result
 */
function compareToTournamentMeta(analysis, decksOrOptions, maybeOptions) {
  if (Array.isArray(decksOrOptions)) {
    return compareAnalysisToMeta(analysis, {
      ...(maybeOptions || {}),
      decks: decksOrOptions
    });
  }
  return compareAnalysisToMeta(analysis, decksOrOptions || {});
}

module.exports = {
  loadTournamentMeta,
  compareAnalysisToMeta,
  compareToTournamentMeta,
  // Export internals for testing
  _internal: {
    similarityScore,
    parseFinish,
    computeAggregate,
    analysisToCounts,
    deckToCounts
  }
};

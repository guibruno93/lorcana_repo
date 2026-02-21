/**
 * backend/parser/analyzeDeck.js
 * 
 * Wrapper que usa o deckParser para análise
 */

"use strict";

const { analyzeDeck } = require("../services/deckParser");

// Try to load metaComparator (optional)
let loadTournamentMeta, compareWithMeta;
try {
  const metaComparator = require("./metaComparator");
  loadTournamentMeta = metaComparator.loadTournamentMeta;
  compareWithMeta = metaComparator.compareWithMeta;
} catch (error) {
  console.warn("⚠️  metaComparator not available:", error.message);
  loadTournamentMeta = null;
  compareWithMeta = null;
}

async function analyzeDeckFromDecklist(decklistText, opts = {}) {
  const { compare = false, top = 32, sameFormat = true } = opts;

  // Análise básica do deck
  const deckAnalysis = analyzeDeck(decklistText, opts);

  // Se não pediu comparação ou metaComparator não está disponível
  if (!compare || !loadTournamentMeta || !compareWithMeta) {
    return {
      ...deckAnalysis,
      metaComparison: null,
    };
  }

  // Carregar meta e comparar
  try {
    const metaPath = opts.metaPath || null;
    const meta = loadTournamentMeta(metaPath);

    if (!meta || !meta.decks || meta.decks.length === 0) {
      console.warn("⚠️  Meta data not available for comparison");
      return { ...deckAnalysis, metaComparison: null };
    }

    const metaComparison = compareWithMeta(deckAnalysis, meta, {
      top,
      sameFormat,
    });

    return {
      ...deckAnalysis,
      metaComparison,
    };
  } catch (err) {
    console.error("❌ Error loading meta:", err.message);
    return { ...deckAnalysis, metaComparison: null };
  }
}

module.exports = analyzeDeckFromDecklist;
module.exports.analyzeDeckFromDecklist = analyzeDeckFromDecklist;

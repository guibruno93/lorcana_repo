// backend/parser/analyzeDeck.js
"use strict";

const { analyzeDeck: analyzeDeckCore } = require("./deckParser");
const { loadMetaState } = require("../services/metaIndex");
const { compareAnalysisToMeta } = require("./metaComparator");

function countComparedDecks(metaState, analysis, { onlyTop = 0, sameFormat = true } = {}) {
  const decks = Array.isArray(metaState?.decks) ? metaState.decks : [];
  const targetFormat = String(analysis?.format || "").toLowerCase();

  let n = 0;
  for (const d of decks) {
    if (sameFormat) {
      const df = String(d?.format || "").toLowerCase();
      if (targetFormat && df && df !== targetFormat) continue;
    }
    if (onlyTop > 0) {
      const f = Number(d?.finish);
      if (!Number.isFinite(f) || f > onlyTop) continue;
    }
    // precisa ter counts/totalQty pra comparar
    if (!d?.counts || !(Number(d?.totalQty) > 0)) continue;
    n++;
  }
  return n;
}

/**
 * deckText -> análise + (opcional) comparação com meta (determinística)
 * opts:
 *  - compare (default true)
 *  - onlyTop (default 0) / top (alias)
 *  - topK (default 10)
 *  - metaPath (opcional)
 *  - sameFormat (default true)
 */
function analyzeDeckFromDecklist(deckText, opts = {}) {
  const analysis = analyzeDeckCore(deckText, opts);

  const compare = opts?.compare !== false;
  if (!compare) {
    return {
      ...analysis,
      metaComparison: { enabled: false },
      metaComparisonDeterministic: { enabled: false },
    };
  }

  const onlyTop = Number(opts?.onlyTop ?? opts?.top ?? 0) || 0;
  const topK = Number(opts?.topK ?? 10) || 10;
  const sameFormat = opts?.sameFormat !== false;

  let metaState;
  try {
    metaState = loadMetaState(opts?.metaPath || undefined);
  } catch (e) {
    return {
      ...analysis,
      metaComparison: {
        enabled: false,
        error: `Falha ao carregar meta: ${e?.message || String(e)}`,
      },
      metaComparisonDeterministic: {
        enabled: false,
        error: `Falha ao carregar meta: ${e?.message || String(e)}`,
      },
    };
  }

  const det = compareAnalysisToMeta(analysis, metaState, {
    topK,
    onlyTop,
    sameFormat,
  });

  const comparedCount = countComparedDecks(metaState, analysis, { onlyTop, sameFormat });

  const similarDecks = (det.top || []).map((r) => ({
    similarity: r.similarity,
    url: r.url || null,
    title:
      r.event ||
      r.archetype ||
      r.url ||
      "Deck",
    placement: r.standing || r.rankLabel || (Number.isFinite(Number(r.finish)) ? `Top ${r.finish}` : null),
    inks: null,
  }));

  const metaComparison = {
    enabled: true,
    requestedTop: onlyTop > 0 ? onlyTop : null,
    comparedCount,
    note: "Similaridade por Jaccard ponderado (quantidade de cópias).",
    filters: { sameInksPreferred: false },
    similarDecks,
    aggregate: det.aggregate,
  };

  return {
    ...analysis,
    metaComparison,                 // ✅ usado pelo seu MetaComparison.jsx
    metaComparisonDeterministic: metaComparison, // ✅ alias p/ compat
  };
}

/**
 * Opcional: caso você tenha um scrape já em cards[] e queira analisar sem texto.
 * Aceita objeto tipo { cards: [{ quantity, name, normalizedName, ...}] }
 */
function analyzeDeckFromScrape(scrape, opts = {}) {
  const cards = Array.isArray(scrape?.cards) ? scrape.cards : [];
  // reutiliza o analyzeDeckCore que aceita array também (ele faz Array.isArray(deckText))
  const analysis = analyzeDeckCore(cards, opts);

  // Reaproveita a mesma comparação
  return analyzeDeckFromDecklist(cards, opts); // funciona pois analyzeDeckCore aceita array
}

module.exports = {
  analyzeDeckFromDecklist,
  analyzeDeckFromScrape,

  // mantém compat com o que você já tem hoje:
  analyzeDeck: analyzeDeckCore,
};

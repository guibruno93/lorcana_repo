// backend/parser/metaComparator.js
"use strict";

const fs = require("fs");
const path = require("path");
const { normalizeName } = require("./normalize");

const DEFAULT_META_PATH = path.join(__dirname, "../db/tournamentMeta.json");

function safeReadJSON(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Mantém compat com scripts antigos:
 * - se o arquivo for { decks: [...] }, usa decks
 * - se for array, usa o array
 */
function loadTournamentMeta(metaPath = DEFAULT_META_PATH) {
  const raw = safeReadJSON(metaPath);
  if (!raw) return { schemaVersion: 1, source: "inkdecks", updatedAt: null, decks: [] };
  if (Array.isArray(raw)) return { schemaVersion: 1, source: "inkdecks", updatedAt: null, decks: raw };
  if (raw && Array.isArray(raw.decks)) return raw;
  return { schemaVersion: 1, source: raw?.source ?? "inkdecks", updatedAt: raw?.updatedAt ?? null, decks: [] };
}

function qtyFrom(x) {
  const q = Number(x?.quantity ?? x?.qty ?? x?.count ?? 0);
  return Number.isFinite(q) ? q : 0;
}

function keyFromCardName(nameOrNormalized) {
  const k = normalizeName(nameOrNormalized || "");
  return k || null;
}

function buildCountsFromCards(cards) {
  const counts = Object.create(null);
  let total = 0;

  for (const c of Array.isArray(cards) ? cards : []) {
    const q = qtyFrom(c);
    if (q <= 0) continue;

    const key = keyFromCardName(c?.normalizedName || c?.name);
    if (!key) continue;

    counts[key] = (counts[key] || 0) + q;
    total += q;
  }

  return { counts, totalQty: total };
}

function parseDeckCardEntry(entry) {
  if (typeof entry === "string") {
    const raw = String(entry).replace(/\u00A0/g, " ").trim();
    const m = raw.match(/^(\d+)\s*(?:x|×)?\s+(.+?)\s*$/i);
    if (m) return { count: Number(m[1]) || 0, name: String(m[2]).trim() };
    return { count: 0, name: raw };
  }

  const raw = String(entry?.name || entry?.cardName || entry?.card || "")
    .replace(/\u00A0/g, " ")
    .trim();

  const m = raw.match(/^(\d+)\s*(?:x|×)?\s+(.+?)\s*$/i);
  if (m) return { count: Number(m[1]) || 0, name: String(m[2]).trim() };

  const count = Number(entry?.count ?? entry?.quantity ?? entry?.qty ?? 0) || 0;
  return { count, name: raw };
}

/**
 * Converte um deck do meta em counts normalizados.
 * Suporta:
 * - deck.counts (obj)
 * - deck.cards (array com quantity/name)
 * - deck.rawCards (array legado)
 */
function buildCountsFromMetaDeck(deck) {
  // 1) caso já venha pronto (metaIndex)
  if (deck && typeof deck.counts === "object" && deck.counts) {
    const counts = Object.create(null);
    let total = 0;

    for (const [k, v] of Object.entries(deck.counts)) {
      const key = keyFromCardName(k);
      const q = Number(v) || 0;
      if (!key || q <= 0) continue;
      counts[key] = (counts[key] || 0) + q;
      total += q;
    }
    return { counts, totalQty: Number(deck.totalQty) > 0 ? Number(deck.totalQty) : total };
  }

  // 2) caso venha em cards[]
  const arr = Array.isArray(deck?.cards) ? deck.cards : Array.isArray(deck?.rawCards) ? deck.rawCards : [];
  const counts = Object.create(null);
  let total = 0;

  for (const e of arr) {
    const { count, name } = parseDeckCardEntry(e);
    if (!count || !name) continue;
    const key = keyFromCardName(name);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + count;
    total += count;
  }

  return { counts, totalQty: Number(deck?.totalQty) > 0 ? Number(deck.totalQty) : total };
}

// Jaccard ponderado (min/max por carta)
function weightedJaccardCounts(aCounts, bCounts) {
  const keys = new Set([...Object.keys(aCounts || {}), ...Object.keys(bCounts || {})]);
  let inter = 0;
  let uni = 0;

  for (const k of keys) {
    const av = aCounts[k] || 0;
    const bv = bCounts[k] || 0;
    inter += Math.min(av, bv);
    uni += Math.max(av, bv);
  }

  return { score: uni ? inter / uni : 0, inter, uni };
}

function parseFinishLabel(label) {
  const s = String(label || "").trim();
  if (!s) return null;

  // Top32 / Top 32 / TOP16 etc
  const mTop = s.match(/^top\s*(\d+)$/i) || s.match(/^top(\d+)$/i);
  if (mTop) return Number(mTop[1]);

  // 1st / 2nd / 3rd / 4th...
  const mOrd = s.match(/^(\d+)(st|nd|rd|th)$/i);
  if (mOrd) return Number(mOrd[1]);

  // 1-4, 5-8 (usa o melhor)
  const mRange = s.match(/^(\d+)\s*(?:st|nd|rd|th)?\s*-\s*(\d+)\s*(?:st|nd|rd|th)?$/i);
  if (mRange) return Number(mRange[1]);

  if (/winner|champion/i.test(s)) return 1;

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function finishOf(deck) {
  const direct = Number(deck?.finish ?? deck?.bestFinish ?? deck?.tournament?.bestFinish ?? null);
  if (Number.isFinite(direct) && direct > 0) return direct;

  return parseFinishLabel(deck?.standing ?? deck?.rankLabel ?? deck?.placement ?? deck?.tournament?.placementText ?? null);
}

function titleOf(deck) {
  return deck?.deckName || deck?.name || deck?.event || deck?.archetype || deck?.url || "Deck";
}

/**
 * ✅ API principal para o backend:
 * compareAnalysisToMeta(analysis, metaState, opts)
 *
 * opts:
 * - topK (default 10)
 * - onlyTop (0 = sem filtro)  // ex: 32, 16, 8
 * - sameFormat (default true)
 */
function compareAnalysisToMeta(analysis, metaState, opts = {}) {
  const topK = Math.max(1, Number(opts.topK ?? opts.top ?? 10) || 10);
  const onlyTop = Number(opts.onlyTop ?? opts.topFinish ?? opts.topFilter ?? 0) || 0;
  const sameFormat = opts.sameFormat !== false;

  const analysisFormat = String(analysis?.format || "").toLowerCase();
  const { counts: aCounts, totalQty: aTotal } = buildCountsFromCards(analysis?.cards || []);

  // metaState pode vir:
  // - de services/metaIndex (obj com decks[])
  // - de loadTournamentMeta (obj com decks[])
  // - ou direto como array
  const decks =
    Array.isArray(metaState)
      ? metaState
      : Array.isArray(metaState?.decks)
      ? metaState.decks
      : Array.isArray(metaState?.state?.decks)
      ? metaState.state.decks
      : [];

  const rows = [];
  let comparedCount = 0;

  for (const d of decks) {
    if (sameFormat) {
      const df = String(d?.format || "").toLowerCase();
      if (analysisFormat && df && df !== analysisFormat) continue;
    }

    const fin = finishOf(d);
    if (onlyTop > 0) {
      // se não sabemos o finish, não entra no filtro
      if (!Number.isFinite(fin)) continue;
      if (fin > onlyTop) continue;
    }

    const { counts: dCounts, totalQty: dTotal } = buildCountsFromMetaDeck(d);
    if (!dTotal) continue;

    comparedCount++;
    const { score, inter } = weightedJaccardCounts(aCounts, dCounts);

    rows.push({
      url: d?.url ?? null,
      title: titleOf(d),
      event: d?.event ?? null,
      archetype: d?.archetype ?? null,
      format: d?.format ?? null,
      standing: d?.standing ?? d?.rankLabel ?? null,
      players: d?.players ?? d?.tournament?.players ?? null,
      finish: fin,
      similarity: Number((score * 100).toFixed(2)),
      sharedQty: Math.round(inter),
      totalQty: Number(d?.totalQty) > 0 ? Number(d.totalQty) : dTotal,
      queryTotalQty: aTotal,
    });
  }

  rows.sort((a, b) => b.similarity - a.similarity);

  const top = rows.slice(0, topK);

  // agregados simples
  const aggregate = {
    count: top.length,
    comparedCount,
    bestFinish: null,
    avgFinish: null,
    top8Rate: null,
    byArchetype: {},
  };

  const finishes = top.map((r) => r.finish).filter((n) => Number.isFinite(n));
  if (finishes.length) {
    aggregate.bestFinish = Math.min(...finishes);
    aggregate.avgFinish = Number((finishes.reduce((s, n) => s + n, 0) / finishes.length).toFixed(2));
    aggregate.top8Rate = Number(((finishes.filter((n) => n <= 8).length / finishes.length) * 100).toFixed(1));
  }

  for (const r of top) {
    const k = r.archetype || "Unknown";
    aggregate.byArchetype[k] = (aggregate.byArchetype[k] || 0) + 1;
  }

  return { top, aggregate, comparedCount };
}

/**
 * Compat com scripts/uso antigo
 */
function compareToTournamentMeta(analysis, metaState, opts = {}) {
  return compareAnalysisToMeta(analysis, metaState, {
    topK: opts.top ?? opts.topK ?? 10,
    sameFormat: opts.sameFormat !== false,
    // aqui o antigo "top" era topK, então não aplicamos filtro.
    onlyTop: 0,
  });
}

module.exports = {
  loadTournamentMeta,
  compareToTournamentMeta,
  // ✅ aliases para acabar com o erro:
  compareAnalysisToMeta,
  compareToMeta: compareAnalysisToMeta,
};

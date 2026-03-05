'use strict';

/**
 * Meta Comparator v2 — Adds & Cuts com dados reais de torneio
 * Usa os 440 decks locais como fonte de verdade
 */

const fs = require('fs');
const path = require('path');

// ─── helpers ──────────────────────────────────────────────────────────────────

function findDb() {
  const candidates = [
    path.join(__dirname, '../../db/tournamentMeta.json'),
    path.join(__dirname, '../db/tournamentMeta.json'),
    path.join(process.cwd(), 'backend/db/tournamentMeta.json'),
    path.join(process.cwd(), 'db/tournamentMeta.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadMeta() {
  const p = findDb();
  if (!p) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(raw) ? raw : (raw.decks || []);
  } catch { return []; }
}

/** Converte standing string → number (TOP8 → 8, 1ST → 1, etc.) */
function standingToNum(s) {
  if (!s) return 999;
  const m = String(s).match(/(\d+)/);
  if (m) return parseInt(m[1]);
  if (/1ST|FIRST|WINNER/i.test(s)) return 1;
  if (/2ND/i.test(s)) return 2;
  if (/3RD/i.test(s)) return 3;
  return 999;
}

/** Peso de colocação: 1st = 1.0, TOP8 = 0.7, TOP32 = 0.4, resto = 0.2 */
function placementWeight(standing) {
  const n = standingToNum(standing);
  if (n <= 1)  return 1.00;
  if (n <= 4)  return 0.90;
  if (n <= 8)  return 0.75;
  if (n <= 16) return 0.60;
  if (n <= 32) return 0.45;
  if (n <= 64) return 0.30;
  return 0.15;
}

/** Mapa nome→quantidade para um deck */
function deckCounts(cards) {
  const m = new Map();
  for (const c of (cards || [])) {
    const k = (c.name || '').toLowerCase().trim();
    if (k) m.set(k, (m.get(k) || 0) + (Number(c.quantity) || 1));
  }
  return m;
}

/** Similaridade Jaccard ponderada por quantidade */
function jaccardSim(a, b) {
  let inter = 0, union = 0;
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const k of keys) {
    const qa = a.get(k) || 0, qb = b.get(k) || 0;
    inter += Math.min(qa, qb);
    union += Math.max(qa, qb);
  }
  return union === 0 ? 0 : inter / union;
}

// ─── Adds & Cuts ──────────────────────────────────────────────────────────────

/**
 * Retorna adds, cuts e decks similares para um deck do usuário.
 *
 * @param {Object} deckAnalysis  — resultado do analyzeDeck (tem .cards, .inks, .archetype)
 * @param {Object} opts
 * @param {number} opts.top      — considerar só decks com standing ≤ top (default 32)
 * @param {boolean} opts.sameFormat — filtrar por mesmo formato (default true)
 * @param {number} opts.minSim  — similaridade mínima 0‥1 (default 0.20)
 * @param {number} opts.maxPool — tamanho máximo do pool de decks similares (default 30)
 */
function compareWithMeta(deckAnalysis, opts = {}) {
  const { top = 32, sameFormat = true, minSim = 0.20, maxPool = 30 } = opts;

  const allDecks = loadMeta();
  if (!allDecks.length) {
    return { enabled: true, note: 'Tournament database not found', similarDecks: [], adds: [], cuts: [] };
  }

  const userCounts = deckCounts(deckAnalysis.cards || []);
  const userFormat = (deckAnalysis.format || 'Core').toLowerCase();

  // 1. Filtrar por formato e colocação
  let pool = allDecks.filter(d => {
    if (sameFormat && d.format && d.format.toLowerCase() !== userFormat) return false;
    const n = standingToNum(d.standing || d.rankLabel || '');
    return n <= top;
  });

  // 2. Calcular similaridade
  const scored = pool
    .map(d => {
      const dc = deckCounts(d.cards || []);
      const sim = jaccardSim(userCounts, dc);
      const w = placementWeight(d.standing || d.rankLabel);
      return { deck: d, sim, weight: w, score: sim * (0.5 + 0.5 * w) };
    })
    .filter(d => d.sim >= minSim)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPool);

  if (!scored.length) {
    return {
      enabled: true,
      note: `No similar decks found in top-${top} (${pool.length} decks checked)`,
      totalChecked: pool.length,
      similarDecks: [],
      adds: [],
      cuts: [],
      aggregate: null,
    };
  }

  // 3. Frequência ponderada de cada carta no pool
  const cardFreq = new Map(); // name → { display, weightedCount, totalWeight, deckCount }
  const totalPoolWeight = scored.reduce((s, d) => s + d.weight, 0);
  const poolSize = scored.length;

  for (const { deck, sim, weight } of scored) {
    for (const c of (deck.cards || [])) {
      const key = (c.name || '').toLowerCase().trim();
      const display = c.name || key;
      if (!key) continue;
      if (!cardFreq.has(key)) {
        cardFreq.set(key, { display, weightedCount: 0, totalWeight: 0, deckCount: 0, totalQty: 0 });
      }
      const f = cardFreq.get(key);
      const qty = Number(c.quantity) || 1;
      f.weightedCount += qty * weight * sim; // ponderado por standing + similaridade
      f.totalWeight += weight * sim;
      f.deckCount++;
      f.totalQty += qty;
    }
  }

  // 4. Normalizar e calcular metaQty / presença
  const cardStats = [];
  for (const [key, f] of cardFreq) {
    const presence = f.deckCount / poolSize;        // % dos decks similares que usam
    const avgQty   = f.totalWeight > 0 ? f.weightedCount / f.totalWeight : 0; // qty média ponderada
    const userQty  = userCounts.get(key) || 0;

    cardStats.push({
      key,
      name: f.display,
      presence,          // 0‥1
      metaAvgQty: Math.round(avgQty * 10) / 10,
      userQty,
      diff: avgQty - userQty,
    });
  }

  // 5. Adds: carta no meta, ausente ou sub-usada no deck do usuário
  const adds = cardStats
    .filter(c => c.presence >= 0.45 && c.diff >= 0.8 && c.userQty < Math.ceil(c.metaAvgQty))
    .map(c => ({
      name: c.name,
      metaPresence: Math.round(c.presence * 100),
      metaAvgQty: c.metaAvgQty,
      yourQty: c.userQty,
      suggestedQty: Math.min(4, Math.ceil(c.metaAvgQty)),
      priority: c.presence >= 0.75 ? 'High' : c.presence >= 0.55 ? 'Medium' : 'Low',
    }))
    .sort((a, b) => b.metaPresence - a.metaPresence)
    .slice(0, 12);

  // 6. Cuts: carta no deck do usuário, rara ou ausente no meta similar
  const cuts = cardStats
    .filter(c => c.userQty > 0 && c.presence < 0.30 && c.diff < -0.5)
    .concat(
      // Também buscar cartas do user que não aparecem no meta
      [...userCounts.entries()]
        .filter(([k]) => !cardFreq.has(k))
        .map(([k, q]) => ({
          key: k, name: k, presence: 0, metaAvgQty: 0, userQty: q, diff: -q
        }))
    )
    .map(c => ({
      name: c.name,
      yourQty: c.userQty,
      metaPresence: Math.round((c.presence || 0) * 100),
      metaAvgQty: c.metaAvgQty || 0,
      suggestedCut: Math.min(c.userQty, Math.ceil(Math.abs(c.diff))),
      priority: (c.presence || 0) < 0.10 ? 'High' : (c.presence || 0) < 0.20 ? 'Medium' : 'Low',
    }))
    .sort((a, b) => a.metaPresence - b.metaPresence)
    .slice(0, 12);

  // 7. Similar decks para exibição
  const similarDecks = scored.slice(0, 8).map(({ deck, sim }) => ({
    score: Math.round(sim * 100),
    archetype: deck.archetype || deck.title || 'Unknown',
    inks: deck.inks || [],
    finish: deck.standing || deck.rankLabel || '-',
    event: deck.event || '-',
    date: deck.date || null,
    url: deck.url || null,
  }));

  // 8. Aggregate
  const finishes = scored.map(d => standingToNum(d.deck.standing || d.deck.rankLabel));
  const aggregate = {
    count: scored.length,
    bestFinish: Math.min(...finishes),
    avgFinish: Math.round(finishes.reduce((a, b) => a + b, 0) / finishes.length),
    top8Rate: finishes.filter(f => f <= 8).length / finishes.length,
  };

  return {
    enabled: true,
    totalChecked: pool.length,
    filters: { top, sameFormat },
    aggregate,
    similarDecks,
    adds,
    cuts,
  };
}

module.exports = { compareWithMeta };

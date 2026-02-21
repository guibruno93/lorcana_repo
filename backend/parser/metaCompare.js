// backend/parser/metaCompare.js
const fs = require("fs");
const path = require("path");
const { normalizeName } = require("./normalize");

const META_PATH = path.join(__dirname, "../db/tournamentMeta.json");

function loadTournamentMeta() {
  if (!fs.existsSync(META_PATH)) return { schemaVersion: 2, decks: [] };

  const raw = JSON.parse(fs.readFileSync(META_PATH, "utf8"));
  if (Array.isArray(raw)) return { schemaVersion: 2, decks: raw };
  if (raw && Array.isArray(raw.decks)) return raw;

  return { schemaVersion: 2, decks: [] };
}

function qtyOf(c) {
  const q = Number(c?.quantity ?? c?.qty ?? 0);
  return Number.isFinite(q) ? q : 0;
}

function keyOf(c) {
  const id = c?.cardId ?? c?.code ?? c?.id ?? null;
  if (id !== null && id !== undefined && String(id).trim() !== "") return `id:${String(id)}`;

  const nn = normalizeName(c?.normalizedName || c?.name || "");
  return nn ? `n:${nn}` : null;
}

function buildVector(cards) {
  const m = new Map();
  let total = 0;

  for (const c of Array.isArray(cards) ? cards : []) {
    const q = qtyOf(c);
    if (q <= 0) continue;
    const k = keyOf(c);
    if (!k) continue;

    m.set(k, (m.get(k) || 0) + q);
    total += q;
  }

  return { map: m, totalQty: total };
}

function weightedJaccard(a, b) {
  const keys = new Set([...a.map.keys(), ...b.map.keys()]);
  let inter = 0;
  let uni = 0;

  for (const k of keys) {
    const av = a.map.get(k) || 0;
    const bv = b.map.get(k) || 0;
    inter += Math.min(av, bv);
    uni += Math.max(av, bv);
  }

  return uni ? inter / uni : 0;
}

function parseFinish(label) {
  const s = String(label || "").trim();
  if (!s) return null;

  if (/^(winner|champion)$/i.test(s)) return 1;
  if (/^(finalist|runner-up)$/i.test(s)) return 2;
  if (/^semifinalist$/i.test(s)) return 4;
  if (/^quarterfinalist$/i.test(s)) return 8;

  const mTop = s.match(/^Top\s*(\d+)$/i);
  if (mTop) return Number(mTop[1]);

  const mTop2 = s.match(/^Top(\d+)$/i);
  if (mTop2) return Number(mTop2[1]);

  const mOrd = s.match(/^(\d+)(st|nd|rd|th)$/i);
  if (mOrd) return Number(mOrd[1]);

  return null;
}

function compareToMeta(analysis, metaState, opts = {}) {
  const top = Math.max(1, Number(opts.top || 10));
  const sameFormat = opts.sameFormat !== false;

  const targetVec = buildVector(analysis?.cards || []);
  const targetFormat = String(analysis?.format || "").toLowerCase();

  const decks = Array.isArray(metaState?.decks) ? metaState.decks : [];
  const rows = [];

  for (const d of decks) {
    if (sameFormat) {
      const df = String(d?.format || "").toLowerCase();
      if (targetFormat && df && df !== targetFormat) continue;
    }

    const vec = buildVector(d?.cards || []);
    const score = weightedJaccard(targetVec, vec);

    rows.push({
      url: d?.url ?? null,
      name: d?.name ?? null,
      archetype: d?.archetype ?? null,
      format: d?.format ?? null,
      event: d?.event ?? null,
      date: d?.date ?? null,
      standing: d?.standing ?? null,
      similarity: Number((score * 100).toFixed(2)),
      finish: parseFinish(d?.standing ?? d?.placement ?? null)
    });
  }

  rows.sort((a, b) => b.similarity - a.similarity);

  const topRows = rows.slice(0, top);

  const finishes = topRows.map((r) => r.finish).filter((n) => Number.isFinite(n));
  const agg = {
    count: topRows.length,
    bestFinish: finishes.length ? Math.min(...finishes) : null,
    avgFinish: finishes.length
      ? Number((finishes.reduce((s, n) => s + n, 0) / finishes.length).toFixed(2))
      : null,
    top8Rate: finishes.length
      ? Number(((finishes.filter((n) => n <= 8).length / finishes.length) * 100).toFixed(1))
      : null
  };

  return { top: topRows, aggregate: agg };
}

module.exports = { loadTournamentMeta, compareToMeta };

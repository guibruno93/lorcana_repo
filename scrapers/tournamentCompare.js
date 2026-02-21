// tournamentCompare.js
const fs = require("fs");
const path = require("path");

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/’/g, "'")
    .replace(/[^a-z0-9' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toQtyMap(cards = []) {
  const m = new Map();
  for (const c of cards) {
    const q = Number(c.quantity ?? c.qty ?? 0);
    if (!Number.isFinite(q) || q <= 0) continue;
    const n = normalizeName(c.normalizedName || c.name);
    if (!n) continue;
    m.set(n, (m.get(n) || 0) + q);
  }
  return m;
}

// Jaccard ponderado por quantidade: sum(min)/sum(max)
function weightedJaccard(mapA, mapB) {
  let minSum = 0;
  let maxSum = 0;

  const keys = new Set([...mapA.keys(), ...mapB.keys()]);
  for (const k of keys) {
    const a = mapA.get(k) || 0;
    const b = mapB.get(k) || 0;
    minSum += Math.min(a, b);
    maxSum += Math.max(a, b);
  }
  return maxSum > 0 ? (minSum / maxSum) : 0;
}

function loadTournamentMeta() {
  const candidates = [
    path.join(__dirname, "../data/tournamentMeta.json"),
    path.join(__dirname, "../db/tournamentMeta.json"),
    path.join(process.cwd(), "data/tournamentMeta.json"),
    path.join(process.cwd(), "db/tournamentMeta.json"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : (parsed.decks || parsed.items || []);
    }
  }
  return [];
}

function compareToTournamentMeta(inputDeckCards, options = {}) {
  const {
    minFinish = 32,
    sinceDays = 120,
    topN = 15,
    requireDate = true,
  } = options;

  const all = loadTournamentMeta();
  const now = Date.now();
  const sinceTs = now - (Number(sinceDays) * 24 * 60 * 60 * 1000);

  const inputMap = toQtyMap(inputDeckCards);

  const filtered = all.filter((d) => {
    const best = Number(d?.tournament?.bestFinish ?? d?.tournament?.best_finish ?? null);
    if (!Number.isFinite(best)) return false;
    if (best > minFinish) return false;

    const dateStr = d?.tournament?.date || null;
    if (!dateStr) return !requireDate;

    const ts = Date.parse(dateStr);
    if (!Number.isFinite(ts)) return !requireDate;

    return ts >= sinceTs;
  });

  const scored = filtered.map((d) => {
    const m = toQtyMap(d.cards || []);
    const sim = weightedJaccard(inputMap, m);

    return {
      url: d.url || null,
      deckName: d.deckName || d.name || null,
      author: d.tournament?.player || d.author || null,
      tournament: d.tournament || null,
      similarity: sim,
    };
  });

  scored.sort((a, b) => b.similarity - a.similarity);
  const matches = scored.slice(0, topN);

  // Sugestões simples (baseadas nos matches)
  const K = matches.length;
  const freq = new Map();      // name -> decks que usam
  const qtySum = new Map();    // name -> soma qty

  for (const m of matches) {
    const deck = filtered.find((d) => d.url === m.url);
    const map = toQtyMap(deck?.cards || []);
    for (const [name, qty] of map.entries()) {
      if (qty > 0) freq.set(name, (freq.get(name) || 0) + 1);
      qtySum.set(name, (qtySum.get(name) || 0) + qty);
    }
  }

  const input = inputMap;
  const adds = [];
  const cuts = [];

  for (const [name, usedIn] of freq.entries()) {
    const avgQty = (qtySum.get(name) || 0) / K;
    const have = input.get(name) || 0;

    // “Add” se aparece em >=60% dos matches e você não usa (ou usa bem menos)
    if (usedIn >= Math.ceil(K * 0.6) && have < Math.round(avgQty)) {
      const target = Math.max(1, Math.round(avgQty));
      adds.push({
        name,
        qty: target - have,
        reason: `Aparece em ${usedIn}/${K} decks Top${minFinish} semelhantes (média ~${avgQty.toFixed(1)} cópias).`,
      });
    }
  }

  for (const [name, have] of input.entries()) {
    const usedIn = freq.get(name) || 0;
    const avgQty = K > 0 ? ((qtySum.get(name) || 0) / K) : 0;

    // “Cut” se aparece em <=20% dos matches
    if (usedIn <= Math.floor(K * 0.2) && have > 0) {
      cuts.push({
        name,
        qty: have, // sugestão agressiva (você pode suavizar pra 1-2)
        reason: `Quase não aparece nos decks Top${minFinish} semelhantes (${usedIn}/${K}).`,
      });
    }
  }

  adds.sort((a, b) => b.qty - a.qty);
  cuts.sort((a, b) => b.qty - a.qty);

  return {
    filters: { minFinish, sinceDays, topN },
    candidates: filtered.length,
    matches,
    adds: adds.slice(0, 20),
    cuts: cuts.slice(0, 20),
  };
}

module.exports = { compareToTournamentMeta };

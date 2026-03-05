"use strict";

const { getCardIndex, normalizeName } = require("./cardIndex");

function tokenize(norm) {
  return String(norm || "")
    .split(" ")
    .map((t) => t.trim())
    .filter(Boolean);
}

function jaccardTokens(aTokens, bTokens) {
  const A = new Set(aTokens);
  const B = new Set(bTokens);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;

  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union > 0 ? inter / union : 0;
}

// Levenshtein distance (iterativo, O(n*m) com memória O(m))
function levenshtein(a, b) {
  a = String(a || "");
  b = String(b || "");
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const m = b.length;
  let prev = new Array(m + 1);
  let curr = new Array(m + 1);

  for (let j = 0; j <= m; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // delete
        curr[j - 1] + 1, // insert
        prev[j - 1] + cost // replace
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

function levRatio(a, b) {
  a = String(a || "");
  b = String(b || "");
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

function cardDisplayName(card) {
  return (
    card.fullName ||
    (card.name && card.version ? `${card.name} - ${card.version}` : null) ||
    card.name ||
    null
  );
}

function scoreName(inputNorm, inputTokens, candidateNorm, candidateTokens, rawInput) {
  if (!candidateNorm) return 0;

  if (candidateNorm === inputNorm) return 1;

  const j = jaccardTokens(inputTokens, candidateTokens);
  const l = levRatio(inputNorm, candidateNorm);

  let score = 0.6 * l + 0.4 * j;

  // bônus leve por “contém” / “prefixo”
  if (candidateNorm.startsWith(inputNorm) || inputNorm.startsWith(candidateNorm)) score += 0.05;
  if (candidateNorm.includes(inputNorm) || inputNorm.includes(candidateNorm)) score += 0.05;

  // se o input tem subtítulo, bonifica match em nome composto
  if (/[-–—]/.test(String(rawInput || ""))) score += 0.02;

  if (score > 1) score = 1;
  return score;
}

/**
 * Retorna candidatos (cartas reais do cards.json) para um nome “suspeito”.
 */
function findCardCandidates(rawName, opts = {}) {
  const limit = Number.isFinite(Number(opts.limit)) ? Number(opts.limit) : 8;
  const minScore = Number.isFinite(Number(opts.minScore)) ? Number(opts.minScore) : 0.45;

  const idx = getCardIndex(); // { cards, size, ... }
  const inputNorm = normalizeName(rawName);
  const inputTokens = tokenize(inputNorm);

  const scored = [];
  for (const c of idx.cards || []) {
    const disp = cardDisplayName(c);
    if (!disp) continue;

    const candNorm = normalizeName(disp);
    const candTokens = tokenize(candNorm);

    const s = scoreName(inputNorm, inputTokens, candNorm, candTokens, rawName);
    if (s >= minScore) {
      scored.push({
        score: Math.round(s * 1000) / 1000,
        cardId: c.code || c.cardId || c.cardIdentifier || c.id || c.uuid || null,
        name: c.name || null,
        fullName: c.fullName || null,
        version: c.version || null,
        setCode: c.setCode || null,
        type: c.type || null,
        cost: Number.isFinite(Number(c.cost)) ? Number(c.cost) : null,
        inkable: typeof c.inkable === "boolean" ? c.inkable : null,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || String(a.fullName || a.name).localeCompare(String(b.fullName || b.name)));
  const candidates = scored.slice(0, Math.max(1, limit));

  // “best guess” heurístico (não aplica nada automaticamente)
  const best = candidates[0] || null;
  const second = candidates[1] || null;

  let chosen = null;
  if (best) {
    const gap = second ? best.score - second.score : best.score;
    if (best.score >= 0.82 || (best.score >= 0.75 && gap >= 0.08)) {
      chosen = { ...best, confidence: best.score, gap: Math.round(gap * 1000) / 1000 };
    }
  }

  return {
    input: rawName,
    normalizedInput: inputNorm,
    candidates,
    best: chosen, // null se não tiver convicção
  };
}

module.exports = {
  findCardCandidates,
};

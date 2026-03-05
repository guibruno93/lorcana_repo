// backend/meta/metaIndex.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function normalizeName(input) {
  return String(input || "")
    .replace(/\u00A0/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCountAndName(raw) {
  const cleaned = String(raw || "").replace(/\u00A0/g, " ").trim();

  // aceita: "4\tCard", "4  Card", "4x Card"
  const m = cleaned.match(/^(\d+)\s*(?:x)?\s*[\t ]+(.*)$/i);
  if (!m) return { count: 1, name: cleaned };
  return { count: Number(m[1]), name: String(m[2] || "").trim() };
}

function placementValue(label) {
  const s = String(label || "").trim().toUpperCase();

  const ord = s.match(/^(\d+)(ST|ND|RD|TH)$/);
  if (ord) return Number(ord[1]);

  const top = s.match(/^TOP(\d+)$/);
  if (top) return Number(top[1]);

  return 9999;
}

function stableIdFromUrl(url) {
  return crypto.createHash("sha1").update(String(url || "")).digest("hex").slice(0, 12);
}

function buildMetaIndex(raw) {
  const decks = (raw.decks || []).map((d) => {
    const id = stableIdFromUrl(d.url);

    const counts = Object.create(null);
    const displayName = Object.create(null);

    let signatureTotalCopies = 0;

    const cards = (d.cards || []).map((c) => {
      const parsed = parseCountAndName(c.name);
      const norm = normalizeName(parsed.name);

      signatureTotalCopies += parsed.count;
      counts[norm] = (counts[norm] || 0) + parsed.count;
      displayName[norm] = parsed.name;

      return {
        cost: Number(c.qty ?? 0), // no meta isso é custo
        count: Number(parsed.count ?? 1),
        name: parsed.name,
        normalized: norm,
        raw: c.name,
      };
    });

    return {
      id,
      url: d.url,

      event: d.event,
      location: d.location,
      date: d.date ?? null,
      standing: d.standing,
      rankLabel: d.rankLabel,
      placementValue: placementValue(d.rankLabel || d.standing),
      players: Number(d.players ?? 0),

      format: d.format,
      archetype: d.archetype,
      metaSet: d.metaSet,
      author: d.author,

      cards,
      counts,
      displayName,
      signatureTotalCopies,
    };
  });

  // inverted index: cardNorm -> [deckIdx...]
  const inverted = Object.create(null);
  decks.forEach((deck, idx) => {
    Object.keys(deck.counts).forEach((cardNorm) => {
      if (!inverted[cardNorm]) inverted[cardNorm] = [];
      inverted[cardNorm].push(idx);
    });
  });

  return {
    schemaVersion: raw.schemaVersion,
    source: raw.source,
    updatedAt: raw.updatedAt,
    decks,
    inverted,
  };
}

function parseDecklistTextToCounts(text) {
  const counts = Object.create(null);

  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const cleaned = line.replace(/\u00A0/g, " ").trim();
    const m = cleaned.match(/^(\d+)\s*(?:x)?\s*[\t ]+(.*)$/i);
    if (!m) continue;

    const qty = Number(m[1]);
    const name = String(m[2] || "").trim();
    if (!name) continue;

    const norm = normalizeName(name);
    counts[norm] = (counts[norm] || 0) + qty;
  }

  return counts;
}

function pickCandidates(deckCounts, metaIndex, { minVotes, maxCandidates }) {
  // “âncoras” do input: top 12 cartas por qty
  const anchors = Object.entries(deckCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k]) => k);

  const votes = new Map();

  for (const cardNorm of anchors) {
    const hit = metaIndex.inverted[cardNorm];
    if (!hit) continue;
    for (const idx of hit) votes.set(idx, (votes.get(idx) || 0) + 1);
  }

  let candidates = Array.from(votes.entries())
    .filter(([, v]) => v >= minVotes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCandidates)
    .map(([idx]) => idx);

  // fallback brute-force se ficou pequeno
  if (candidates.length < 50) {
    candidates = metaIndex.decks.map((_, i) => i);
  }

  return candidates;
}

function compareDeckToMeta(deckCounts, metaIndex, options = {}) {
  const topK = Number.isFinite(options.topK) ? options.topK : 10;
  const minVotes = Number.isFinite(options.minVotes) ? options.minVotes : 2;
  const maxCandidates = Number.isFinite(options.maxCandidates) ? options.maxCandidates : 800;

  const candidates = pickCandidates(deckCounts, metaIndex, { minVotes, maxCandidates });
  const matches = [];

  for (const idx of candidates) {
    const d = metaIndex.decks[idx];

    let matchedCopies = 0;
    const missingFromSignature = [];

    for (const [cardNorm, sigQty] of Object.entries(d.counts)) {
      const have = deckCounts[cardNorm] || 0;
      matchedCopies += Math.min(have, sigQty);

      if (have < sigQty) {
        missingFromSignature.push({
          name: d.displayName[cardNorm] || cardNorm,
          need: sigQty,
          have,
        });
      }
    }

    const signatureTotalCopies = d.signatureTotalCopies || 1;
    const matchPct = matchedCopies / signatureTotalCopies;

    matches.push({
      deckId: d.id,
      url: d.url,

      event: d.event,
      location: d.location,
      date: d.date,
      standing: d.standing,
      rankLabel: d.rankLabel,
      placementValue: d.placementValue,
      players: d.players,

      format: d.format,
      archetype: d.archetype,
      author: d.author,

      matchPct,
      matchedCopies,
      signatureTotalCopies,
      missingFromSignature: missingFromSignature.slice(0, 12),
    });
  }

  matches.sort((a, b) => {
    if (b.matchPct !== a.matchPct) return b.matchPct - a.matchPct;
    if (a.placementValue !== b.placementValue) return a.placementValue - b.placementValue;
    return (b.players || 0) - (a.players || 0);
  });

  return matches.slice(0, topK);
}

// tenta achar o arquivo em mais de um lugar (igual você já faz com analyzeDeck)
function loadMetaIndexFromDisk(possiblePaths) {
  const tries = (possiblePaths || []).filter(Boolean);

  for (const p of tries) {
    try {
      const json = JSON.parse(fs.readFileSync(p, "utf-8"));
      return buildMetaIndex(json);
    } catch (_) {}
  }

  // última tentativa: relativo ao projeto
  const fallback = path.join(__dirname, "..", "db", "tournamentMeta.json");
  const json = JSON.parse(fs.readFileSync(fallback, "utf-8"));
  return buildMetaIndex(json);
}

module.exports = {
  buildMetaIndex,
  parseDecklistTextToCounts,
  compareDeckToMeta,
  loadMetaIndexFromDisk,
};

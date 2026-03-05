// backend/services/metaIndex.js
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let normalizeName = null;
try {
  ({ normalizeName } = require("../parser/normalize"));
} catch {
  normalizeName = (s) =>
    String(s || "")
      .replace(/\u00A0/g, " ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
}

const DEFAULT_META_PATH = path.join(__dirname, "../db/tournamentMeta.json");

let _cache = { mtimeMs: 0, state: null };

function makeId(url, i) {
  const base = String(url || `idx:${i}`);
  return crypto.createHash("sha1").update(base).digest("hex").slice(0, 12);
}

function parseDeckCardEntry(entry) {
  if (typeof entry === "string") {
    const raw = String(entry).replace(/\u00A0/g, " ").trim();
    const m = raw.match(/^(\d+)\s*(?:x|×)?\s+(.+?)\s*$/i);
    if (m) return { count: Number(m[1]) || 0, name: String(m[2]).trim() };
    return { count: 0, name: raw };
  }

  const raw = String(entry?.name || entry?.cardName || entry?.card || entry?.title || "")
    .replace(/\u00A0/g, " ")
    .trim();

  const m = raw.match(/^(\d+)\s*(?:x|×)?\s+(.+?)\s*$/i);
  if (m) return { count: Number(m[1]) || 0, name: String(m[2]).trim() };

  const count = Number(entry?.count ?? entry?.quantity ?? entry?.qty ?? entry?.copies ?? 0) || 0;
  return { count, name: raw };
}

function buildCountsFromDeck(deck) {
  const counts = Object.create(null);
  let total = 0;

  const arr = Array.isArray(deck?.cards) ? deck.cards : [];
  for (const e of arr) {
    const { count, name } = parseDeckCardEntry(e);
    if (!count || !name) continue;
    const key = normalizeName(name);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + count;
    total += count;
  }

  return { counts, totalQty: total };
}

function parseFinishLabel(label) {
  const s = String(label || "").trim();
  if (!s) return null;

  const mTop = s.match(/^Top\s*(\d+)$/i) || s.match(/^Top(\d+)$/i);
  if (mTop) return Number(mTop[1]);

  const mOrd = s.match(/^(\d+)(st|nd|rd|th)$/i);
  if (mOrd) return Number(mOrd[1]);

  const mRange = s.match(/^(\d+)\s*(?:st|nd|rd|th)?\s*-\s*(\d+)\s*(?:st|nd|rd|th)?$/i);
  if (mRange) return Number(mRange[1]);

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function loadMetaState(metaPath = DEFAULT_META_PATH) {
  const stat = fs.statSync(metaPath);
  if (_cache.state && _cache.mtimeMs === stat.mtimeMs) return _cache.state;

  const raw = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const state = Array.isArray(raw)
    ? { schemaVersion: 1, source: "inkdecks", updatedAt: null, decks: raw }
    : raw;

  const decksIn = Array.isArray(state?.decks) ? state.decks : [];
  const decks = [];
  const byId = new Map();
  const archetypes = Object.create(null);
  const formats = Object.create(null);

  for (let i = 0; i < decksIn.length; i++) {
    const d = decksIn[i];
    const id = d.id || makeId(d.url, i);

    const { counts, totalQty } = buildCountsFromDeck(d);

    const archetype = d.archetype || "Unknown";
    const format = d.format || "Unknown";
    archetypes[archetype] = (archetypes[archetype] || 0) + 1;
    formats[format] = (formats[format] || 0) + 1;

    const deckObj = {
      id,
      url: d.url ?? null,
      deckName: d.name ?? d.deckName ?? null,
      author: d.author ?? null,

      event: d.event ?? null,
      location: d.location ?? null,
      date: d.date ?? (d.tournament?.date ?? null),

      standing: d.standing ?? null,
      rankLabel: d.rankLabel ?? null,
      players: d.players ?? (d.tournament?.players ?? null),

      format: d.format ?? null,
      archetype: d.archetype ?? null,

      counts,
      totalQty: d.totalQty ?? totalQty,
      finish: d.finish ?? parseFinishLabel(d.standing ?? d.rankLabel ?? d.tournament?.placementText ?? null),

      rawCards: d.cards || [],
    };

    decks.push(deckObj);
    byId.set(id, deckObj);
  }

  const out = {
    schemaVersion: state?.schemaVersion ?? 1,
    source: state?.source ?? "inkdecks",
    updatedAt: state?.updatedAt ?? null,
    scrapedAt: state?.scrapedAt ?? null,
    metaPath,
    decks,
    byId,
    stats: {
      decks: decks.length,
      archetypes,
      formats,
    },
  };

  _cache = { mtimeMs: stat.mtimeMs, state: out };
  return out;
}

module.exports = { loadMetaState };

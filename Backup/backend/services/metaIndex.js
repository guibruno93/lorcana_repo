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

function resolvePathMaybeRelative(p) {
  if (!p) return null;
  const s = String(p);
  return path.isAbsolute(s) ? s : path.resolve(process.cwd(), s);
}

// ✅ padrão correto: backend/db/tournamentMeta.json (a partir de backend/services)
const DEFAULT_META_PATH =
  resolvePathMaybeRelative(process.env.TOURNAMENT_META_PATH) ||
  path.resolve(__dirname, "..", "db", "tournamentMeta.json");

let _cache = { mtimeMs: 0, state: null };

function makeId(url, i) {
  const base = String(url || `idx:${i}`);
  return crypto.createHash("sha1").update(base).digest("hex").slice(0, 12);
}

function parseDeckCardEntry(entry) {
  const raw = String(entry?.name || "").replace(/\u00A0/g, " ").trim();

  const m = raw.match(/^(\d+)\s*(?:x|×)?\s+(.+?)\s*$/i);
  if (m) return { count: Number(m[1]) || 0, name: String(m[2]).trim() };

  const count = Number(entry?.count ?? entry?.qty ?? 0) || 0;
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

  const mTop = s.match(/^Top\s*(\d+)$/i);
  if (mTop) return Number(mTop[1]);

  const mOrd = s.match(/^(\d+)(st|nd|rd|th)$/i);
  if (mOrd) return Number(mOrd[1]);

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function loadMetaState(metaPath = DEFAULT_META_PATH) {
  const resolved = resolvePathMaybeRelative(metaPath) || DEFAULT_META_PATH;

  if (!fs.existsSync(resolved)) {
    throw new Error(
      `tournamentMeta.json não encontrado.\n` +
        `Esperado em: ${resolved}\n` +
        `Dica: confirme que existe em backend/db/tournamentMeta.json ou defina TOURNAMENT_META_PATH=backend/db/tournamentMeta.json`
    );
  }

  const stat = fs.statSync(resolved);
  if (_cache.state && _cache.mtimeMs === stat.mtimeMs) return _cache.state;

  const raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
  const state =
    Array.isArray(raw)
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
      event: d.event ?? null,
      location: d.location ?? null,
      date: d.date ?? null,
      standing: d.standing ?? null,
      rankLabel: d.rankLabel ?? null,
      players: d.players ?? null,
      format: d.format ?? null,
      archetype: d.archetype ?? null,
      author: d.author ?? null,

      counts,
      totalQty: d.totalQty ?? totalQty,
      finish: parseFinishLabel(d.standing ?? d.rankLabel ?? null),
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
    metaPath: resolved,
    decks,
    byId,
    stats: { decks: decks.length, archetypes, formats },
  };

  _cache = { mtimeMs: stat.mtimeMs, state: out };
  return out;
}

module.exports = { loadMetaState };

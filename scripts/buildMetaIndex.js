"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function makeId(url, i) {
  const base = String(url || `idx:${i}`);
  return crypto.createHash("sha1").update(base).digest("hex").slice(0, 12);
}

function normalizeName(s) {
  return String(s || "")
    .replace(/\u00A0/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeRaw(s) {
  return String(s || "").replace(/\u00A0/g, " ").trim();
}

function parseDeckCardEntry(entry) {
  const raw =
    typeof entry === "string"
      ? normalizeRaw(entry)
      : normalizeRaw(entry?.name || entry?.card || "");

  const m = raw.match(/^(\d+)\s*(?:x|×)?\s+(.+?)\s*$/i);
  if (m) return { count: Number(m[1]) || 0, name: String(m[2]).trim() };

  const count =
    typeof entry === "object"
      ? Number(entry?.count ?? entry?.qty ?? 0) || 0
      : 0;

  return { count, name: raw };
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

function readArg(name, fallback) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const n = Number(arg.split("=")[1]);
  return Number.isFinite(n) ? n : fallback;
}

function main() {
  const inPath =
    process.argv.find((a) => a.endsWith(".json")) ||
    path.join(__dirname, "..", "db", "tournamentMeta.json");

  const outPath =
    (process.argv.find((a) => a.startsWith("--out=")) || "")
      .split("=")[1] ||
    path.join(__dirname, "..", "db", "metaIndex.cache.json");

  const minTotal = readArg("min", 60);
  const onlyMeetsMin = process.argv.includes("--onlyMeetsMin");

  if (!fs.existsSync(inPath)) {
    console.error("Meta não encontrado:", inPath);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(inPath, "utf8"));
  const state = Array.isArray(raw) ? { schemaVersion: 1, source: "unknown", decks: raw } : raw;
  const decksIn = Array.isArray(state?.decks) ? state.decks : [];

  const decksOut = [];
  let meets = 0, below = 0, over = 0;

  const dist = new Map();

  for (let i = 0; i < decksIn.length; i++) {
    const d = decksIn[i];
    const id = d.id || makeId(d.url, i);

    const counts = Object.create(null);
    const parsedCards = [];
    let total = 0;

    const arr = Array.isArray(d.cards) ? d.cards : [];
    for (const e of arr) {
      const { count, name } = parseDeckCardEntry(e);
      if (!count || !name) continue;

      const key = normalizeName(name);
      if (!key) continue;

      counts[key] = (counts[key] || 0) + count;
      total += count;

      parsedCards.push({ count, name, normalizedName: key });
    }

    dist.set(total, (dist.get(total) || 0) + 1);

    const meetsMin = total >= minTotal;
    if (meetsMin) meets++;
    else below++;

    if (total > minTotal) over++;

    if (onlyMeetsMin && !meetsMin) continue;

    decksOut.push({
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
      totalQty: total,
      meetsMin,
      isOverMin: total > minTotal,
      finish: parseFinishLabel(d.standing ?? d.rankLabel ?? null),

      sourceTotalQty: d.totalQty ?? null,
      cardsParsed: parsedCards,
      rawCards: d.cards || [],
    });
  }

  const sortedDist = [...dist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  const payload = {
    schemaVersion: state?.schemaVersion ?? 1,
    source: state?.source ?? "unknown",
    updatedAt: state?.updatedAt ?? null,
    scrapedAt: state?.scrapedAt ?? null,
    minTotal,
    decks: decksOut,
    stats: {
      decksIn: decksIn.length,
      decksOut: decksOut.length,
      meetsMin,
      belowMin: below,
      overMin: over,
      topTotals: sortedDist.map(([totalQty, count]) => ({ totalQty, count })),
    },
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");

  console.log("✅ metaIndex.cache gerado:", outPath);
  console.log("Stats:", payload.stats);
  if (onlyMeetsMin) console.log("Modo: --onlyMeetsMin (filtrando totalQty >= min)");
}

main();

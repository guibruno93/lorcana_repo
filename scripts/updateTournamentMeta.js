// backend/scripts/updateTournamentMeta.js
"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { getDeckRefs, scrapeDeck } = require("../scrapers/inkdecksScraper");

const DEFAULT_OUT = path.join(__dirname, "../db/tournamentMeta.json");

function nowIso() {
  return new Date().toISOString();
}

function readJson(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    if (!a.startsWith("--")) continue;
    const [k, v] = a.replace(/^--/, "").split("=");
    out[k] = v === undefined ? true : v;
  }
  return out;
}

function pickBool(v, def) {
  if (v === undefined || v === null) return def;
  const s = String(v).toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return def;
}

async function scrapeWithRetry(url, browser, { retries = 1, timeoutMs = 60000, delayMs = 600 } = {}) {
  let lastErr = null;
  for (let i = 0; i <= retries; i++) {
    try {
      if (i > 0) await new Promise((r) => setTimeout(r, delayMs));
      return await scrapeDeck(url, { browser, timeoutMs });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function main() {
  const args = parseArgs(process.argv);

  const format = String(args.format || "core").toLowerCase();
  const page = Number(args.page || 1);
  const headless = pickBool(args.headless, true);
  const outPath = args.out ? path.resolve(String(args.out)) : DEFAULT_OUT;

  const timeoutMs = Number(args.timeoutMs || 60000);
  const retries = Number(args.retries || 1);

  const stateRaw = readJson(outPath);
  const state =
    Array.isArray(stateRaw)
      ? { schemaVersion: 1, source: "inkdecks", updatedAt: null, decks: stateRaw }
      : (stateRaw || { schemaVersion: 1, source: "inkdecks", updatedAt: null, decks: [] });

  const existing = new Map();
  for (const d of Array.isArray(state.decks) ? state.decks : []) {
    if (d?.url) existing.set(d.url, d);
  }

  const browser = await chromium.launch({ headless });

  try {
    const refs = await getDeckRefs(format, browser, page);
    console.log(`Refs: ${refs.length} (format=${format} page=${page})`);

    let added = 0;

    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      if (!ref?.url) continue;
      if (existing.has(ref.url)) continue;

      console.log(`🔎 [${i + 1}/${refs.length}] ${ref.url}`);

      const deck = await scrapeWithRetry(ref.url, browser, { retries, timeoutMs, delayMs: 800 });

      const merged = {
        url: ref.url,
        name: ref.name ?? null,
        author: ref.author ?? null,
        metaSet: ref.metaSet ?? null,
        format: ref.format ?? null,
        archetype: ref.archetype ?? null,
        event: ref.event ?? null,
        location: ref.location ?? null,
        players: ref.players ?? null,
        date: ref.date ?? null,
        rankLabel: ref.rankLabel ?? null,
        standing: ref.standing ?? null,

        tournament: deck.tournament ?? null,
        cards: deck.cards ?? [],
        totalQty: deck.totalQty ?? null,

        scrapedAt: nowIso(),
      };

      state.decks.push(merged);
      existing.set(ref.url, merged);
      added++;
    }

    state.updatedAt = nowIso();
    writeJson(outPath, state);

    console.log(`✅ updateTournamentMeta concluído. added=${added} out=${outPath}`);
  } finally {
    await browser.close().catch(() => {});
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error("❌ Erro no updateTournamentMeta:", e?.message || e);
    process.exit(1);
  });
}

module.exports = { main };

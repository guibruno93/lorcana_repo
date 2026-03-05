// backend/scripts/auditTournamentMeta.js
"use strict";

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    if (!a.startsWith("--")) continue;
    const [k, v] = a.replace(/^--/, "").split("=");
    out[k] = v === undefined ? true : v;
  }
  return out;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function parseDeckCardEntry(entry) {
  if (typeof entry === "string") {
    const raw = entry.trim();
    const m = raw.match(/^(\d+)\s*(?:x|×)?\s+(.+?)\s*$/i);
    if (m) return { count: Number(m[1]) || 0, matchedPrefix: true };
    return { count: 0, matchedPrefix: false };
  }

  const raw = String(entry?.name || entry?.cardName || entry?.card || "").trim();
  const m = raw.match(/^(\d+)\s*(?:x|×)?\s+(.+?)\s*$/i);
  if (m) return { count: Number(m[1]) || 0, matchedPrefix: true };

  const count = Number(entry?.count ?? entry?.quantity ?? entry?.qty ?? 0) || 0;
  return { count, matchedPrefix: false };
}

function computeTotalQty(deck) {
  const arr = Array.isArray(deck?.cards) ? deck.cards : [];
  let sum = 0;

  for (const e of arr) {
    const p = parseDeckCardEntry(e);
    sum += Number(p.count) || 0;
  }

  return { sum, entries: arr.length };
}

function main() {
  const args = parseArgs(process.argv);
  const metaPath =
    args.in ||
    process.argv.find((a) => a.endsWith(".json")) ||
    path.join(__dirname, "../db/tournamentMeta.json");

  const min = Number(args.min ?? 60);
  const strict = args.strict === true || String(args.strict || "").toLowerCase() === "true";

  const raw = readJson(metaPath);
  const state = Array.isArray(raw)
    ? { schemaVersion: 1, decks: raw }
    : raw;

  const decks = Array.isArray(state?.decks) ? state.decks : [];
  console.log(`Meta file: ${metaPath}`);
  console.log(`Decks: ${decks.length}`);

  let eq60 = 0, lt60 = 0, gt60 = 0, ltMin = 0;
  const totals = new Map();
  const samples = [];

  for (const d of decks) {
    const { sum, entries } = computeTotalQty(d);
    const srcTotal = Number(d?.totalQty ?? null);

    if (sum === 60) eq60++;
    else if (sum < 60) lt60++;
    else gt60++;

    if (Number.isFinite(min) && sum < min) ltMin++;

    totals.set(sum, (totals.get(sum) || 0) + 1);

    samples.push({
      total: sum,
      srcTotal: Number.isFinite(srcTotal) ? srcTotal : null,
      cardsLen: entries,
      standing: d?.standing ?? d?.rankLabel ?? null,
      players: d?.players ?? d?.tournament?.players ?? null,
      url: d?.url ?? null,
    });
  }

  const topTotals = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  console.log(`Computed totalQty: =60 ${eq60} | <60 ${lt60} | >60 ${gt60}`);
  console.log(`Abaixo do mínimo (min=${min}): ${ltMin}`);
  console.log("Top totals (computedTotalQty -> count):");
  for (const [t, c] of topTotals) console.log(`  ${t} -> ${c}`);

  samples.sort((a, b) => a.total - b.total);
  console.log("\nExemplos (top 15) mais distantes de 60:");
  for (const s of samples.slice(0, 15)) {
    console.log(
      `- total=${s.total} srcTotal=${s.srcTotal ?? "?"} cardsLen=${s.cardsLen} standing=${s.standing} players=${s.players} url=${s.url}`
    );
  }

  if (strict && ltMin > 0) {
    console.error(`❌ strict: existem ${ltMin} decks com total < min (${min}).`);
    process.exit(1);
  }

  console.log("\n✅ auditTournamentMeta concluído.");
}

if (require.main === module) main();

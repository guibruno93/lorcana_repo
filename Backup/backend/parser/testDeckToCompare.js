// backend/scrapers/testDeckToCompare.js
const { scrapeDeck } = require("./inkdecksScraper");
const { analyzeDeckFromScrape } = require("../parser/analyzeDeck");
const { loadTournamentMeta, compareToMeta } = require("../parser/metaCompare");

(async () => {
  const url =
    process.argv[2] ||
    "https://inkdecks.com/lorcana-metagame/deck-blurple-hk-499297";

  console.log(`🔎 Scraping: ${url}`);
  const deckObj = await scrapeDeck(url);

  const analysis = analyzeDeckFromScrape(deckObj, { strict60: true });

  console.log("✅ Analysis:");
  console.log({
    name: analysis.meta?.name,
    totalCards: analysis.totalCards,
    inkablePct: analysis.inkablePct,
    avgCost: analysis.avgCost,
    archetype: analysis.archetype,
    format: analysis.format,
    unknown: analysis.unknown,
    warnings: analysis.warnings?.length || 0
  });

  const meta = loadTournamentMeta();
  console.log(`📦 Meta decks: ${meta.decks?.length || 0}`);

  const cmp = compareToMeta(analysis, meta, { top: 10, sameFormat: true });

  console.log("🏁 Top similares:");
  for (const r of cmp.top) {
    console.log(
      `- ${String(r.similarity).padStart(6)}% | ${r.name || "?"} | ${r.archetype || "?"} | ${r.standing || ""} | ${r.date || ""}`
    );
  }

  console.log("📊 Agg (se tiver standing parseável):", cmp.aggregate);
})().catch((e) => {
  console.error("💥 Erro:", e?.message || e);
  process.exit(1);
});

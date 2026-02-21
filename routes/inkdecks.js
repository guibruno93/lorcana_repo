// routes/inkdecks.js
const express = require("express");
const router = express.Router();

const { scrapeDeck } = require("../scrapers/inkdecksScraper");
const { analyzeDeckFromScrape } = require("../parser/analyzeDeck");
const { loadTournamentMeta, compareToTournamentMeta } = require("../parser/metaCompare");

router.get("/analyze", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "missing url" });

  try {
    const deckObj = await scrapeDeck(url);
    const analysis = analyzeDeckFromScrape(deckObj, { strict60: true });
    return res.json(analysis);
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

/**
 * /compare?url=...&top=10
 * - Faz scrape + analyze (sem reparsear texto)
 * - Compara com tournamentMeta.json por overlap (Jaccard ponderado por qty)
 */
router.get("/compare", async (req, res) => {
  const url = req.query.url;
  const top = Number(req.query.top || 10);

  if (!url) return res.status(400).json({ error: "missing url" });

  try {
    const deckObj = await scrapeDeck(url);
    const analysis = analyzeDeckFromScrape(deckObj, { strict60: true });

    const meta = loadTournamentMeta();
    const cmp = compareToTournamentMeta(analysis, meta, { top, sameFormat: true });

    return res.json({
      analysis,
      similarDecks: cmp.top,
      similarDecksAgg: cmp.aggregate,
      metaInfo: { source: meta.source, updatedAt: meta.updatedAt, total: meta.decks?.length || 0 }
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

/**
 * /meta/info
 * Retorna apenas status do tournamentMeta.json (pra front saber se tem base).
 */
router.get("/meta/info", (req, res) => {
  const meta = loadTournamentMeta();
  return res.json({
    source: meta.source,
    updatedAt: meta.updatedAt,
    total: meta.decks?.length || 0
  });
});

module.exports = router;

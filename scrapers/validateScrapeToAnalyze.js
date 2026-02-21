const { scrapeDeck } = require("./inkdecksScraper");
const { analyzeDeck } = require("../parser/deckParser");

function deckToText(deck) {
  return (deck.cards || [])
    .map((c) => `${c.qty} ${c.name}`)
    .join("\n");
}

async function run() {
  const url = "https://inkdecks.com/lorcana-metagame/deck-blurple-hk-499297";

  console.log("🧪 Scrape deck...");
  const deck = await scrapeDeck(url);

  console.log("🧾 Build deck text + analyze...");
  const deckText = deckToText(deck);

  const analysis = analyzeDeck(deckText);

  console.log("✅ Pipeline OK");
  console.log({
    scrapedName: deck.name,
    scrapedFormat: deck.format,
    scrapedArchetype: deck.archetype,
    scrapedCards: deck.cards.length,
    unmatchedFromScrape: deck.unmatchedCards?.length || 0,
    analyzedTotalCards: analysis.totalCards,
    analyzedUnknownCards: analysis.unknownCards?.length || 0,
    analyzedFormat: analysis.format,
    analyzedArchetype: analysis.archetype,
    metaTier: analysis.meta?.tier
  });
}

run().catch((e) => {
  console.error("💥 Falhou:", e);
  process.exit(1);
});

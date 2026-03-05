// backend/scrapers/testDeckToParser.js
const { scrapeDeck } = require("./inkdecksScraper");
const { analyzeDeck } = require("../parser/deckParser");

function toDeckText(scrapedDeck) {
  return scrapedDeck.cards.map((c) => `${c.qty} ${c.name}`).join("\n");
}

(async () => {
  const url = "https://inkdecks.com/lorcana-metagame/deck-blurple-hk-499297";

  const deck = await scrapeDeck(url);
  console.log("✅ Scrape ok:", deck.name, deck.matchStats);

  const totalQty = deck.cards.reduce((acc, c) => acc + Number(c.qty || 0), 0);
  console.log("📌 Total qty extraído:", totalQty);

  const deckText = toDeckText(deck);
  const result = analyzeDeck(deckText);

  console.log("✅ Parser ok:", {
    totalCards: result.totalCards,
    inkablePct: result.inkablePercentage,
    archetype: result.archetype,
    format: result.format,
    unknown: result.unknownCards?.length ?? 0
  });

  console.log("🧾 Primeiras 15 cartas do parser:");
  console.log(result.cards.slice(0, 15));
})();

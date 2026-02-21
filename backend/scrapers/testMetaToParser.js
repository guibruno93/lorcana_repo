const meta = require("../db/tournamentMeta.json");
const { analyzeScrapedDeck } = require("../parser/deckParser");

const first = meta.decks[0];
const result = analyzeScrapedDeck(first);

console.log("Deck:", first.name);
console.log("Format:", result.format);
console.log("Archetype:", result.archetype);
console.log("Total cards:", result.totalCards);
console.log("Inkable %:", result.inkablePercentage);
console.log("Unknown cards:", result.unknownCards?.length);

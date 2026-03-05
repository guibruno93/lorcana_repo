// backend/scraper/parseDecklist.js
const normalizeCard = require("./normalizeCard");

module.exports = function parseDecklist(rawText = "") {
  const lines = rawText
    .split("\n")
    .map(l => l.trim())
    .filter(l => /^\d+/.test(l));

  const deck = [];

  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) continue;

    deck.push({
      quantity: Number(match[1]),
      name: match[2],
      normalized: normalizeCard(match[2])
    });
  }

  return deck;
};

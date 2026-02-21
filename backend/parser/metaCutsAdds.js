function suggestMetaCutsAndAdds(deckCards, metaDeck) {
  const deckMap = Object.fromEntries(
    deckCards.map(c => [c.name, c.quantity])
  );

  const metaCardNames = Object.keys(metaDeck.cards);

  const cuts = deckCards
    .filter(c => !metaCardNames.includes(c.name))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 3);



  const adds = metaCardNames
    .filter(name => !deckMap[name])
    .slice(0, cuts.length);

  return cuts.map((cut, i) => ({
    cut: cut.name,
    add: adds[i] ?? null,
    reason: "Alta presença em Tier 1"
  }));
}

module.exports = { suggestMetaCutsAndAdds };

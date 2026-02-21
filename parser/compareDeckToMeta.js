function compareDeckToMeta(deckCards, tier1Decks) {
  const deckNames = deckCards.map(c => c.name);

  return tier1Decks.map(meta => {
    let overlap = 0;
    const metaCards = Object.keys(meta.cards);

    metaCards.forEach(card => {
      if (deckNames.includes(card)) overlap++;
    });

    return {
      metaDeck: meta.name,
      archetype: meta.archetype,
      overlapPct: Math.round((overlap / metaCards.length) * 100),
      avgPlacement: meta.avgPlacement
    };
  });
}

module.exports = { compareDeckToMeta };

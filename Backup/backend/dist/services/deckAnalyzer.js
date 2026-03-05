"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeDeck = analyzeDeck;
// Função simulada de análise (substitua pela chamada real à IA)
async function analyzeDeck(deck) {
    // Simulação simples: calcula custo médio e curva de mana
    const totalCards = deck.reduce((sum, card) => sum + card.count, 0);
    const averageCost = deck.reduce((sum, card) => sum + card.cost * card.count, 0) / totalCards;
    const manaCurve = {};
    const factionDistribution = {};
    deck.forEach(card => {
        manaCurve[card.cost] = (manaCurve[card.cost] || 0) + card.count;
        factionDistribution[card.faction] = (factionDistribution[card.faction] || 0) + card.count;
    });
    // Recomendação simples (exemplo)
    const recommendations = deck
        .filter(c => c.count === 1)
        .map(c => ({ card_to_add: c.name, reason: "Consider adding more copies" }));
    return {
        deck_name: "Meu Deck Lorcana",
        author: "Usuário",
        total_cards: totalCards,
        cards: deck,
        mana_curve: manaCurve,
        deck_stats: {
            average_cost: averageCost,
            total_rarity_points: deck.reduce((sum, c) => sum + (c.rarity === "Common" ? 1 : c.rarity === "Rare" ? 2 : c.rarity === "Epic" ? 3 : 5) * c.count, 0),
            faction_distribution: factionDistribution,
        },
        recommendations,
    };
}

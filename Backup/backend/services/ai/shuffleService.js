'use strict';

/**
 * Shuffle Service - Gera mãos aleatórias do deck
 * @module services/ai/shuffleService
 */

/**
 * Embaralha e gera uma mão inicial de 7 cartas
 * @param {Object} deckAnalysis - Análise do deck
 * @returns {Object} Mão gerada
 */
function shuffleHand(deckAnalysis) {
  const cards = deckAnalysis.cards || [];
  
  if (cards.length === 0) {
    throw new Error('Deck has no cards');
  }

  // Criar pool de cartas (expandir quantidades)
  const cardPool = [];
  cards.forEach(card => {
    const qty = card.quantity || 1;
    for (let i = 0; i < qty; i++) {
      cardPool.push({
        name: card.name,
        cost: card.cost || 0,
        inkable: card.inkable || false,
        lore: card.lore || 0,
        type: card.type || 'Character',
      });
    }
  });

  // Shuffle (Fisher-Yates)
  const shuffled = fisherYatesShuffle([...cardPool]);

  // Pegar top 7
  const hand = shuffled.slice(0, 7);

  // Calcular estatísticas da mão
  const stats = calculateHandStats(hand);

  return {
    hand: hand.map(c => c.name),
    stats,
    deckSize: cardPool.length,
    cardsRemaining: cardPool.length - 7,
  };
}

/**
 * Gera múltiplas mãos para comparação
 * @param {Object} deckAnalysis - Análise do deck
 * @param {number} count - Número de mãos a gerar
 * @returns {Array} Array de mãos
 */
function generateMultipleHands(deckAnalysis, count = 5) {
  const hands = [];
  
  for (let i = 0; i < count; i++) {
    hands.push(shuffleHand(deckAnalysis));
  }

  return hands;
}

/**
 * Simula mulligan - remove cartas e puxa novas
 * @param {Array<string>} hand - Mão atual
 * @param {Array<number>} mulligan - Índices das cartas a trocar
 * @param {Object} deckAnalysis - Análise do deck
 * @returns {Object} Nova mão após mulligan
 */
function simulateMulligan(hand, mulliganIndices, deckAnalysis) {
  if (!Array.isArray(hand) || hand.length !== 7) {
    throw new Error('Hand must have 7 cards');
  }

  const cards = deckAnalysis.cards || [];

  // Criar pool (remover cartas que já estão na mão)
  const cardPool = [];
  const handNames = hand.map(name => name.toLowerCase());
  const handCounts = new Map();
  
  // Contar quantas de cada carta na mão
  handNames.forEach(name => {
    handCounts.set(name, (handCounts.get(name) || 0) + 1);
  });

  cards.forEach(card => {
    const normalizedName = (card.name || '').toLowerCase();
    const inHand = handCounts.get(normalizedName) || 0;
    const remaining = (card.quantity || 1) - inHand;
    
    for (let i = 0; i < remaining; i++) {
      cardPool.push({
        name: card.name,
        cost: card.cost || 0,
        inkable: card.inkable || false,
        lore: card.lore || 0,
        type: card.type || 'Character',
      });
    }
  });

  // Shuffle pool
  const shuffled = fisherYatesShuffle(cardPool);

  // Nova mão
  const newHand = [...hand];
  let drawIndex = 0;

  // Substituir cartas nos índices de mulligan
  mulliganIndices.forEach(index => {
    if (index >= 0 && index < 7 && drawIndex < shuffled.length) {
      newHand[index] = shuffled[drawIndex].name;
      drawIndex++;
    }
  });

  // Calcular stats da nova mão
  const handCards = newHand.map(name => {
    const normalizedName = name.toLowerCase();
    const card = cards.find(c => (c.name || '').toLowerCase() === normalizedName);
    return {
      name,
      cost: card?.cost || 0,
      inkable: card?.inkable || false,
      lore: card?.lore || 0,
      type: card?.type || 'Character',
    };
  });

  const stats = calculateHandStats(handCards);

  return {
    hand: newHand,
    stats,
    mulliganedCount: mulliganIndices.length,
  };
}

/**
 * Fisher-Yates shuffle algorithm
 */
function fisherYatesShuffle(array) {
  const shuffled = [...array];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

/**
 * Calcula estatísticas da mão
 */
function calculateHandStats(hand) {
  const costs = hand.map(c => c.cost || 0);
  const inkableCount = hand.filter(c => c.inkable).length;
  const loreCount = hand.filter(c => (c.lore || 0) > 0).length;

  const avgCost = costs.reduce((a, b) => a + b, 0) / 7;
  
  const hasTurn1 = costs.some(c => c <= 1);
  const hasTurn2 = costs.some(c => c === 2);
  const hasTurn3 = costs.some(c => c === 3);

  return {
    avgCost: Math.round(avgCost * 10) / 10,
    inkableCount,
    inkableRatio: Math.round((inkableCount / 7) * 100),
    loreGenerators: loreCount,
    hasTurn1,
    hasTurn2,
    hasTurn3,
    curveQuality: hasTurn1 && hasTurn2 && hasTurn3 ? 'Good' : hasTurn2 ? 'Average' : 'Poor',
  };
}

module.exports = {
  shuffleHand,
  generateMultipleHands,
  simulateMulligan,
  calculateHandStats,
};

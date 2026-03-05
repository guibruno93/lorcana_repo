'use strict';

/**
 * Mulligan Advisor - Sugere quais cartas trocar no mulligan
 * @module services/ai/mulliganAdvisor
 */

const fs = require('fs');
const path = require('path');

/**
 * Build card index inline (avoid dependency issues)
 */
function buildCardIndex() {
  try {
    const possiblePaths = [
      path.join(__dirname, '../../db/cards.json'),
      path.join(__dirname, '../db/cards.json'),
      path.join(process.cwd(), 'backend/db/cards.json'),
      path.join(process.cwd(), 'db/cards.json'),
    ];

    let cardsData = null;

    for (const cardPath of possiblePaths) {
      if (fs.existsSync(cardPath)) {
        const rawData = fs.readFileSync(cardPath, 'utf8');
        cardsData = JSON.parse(rawData);
        break;
      }
    }

    if (!cardsData) {
      throw new Error('cards.json not found');
    }

    let cardsArray;
    
    if (Array.isArray(cardsData)) {
      cardsArray = cardsData;
    } else if (cardsData.cards && Array.isArray(cardsData.cards)) {
      cardsArray = cardsData.cards;
    } else if (typeof cardsData === 'object') {
      cardsArray = Object.values(cardsData);
    } else {
      throw new Error('cards.json has invalid format');
    }

    const index = new Map();
    
    for (const card of cardsArray) {
      if (!card || typeof card !== 'object') continue;
      
      const name = (card.name || card.Name || '').toLowerCase().trim();
      if (!name) continue;
      
      index.set(name, card);
    }

    return index;
    
  } catch (err) {
    console.error('Error in buildCardIndex:', err.message);
    throw err;
  }
}

/**
 * Analisa mulligan para uma mão inicial
 * @param {Array<string>} hand - Mão de 7 cartas
 * @param {Object} deckAnalysis - Análise do deck
 * @returns {Object} Sugestões de mulligan
 */
function analyzeMulligan(hand, deckAnalysis) {
  if (!Array.isArray(hand) || hand.length !== 7) {
    throw new Error('Hand must be an array of 7 cards');
  }

  const cardIndex = buildCardIndex();

  // Resolver cartas da mão
  const handCards = hand.map(name => {
    const normalized = String(name || '').toLowerCase().trim();
    const card = cardIndex.get(normalized);
    
    if (!card) {
      return { 
        name: String(name || 'Unknown'), 
        cost: 0, 
        inkable: false, 
        unknown: true 
      };
    }
    
    return { ...card, unknown: false };
  });

  // Detectar estratégia do deck
  const strategy = detectStrategy(deckAnalysis);

  // Identificar cartas problemáticas
  const problematicCards = identifyProblematicCards(handCards, deckAnalysis, strategy);

  // Gerar sugestões
  const suggestions = generateMulliganSuggestions(handCards, problematicCards, strategy);

  // Decidir estratégia de mulligan
  const decision = decideMulliganStrategy(suggestions, strategy);

  // Separar cartas
  const keepCards = suggestions
    .filter(s => s.action === 'Keep')
    .map(s => s.card);

  const mulliganCards = suggestions
    .filter(s => s.action === 'Mulligan')
    .map(s => s.card);

  return {
    decision: decision.decision,
    confidence: decision.confidence,
    reasoning: decision.reasoning,
    strategy,
    suggestions,
    keepCards,
    mulliganCards,
    expectedImprovement: decision.expectedImprovement,
  };
}

/**
 * Detecta estratégia do deck
 */
function detectStrategy(deckAnalysis) {
  const archetype = deckAnalysis.archetype || 'Unknown';
  const inks = deckAnalysis.inks || [];
  const avgCost = calculateAvgCost(deckAnalysis.cards || []);

  let strategyType = 'Balanced';
  let priorities = ['Early plays', 'Curve', 'Inkable cards'];

  // Sapphire Ramp
  if (inks.includes('Sapphire')) {
    strategyType = 'Ramp';
    priorities = ['Inkable cards', 'Card draw', 'Late game threats'];
  }
  
  // Amber/Ruby Aggro
  if ((inks.includes('Amber') || inks.includes('Ruby')) && avgCost <= 3.5) {
    strategyType = 'Aggro';
    priorities = ['1-2 cost plays', 'Non-inkable threats', 'Early pressure'];
  }

  // Steel Control
  if (inks.includes('Steel') && avgCost >= 4) {
    strategyType = 'Control';
    priorities = ['Removal', 'Inkable cards', 'Late game'];
  }

  // Emerald Tempo
  if (inks.includes('Emerald')) {
    strategyType = 'Tempo';
    priorities = ['2-3 cost plays', 'Card advantage', 'Efficiency'];
  }

  return {
    type: strategyType,
    archetype,
    priorities,
    idealCurve: getIdealCurve(strategyType),
    idealInkRatio: getIdealInkRatio(strategyType),
  };
}

/**
 * Get ideal curve for strategy
 */
function getIdealCurve(strategyType) {
  const curves = {
    'Aggro': { 1: 2, 2: 2, 3: 2, '4+': 1 },
    'Ramp': { 1: 1, 2: 1, 3: 1, '4+': 4 },
    'Control': { 1: 1, 2: 1, 3: 2, '4+': 3 },
    'Tempo': { 1: 1, 2: 2, 3: 2, '4+': 2 },
    'Balanced': { 1: 1, 2: 2, 3: 2, '4+': 2 },
  };
  
  return curves[strategyType] || curves['Balanced'];
}

/**
 * Get ideal ink ratio for strategy
 */
function getIdealInkRatio(strategyType) {
  const ratios = {
    'Aggro': 0.45,      // 45% inkable (mais threats)
    'Ramp': 0.70,       // 70% inkable (ramp ink)
    'Control': 0.60,    // 60% inkable
    'Tempo': 0.55,      // 55% inkable
    'Balanced': 0.55,   // 55% inkable
  };
  
  return ratios[strategyType] || 0.55;
}

/**
 * Identifica cartas problemáticas
 */
function identifyProblematicCards(handCards, deckAnalysis, strategy) {
  const problems = [];

  const inkableCount = handCards.filter(c => c.inkable).length;
  const inkableRatio = inkableCount / 7;
  const costs = handCards.map(c => c.cost || 0);
  const avgCost = costs.reduce((a, b) => a + b, 0) / 7;

  handCards.forEach((card, index) => {
    const cost = card.cost || 0;

    // Priority 3 (HIGH): Cards that are clearly wrong
    
    // High cost without early game
    if (cost >= 7 && !costs.some(c => c <= 2)) {
      problems.push({
        cardIndex: index,
        card: card.name,
        priority: 3,
        reason: 'High cost card without early game',
        category: 'curve',
      });
    }

    // Duplicate expensive cards
    const duplicates = handCards.filter(c => c.name === card.name && c.cost >= 5);
    if (duplicates.length >= 2 && cost >= 5) {
      problems.push({
        cardIndex: index,
        card: card.name,
        priority: 3,
        reason: 'Duplicate expensive card',
        category: 'redundancy',
      });
    }

    // Priority 2 (MEDIUM): Strategy mismatches

    // Ramp strategy: need inkables
    if (strategy.type === 'Ramp' && !card.inkable && cost >= 4) {
      problems.push({
        cardIndex: index,
        card: card.name,
        priority: 2,
        reason: 'Ramp deck needs more inkable cards',
        category: 'strategy',
      });
    }

    // Aggro strategy: late game without curve
    if (strategy.type === 'Aggro' && cost >= 6 && !costs.some(c => c <= 2)) {
      problems.push({
        cardIndex: index,
        card: card.name,
        priority: 2,
        reason: 'Aggro hand too slow',
        category: 'strategy',
      });
    }

    // Too many inkables
    if (inkableRatio > 0.7 && card.inkable && cost >= 4) {
      problems.push({
        cardIndex: index,
        card: card.name,
        priority: 2,
        reason: 'Too many inkable cards',
        category: 'balance',
      });
    }

    // Priority 1 (LOW): Minor issues

    // Too few inkables for any strategy
    if (inkableRatio < 0.3 && card.inkable === false && cost >= 5) {
      problems.push({
        cardIndex: index,
        card: card.name,
        priority: 1,
        reason: 'Hand lacks inkable cards',
        category: 'balance',
      });
    }
  });

  // Remove duplicates (keep highest priority)
  const seen = new Map();
  problems.forEach(p => {
    if (!seen.has(p.cardIndex) || seen.get(p.cardIndex).priority < p.priority) {
      seen.set(p.cardIndex, p);
    }
  });

  return Array.from(seen.values()).sort((a, b) => b.priority - a.priority);
}

/**
 * Gera sugestões de mulligan
 */
function generateMulliganSuggestions(handCards, problematicCards, strategy) {
  const suggestions = [];

  handCards.forEach((card, index) => {
    const problem = problematicCards.find(p => p.cardIndex === index);

    if (problem) {
      suggestions.push({
        card: card.name,
        cost: card.cost || 0,
        inkable: card.inkable || false,
        action: 'Mulligan',
        priority: problem.priority,
        reasons: [problem.reason],
        alternatives: getAlternatives(card, strategy),
      });
    } else {
      // Keep card
      const keepReasons = getKeepReasons(card, strategy);
      suggestions.push({
        card: card.name,
        cost: card.cost || 0,
        inkable: card.inkable || false,
        action: 'Keep',
        priority: 0,
        reasons: keepReasons,
        alternatives: [],
      });
    }
  });

  return suggestions;
}

/**
 * Get reasons to keep a card
 */
function getKeepReasons(card, strategy) {
  const reasons = [];
  const cost = card.cost || 0;

  if (cost <= 2) reasons.push('Early game play');
  if (card.inkable) reasons.push('Inkable');
  
  if (strategy.type === 'Ramp' && card.inkable) {
    reasons.push('Ramp strategy - inkable card');
  }
  
  if (strategy.type === 'Aggro' && cost <= 3 && !card.inkable) {
    reasons.push('Aggro threat');
  }

  if (reasons.length === 0) {
    reasons.push('Fits curve');
  }

  return reasons;
}

/**
 * Get alternatives for a card
 */
function getAlternatives(card, strategy) {
  const alternatives = [];

  if (strategy.type === 'Ramp') {
    alternatives.push('Look for inkable cards');
    alternatives.push('Look for card draw');
  } else if (strategy.type === 'Aggro') {
    alternatives.push('Look for 1-3 cost cards');
    alternatives.push('Look for early threats');
  } else if (strategy.type === 'Control') {
    alternatives.push('Look for removal');
    alternatives.push('Look for inkable cards');
  } else {
    alternatives.push('Look for lower cost cards');
    alternatives.push('Look for better curve');
  }

  return alternatives;
}

/**
 * Decide mulligan strategy
 */
function decideMulliganStrategy(suggestions, strategy) {
  const mulliganCount = suggestions.filter(s => s.action === 'Mulligan').length;
  const highPriority = suggestions.filter(s => s.priority === 3).length;

  const inkableCount = suggestions.filter(s => s.inkable && s.action === 'Keep').length;
  const earlyPlays = suggestions.filter(s => s.cost <= 2 && s.action === 'Keep').length;

  let decision = 'Keep';
  let confidence = 0.5;
  let reasoning = '';
  let expectedImprovement = 0;

  // Full mulligan conditions
  if (mulliganCount >= 5 || highPriority >= 3) {
    decision = 'Full Mulligan';
    confidence = 0.85;
    reasoning = `Mulligan ${mulliganCount} cards. Hand is too problematic to keep.`;
    expectedImprovement = 30;
  }
  // Partial mulligan
  else if (mulliganCount >= 2) {
    decision = 'Partial Mulligan';
    confidence = 0.75;
    reasoning = `Mulligan ${mulliganCount} specific problematic cards while keeping the core.`;
    expectedImprovement = 15;
  }
  // Keep
  else if (mulliganCount <= 1) {
    decision = 'Keep';
    confidence = 0.9;
    reasoning = 'Hand is good enough to keep.';
    expectedImprovement = -5; // Mulliganing would make it worse
  }

  // Adjust for strategy
  if (strategy.type === 'Ramp' && inkableCount < 3) {
    decision = 'Partial Mulligan';
    reasoning += ' Ramp deck needs more inkable cards.';
    expectedImprovement += 10;
  }

  if (strategy.type === 'Aggro' && earlyPlays < 2) {
    decision = 'Partial Mulligan';
    reasoning += ' Aggro deck needs early plays.';
    expectedImprovement += 10;
  }

  return {
    decision,
    confidence: Math.min(0.95, confidence),
    reasoning,
    expectedImprovement: Math.max(0, expectedImprovement),
  };
}

/**
 * Simula múltiplas mãos (Monte Carlo)
 */
function simulateHands(deckAnalysis, simulations = 1000) {
  const results = {
    totalSimulations: simulations,
    avgScore: 0,
    scoreDistribution: {
      excellent: 0,
      good: 0,
      average: 0,
      poor: 0,
    },
    avgCurve: 0,
    avgInkRatio: 0,
    mulliganRate: 0,
  };

  // Simplified simulation (real implementation would draw random hands)
  // For now, return estimated statistics based on deck composition

  const inkableRatio = deckAnalysis.inkablePct / 100;
  const cards = deckAnalysis.cards || [];
  const avgCost = calculateAvgCost(cards);

  // Estimate based on deck composition
  results.avgScore = 50 + (inkableRatio >= 0.5 && inkableRatio <= 0.65 ? 15 : 0);
  results.avgScore += (avgCost >= 3 && avgCost <= 4.5 ? 10 : 0);

  results.scoreDistribution = {
    excellent: Math.round(results.avgScore >= 75 ? 25 : 10),
    good: Math.round(results.avgScore >= 65 ? 35 : 25),
    average: Math.round(40),
    poor: Math.round(results.avgScore <= 50 ? 25 : 5),
  };

  results.avgCurve = avgCost;
  results.avgInkRatio = inkableRatio * 100;
  results.mulliganRate = results.avgScore < 60 ? 45 : 25;

  return results;
}

/**
 * Helper: Calculate average cost
 */
function calculateAvgCost(cards) {
  if (cards.length === 0) return 0;
  const total = cards.reduce((sum, c) => sum + (c.cost || 0) * (c.quantity || 1), 0);
  const count = cards.reduce((sum, c) => sum + (c.quantity || 1), 0);
  return count > 0 ? total / count : 0;
}

module.exports = {
  analyzeMulligan,
  simulateHands,
  detectStrategy,
  identifyProblematicCards,
  generateMulliganSuggestions,
};

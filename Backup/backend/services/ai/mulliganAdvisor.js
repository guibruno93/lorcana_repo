'use strict';

/**
 * Mulligan Advisor v2 - Análise baseada em efeitos REAIS das cartas
 * @module services/ai/mulliganAdvisor
 */

const { loadCardEffects, getCardAnalysis, EFFECT_CATEGORIES } = require('./cardEffectsParser');

// Load card effects once on startup
let CARD_EFFECTS_INDEX = null;

function getCardEffectsIndex() {
  if (!CARD_EFFECTS_INDEX) {
    CARD_EFFECTS_INDEX = loadCardEffects();
  }
  return CARD_EFFECTS_INDEX;
}

/**
 * Analisa mulligan para uma mão inicial
 * VERSÃO 2.0 - Baseada em efeitos REAIS das cartas
 */
function analyzeMulligan(hand, deckAnalysis) {
  if (!Array.isArray(hand) || hand.length !== 7) {
    throw new Error('Hand must be an array of 7 cards');
  }

  const cardIndex = getCardEffectsIndex();

  // Resolver cartas da mão com análise completa
  const handCards = hand.map(name => {
    const analysis = getCardAnalysis(name, cardIndex);
    
    if (!analysis) {
      return { 
        name: String(name || 'Unknown'), 
        cost: 0, 
        inkable: false, 
        unknown: true,
        role: 'Unknown',
        effects: [],
        timing: 'Unknown',
      };
    }
    
    return { ...analysis, unknown: false };
  });

  // Detectar estratégia do deck
  const strategy = detectStrategy(deckAnalysis, cardIndex);

  // Analisar mão baseada em efeitos REAIS
  const handAnalysis = analyzeHandComposition(handCards, strategy);

  // Identificar cartas problemáticas (com base em EFEITOS)
  const problematicCards = identifyProblematicCards(handCards, handAnalysis, strategy);

  // Gerar sugestões
  const suggestions = generateMulliganSuggestions(handCards, problematicCards, handAnalysis, strategy);

  // Decidir estratégia de mulligan
  const decision = decideMulliganStrategy(suggestions, handAnalysis, strategy);

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
    handAnalysis,
    suggestions,
    keepCards,
    mulliganCards,
    expectedImprovement: decision.expectedImprovement,
  };
}

/**
 * Detecta estratégia do deck baseada em EFEITOS das cartas
 */
function detectStrategy(deckAnalysis, cardIndex) {
  const cards = deckAnalysis.cards || [];
  const inks = deckAnalysis.inks || [];
  
  let rampCount = 0;
  let drawCount = 0;
  let removalCount = 0;
  let evasiveCount = 0;
  let earlyLoreCount = 0;
  
  let totalCost = 0;
  let totalCards = 0;

  cards.forEach(card => {
    const analysis = getCardAnalysis(card.name, cardIndex);
    if (!analysis) return;
    
    const qty = card.quantity || 1;
    totalCards += qty;
    totalCost += (analysis.cost || 0) * qty;
    
    // Count effects
    const hasRamp = analysis.effects.some(e => e.type === EFFECT_CATEGORIES.RAMP);
    const hasDraw = analysis.effects.some(e => e.type === EFFECT_CATEGORIES.DRAW);
    const hasRemoval = analysis.effects.some(e => e.type === EFFECT_CATEGORIES.REMOVAL);
    const hasEvasion = analysis.effects.some(e => e.type === EFFECT_CATEGORIES.EVASION) || 
                      analysis.keywords.includes('Evasive');
    
    if (hasRamp) rampCount += qty;
    if (hasDraw) drawCount += qty;
    if (hasRemoval) removalCount += qty;
    if (hasEvasion) evasiveCount += qty;
    
    if (analysis.cost <= 2 && analysis.lore >= 1) {
      earlyLoreCount += qty;
    }
  });

  const avgCost = totalCards > 0 ? totalCost / totalCards : 0;
  const inkableRatio = deckAnalysis.inkablePct / 100;

  // Detect strategy based on REAL effects
  let strategyType = 'Balanced';
  let priorities = [];
  let keyEffects = [];

  // RAMP Strategy
  if (rampCount >= 6 && avgCost >= 4) {
    strategyType = 'Ramp';
    priorities = [
      'Ramp cards (Sail, Develop)',
      'Inkable cards',
      'Card draw',
      'Big threats (6+ cost)',
    ];
    keyEffects = [EFFECT_CATEGORIES.RAMP, EFFECT_CATEGORIES.DRAW];
  }
  // AGGRO Strategy
  else if (earlyLoreCount >= 8 && avgCost <= 3.5) {
    strategyType = 'Aggro';
    priorities = [
      'Early lore (1-2 cost)',
      'Evasive threats',
      'Non-inkable aggression',
      'Curve out (turns 1-3)',
    ];
    keyEffects = [EFFECT_CATEGORIES.EVASION, EFFECT_CATEGORIES.QUEST];
  }
  // CONTROL Strategy
  else if (removalCount >= 8 && avgCost >= 4) {
    strategyType = 'Control';
    priorities = [
      'Removal spells',
      'Inkable cards',
      'Card draw',
      'Survive early game',
    ];
    keyEffects = [EFFECT_CATEGORIES.REMOVAL, EFFECT_CATEGORIES.DRAW];
  }
  // TEMPO Strategy
  else if (drawCount >= 6 && avgCost >= 3 && avgCost <= 4.5) {
    strategyType = 'Tempo';
    priorities = [
      'Card draw',
      'Efficient threats (2-4 cost)',
      'Removal',
      'Generate advantage',
    ];
    keyEffects = [EFFECT_CATEGORIES.DRAW, EFFECT_CATEGORIES.REMOVAL];
  }
  // MIDRANGE (default)
  else {
    strategyType = 'Midrange';
    priorities = [
      'Curve out (2-5 cost)',
      'Balanced threats',
      'Some interaction',
    ];
    keyEffects = [];
  }

  return {
    type: strategyType,
    archetype: deckAnalysis.archetype || strategyType,
    priorities,
    keyEffects,
    stats: {
      rampCount,
      drawCount,
      removalCount,
      evasiveCount,
      earlyLoreCount,
      avgCost,
      inkableRatio,
    },
  };
}

/**
 * Analisa composição da mão baseada em EFEITOS
 */
function analyzeHandComposition(handCards, strategy) {
  const composition = {
    // Curve
    turn1Plays: 0,
    turn2Plays: 0,
    turn3Plays: 0,
    avgCost: 0,
    
    // Ink
    inkableCount: 0,
    inkableRatio: 0,
    
    // Effects (REAL)
    rampCards: [],
    drawCards: [],
    removalCards: [],
    evasiveCards: [],
    earlyLoreCards: [],
    
    // Roles
    threats: [],
    answers: [],
    engines: [],
    
    // Quality
    hasGoodCurve: false,
    hasEngines: false,
    hasAnswers: false,
    hasThreats: false,
  };

  let totalCost = 0;

  handCards.forEach(card => {
    const cost = card.cost || 0;
    totalCost += cost;
    
    if (card.inkable) composition.inkableCount++;
    
    if (cost <= 1) composition.turn1Plays++;
    if (cost === 2) composition.turn2Plays++;
    if (cost === 3) composition.turn3Plays++;
    
    // Analyze REAL effects
    const hasRamp = card.effects?.some(e => e.type === EFFECT_CATEGORIES.RAMP);
    const hasDraw = card.effects?.some(e => e.type === EFFECT_CATEGORIES.DRAW);
    const hasRemoval = card.effects?.some(e => e.type === EFFECT_CATEGORIES.REMOVAL);
    const hasEvasion = card.effects?.some(e => e.type === EFFECT_CATEGORIES.EVASION) || 
                      card.keywords?.includes('Evasive');
    
    if (hasRamp) composition.rampCards.push(card.name);
    if (hasDraw) composition.drawCards.push(card.name);
    if (hasRemoval) composition.removalCards.push(card.name);
    if (hasEvasion) composition.evasiveCards.push(card.name);
    
    if (cost <= 2 && card.lore >= 1) {
      composition.earlyLoreCards.push(card.name);
    }
    
    // Classify by role
    if (card.role === 'Ramp' || card.role === 'Draw Engine') {
      composition.engines.push(card.name);
    }
    if (card.role === 'Removal') {
      composition.answers.push(card.name);
    }
    if (card.role === 'Evasive Threat' || card.role === 'Finisher' || card.role === 'Early Lore') {
      composition.threats.push(card.name);
    }
  });

  composition.avgCost = totalCost / 7;
  composition.inkableRatio = composition.inkableCount / 7;
  
  composition.hasGoodCurve = composition.turn1Plays >= 1 || composition.turn2Plays >= 1;
  composition.hasEngines = composition.engines.length > 0;
  composition.hasAnswers = composition.answers.length > 0;
  composition.hasThreats = composition.threats.length > 0;

  return composition;
}

/**
 * Identifica cartas problemáticas baseado em EFEITOS e ESTRATÉGIA
 */
function identifyProblematicCards(handCards, handAnalysis, strategy) {
  const problems = [];

  handCards.forEach((card, index) => {
    if (card.unknown) {
      problems.push({
        cardIndex: index,
        card: card.name,
        priority: 3,
        reason: 'Unknown card',
        category: 'unknown',
      });
      return;
    }

    const cost = card.cost || 0;

    // STRATEGY-SPECIFIC PROBLEMS

    // RAMP Strategy
    if (strategy.type === 'Ramp') {
      // Missing ramp cards
      if (handAnalysis.rampCards.length === 0 && handAnalysis.inkableCount < 4) {
        if (!card.inkable && cost >= 6) {
          problems.push({
            cardIndex: index,
            card: card.name,
            priority: 3,
            reason: 'Ramp deck: expensive card without ramp enablers',
            category: 'strategy',
          });
        }
      }
      
      // Too many expensive threats without ramp
      if (cost >= 7 && handAnalysis.rampCards.length === 0 && handAnalysis.drawCards.length === 0) {
        problems.push({
          cardIndex: index,
          card: card.name,
          priority: 2,
          reason: 'Too expensive without ramp/draw',
          category: 'curve',
        });
      }
    }

    // AGGRO Strategy
    if (strategy.type === 'Aggro') {
      // Expensive cards in aggro
      if (cost >= 6 && !card.effects?.some(e => e.type === EFFECT_CATEGORIES.EVASION)) {
        problems.push({
          cardIndex: index,
          card: card.name,
          priority: 3,
          reason: 'Aggro deck: too expensive, need early threats',
          category: 'strategy',
        });
      }
      
      // No early game
      if (handAnalysis.earlyLoreCards.length === 0 && cost >= 4) {
        problems.push({
          cardIndex: index,
          card: card.name,
          priority: 2,
          reason: 'Aggro needs early lore generators',
          category: 'curve',
        });
      }
      
      // Too many inkables in aggro
      if (card.inkable && cost >= 4 && handAnalysis.inkableCount >= 5) {
        problems.push({
          cardIndex: index,
          card: card.name,
          priority: 1,
          reason: 'Too many inkables for aggro',
          category: 'balance',
        });
      }
    }

    // CONTROL Strategy
    if (strategy.type === 'Control') {
      // No answers
      if (handAnalysis.removalCards.length === 0 && card.role !== 'Removal' && cost >= 5) {
        problems.push({
          cardIndex: index,
          card: card.name,
          priority: 2,
          reason: 'Control deck needs removal',
          category: 'strategy',
        });
      }
      
      // Too many threats, not enough answers
      if (handAnalysis.threats.length >= 4 && handAnalysis.answers.length === 0 && card.role === 'Finisher') {
        problems.push({
          cardIndex: index,
          card: card.name,
          priority: 2,
          reason: 'Control needs answers, not just threats',
          category: 'balance',
        });
      }
    }

    // UNIVERSAL PROBLEMS
    
    // Duplicates of expensive cards
    const duplicates = handCards.filter(c => c.name === card.name);
    if (duplicates.length >= 2 && cost >= 6) {
      problems.push({
        cardIndex: index,
        card: card.name,
        priority: 3,
        reason: 'Duplicate expensive card - dead draw',
        category: 'redundancy',
      });
    }
    
    // All expensive, no curve
    if (handAnalysis.avgCost >= 5 && cost >= 6 && handAnalysis.turn1Plays === 0 && handAnalysis.turn2Plays === 0) {
      problems.push({
        cardIndex: index,
        card: card.name,
        priority: 3,
        reason: 'Hand too slow - no early plays',
        category: 'curve',
      });
    }
    
    // Too many non-inkables
    if (handAnalysis.inkableCount <= 2 && !card.inkable && cost >= 4) {
      problems.push({
        cardIndex: index,
        card: card.name,
        priority: 2,
        reason: 'Hand lacks inkables - ink screw risk',
        category: 'balance',
      });
    }
  });

  // Remove duplicates, keep highest priority
  const seen = new Map();
  problems.forEach(p => {
    if (!seen.has(p.cardIndex) || seen.get(p.cardIndex).priority < p.priority) {
      seen.set(p.cardIndex, p);
    }
  });

  return Array.from(seen.values()).sort((a, b) => b.priority - a.priority);
}

/**
 * Gera sugestões de mulligan baseadas em EFEITOS
 */
function generateMulliganSuggestions(handCards, problematicCards, handAnalysis, strategy) {
  const suggestions = [];

  handCards.forEach((card, index) => {
    const problem = problematicCards.find(p => p.cardIndex === index);

    if (problem) {
      suggestions.push({
        card: card.name,
        cost: card.cost || 0,
        inkable: card.inkable || false,
        role: card.role || 'Unknown',
        effects: card.effects?.map(e => e.type) || [],
        action: 'Mulligan',
        priority: problem.priority,
        reasons: [problem.reason],
        alternatives: getAlternatives(card, strategy, handAnalysis),
      });
    } else {
      // Keep card - explain WHY
      const keepReasons = getKeepReasons(card, strategy, handAnalysis);
      suggestions.push({
        card: card.name,
        cost: card.cost || 0,
        inkable: card.inkable || false,
        role: card.role || 'Unknown',
        effects: card.effects?.map(e => e.type) || [],
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
 * Get reasons to KEEP a card (based on EFFECTS)
 */
function getKeepReasons(card, strategy, handAnalysis) {
  const reasons = [];
  const cost = card.cost || 0;
  
  // Strategy-specific keeps
  if (strategy.type === 'Ramp') {
    if (card.effects?.some(e => e.type === EFFECT_CATEGORIES.RAMP)) {
      reasons.push('⚡ RAMP enabler - critical for strategy');
    }
    if (card.effects?.some(e => e.type === EFFECT_CATEGORIES.DRAW)) {
      reasons.push('📚 Card draw - find more ramp');
    }
    if (card.inkable && cost <= 3) {
      reasons.push('💧 Inkable early play');
    }
  }
  
  if (strategy.type === 'Aggro') {
    if (cost <= 2 && card.lore >= 1) {
      reasons.push('⚡ Early lore - aggro needs speed');
    }
    if (card.keywords?.includes('Evasive') || card.effects?.some(e => e.type === EFFECT_CATEGORIES.EVASION)) {
      reasons.push('👻 Evasive threat - unblockable damage');
    }
    if (!card.inkable && cost <= 3) {
      reasons.push('💥 Non-inkable threat');
    }
  }
  
  if (strategy.type === 'Control') {
    if (card.effects?.some(e => e.type === EFFECT_CATEGORIES.REMOVAL)) {
      reasons.push('🗡️ Removal - control needs answers');
    }
    if (card.inkable) {
      reasons.push('💧 Inkable - ramp into late game');
    }
    if (card.effects?.some(e => e.type === EFFECT_CATEGORIES.DRAW)) {
      reasons.push('📚 Card draw - control needs card advantage');
    }
  }
  
  // Universal keeps
  if (cost <= 2) {
    reasons.push('📈 Early game play');
  }
  
  if (card.role === 'Draw Engine' || card.role === 'Ramp') {
    reasons.push('🔧 Engine piece - generates advantage');
  }
  
  if (handAnalysis.turn1Plays === 0 && cost === 1) {
    reasons.push('🎯 Only turn 1 play');
  }
  
  if (handAnalysis.turn2Plays === 0 && cost === 2) {
    reasons.push('🎯 Only turn 2 play');
  }

  if (reasons.length === 0) {
    reasons.push('✓ Fits curve');
  }

  return reasons;
}

/**
 * Get alternatives for a card
 */
function getAlternatives(card, strategy, handAnalysis) {
  const alternatives = [];

  if (strategy.type === 'Ramp') {
    if (handAnalysis.rampCards.length === 0) {
      alternatives.push('Look for: Sail The Azurite Sea, Develop Your Brain');
    }
    if (handAnalysis.inkableCount < 3) {
      alternatives.push('Look for: Inkable cards');
    }
  } else if (strategy.type === 'Aggro') {
    alternatives.push('Look for: 1-3 cost threats');
    if (handAnalysis.evasiveCards.length === 0) {
      alternatives.push('Look for: Evasive threats');
    }
  } else if (strategy.type === 'Control') {
    if (handAnalysis.removalCards.length === 0) {
      alternatives.push('Look for: Removal (Be Prepared, He Hurled His Thunderbolt)');
    }
    alternatives.push('Look for: Inkable cards');
  } else {
    alternatives.push('Look for: Lower cost cards');
    alternatives.push('Look for: Better curve');
  }

  return alternatives;
}

/**
 * Decide mulligan strategy
 */
function decideMulliganStrategy(suggestions, handAnalysis, strategy) {
  const mulliganCount = suggestions.filter(s => s.action === 'Mulligan').length;
  const criticalProblems = suggestions.filter(s => s.priority === 3).length;
  const highProblems = suggestions.filter(s => s.priority >= 2).length;

  let decision = 'Keep';
  let confidence = 0.5;
  let reasoning = '';
  let expectedImprovement = 0;

  // CRITICAL: Full mulligan
  if (criticalProblems >= 3 || mulliganCount >= 5) {
    decision = 'Full Mulligan';
    confidence = 0.9;
    reasoning = `Full mulligan recommended. Hand has ${criticalProblems} critical issues and ${mulliganCount} total problems.`;
    expectedImprovement = 40;
  }
  // PARTIAL: Some problems
  else if (highProblems >= 2 || mulliganCount >= 2) {
    decision = 'Partial Mulligan';
    confidence = 0.8;
    reasoning = `Partial mulligan: exchange ${mulliganCount} problematic cards.`;
    expectedImprovement = 20;
  }
  // KEEP: Good hand
  else if (mulliganCount <= 1) {
    decision = 'Keep';
    confidence = 0.85;
    reasoning = 'Hand is good enough to keep. Fits strategy well.';
    expectedImprovement = -5;
  }

  // Strategy-specific adjustments
  if (strategy.type === 'Ramp') {
    if (handAnalysis.rampCards.length === 0 && handAnalysis.avgCost >= 5) {
      decision = 'Full Mulligan';
      reasoning += ' Ramp deck without ramp enablers - unplayable hand.';
      confidence = 0.95;
      expectedImprovement = 50;
    } else if (handAnalysis.rampCards.length >= 1 && handAnalysis.inkableCount >= 3) {
      decision = 'Keep';
      reasoning += ' Has ramp enablers and inkables - solid ramp hand.';
      confidence = 0.9;
    }
  }

  if (strategy.type === 'Aggro') {
    if (handAnalysis.earlyLoreCards.length === 0) {
      decision = 'Full Mulligan';
      reasoning += ' Aggro needs early lore generators.';
      confidence = 0.9;
      expectedImprovement = 45;
    } else if (handAnalysis.earlyLoreCards.length >= 2) {
      decision = 'Keep';
      reasoning += ' Has multiple early threats - good aggro start.';
      confidence = 0.85;
    }
  }

  if (strategy.type === 'Control') {
    if (handAnalysis.answers.length === 0 && handAnalysis.threats.length >= 4) {
      decision = 'Partial Mulligan';
      reasoning += ' Control needs answers, not just threats.';
      expectedImprovement += 15;
    }
  }

  return {
    decision,
    confidence: Math.min(0.95, confidence),
    reasoning,
    expectedImprovement: Math.max(0, expectedImprovement),
  };
}

/**
 * Simula múltiplas mãos (placeholder)
 */
function simulateHands(deckAnalysis, simulations = 1000) {
  // Simplified - real implementation would use card effects
  const inkableRatio = deckAnalysis.inkablePct / 100;
  const avgCost = calculateAvgCost(deckAnalysis.cards || []);

  const results = {
    totalSimulations: simulations,
    avgScore: 50 + (inkableRatio >= 0.5 && inkableRatio <= 0.65 ? 15 : 0) + (avgCost >= 3 && avgCost <= 4.5 ? 10 : 0),
    scoreDistribution: {
      excellent: 15,
      good: 35,
      average: 35,
      poor: 15,
    },
    avgCurve: avgCost,
    avgInkRatio: inkableRatio * 100,
    mulliganRate: 35,
  };

  return results;
}

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
};

'use strict';

/**
 * Strategy Analyzer - Detecta estratégia do deck e sugere melhorias
 * Sistema baseado em regras (expert system) que simula ML
 * @module services/ai/strategyAnalyzer
 */

/**
 * Analisa estratégia completa do deck
 * @param {Object} deckAnalysis - Análise do deck
 * @returns {Object} Estratégia detectada e sugestões
 */
function analyzeStrategy(deckAnalysis) {
  // Detectar arquétipo e estratégia
  const archetype = detectArchetype(deckAnalysis);
  
  // Identificar key cards
  const keyCards = identifyKeyCards(deckAnalysis, archetype);
  
  // Analisar game plan
  const gamePlan = generateGamePlan(archetype, deckAnalysis);
  
  // Sugestões de cartas
  const suggestions = generateCardSuggestions(deckAnalysis, archetype);
  
  // Análise de consistência
  const consistency = analyzeConsistency(deckAnalysis, archetype);
  
  // Pontos fortes e fracos
  const strengths = identifyStrengths(deckAnalysis, archetype);
  const weaknesses = identifyWeaknesses(deckAnalysis, archetype);

  return {
    archetype,
    keyCards,
    gamePlan,
    suggestions,
    consistency,
    strengths,
    weaknesses,
    confidenceScore: calculateConfidenceScore(deckAnalysis, archetype),
  };
}

/**
 * Detecta arquétipo baseado em cartas e composição
 */
function detectArchetype(deckAnalysis) {
  const cards = deckAnalysis.cards || [];
  const inks = deckAnalysis.inks || [];
  const avgCost = calculateAvgCost(cards);
  const inkableRatio = deckAnalysis.inkablePct / 100;

  // Criar "fingerprint" do deck
  const cardNames = cards.map(c => (c.name || '').toLowerCase()).join(' ');
  
  // Detectar arquétipos conhecidos por cartas-chave
  
  // Amber/Steel Control (Hades + Be Prepared)
  if (cardNames.includes('hades') && cardNames.includes('be prepared')) {
    return {
      name: 'Amber/Steel Control',
      type: 'Control',
      strategy: 'Ramp into big threats with removal backup',
      winCondition: 'Outvalue opponent with card advantage and big characters',
      tempo: 'Slow',
      complexity: 'High',
    };
  }

  // Ruby/Sapphire Aggro
  if (cardNames.includes('goliath') && cardNames.includes('jasmine')) {
    return {
      name: 'Ruby/Sapphire Aggro',
      type: 'Aggro',
      strategy: 'Apply early pressure with cheap efficient characters',
      winCondition: 'Race to 20 lore before opponent stabilizes',
      tempo: 'Fast',
      complexity: 'Medium',
    };
  }

  // Amethyst Dragons
  if (cardNames.includes('maleficent') || (cardNames.includes('dragon') && inks.includes('Amethyst'))) {
    return {
      name: 'Amethyst Dragons',
      type: 'Midrange',
      strategy: 'Build dragon synergies and overwhelm',
      winCondition: 'Dragon tribal synergies',
      tempo: 'Medium',
      complexity: 'Medium',
    };
  }

  // Sapphire Ramp
  if (inks.includes('Sapphire') && inkableRatio > 0.6 && avgCost > 4) {
    return {
      name: 'Sapphire Ramp',
      type: 'Ramp',
      strategy: 'Generate ink advantage and play big threats early',
      winCondition: 'Land expensive bombs ahead of curve',
      tempo: 'Slow',
      complexity: 'Medium',
    };
  }

  // Emerald/Sapphire Tempo
  if ((inks.includes('Emerald') || cardNames.includes('tinker bell')) && avgCost < 4) {
    return {
      name: 'Emerald/Sapphire Tempo',
      type: 'Tempo',
      strategy: 'Efficient plays with card advantage',
      winCondition: 'Outpace opponent through efficiency',
      tempo: 'Medium',
      complexity: 'High',
    };
  }

  // Amber Aggro
  if (inks.includes('Amber') && avgCost <= 3.5) {
    return {
      name: 'Amber Aggro',
      type: 'Aggro',
      strategy: 'Fast aggressive curve-out strategy',
      winCondition: 'Overwhelm with early board presence',
      tempo: 'Fast',
      complexity: 'Low',
    };
  }

  // Steel Control
  if (inks.includes('Steel') && avgCost >= 4.5) {
    return {
      name: 'Steel Control',
      type: 'Control',
      strategy: 'Control board with removal and win late',
      winCondition: 'Exhaust opponent resources',
      tempo: 'Slow',
      complexity: 'High',
    };
  }

  // Fallback: classificar por características
  if (avgCost <= 3.5) {
    return {
      name: `${inks[0] || 'Core'} Aggro`,
      type: 'Aggro',
      strategy: 'Fast aggressive strategy',
      winCondition: 'Apply early pressure',
      tempo: 'Fast',
      complexity: 'Low',
    };
  } else if (avgCost >= 4.5) {
    return {
      name: `${inks[0] || 'Core'} Control`,
      type: 'Control',
      strategy: 'Late game value strategy',
      winCondition: 'Outvalue in late game',
      tempo: 'Slow',
      complexity: 'Medium',
    };
  } else {
    return {
      name: `${inks[0] || 'Core'} Midrange`,
      type: 'Midrange',
      strategy: 'Balanced strategy',
      winCondition: 'Flexible game plan',
      tempo: 'Medium',
      complexity: 'Medium',
    };
  }
}

/**
 * Identifica cartas-chave do deck
 */
function identifyKeyCards(deckAnalysis, archetype) {
  const cards = deckAnalysis.cards || [];
  const keyCards = [];

  // Cartas com alta quantidade (4x)
  const maxCopies = cards.filter(c => (c.quantity || 0) >= 4);
  
  // Cartas de custo ideal para o arquétipo
  const idealCost = getIdealCostRange(archetype.type);
  const curveCards = cards.filter(c => {
    const cost = c.cost || 0;
    return cost >= idealCost.min && cost <= idealCost.max;
  });

  // Cartas únicas (lendárias ou power cards)
  const uniqueCards = cards.filter(c => {
    const name = (c.name || '').toLowerCase();
    return name.includes('legendary') || 
           (c.lore && c.lore >= 3) ||
           (c.cost && c.cost >= 7);
  });

  // Combinar e categorizar
  maxCopies.forEach(card => {
    keyCards.push({
      name: card.name,
      cost: card.cost,
      quantity: card.quantity,
      role: 'Core',
      importance: 'Critical',
      reason: '4-of staple',
    });
  });

  curveCards.slice(0, 5).forEach(card => {
    if (!keyCards.find(k => k.name === card.name)) {
      keyCards.push({
        name: card.name,
        cost: card.cost,
        quantity: card.quantity,
        role: 'Curve',
        importance: 'High',
        reason: 'Fits strategy curve',
      });
    }
  });

  uniqueCards.slice(0, 3).forEach(card => {
    if (!keyCards.find(k => k.name === card.name)) {
      keyCards.push({
        name: card.name,
        cost: card.cost,
        quantity: card.quantity,
        role: 'Finisher',
        importance: 'High',
        reason: 'Win condition',
      });
    }
  });

  return keyCards.slice(0, 12); // Top 12 key cards
}

/**
 * Gera game plan detalhado
 */
function generateGamePlan(archetype, deckAnalysis) {
  const gamePlan = {
    earlyGame: [],
    midGame: [],
    lateGame: [],
    mulliganGuide: [],
    keyDecisions: [],
  };

  switch (archetype.type) {
    case 'Aggro':
      gamePlan.earlyGame = [
        'Mulligan for 1-2 cost characters',
        'Play curve-out aggressively',
        'Prioritize board presence over inkwell',
        'Apply pressure immediately',
      ];
      gamePlan.midGame = [
        'Continue pressure - do not let up',
        'Use removal on blockers only',
        'Race for lore - ignore their characters if possible',
        'Calculate lethal damage',
      ];
      gamePlan.lateGame = [
        'Close out game before opponent stabilizes',
        'All-in if needed - you lose long game',
        'Top-deck mode - every draw must count',
      ];
      gamePlan.mulliganGuide = [
        'Keep: 1-2 cost non-inkable threats',
        'Mulligan: Expensive cards (5+)',
        'Mulligan: Too many inkables (>5)',
      ];
      gamePlan.keyDecisions = [
        'When to go wide vs tall',
        'When to challenge vs quest',
        'Calculating racing scenarios',
      ];
      break;

    case 'Ramp':
      gamePlan.earlyGame = [
        'Mulligan for inkable cards',
        'Ramp ink aggressively (turn 1-3)',
        'Avoid early board fights',
        'Sculpt hand for big turn 4-5',
      ];
      gamePlan.midGame = [
        'Drop big threats ahead of curve',
        'Establish board control',
        'Generate card advantage',
        'Start racing on lore',
      ];
      gamePlan.lateGame = [
        'Overwhelming size advantage',
        'Stabilize and grind',
        'Use ink advantage to play multiple spells',
      ];
      gamePlan.mulliganGuide = [
        'Keep: Inkable cards',
        'Keep: Card draw',
        'Mulligan: Expensive threats without ramp',
      ];
      gamePlan.keyDecisions = [
        'When to stop ramping and start threatening',
        'Balancing ink vs board presence',
        'Managing card advantage',
      ];
      break;

    case 'Control':
      gamePlan.earlyGame = [
        'Stabilize and survive',
        'Mulligan for removal and inkables',
        'Trade resources efficiently',
        'Set up late game',
      ];
      gamePlan.midGame = [
        'Control board with removal',
        'Generate card advantage',
        'Neutralize opponent threats',
        'Prepare win conditions',
      ];
      gamePlan.lateGame = [
        'Dominate with superior cards',
        'Grind out opponent resources',
        'Close with finishers',
      ];
      gamePlan.mulliganGuide = [
        'Keep: Removal spells',
        'Keep: Inkable cards',
        'Mulligan: Late game without early answers',
      ];
      gamePlan.keyDecisions = [
        'Which threats to remove vs ignore',
        'When to transition to offense',
        'Resource management',
      ];
      break;

    default: // Midrange/Tempo
      gamePlan.earlyGame = [
        'Establish board presence',
        'Trade efficiently',
        'Build advantage incrementally',
      ];
      gamePlan.midGame = [
        'Press advantage',
        'Generate value trades',
        'Flexible gameplan based on matchup',
      ];
      gamePlan.lateGame = [
        'Close with accumulated advantage',
        'Adapt to game state',
      ];
      gamePlan.mulliganGuide = [
        'Keep: 2-4 cost cards',
        'Mulligan: Extremes (too cheap or expensive)',
      ];
      gamePlan.keyDecisions = [
        'Identifying role (beatdown vs control)',
        'Tempo vs value decisions',
      ];
  }

  return gamePlan;
}

/**
 * Gera sugestões de cartas
 */
function generateCardSuggestions(deckAnalysis, archetype) {
  const suggestions = [];
  const cards = deckAnalysis.cards || [];
  const inks = deckAnalysis.inks || [];

  // Análise de gaps
  const hasEarlyGame = cards.some(c => (c.cost || 0) <= 2);
  const hasRemoval = cards.some(c => {
    const name = (c.name || '').toLowerCase();
    return name.includes('hurled') || name.includes('be prepared') || name.includes('freeze');
  });
  const hasCardDraw = cards.some(c => {
    const name = (c.name || '').toLowerCase();
    return name.includes('draw') || name.includes('develop');
  });
  const hasFinishers = cards.some(c => (c.cost || 0) >= 6 && (c.lore || 0) >= 2);

  // Sugestões baseadas em gaps
  if (!hasEarlyGame && archetype.type === 'Aggro') {
    suggestions.push({
      category: 'Missing: Early Game',
      priority: 'Critical',
      cards: [
        { name: 'Tipo - Growing Son', reason: '1-cost lore generator' },
        { name: 'Mulan - Disguised Soldier', reason: '2-cost efficient threat' },
      ],
    });
  }

  if (!hasRemoval && archetype.type === 'Control') {
    suggestions.push({
      category: 'Missing: Removal',
      priority: 'High',
      cards: [
        { name: 'He Hurled His Thunderbolt', reason: 'Flexible removal' },
        { name: 'Be Prepared', reason: 'Unconditional removal' },
      ],
    });
  }

  if (!hasCardDraw && archetype.type === 'Ramp') {
    suggestions.push({
      category: 'Missing: Card Draw',
      priority: 'High',
      cards: [
        { name: 'Develop Your Brain', reason: 'Ramp enabler' },
        { name: 'Vision of the Future', reason: 'Card selection' },
      ],
    });
  }

  if (!hasFinishers && archetype.type !== 'Aggro') {
    suggestions.push({
      category: 'Missing: Finishers',
      priority: 'Medium',
      cards: [
        { name: 'Hades - Infernal Schemer', reason: 'Card advantage engine' },
        { name: 'Arthur - King Victorious', reason: 'Game-ending threat' },
      ],
    });
  }

  // Sugestões baseadas em arquétipo
  addArchetypeSpecificSuggestions(suggestions, archetype, inks, cards);

  return suggestions;
}

/**
 * Adiciona sugestões específicas por arquétipo
 */
function addArchetypeSpecificSuggestions(suggestions, archetype, inks, cards) {
  const cardNames = cards.map(c => (c.name || '').toLowerCase()).join(' ');

  if (archetype.name.includes('Amber/Steel')) {
    if (!cardNames.includes('hades')) {
      suggestions.push({
        category: 'Core Cards',
        priority: 'Critical',
        cards: [
          { name: 'Hades - Infernal Schemer', reason: 'Deck centerpiece - tutors removal' },
        ],
      });
    }
    
    if (!cardNames.includes('tinker bell')) {
      suggestions.push({
        category: 'Card Advantage',
        priority: 'High',
        cards: [
          { name: 'Tinker Bell - Giant Fairy', reason: 'Card draw engine' },
        ],
      });
    }
  }

  if (archetype.type === 'Ramp' && inks.includes('Sapphire')) {
    suggestions.push({
      category: 'Ramp Enablers',
      priority: 'High',
      cards: [
        { name: 'Sail The Azurite Sea', reason: 'Ramps ink' },
        { name: 'Develop Your Brain', reason: 'Draws cards' },
      ],
    });
  }

  if (archetype.type === 'Aggro' && inks.includes('Ruby')) {
    suggestions.push({
      category: 'Aggressive Threats',
      priority: 'High',
      cards: [
        { name: 'Goliath - Clan Leader', reason: 'Evasive lore generator' },
        { name: 'Namaari - Single-Minded Rival', reason: 'Efficient beater' },
      ],
    });
  }
}

/**
 * Analisa consistência do deck
 */
function analyzeConsistency(deckAnalysis, archetype) {
  const cards = deckAnalysis.cards || [];
  const totalCards = deckAnalysis.totalCards || 60;

  // Contar 4-ofs
  const fourOfs = cards.filter(c => (c.quantity || 0) >= 4).length;
  const threeOfs = cards.filter(c => (c.quantity || 0) === 3).length;
  const oneOfs = cards.filter(c => (c.quantity || 0) === 1).length;

  // Calcular score de consistência
  let consistencyScore = 50;
  
  // Mais 4-ofs = mais consistente
  consistencyScore += (fourOfs * 5);
  
  // Muitos 1-ofs = menos consistente
  consistencyScore -= (oneOfs * 2);

  // Curve consistency
  const curveCounts = deckAnalysis.curveCounts || {};
  const curveSpread = Object.values(curveCounts).filter(v => v > 0).length;
  if (curveSpread >= 5 && curveSpread <= 7) {
    consistencyScore += 10; // Good spread
  }

  consistencyScore = Math.max(0, Math.min(100, consistencyScore));

  return {
    score: consistencyScore,
    rating: getConsistencyRating(consistencyScore),
    fourOfs,
    threeOfs,
    oneOfs,
    recommendation: getConsistencyRecommendation(consistencyScore, fourOfs, oneOfs),
  };
}

function getConsistencyRating(score) {
  if (score >= 75) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 45) return 'Average';
  return 'Poor';
}

function getConsistencyRecommendation(score, fourOfs, oneOfs) {
  if (score >= 70) {
    return 'Deck is very consistent';
  }
  if (oneOfs > 8) {
    return `Too many 1-ofs (${oneOfs}). Consider consolidating to 3-4 copies of key cards.`;
  }
  if (fourOfs < 5) {
    return `Only ${fourOfs} 4-ofs. Identify core cards and play 4 copies.`;
  }
  return 'Deck consistency could be improved';
}

/**
 * Identifica pontos fortes
 */
function identifyStrengths(deckAnalysis, archetype) {
  const strengths = [];
  const cards = deckAnalysis.cards || [];
  const inkableRatio = deckAnalysis.inkablePct / 100;
  const avgCost = calculateAvgCost(cards);

  if (inkableRatio >= 0.55 && inkableRatio <= 0.65) {
    strengths.push({
      aspect: 'Ink Ratio',
      description: 'Well-balanced inkable ratio',
      impact: 'High',
    });
  }

  if (avgCost >= 3 && avgCost <= 4) {
    strengths.push({
      aspect: 'Curve',
      description: 'Smooth mana curve',
      impact: 'High',
    });
  }

  if (archetype.type === 'Aggro' && avgCost <= 3.5) {
    strengths.push({
      aspect: 'Speed',
      description: 'Fast aggressive curve',
      impact: 'Critical',
    });
  }

  if (archetype.type === 'Ramp' && inkableRatio >= 0.65) {
    strengths.push({
      aspect: 'Ramp',
      description: 'Strong ramp potential',
      impact: 'Critical',
    });
  }

  return strengths;
}

/**
 * Identifica pontos fracos
 */
function identifyWeaknesses(deckAnalysis, archetype) {
  const weaknesses = [];
  const cards = deckAnalysis.cards || [];
  const inkableRatio = deckAnalysis.inkablePct / 100;
  const avgCost = calculateAvgCost(cards);

  if (inkableRatio < 0.4) {
    weaknesses.push({
      aspect: 'Ink Ratio',
      description: 'Too few inkable cards - ink screw risk',
      impact: 'Critical',
      solution: 'Add more inkable cards',
    });
  }

  if (inkableRatio > 0.75) {
    weaknesses.push({
      aspect: 'Threats',
      description: 'Too many inkables - lack of threats',
      impact: 'High',
      solution: 'Add more non-inkable win conditions',
    });
  }

  if (avgCost >= 5 && archetype.type !== 'Ramp') {
    weaknesses.push({
      aspect: 'Curve',
      description: 'Curve too high - slow starts',
      impact: 'High',
      solution: 'Add 1-3 cost cards',
    });
  }

  if (archetype.type === 'Aggro' && avgCost >= 4) {
    weaknesses.push({
      aspect: 'Speed',
      description: 'Aggro deck is too slow',
      impact: 'Critical',
      solution: 'Lower curve to 3.5 or less',
    });
  }

  const hasEarlyGame = cards.some(c => (c.cost || 0) <= 2);
  if (!hasEarlyGame) {
    weaknesses.push({
      aspect: 'Early Game',
      description: 'No turn 1-2 plays',
      impact: 'High',
      solution: 'Add 1-2 cost characters',
    });
  }

  return weaknesses;
}

/**
 * Calcula confidence score da análise
 */
function calculateConfidenceScore(deckAnalysis, archetype) {
  let confidence = 50;

  // Quanto mais cartas reconhecidas, mais confiança
  const recognizedRatio = deckAnalysis.recognizedQty / deckAnalysis.totalCards;
  confidence += recognizedRatio * 30;

  // Deck com arquétipo bem definido
  if (archetype.name !== 'Unknown' && !archetype.name.includes('Core')) {
    confidence += 20;
  }

  return Math.min(95, Math.round(confidence));
}

/**
 * Helpers
 */
function calculateAvgCost(cards) {
  if (cards.length === 0) return 0;
  const total = cards.reduce((sum, c) => sum + (c.cost || 0) * (c.quantity || 1), 0);
  const count = cards.reduce((sum, c) => sum + (c.quantity || 1), 0);
  return count > 0 ? total / count : 0;
}

function getIdealCostRange(archetypeType) {
  const ranges = {
    'Aggro': { min: 1, max: 3 },
    'Tempo': { min: 2, max: 4 },
    'Midrange': { min: 3, max: 5 },
    'Ramp': { min: 4, max: 8 },
    'Control': { min: 3, max: 6 },
  };
  return ranges[archetypeType] || { min: 2, max: 5 };
}

module.exports = {
  analyzeStrategy,
  detectArchetype,
  identifyKeyCards,
  generateGamePlan,
  generateCardSuggestions,
  analyzeConsistency,
};

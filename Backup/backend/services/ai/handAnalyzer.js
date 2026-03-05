'use strict';

/**
 * Hand Analyzer - Analisa qualidade de mãos iniciais
 * VERSÃO CORRIGIDA - Com melhor error handling e imports
 * @module services/ai/handAnalyzer
 */

const fs = require('fs');
const path = require('path');

/**
 * Build card index (inline para evitar import issues)
 */
function buildCardIndex() {
  try {
    // Try multiple possible paths for cards.json
    const possiblePaths = [
      path.join(__dirname, '../../db/cards.json'),
      path.join(__dirname, '../db/cards.json'),
      path.join(process.cwd(), 'backend/db/cards.json'),
      path.join(process.cwd(), 'db/cards.json'),
    ];

    let cardsData = null;
    let foundPath = null;

    for (const cardPath of possiblePaths) {
      if (fs.existsSync(cardPath)) {
        cardsData = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
        foundPath = cardPath;
        break;
      }
    }

    if (!cardsData) {
      throw new Error('cards.json not found. Run: node mergeSets.js');
    }

    const index = new Map();
    
    for (const card of cardsData) {
      const normalized = (card.name || '').toLowerCase().trim();
      if (normalized) {
        index.set(normalized, card);
      }
    }

    console.log(`✅ Card index built: ${index.size} cards from ${foundPath}`);
    return index;
  } catch (err) {
    console.error('❌ Error building card index:', err.message);
    throw err;
  }
}

/**
 * Analisa uma mão inicial de 7 cartas
 * @param {Array<string>} hand - Array de nomes de cartas (7 cartas)
 * @param {Object} deckAnalysis - Análise completa do deck
 * @returns {Object} Análise da mão
 */
function analyzeHand(hand, deckAnalysis) {
  try {
    // Validação de entrada
    if (!Array.isArray(hand)) {
      throw new Error('Hand must be an array');
    }
    
    if (hand.length !== 7) {
      throw new Error(`Hand must contain exactly 7 cards (received ${hand.length})`);
    }

    if (!deckAnalysis || typeof deckAnalysis !== 'object') {
      throw new Error('deckAnalysis is required');
    }

    console.log('🎴 Analyzing hand:', hand);

    const cardIndex = buildCardIndex();
    
    // Resolver cartas da mão
    const handCards = hand.map((name, index) => {
      const normalized = String(name || '').toLowerCase().trim();
      const card = cardIndex.get(normalized);
      
      if (!card) {
        console.warn(`⚠️  Card ${index + 1} not found: "${name}"`);
        return { 
          name: String(name || 'Unknown'), 
          cost: 0, 
          inkable: false, 
          unknown: true 
        };
      }
      
      return { ...card, unknown: false };
    });

    console.log(`✅ Hand resolved: ${handCards.filter(c => !c.unknown).length}/7 recognized`);

    // 1. CURVE ANALYSIS
    const costs = handCards.filter(c => !c.unknown).map(c => Number(c.cost) || 0);
    const avgCost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
    const hasTurn1 = costs.some(c => c <= 1);
    const hasTurn2 = costs.some(c => c === 2);
    const hasTurn3 = costs.some(c => c === 3);
    const hasLateGame = costs.some(c => c >= 6);

    // 2. INK ANALYSIS
    const inkableCount = handCards.filter(c => c.inkable).length;
    const inkableRatio = inkableCount / 7;
    const nonInkableCount = 7 - inkableCount;

    // 3. PLAYABILITY
    const playableTurn1 = handCards.filter(c => (c.cost || 0) <= 1).length;
    const playableTurn2 = handCards.filter(c => (c.cost || 0) <= 2).length;
    const playableTurn3 = handCards.filter(c => (c.cost || 0) <= 3).length;

    // 4. SYNERGIES
    const synergies = detectSynergies(handCards);

    // 5. WIN CONDITIONS
    const hasWinCon = detectWinConditions(handCards, deckAnalysis);

    // 6. SCORE
    const score = calculateHandScore({
      avgCost,
      hasTurn1,
      hasTurn2,
      hasTurn3,
      hasLateGame,
      inkableRatio,
      nonInkableCount,
      playableTurn1,
      playableTurn2,
      playableTurn3,
      synergies: synergies.length,
      hasWinCon,
    });

    // 7. RATING
    const rating = getRating(score);

    // 8. VERDICT
    const verdict = getVerdict(score, {
      hasTurn1,
      hasTurn2,
      inkableRatio,
      nonInkableCount,
      synergies: synergies.length,
    });

    console.log(`✅ Hand analysis complete: Score ${score}, Rating ${rating}`);

    return {
      score,
      rating,
      verdict,
      analysis: {
        curve: {
          avgCost: Math.round(avgCost * 10) / 10,
          hasTurn1,
          hasTurn2,
          hasTurn3,
          hasLateGame,
          distribution: getCostDistribution(costs),
        },
        ink: {
          inkableCount,
          inkableRatio: Math.round(inkableRatio * 100),
          nonInkableCount,
          recommendation: getInkRecommendation(inkableRatio, nonInkableCount),
        },
        playability: {
          turn1: playableTurn1,
          turn2: playableTurn2,
          turn3: playableTurn3,
          description: getPlayabilityDescription(playableTurn1, playableTurn2, playableTurn3),
        },
        synergies,
        hasWinCon,
      },
      hand: handCards.map(c => ({
        name: c.name,
        cost: c.cost || 0,
        inkable: c.inkable || false,
        type: c.type || 'Unknown',
        unknown: c.unknown || false,
      })),
    };
  } catch (err) {
    console.error('❌ Error in analyzeHand:', err.message);
    console.error(err.stack);
    throw err;
  }
}

/**
 * Detecta synergies conhecidas na mão
 */
function detectSynergies(handCards) {
  const synergies = [];
  const names = handCards.map(c => (c.name || '').toLowerCase());

  const knownSynergies = [
    {
      cards: ['hades', 'be prepared'],
      description: 'Hades tutors Be Prepared for removal',
      strength: 0.9,
    },
    {
      cards: ['tinker bell', 'develop your brain'],
      description: 'Tinker Bell + card draw for tempo',
      strength: 0.85,
    },
    {
      cards: ['goliath', 'jasmine'],
      description: 'Goliath + Jasmine for board control',
      strength: 0.8,
    },
    {
      cards: ['namaari', 'mulan'],
      description: 'Amber Aggressive curve',
      strength: 0.75,
    },
    {
      cards: ['sail the azurite sea', 'vision of the future'],
      description: 'Multiple song cards for consistency',
      strength: 0.7,
    },
  ];

  for (const syn of knownSynergies) {
    const hasAll = syn.cards.every(card => 
      names.some(n => n.includes(card))
    );
    
    if (hasAll) {
      synergies.push({
        cards: syn.cards,
        description: syn.description,
        strength: syn.strength,
      });
    }
  }

  return synergies;
}

/**
 * Detecta se a mão tem win conditions
 */
function detectWinConditions(handCards, deckAnalysis) {
  const loreGenerators = handCards.filter(c => c.lore && c.lore > 0).length;
  
  const removal = handCards.filter(c => {
    const name = (c.name || '').toLowerCase();
    return name.includes('hurled') ||
           name.includes('be prepared') ||
           name.includes('freeze');
  }).length;

  const finishers = handCards.filter(c => 
    (c.cost || 0) >= 6 && c.lore && c.lore >= 2
  ).length;

  return loreGenerators >= 2 || removal >= 1 || finishers >= 1;
}

/**
 * Calcula score da mão (0-100)
 */
function calculateHandScore(factors) {
  let score = 50;

  // Curve factors (30 points)
  if (factors.hasTurn1) score += 5;
  if (factors.hasTurn2) score += 8;
  if (factors.hasTurn3) score += 7;
  if (factors.hasLateGame) score += 5;
  if (factors.avgCost >= 2 && factors.avgCost <= 4) score += 5;

  // Ink factors (25 points)
  if (factors.inkableRatio >= 0.5 && factors.inkableRatio <= 0.7) score += 15;
  else if (factors.inkableRatio >= 0.4 && factors.inkableRatio <= 0.8) score += 10;
  else if (factors.inkableRatio < 0.3 || factors.inkableRatio > 0.85) score -= 10;

  if (factors.nonInkableCount >= 2 && factors.nonInkableCount <= 4) score += 10;
  else if (factors.nonInkableCount < 2) score -= 5;

  // Playability factors (20 points)
  if (factors.playableTurn1 >= 1) score += 5;
  if (factors.playableTurn2 >= 2) score += 8;
  if (factors.playableTurn3 >= 3) score += 7;

  // Synergies (15 points)
  score += Math.min(factors.synergies * 5, 15);

  // Win conditions (10 points)
  if (factors.hasWinCon) score += 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Converte score em rating
 */
function getRating(score) {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Poor';
}

/**
 * Gera verdict (Keep ou Mulligan)
 */
function getVerdict(score, factors) {
  const reasons = [];

  if (score >= 75) {
    reasons.push('Strong overall hand');
    return { decision: 'Keep', reasons, confidence: 0.9 };
  }

  if (!factors.hasTurn1 && !factors.hasTurn2) {
    reasons.push('No early game plays');
    return { decision: 'Mulligan', reasons, confidence: 0.85 };
  }

  if (factors.inkableRatio < 0.3) {
    reasons.push('Too few inkable cards');
    return { decision: 'Mulligan', reasons, confidence: 0.8 };
  }

  if (factors.nonInkableCount < 2) {
    reasons.push('Not enough non-inkable threats');
    return { decision: 'Mulligan', reasons, confidence: 0.75 };
  }

  if (score >= 60) {
    if (factors.synergies >= 1) reasons.push('Has synergies');
    if (factors.hasTurn1 || factors.hasTurn2) reasons.push('Has early plays');
    return { decision: 'Keep', reasons, confidence: 0.6 };
  }

  if (score < 60) {
    if (!factors.hasTurn1) reasons.push('Weak early game');
    if (factors.inkableRatio > 0.8) reasons.push('Too many inkables');
    if (factors.synergies === 0) reasons.push('No synergies');
    return { decision: 'Mulligan', reasons, confidence: 0.7 };
  }

  reasons.push('Average hand');
  return { decision: 'Keep', reasons, confidence: 0.5 };
}

/**
 * Helpers
 */
function getCostDistribution(costs) {
  const dist = { low: 0, mid: 0, high: 0 };
  costs.forEach(c => {
    if (c <= 2) dist.low++;
    else if (c <= 5) dist.mid++;
    else dist.high++;
  });
  return dist;
}

function getInkRecommendation(ratio, nonInkable) {
  if (ratio < 0.3) return 'Too few inkable cards - risky hand';
  if (ratio > 0.85) return 'Too many inkable cards - lack of threats';
  if (nonInkable < 2) return 'Need more non-inkable plays';
  if (ratio >= 0.5 && ratio <= 0.7) return 'Good ink balance';
  return 'Acceptable ink ratio';
}

function getPlayabilityDescription(t1, t2, t3) {
  if (t1 >= 2 && t2 >= 3) return 'Excellent curve';
  if (t2 >= 2 && t3 >= 3) return 'Good mid-game';
  if (t1 === 0 && t2 === 0) return 'Very slow start';
  if (t1 + t2 >= 3) return 'Solid early game';
  return 'Average playability';
}

module.exports = {
  analyzeHand,
  detectSynergies,
  detectWinConditions,
  calculateHandScore,
};

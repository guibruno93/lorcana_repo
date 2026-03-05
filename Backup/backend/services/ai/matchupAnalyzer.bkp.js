'use strict';

/**
 * Matchup Analyzer - Analisa matchups contra outros arquétipos
 * @module services/ai/matchupAnalyzer
 */

// Try to load metaComparator (optional dependency)
let loadTournamentMeta = null;

try {
  const metaComparator = require('../../parser/metaComparator');
  loadTournamentMeta = metaComparator.loadTournamentMeta;
} catch (error) {
  console.warn('⚠️  metaComparator not available for matchup analysis');
}

/**
 * Analisa matchups do deck contra o meta
 * @param {Object} deckAnalysis - Análise do deck
 * @param {Object} options - Opções
 * @returns {Object} Análise de matchups
 */
function analyzeMatchups(deckAnalysis, options = {}) {
  // Se metaComparator não está disponível
  if (!loadTournamentMeta) {
    return {
      available: false,
      note: 'Meta comparison not available - metaComparator module missing',
      matchups: [],
    };
  }

  // Carregar meta
  const { decks } = loadTournamentMeta(options.metaPath);

  if (!decks || decks.length === 0) {
    return {
      available: false,
      note: 'No tournament meta data available',
      matchups: [],
    };
  }

  // Identificar arquétipos no meta
  const archetypes = identifyArchetypes(decks);

  // Analisar matchup contra cada arquétipo
  const matchups = archetypes.map(archetype => 
    calculateMatchup(deckAnalysis, archetype, decks)
  );

  // Ordenar: melhores matchups primeiro
  matchups.sort((a, b) => b.winRate - a.winRate);

  // Estatísticas gerais
  const stats = calculateOverallStats(matchups);

  return {
    available: true,
    deckArchetype: deckAnalysis.archetype || 'Unknown',
    matchups,
    stats,
    metaPosition: determineMetaPosition(deckAnalysis, matchups, archetypes),
  };
}

/**
 * Identifica arquétipos únicos no meta
 */
function identifyArchetypes(decks) {
  const archetypeMap = new Map();

  decks.forEach(deck => {
    const archetype = deck.archetype || inferArchetype(deck);
    
    if (!archetypeMap.has(archetype)) {
      archetypeMap.set(archetype, {
        name: archetype,
        count: 0,
        avgFinish: 0,
        totalFinish: 0,
        finishCount: 0,
        sampleDecks: [],
      });
    }

    const arch = archetypeMap.get(archetype);
    arch.count++;
    
    const finish = deck.finish || parseFinish(deck);
    if (typeof finish === 'number' && Number.isFinite(finish)) {
      arch.totalFinish += finish;
      arch.finishCount++;
    }

    if (arch.sampleDecks.length < 3) {
      arch.sampleDecks.push(deck);
    }
  });

  // Calcular average finish
  archetypeMap.forEach(arch => {
    if (arch.finishCount > 0) {
      arch.avgFinish = Math.round(arch.totalFinish / arch.finishCount);
    }
  });

  return Array.from(archetypeMap.values())
    .filter(a => a.count >= 2) // Pelo menos 2 decks
    .sort((a, b) => b.count - a.count); // Mais populares primeiro
}

/**
 * Infere arquétipo baseado nas cartas
 */
function inferArchetype(deck) {
  const cards = deck.cards || [];
  const cardNames = cards.map(c => (c.name || '').toLowerCase()).join(' ');

  // Detectar arquétipos conhecidos
  if (cardNames.includes('hades') && cardNames.includes('steel')) {
    return 'Amber/Steel Control';
  }
  if (cardNames.includes('goliath') && cardNames.includes('jasmine')) {
    return 'Ruby/Sapphire Aggro';
  }
  if (cardNames.includes('maleficent') || cardNames.includes('dragon')) {
    return 'Amethyst Dragons';
  }
  if (cardNames.includes('tinker bell') && cardNames.includes('sapphire')) {
    return 'Emerald/Sapphire Tempo';
  }
  if (cardNames.includes('amber')) {
    return 'Amber Aggro';
  }
  if (cardNames.includes('steel')) {
    return 'Steel Control';
  }

  // Fallback: usar inks
  const format = deck.format || 'Core';
  return `${format} Deck`;
}

/**
 * Parse finish de deck
 */
function parseFinish(deck) {
  const value = deck.finish ?? deck.placement ?? deck.standing ?? deck.rank ?? null;
  if (value == null) return null;
  if (typeof value === 'number') return value;
  
  const str = String(value).trim().toUpperCase();
  const match = str.match(/(\d{1,4})/);
  if (!match) return null;
  
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}

/**
 * Calcula matchup contra arquétipo
 */
function calculateMatchup(deckAnalysis, archetype, allDecks) {
  const deckArchetype = deckAnalysis.archetype || 'Unknown';
  
  // Pegar sample decks do arquétipo
  const sampleDecks = archetype.sampleDecks;

  // Analisar componentes do matchup
  const factors = analyzeMatchupFactors(deckAnalysis, sampleDecks);

  // Calcular win rate estimado
  const winRate = estimateWinRate(factors);

  // Determinar rating
  const rating = getMatchupRating(winRate);

  // Gerar insights
  const insights = generateMatchupInsights(deckAnalysis, archetype, factors, winRate);

  return {
    opponent: archetype.name,
    metaShare: Math.round((archetype.count / allDecks.length) * 100),
    avgFinish: archetype.avgFinish,
    winRate,
    rating, // "Favored" | "Even" | "Unfavored" | "Very Unfavored"
    confidence: factors.confidence,
    factors,
    insights,
  };
}

/**
 * Analisa fatores do matchup
 */
function analyzeMatchupFactors(deckAnalysis, opponentDecks) {
  const factors = {
    speedAdvantage: 0,    // -2 a +2
    removalAdvantage: 0,  // -2 a +2
    loreAdvantage: 0,     // -2 a +2
    synergyAdvantage: 0,  // -2 a +2
    confidence: 0.5,
  };

  if (opponentDecks.length === 0) {
    return factors;
  }

  // Analisar curva de custo
  const deckAvgCost = calculateAvgCost(deckAnalysis.cards || []);
  const oppAvgCost = calculateAvgCost(opponentDecks[0].cards || []);

  // Speed advantage (deck mais rápido tem vantagem)
  if (deckAvgCost < oppAvgCost - 0.5) factors.speedAdvantage = 2;
  else if (deckAvgCost < oppAvgCost) factors.speedAdvantage = 1;
  else if (deckAvgCost > oppAvgCost + 0.5) factors.speedAdvantage = -2;
  else if (deckAvgCost > oppAvgCost) factors.speedAdvantage = -1;

  // Removal advantage (quem tem mais removal)
  const deckRemoval = countRemoval(deckAnalysis.cards || []);
  const oppRemoval = countRemoval(opponentDecks[0].cards || []);
  
  if (deckRemoval > oppRemoval + 2) factors.removalAdvantage = 2;
  else if (deckRemoval > oppRemoval) factors.removalAdvantage = 1;
  else if (deckRemoval < oppRemoval - 2) factors.removalAdvantage = -2;
  else if (deckRemoval < oppRemoval) factors.removalAdvantage = -1;

  // Lore advantage (quem gera mais lore)
  const deckLore = countLoreGenerators(deckAnalysis.cards || []);
  const oppLore = countLoreGenerators(opponentDecks[0].cards || []);
  
  if (deckLore > oppLore + 3) factors.loreAdvantage = 2;
  else if (deckLore > oppLore) factors.loreAdvantage = 1;
  else if (deckLore < oppLore - 3) factors.loreAdvantage = -2;
  else if (deckLore < oppLore) factors.loreAdvantage = -1;

  // Synergy advantage (baseado em arquétipo)
  factors.synergyAdvantage = calculateSynergyAdvantage(
    deckAnalysis.archetype,
    opponentDecks[0].archetype
  );

  // Confidence (mais sample decks = mais confiante)
  factors.confidence = Math.min(0.9, 0.5 + (opponentDecks.length * 0.1));

  return factors;
}

/**
 * Estima win rate baseado nos fatores
 */
function estimateWinRate(factors) {
  let baseRate = 50; // 50% base

  // Cada fator contribui até ±10%
  baseRate += factors.speedAdvantage * 5;
  baseRate += factors.removalAdvantage * 5;
  baseRate += factors.loreAdvantage * 5;
  baseRate += factors.synergyAdvantage * 5;

  // Limitar entre 20% e 80%
  return Math.max(20, Math.min(80, Math.round(baseRate)));
}

/**
 * Determina rating do matchup
 */
function getMatchupRating(winRate) {
  if (winRate >= 65) return 'Favored';
  if (winRate >= 45) return 'Even';
  if (winRate >= 35) return 'Unfavored';
  return 'Very Unfavored';
}

/**
 * Gera insights sobre o matchup
 */
function generateMatchupInsights(deckAnalysis, archetype, factors, winRate) {
  const insights = [];

  // Speed insights
  if (factors.speedAdvantage >= 1) {
    insights.push({
      type: 'advantage',
      category: 'Speed',
      text: 'You are faster - apply early pressure',
    });
  } else if (factors.speedAdvantage <= -1) {
    insights.push({
      type: 'disadvantage',
      category: 'Speed',
      text: 'Opponent is faster - focus on survival early',
    });
  }

  // Removal insights
  if (factors.removalAdvantage >= 1) {
    insights.push({
      type: 'advantage',
      category: 'Removal',
      text: 'Strong removal suite - control the board',
    });
  } else if (factors.removalAdvantage <= -1) {
    insights.push({
      type: 'disadvantage',
      category: 'Removal',
      text: 'Limited removal - opponent controls board easily',
    });
  }

  // Lore insights
  if (factors.loreAdvantage >= 1) {
    insights.push({
      type: 'advantage',
      category: 'Lore',
      text: 'Superior lore generation - win through racing',
    });
  } else if (factors.loreAdvantage <= -1) {
    insights.push({
      type: 'disadvantage',
      category: 'Lore',
      text: 'Weaker lore engine - need to disrupt opponent',
    });
  }

  // Game plan
  if (winRate >= 55) {
    insights.push({
      type: 'gameplan',
      category: 'Strategy',
      text: 'Play proactively - your deck is favored',
    });
  } else if (winRate <= 45) {
    insights.push({
      type: 'gameplan',
      category: 'Strategy',
      text: 'Play defensively - look for opponent mistakes',
    });
  } else {
    insights.push({
      type: 'gameplan',
      category: 'Strategy',
      text: 'Even matchup - skill and draws matter most',
    });
  }

  return insights;
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

function countRemoval(cards) {
  return cards.filter(c => {
    const name = (c.name || '').toLowerCase();
    return name.includes('hurled') || 
           name.includes('be prepared') || 
           name.includes('freeze') ||
           name.includes('banish') ||
           name.includes('return');
  }).reduce((sum, c) => sum + (c.quantity || 1), 0);
}

function countLoreGenerators(cards) {
  return cards.filter(c => c.lore && c.lore > 0)
    .reduce((sum, c) => sum + (c.quantity || 1), 0);
}

function calculateSynergyAdvantage(deckArch, oppArch) {
  // Matchup table (simplificado)
  const matchups = {
    'Amber Aggro': {
      'Steel Control': -1,
      'Ruby Aggro': 0,
      'Amethyst Dragons': 1,
    },
    'Steel Control': {
      'Amber Aggro': 1,
      'Ruby Aggro': 1,
      'Amethyst Dragons': -1,
    },
  };

  if (matchups[deckArch] && matchups[deckArch][oppArch] !== undefined) {
    return matchups[deckArch][oppArch];
  }

  return 0; // Unknown matchup
}

function calculateOverallStats(matchups) {
  if (matchups.length === 0) {
    return {
      avgWinRate: 50,
      favoredCount: 0,
      evenCount: 0,
      unfavoredCount: 0,
    };
  }

  const totalWinRate = matchups.reduce((sum, m) => sum + m.winRate, 0);
  const avgWinRate = Math.round(totalWinRate / matchups.length);

  const favoredCount = matchups.filter(m => m.rating === 'Favored').length;
  const evenCount = matchups.filter(m => m.rating === 'Even').length;
  const unfavoredCount = matchups.filter(m => 
    m.rating === 'Unfavored' || m.rating === 'Very Unfavored'
  ).length;

  return {
    avgWinRate,
    favoredCount,
    evenCount,
    unfavoredCount,
  };
}

function determineMetaPosition(deckAnalysis, matchups, archetypes) {
  const stats = calculateOverallStats(matchups);

  // Calcular meta share dos matchups favoráveis
  const favorableShare = matchups
    .filter(m => m.rating === 'Favored')
    .reduce((sum, m) => sum + m.metaShare, 0);

  const unfavorableShare = matchups
    .filter(m => m.rating === 'Unfavored' || m.rating === 'Very Unfavored')
    .reduce((sum, m) => sum + m.metaShare, 0);

  let tier = 'Tier 2';
  let description = 'Solid meta position';

  if (stats.avgWinRate >= 55 && favorableShare >= 40) {
    tier = 'Tier 1';
    description = 'Strong against the meta';
  } else if (stats.avgWinRate <= 45 || unfavorableShare >= 50) {
    tier = 'Tier 3';
    description = 'Struggles against popular decks';
  }

  return {
    tier,
    description,
    avgWinRate: stats.avgWinRate,
    favorableMetaShare: favorableShare,
    unfavorableMetaShare: unfavorableShare,
  };
}

module.exports = {
  analyzeMatchups,
  identifyArchetypes,
  calculateMatchup,
  analyzeMatchupFactors,
  estimateWinRate,
};

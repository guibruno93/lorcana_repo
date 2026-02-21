'use strict';

/**
 * mulliganAdvisor-WORKING.js
 * Versão que funciona mesmo sem dados completos de custo
 */

// ── Extract cost from name ───────────────────────────────────────────────────

function extractCostFromName(cardName) {
  const name = cardName.toLowerCase();
  
  // Early game (1-2)
  if (name.includes('tipo') || name.includes('olaf') || name.includes('captain hook')) return 1;
  
  // Mid game (3-4)
  if (name.includes('hades') || name.includes('goliath') || name.includes('namaari')) return 4;
  if (name.includes('mulan') || name.includes('vincenzo') || name.includes('jasmine')) return 3;
  
  // Ramp/Draw (2-3)
  if (name.includes('sail') || name.includes('vision') || name.includes('develop')) return 2;
  if (name.includes('beyond the horizon')) return 2;
  
  // Removal (3-4)
  if (name.includes('he hurled') || name.includes('spooky')) return 3;
  
  // Late game (5+)
  if (name.includes('tinker bell') || name.includes('cinderella')) return 6;
  if (name.includes('pluto') || name.includes('arthur')) return 5;
  
  // Default: mid-range
  return 3;
}

// ── Strategy Detection ───────────────────────────────────────────────────────

function detectStrategy(deckAnalysis) {
  if (!deckAnalysis || !deckAnalysis.cards) {
    return { type: 'midrange', aggression: 50 };
  }
  
  const cards = deckAnalysis.cards;
  let avgCost = 0;
  let totalCards = 0;
  let earlyGameCount = 0;
  let lateGameCount = 0;
  
  for (const card of cards) {
    const cost = card.cost || extractCostFromName(card.name);
    const qty = card.quantity || 1;
    
    avgCost += cost * qty;
    totalCards += qty;
    
    if (cost <= 2) earlyGameCount += qty;
    if (cost >= 6) lateGameCount += qty;
  }
  
  avgCost = avgCost / totalCards;
  
  const earlyPct = (earlyGameCount / totalCards) * 100;
  const latePct = (lateGameCount / totalCards) * 100;
  
  let type = 'midrange';
  let aggression = 50;
  
  if (avgCost <= 2.5 && earlyPct > 40) {
    type = 'aggro';
    aggression = 80;
  } else if (avgCost >= 4.5 && latePct > 30) {
    type = 'control';
    aggression = 20;
  } else if (avgCost < 3.5 && earlyPct > 30) {
    type = 'tempo';
    aggression = 65;
  }
  
  return { type, aggression, avgCost, earlyPct, latePct };
}

// ── Hand Analysis ────────────────────────────────────────────────────────────

function analyzeHandComposition(hand, deckAnalysis) {
  const strategy = detectStrategy(deckAnalysis);
  
  const composition = {
    totalCards: hand.length,
    
    // Por custo
    costDistribution: {},
    avgCost: 0,
    
    // Simplified
    earlyGame: 0,
    midGame: 0,
    lateGame: 0,
  };
  
  let totalCost = 0;
  
  for (const cardName of hand) {
    const cardData = deckAnalysis?.cards?.find(c => c.name === cardName);
    const cost = cardData?.cost || extractCostFromName(cardName);
    
    totalCost += cost;
    composition.costDistribution[cost] = (composition.costDistribution[cost] || 0) + 1;
    
    if (cost <= 2) composition.earlyGame++;
    else if (cost <= 5) composition.midGame++;
    else composition.lateGame++;
  }
  
  composition.avgCost = (totalCost / hand.length).toFixed(2);
  
  return { composition, strategy };
}

// ── Mulligan Decision ────────────────────────────────────────────────────────

function analyzeMulligan(hand, deckAnalysis) {
  const { composition, strategy } = analyzeHandComposition(hand, deckAnalysis);
  
  // Variáveis para decisão
  let confidence = 60; // Base
  let decision = 'Keep';
  let issues = [];
  let strengths = [];
  
  // Análise baseada na estratégia
  
  if (strategy.type === 'aggro' || strategy.type === 'tempo') {
    // Aggro precisa early game
    if (composition.earlyGame === 0) {
      issues.push('Nenhuma carta de early game (0-2 ink)');
      confidence = 25;
      decision = 'Mulligan';
    } else if (composition.earlyGame >= 3) {
      strengths.push(`Bom early game (${composition.earlyGame} cartas)`);
      confidence = 85;
    } else if (composition.earlyGame >= 1) {
      strengths.push('Early game presente');
      confidence = 70;
    }
    
    // Muito late game é ruim
    if (composition.lateGame >= 4) {
      issues.push('Mão muito pesada para deck agressivo');
      confidence = Math.min(confidence, 40);
      decision = 'Mulligan';
    }
    
  } else if (strategy.type === 'control') {
    // Control aguenta mãos lentas
    if (composition.earlyGame === 7) {
      issues.push('Muito rápida, falta late game');
      confidence = 55;
    } else if (composition.lateGame >= 2) {
      strengths.push('Boa curva para control');
      confidence = 80;
    } else {
      confidence = 65;
    }
    
  } else { // midrange
    // Midrange precisa balanço
    if (composition.earlyGame === 0 && composition.midGame === 0) {
      issues.push('Nenhuma jogada nos primeiros turnos');
      confidence = 30;
      decision = 'Mulligan';
    } else if (composition.earlyGame >= 1 && composition.midGame >= 2) {
      strengths.push('Curva balanceada');
      confidence = 80;
    } else {
      confidence = 60;
    }
  }
  
  // Ajustar por custo médio
  const avgCost = parseFloat(composition.avgCost);
  
  if (avgCost > 5.5) {
    issues.push(`Custo médio muito alto (${avgCost})`);
    confidence = Math.min(confidence, 40);
    decision = 'Mulligan';
  } else if (avgCost < 2) {
    if (strategy.type !== 'aggro') {
      issues.push('Mão muito rápida');
      confidence = Math.min(confidence, 50);
    }
  }
  
  // Finalizar decisão
  if (confidence >= 70) {
    decision = 'Keep';
  } else if (confidence <= 40) {
    decision = 'Mulligan';
  } else {
    decision = confidence >= 55 ? 'Keep' : 'Mulligan';
  }
  
  const reasoning = decision === 'Keep' 
    ? (strengths[0] || 'Mão aceitável')
    : (issues[0] || 'Mão inconsistente');
  
  return {
    decision,
    confidence,
    reasoning,
    strategy,
    composition,
    issues,
    strengths,
    suggestions: hand.map((card, i) => {
      const cost = extractCostFromName(card);
      let action = 'Keep';
      let priority = 'Low';
      
      // Determinar se deveria fazer mulligan
      if (strategy.type === 'aggro' && cost >= 6) {
        action = 'Mulligan';
        priority = 'High';
      } else if (strategy.type === 'control' && cost <= 1 && composition.lateGame < 2) {
        action = 'Mulligan';
        priority = 'Medium';
      } else if (avgCost > 5 && cost >= 5) {
        action = 'Mulligan';
        priority = 'Medium';
      }
      
      return {
        card,
        action,
        priority,
        role: cost <= 2 ? 'Early' : cost <= 4 ? 'Mid' : 'Late',
        cost,
        inkable: true, // Assume true por padrão
      };
    }),
  };
}

// ── Simulate Mulligan ────────────────────────────────────────────────────────

function simulateMulligan(hand, mulliganIndices, deckAnalysis) {
  const newHand = [...hand];
  
  const deck = [];
  for (const card of deckAnalysis.cards || []) {
    for (let i = 0; i < (card.quantity || 1); i++) {
      deck.push(card.name);
    }
  }
  
  const remainingDeck = deck.filter(c => !hand.includes(c));
  
  // Shuffle
  for (let i = remainingDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remainingDeck[i], remainingDeck[j]] = [remainingDeck[j], remainingDeck[i]];
  }
  
  // Substituir
  for (let i = 0; i < mulliganIndices.length && i < remainingDeck.length; i++) {
    const idx = mulliganIndices[i];
    if (idx >= 0 && idx < 7) {
      newHand[idx] = remainingDeck[i];
    }
  }
  
  return newHand;
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  analyzeMulligan,
  simulateMulligan,
  detectStrategy,
};

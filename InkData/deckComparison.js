/**
 * backend/routes/deckComparison.js
 * API para comparação de decks com filtros de placement
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Carregar dados
const SCRAPED_DATA_PATH = path.join(__dirname, '../data/inkdecks-scraped.json');

function loadDecks() {
  if (!fs.existsSync(SCRAPED_DATA_PATH)) {
    return { decks: [], stats: {} };
  }
  
  const data = fs.readFileSync(SCRAPED_DATA_PATH, 'utf8');
  return JSON.parse(data);
}

/**
 * Calcular fingerprint do deck do usuário
 */
function calculateFingerprint(cards) {
  const crypto = require('crypto');
  
  const normalized = cards
    .map(c => ({
      name: (c.name || '').toLowerCase().trim(),
      quantity: parseInt(c.quantity) || 0,
    }))
    .filter(c => c.name && c.quantity > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const deckString = normalized.map(c => `${c.quantity}x${c.name}`).join('|');
  
  return crypto
    .createHash('sha256')
    .update(deckString)
    .digest('hex');
}

/**
 * Calcular similaridade entre dois decks (0-1)
 */
function calculateSimilarity(deck1Cards, deck2Cards) {
  const cards1 = new Map();
  const cards2 = new Map();
  
  for (const card of deck1Cards) {
    const name = (card.name || '').toLowerCase().trim();
    cards1.set(name, parseInt(card.quantity) || 0);
  }
  
  for (const card of deck2Cards) {
    const name = (card.name || '').toLowerCase().trim();
    cards2.set(name, parseInt(card.quantity) || 0);
  }
  
  const allCards = new Set([...cards1.keys(), ...cards2.keys()]);
  let matches = 0;
  let total = 0;
  
  for (const card of allCards) {
    const q1 = cards1.get(card) || 0;
    const q2 = cards2.get(card) || 0;
    matches += Math.min(q1, q2);
    total += Math.max(q1, q2);
  }
  
  return total > 0 ? matches / total : 0;
}

/**
 * Filtrar decks por placement
 */
function filterByPlacement(decks, filter) {
  if (!filter || filter === 'all') return decks;
  
  const placements = {
    'top4': 4,
    'top8': 8,
    'top16': 16,
    'top32': 32,
  };
  
  const maxPlacement = placements[filter.toLowerCase()];
  if (!maxPlacement) return decks;
  
  return decks.filter(deck => {
    const placement = deck.placement || 999;
    return placement <= maxPlacement;
  });
}

/**
 * Filtrar decks por inks (cores)
 */
function filterByInks(decks, userInks) {
  if (!userInks || userInks.length === 0) return decks;
  
  return decks.filter(deck => {
    const deckInks = deck.inks || [];
    
    // Mesmas cores (ordem não importa)
    if (deckInks.length !== userInks.length) return false;
    
    const sortedDeckInks = [...deckInks].sort();
    const sortedUserInks = [...userInks].sort();
    
    return sortedDeckInks.every((ink, i) => ink === sortedUserInks[i]);
  });
}

/**
 * Calcular nota 0-10 baseada em similaridade com top decks
 */
function calculateScore(userDeck, similarDecks) {
  if (similarDecks.length === 0) {
    return {
      score: 0,
      confidence: 'low',
      message: 'Nenhum deck similar encontrado no meta',
    };
  }
  
  // Calcular similaridade média com os top decks
  const similarities = similarDecks.map(deck => ({
    deck,
    similarity: calculateSimilarity(userDeck.cards, deck.cards),
    placement: deck.placement || 999,
  }));
  
  // Ordenar por similaridade
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  // Pegar top 5 mais similares
  const top5 = similarities.slice(0, 5);
  
  // Calcular score baseado em:
  // - Similaridade média com top 5
  // - Placement médio dos decks similares
  // - Quantidade de decks similares encontrados
  
  const avgSimilarity = top5.reduce((sum, s) => sum + s.similarity, 0) / top5.length;
  const avgPlacement = top5.reduce((sum, s) => sum + s.placement, 0) / top5.length;
  
  // Score base: similaridade (0-1) → (0-10)
  let score = avgSimilarity * 10;
  
  // Bonus por placement (top 4 = +1, top 8 = +0.5, etc)
  if (avgPlacement <= 4) score += 1;
  else if (avgPlacement <= 8) score += 0.5;
  else if (avgPlacement <= 16) score += 0.25;
  
  // Bonus por quantidade de matches
  if (similarDecks.length >= 10) score += 0.5;
  else if (similarDecks.length >= 5) score += 0.25;
  
  // Limitar 0-10
  score = Math.min(10, Math.max(0, score));
  
  // Confiança baseada em quantidade de matches
  let confidence = 'low';
  if (similarDecks.length >= 10) confidence = 'high';
  else if (similarDecks.length >= 5) confidence = 'medium';
  
  return {
    score: parseFloat(score.toFixed(1)),
    confidence,
    avgSimilarity: parseFloat((avgSimilarity * 100).toFixed(1)),
    matchesFound: similarDecks.length,
    top5Matches: top5.map(s => ({
      similarity: parseFloat((s.similarity * 100).toFixed(1)),
      placement: s.placement,
      tournament: s.deck.tournament,
    })),
  };
}

/**
 * POST /api/deck-comparison
 * Compara deck do usuário com meta
 */
router.post('/compare', (req, res) => {
  try {
    const { cards, filter = 'all' } = req.body;
    
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ 
        error: 'Cards array is required' 
      });
    }
    
    // Validar deck (60 cards)
    const totalCards = cards.reduce((sum, c) => sum + (c.quantity || 0), 0);
    if (totalCards !== 60) {
      return res.status(400).json({
        error: `Deck must have exactly 60 cards (got ${totalCards})`,
      });
    }
    
    // Detectar inks do deck do usuário
    const userInks = [...new Set(cards.map(c => c.ink).filter(Boolean))].sort();
    
    // Carregar dados
    const data = loadDecks();
    let decks = data.decks || [];
    
    // Filtrar apenas decks válidos (60 cards)
    decks = decks.filter(deck => {
      const total = deck.cards.reduce((sum, c) => sum + c.quantity, 0);
      return total === 60;
    });
    
    // Aplicar filtro de placement
    let filteredDecks = filterByPlacement(decks, filter);
    
    // Filtrar por mesmas cores
    const sameInksDecks = filterByInks(filteredDecks, userInks);
    
    // Calcular score
    const result = calculateScore({ cards }, sameInksDecks);
    
    res.json({
      success: true,
      userDeck: {
        totalCards,
        inks: userInks,
        fingerprint: calculateFingerprint(cards),
      },
      filter,
      meta: {
        totalDecks: decks.length,
        filteredByPlacement: filteredDecks.length,
        sameInks: sameInksDecks.length,
      },
      comparison: result,
    });
    
  } catch (err) {
    console.error('Deck comparison error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: err.message,
    });
  }
});

/**
 * GET /api/deck-comparison/stats
 * Retorna estatísticas do meta
 */
router.get('/stats', (req, res) => {
  try {
    const data = loadDecks();
    const decks = data.decks || [];
    
    // Filtrar apenas 60 cards
    const validDecks = decks.filter(deck => {
      const total = deck.cards.reduce((sum, c) => sum + c.quantity, 0);
      return total === 60;
    });
    
    // Contar por inks
    const inkCombos = new Map();
    for (const deck of validDecks) {
      const inks = (deck.inks || []).sort().join('/');
      inkCombos.set(inks, (inkCombos.get(inks) || 0) + 1);
    }
    
    // Ordenar por popularidade
    const topCombos = Array.from(inkCombos.entries())
      .map(([inks, count]) => ({ inks, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    res.json({
      success: true,
      stats: data.stats,
      validDecks: validDecks.length,
      topInkCombos: topCombos,
    });
    
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

module.exports = router;

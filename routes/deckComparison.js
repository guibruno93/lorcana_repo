/**
 * backend/routes/deckComparison.js
 * API para comparação de decks com filtros de placement (Supabase version)
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Carregar decks do Supabase com filtros
 */
async function loadDecks(filter = 'all') {
  try {
    // Query base: todos os decks
    let query = supabase
      .from('decks')
      .select('*')
      .order('scraped_at', { ascending: false });
    
    // Aplicar filtro de placement se especificado
    if (filter && filter !== 'all') {
      const placements = { 
        'top4': 4, 
        'top8': 8, 
        'top16': 16, 
        'top32': 32 
      };
      const maxPlacement = placements[filter.toLowerCase()];
      
      if (maxPlacement) {
        query = query.lte('placement', maxPlacement);
      }
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }
    
    // Filtrar apenas decks com 60 cards (fazer client-side pois função SQL não funciona em .eq())
    const validDecks = (data || []).filter(deck => {
      if (!deck.cards || !Array.isArray(deck.cards)) return false;
      const total = deck.cards.reduce((sum, c) => sum + (c.quantity || 0), 0);
      return total === 60;
    });
    
    return { decks: validDecks };
    
  } catch (err) {
    console.error('Error loading decks:', err);
    throw err;
  }
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
  
  // Calcular similaridade com cada deck
  const similarities = similarDecks.map(deck => ({
    deck,
    similarity: calculateSimilarity(userDeck.cards, deck.cards),
    placement: deck.placement || 999,
  }));
  
  // Ordenar por similaridade
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  // Pegar top 5 mais similares
  const top5 = similarities.slice(0, 5);
  
  // Calcular métricas
  const avgSimilarity = top5.reduce((sum, s) => sum + s.similarity, 0) / top5.length;
  const avgPlacement = top5.reduce((sum, s) => sum + s.placement, 0) / top5.length;
  
  // Score base: similaridade (0-1) → (0-10)
  let score = avgSimilarity * 10;
  
  // Bonus por placement
  if (avgPlacement <= 4) score += 1.0;
  else if (avgPlacement <= 8) score += 0.5;
  else if (avgPlacement <= 16) score += 0.25;
  
  // Bonus por quantidade de matches
  if (similarDecks.length >= 10) score += 0.5;
  else if (similarDecks.length >= 5) score += 0.25;
  
  // Limitar 0-10
  score = Math.min(10, Math.max(0, score));
  
  // Confiança
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
 * POST /api/deck-comparison/compare
 * Compara deck do usuário com meta
 */
router.post('/compare', async (req, res) => {
  try {
    const { cards, filter = 'all' } = req.body;
    
    // Validação
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ 
        error: 'Cards array is required' 
      });
    }
    
    // Validar total de cards
    const totalCards = cards.reduce((sum, c) => sum + (c.quantity || 0), 0);
    if (totalCards !== 60) {
      return res.status(400).json({
        error: `Deck must have exactly 60 cards (got ${totalCards})`,
      });
    }
    
    // Detectar inks do deck do usuário
    const userInks = [...new Set(cards.map(c => c.ink).filter(Boolean))].sort();
    
    // Carregar decks do Supabase (já filtrados por placement se especificado)
    const data = await loadDecks(filter);
    const decks = data.decks || [];
    
    // Filtrar por mesmas cores
    const sameInksDecks = filterByInks(decks, userInks);
    
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
        sameInks: sameInksDecks.length,
      },
      comparison: result,
    });
    
  } catch (err) {
    console.error('Deck comparison error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

/**
 * GET /api/deck-comparison/stats
 * Retorna estatísticas do meta
 */
router.get('/stats', async (req, res) => {
  try {
    // Usar view do Supabase para estatísticas
    const { data: metaStats, error: statsError } = await supabase
      .from('v_meta_stats')
      .select('*')
      .single();
    
    if (statsError) {
      console.error('Error fetching meta stats:', statsError);
    }
    
    // Carregar todos os decks válidos
    const decksData = await loadDecks('all');
    const validDecks = decksData.decks || [];
    
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
      stats: metaStats || {},
      validDecks: validDecks.length,
      topInkCombos: topCombos,
    });
    
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

/**
 * GET /api/deck-comparison/top-decks
 * Retorna top decks do meta por ink combo
 */
router.get('/top-decks', async (req, res) => {
  try {
    const { inks, limit = 10 } = req.query;
    
    let query = supabase
      .from('decks')
      .select('*')
      .order('placement', { ascending: true })
      .limit(parseInt(limit));
    
    // Filtrar por inks se especificado
    if (inks) {
      const inksArray = inks.split(',').map(i => i.trim()).sort();
      query = query.contains('inks', inksArray);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // Filtrar apenas 60 cards
    const validDecks = (data || []).filter(deck => {
      if (!deck.cards || !Array.isArray(deck.cards)) return false;
      const total = deck.cards.reduce((sum, c) => sum + (c.quantity || 0), 0);
      return total === 60;
    });
    
    res.json({
      success: true,
      decks: validDecks,
      count: validDecks.length,
    });
    
  } catch (err) {
    console.error('Top decks error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

module.exports = router;

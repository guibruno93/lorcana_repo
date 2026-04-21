/**
 * backend/routes/deck.js
 * VERSÃO CORRIGIDA - Todos os bugs fixados
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { HybridArchetypeIdentifier } = require('../services/archetype-ml');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ═══════════════════════════════════════════════════════════════════
// ML SINGLETON
// ═══════════════════════════════════════════════════════════════════

let mlIdentifier = null;

async function getMLIdentifier() {
  if (!mlIdentifier) {
    try {
      console.log('🤖 Initializing ML Identifier...');
      mlIdentifier = new HybridArchetypeIdentifier();
      await mlIdentifier.initialize();
      console.log('✅ ML Identifier ready');
    } catch (err) {
      console.error('❌ ML initialization failed:', err.message);
      // Resetar após 5 segundos para tentar novamente
      setTimeout(() => { mlIdentifier = null; }, 5000);
      throw err;
    }
  }
  return mlIdentifier;
}

// Inicializar no startup (em Jest o carregamento do app não dispara ML para não bloquear a suite)
if (process.env.NODE_ENV !== 'test') {
  getMLIdentifier().catch((err) => {
    console.error('❌ Failed to initialize ML:', err.message);
  });
}

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function parseDeckText(deckText) {
  const lines = deckText.split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  
  const cards = [];
  
  for (const line of lines) {
    // Suporta: "4x Card", "4 Card", "Card (4)", "Card x4"
    let match = line.match(/^(\d+)[\sx]+(.+)$/i);
    
    if (!match) {
      match = line.match(/^(.+?)[\s\(]+(\d+)[\)\s]*$/i);
      if (match) {
        const name = match[1].trim();
        const quantity = parseInt(match[2]);
        if (quantity > 0 && name) {
          cards.push({ quantity, name });
        }
        continue;
      }
    }
    
    if (match) {
      const quantity = parseInt(match[1]);
      const name = match[2].trim();
      
      if (quantity > 0 && name) {
        cards.push({ quantity, name });
      }
    }
  }
  
  return cards;
}

/**
 * ✅ FIX: Função unificada para enriquecer deck
 * Evita duplicação de código entre endpoints
 */
async function enrichDeck(deckText) {
  // Parse
  const cards = parseDeckText(deckText);
  
  if (cards.length === 0) {
    throw new Error('No valid cards found');
  }
  
  const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);
  
  if (totalCards !== 60) {
    throw new Error(`Deck must have 60 cards (got ${totalCards})`);
  }
  
  // Buscar info do banco
  let allCardsDB = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const start = page * pageSize;
    const end = start + pageSize - 1;
    
    const { data, error } = await supabase
      .from('cards')
      .select('name, ink, type, cost, rarity, set_name, inkable')
      .range(start, end);
    
    if (error) break;
    if (!data || data.length === 0) break;
    
    allCardsDB = allCardsDB.concat(data);
    
    if (data.length < pageSize) break;
    page++;
  }
  
  // Mapear cards
  const cardMap = new Map();
  for (const card of allCardsDB) {
    const key = card.name.toLowerCase().trim();
    cardMap.set(key, card);
  }
  
  // Enriquecer
  const enrichedCards = cards.map(c => {
    const key = c.name.toLowerCase().trim();
    const info = cardMap.get(key);
    
    return {
      name: c.name,
      quantity: c.quantity,
      ink: info?.ink || null,
      type: info?.type || null,
      cost: info?.cost || null,
      rarity: info?.rarity || null,
      set: info?.set_name || null,
      inkable: info?.inkable || false,
      found: !!info
    };
  });
  
  // Calcular stats
  const byInk = {};
  for (const card of enrichedCards) {
    if (card.ink) {
      byInk[card.ink] = (byInk[card.ink] || 0) + card.quantity;
    }
  }
  
  const inks = Object.keys(byInk).sort();
  
  return {
    cards: enrichedCards,
    inks,
    totalCards,
    byInk,
    cardMap  // Para buscar custos depois
  };
}

// ═══════════════════════════════════════════════════════════════════
// LORCAST API + CACHE + RATE LIMITING
// ═══════════════════════════════════════════════════════════════════

const lorcast = require('../services/lorcast-api');
// Cache em memória para reduzir chamadas à API Lorcast
const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
 
// Rate limiting simples (em memória)
const rateLimitMap = new Map();
const MAX_REQUESTS_PER_MINUTE = 30;
 
function checkRateLimit(ip) {
  const now = Date.now();
  const key = `search-${ip}`;
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }
  
  const limit = rateLimitMap.get(key);
  
  // Reset se passou 1 minuto
  if (now > limit.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }
  
  // Incrementar contador
  limit.count++;
  
  // Verificar se excedeu limite
  if (limit.count > MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  
  return true;
}

// ═══════════════════════════════════════════════════════════════════
// ✅ ROTA PÚBLICA - SEARCH CARD (DEVE VIR ANTES DE /:id!)
// ═══════════════════════════════════════════════════════════════════

router.get('/search-card', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query required' });
    }
    
    // ✅ RATE LIMITING
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      console.warn(`⚠️ Rate limit exceeded for IP: ${clientIp}`);
      return res.status(429).json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: 60 
      });
    }
    
    // ✅ CACHE: Verificar se já temos resultado
    const cacheKey = `card-${q.toLowerCase()}`;
    const cached = searchCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`💾 Cache HIT for: ${q}`);
      return res.json({
        query: q,
        count: cached.results.length,
        results: cached.results.slice(0, 10),
        cached: true
      });
    }
    
    console.log(`🔍 [PUBLIC] Searching for: ${q}`);
    
    // ✅ TIMEOUT: Adicionar timeout de 10s
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 10000)
    );
    
    const searchPromise = lorcast.searchCard(q);
    
    const results = await Promise.race([searchPromise, timeoutPromise]);
    
    console.log(`✅ Found ${results.length} cards`);
    
    // ✅ SALVAR NO CACHE
    searchCache.set(cacheKey, {
      results: results,
      timestamp: Date.now()
    });
    
    // ✅ LIMPAR CACHE ANTIGO (evitar memory leak)
    if (searchCache.size > 1000) {
      const oldestKey = searchCache.keys().next().value;
      searchCache.delete(oldestKey);
    }
    
    res.json({ 
      query: q,
      count: results.length,
      results: results.slice(0, 10),
      cached: false
    });
    
  } catch (error) {
    console.error('❌ Search error:', error.message);
    
    // ✅ MELHOR ERROR HANDLING
    if (error.message === 'Request timeout') {
      return res.status(504).json({ 
        error: 'Search timeout. Please try again.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Search failed',
      message: error.message 
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ROTAS POST (análise de deck)
// ═══════════════════════════════════════════════════════════════════

/**
 * ✅ FIX: Buscar custo do banco ao invés de lista hardcoded
 */
function extractCostFromCard(cardName, cardMap) {
  const key = cardName.toLowerCase().trim();
  const card = cardMap.get(key);
  
  return card?.cost || 4;  // Default 4 se não encontrar
}

// ═══════════════════════════════════════════════════════════════════
// POST /api/deck/analyze
// ═══════════════════════════════════════════════════════════════════

router.post('/analyze', async (req, res) => {
  try {
    console.log('📊 /analyze request received');
    
    let deckText = req.body.deckText 
                || req.body.decklist 
                || req.body.deck 
                || req.body.text;
    
    if (!deckText && req.body.cards && Array.isArray(req.body.cards)) {
      deckText = req.body.cards
        .map(c => `${c.quantity || 1}x ${c.name || c.card_name}`)
        .join('\n');
    }
    
    if (!deckText) {
      return res.status(400).json({
        success: false,
        error: 'deckText is required'
      });
    }

    // ✅ Usar função unificada
    const enriched = await enrichDeck(deckText);
    const { cards, inks, totalCards, byInk } = enriched;

    // Estatísticas adicionais
    const byType = {};
    const byCost = {};
    const byRarity = {};
    
    for (const card of cards) {
      if (card.type) {
        byType[card.type] = (byType[card.type] || 0) + card.quantity;
      }
      
      if (card.cost != null) {
        const bucket = card.cost >= 10 ? '10+' : String(card.cost);
        byCost[bucket] = (byCost[bucket] || 0) + card.quantity;
      }
      
      if (card.rarity) {
        byRarity[card.rarity] = (byRarity[card.rarity] || 0) + card.quantity;
      }
    }

    // Custo médio
    let totalCost = 0;
    let countedCards = 0;
    for (const card of cards) {
      if (card.cost != null) {
        totalCost += card.cost * card.quantity;
        countedCards += card.quantity;
      }
    }
    const avgCost = countedCards > 0 ? (totalCost / countedCards).toFixed(2) : '0';

    // Inkable %
    const inkableCount = cards
      .filter(c => c.inkable === true)
      .reduce((sum, c) => sum + c.quantity, 0);
    
    const inkablePct = totalCards > 0 
      ? ((inkableCount / totalCards) * 100).toFixed(1) 
      : 0;

    // ML
    console.log('🤖 Identifying archetype with ML...');
    const identifier = await getMLIdentifier();
    const mlResult = await identifier.identify({ cards, inks });
    
    console.log(`✅ Archetype: ${mlResult.archetype} (${(mlResult.confidence * 100).toFixed(1)}% confidence, method: ${mlResult.method})`);

    // Resposta
    res.json({
      success: true,
      archetype: mlResult.archetype,
      archetypeConfidence: mlResult.confidence,
      archetypeMethod: mlResult.method,
      archetypeAlternatives: mlResult.alternatives,
      totalCards,
      inkablePct: parseFloat(inkablePct),
      curveCounts: byCost,
      avgCost: parseFloat(avgCost),
      inks,
      cards,
      analysis: {
        cards,
        stats: {
          totalCards,
          uniqueCards: cards.length,
          foundInDatabase: cards.filter(c => c.found).length
        },
        breakdown: { byInk, byType, byCost, byRarity },
        curve: {
          avgCost: parseFloat(avgCost),
          distribution: byCost
        },
        inks,
        ml: {
          archetype: mlResult.archetype,
          confidence: mlResult.confidence,
          method: mlResult.method,
          alternatives: mlResult.alternatives
        }
      }
    });
    
  } catch (err) {
    console.error('❌ /analyze error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/deck/matchups
// ═══════════════════════════════════════════════════════════════════

router.post('/matchups', async (req, res) => {
  try {
    let deckText = req.body.deckText || req.body.decklist;
    
    if (!deckText) {
      return res.status(400).json({
        success: false,
        error: 'deckText is required'
      });
    }
    
    // ✅ Usar função unificada
    const enriched = await enrichDeck(deckText);
    const { cards, inks } = enriched;
    
    // ML
    const identifier = await getMLIdentifier();
    const mlResult = await identifier.identify({ cards, inks });
    
    console.log(`🎯 Identified: ${mlResult.archetype} (${(mlResult.confidence * 100).toFixed(0)}%)`);
    
    // Buscar matchups
    const { data: matchupData, error: matchupError } = await supabase
      .from('matchup_matrix')
      .select('*')
      .ilike('archetype', mlResult.archetype)
      .eq('format', 'core')
      .order('winrate', { ascending: false });
    
    if (matchupError || !matchupData || matchupData.length === 0) {
      return res.json({
        success: true,
        deck: {
          archetype: mlResult.archetype,
          confidence: mlResult.confidence,
          method: mlResult.method
        },
        matchups: {
          available: false,
          message: 'No matchup data found for this archetype'
        }
      });
    }
    
    // Buscar meta share
    const { data: metaData } = await supabase
      .from('archetype_meta')
      .select('archetype, meta_share, tier')
      .eq('format', 'core')
      .eq('days', 30);
    
    // Enriquecer matchups
    const enrichedMatchups = matchupData.map(m => {
      const meta = metaData?.find(a => 
        a.archetype.toLowerCase() === m.opponent.toLowerCase()
      );
      
      return {
        opponent: m.opponent,
        winrate: m.winrate,
        metaShare: meta?.meta_share || 0,
        tier: meta?.tier || 'D',
        difficulty: 
          m.winrate >= 60 ? 'favorable' :
          m.winrate >= 50 ? 'even' : 'unfavorable'
      };
    });
    
    enrichedMatchups.sort((a, b) => b.metaShare - a.metaShare);
    
    // Calcular expected WR
    const totalMeta = enrichedMatchups.reduce((sum, m) => sum + m.metaShare, 0);
    const expectedWR = totalMeta > 0
      ? enrichedMatchups.reduce((sum, m) => 
          sum + (m.winrate / 100) * m.metaShare, 0
        ) / totalMeta * 100
      : null;
    
    // Calcular tier
    let deckTier = 'C';
    if (expectedWR >= 55) deckTier = 'S';
    else if (expectedWR >= 52) deckTier = 'A';
    else if (expectedWR >= 48) deckTier = 'B';
    else if (expectedWR >= 45) deckTier = 'C';
    else deckTier = 'D';
    
    res.json({
      success: true,
      deck: {
        archetype: mlResult.archetype,
        confidence: mlResult.confidence,
        method: mlResult.method,
        tier: deckTier,
        expectedWinrate: expectedWR ? expectedWR.toFixed(1) : null
      },
      matchups: enrichedMatchups,
      summary: {
        avgWinrate: expectedWR ? expectedWR.toFixed(1) : null,
        tier: deckTier,
        favorable: enrichedMatchups.filter(m => m.winrate >= 60).length,
        even: enrichedMatchups.filter(m => m.winrate >= 50 && m.winrate < 60).length,
        unfavorable: enrichedMatchups.filter(m => m.winrate < 50).length
      }
    });
    
  } catch (err) {
    console.error('❌ /matchups error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/deck/mulligan - ✅ CORRIGIDO
// ═══════════════════════════════════════════════════════════════════

router.post('/mulligan', async (req, res) => {
  try {
    const { hand, deckText, opponent } = req.body;
    
    if (!hand || !Array.isArray(hand)) {
      return res.status(400).json({
        success: false,
        error: 'hand is required (array of card names)'
      });
    }
    
    if (!deckText) {
      return res.status(400).json({
        success: false,
        error: 'deckText is required'
      });
    }
    
    // ✅ FIX: Usar função unificada para enriquecer deck
    const enriched = await enrichDeck(deckText);
    const { cards, inks, cardMap } = enriched;
    
    // ✅ FIX: Chamar ML de verdade ao invés de placeholder!
    const identifier = await getMLIdentifier();
    const mlResult = await identifier.identify({ cards, inks });
    
    console.log(`🎯 Mulligan for: ${mlResult.archetype} vs ${opponent || 'Unknown'}`);
    
    // Buscar regras de mulligan
    let { data: rules } = await supabase
      .from('mulligan_rules')
      .select('*')
      .eq('archetype', mlResult.archetype)
      .eq('opponent', opponent)
      .single();
    
    // Se não achar regra específica, usar genérica
    if (!rules) {
      const { data: genericRules } = await supabase
        .from('mulligan_rules')
        .select('*')
        .eq('archetype', mlResult.archetype)
        .is('opponent', null)
        .single();
      
      rules = genericRules;
    }
    
    // Analisar mão
    const analysis = analyzeMulliganHand(hand, rules, mlResult.archetype, cardMap);
    
    res.json({
      success: true,
      archetype: mlResult.archetype,  // ✅ FIX: Agora retorna o correto!
      opponent: opponent || 'Unknown',
      hand,
      ...analysis
    });
    
  } catch (err) {
    console.error('❌ /mulligan error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// ✅ FIX: Analisar mulligan usando custos corretos
function analyzeMulliganHand(hand, rules, archetype, cardMap) {
  if (!rules) {
    return analyzeGenericMulligan(hand, archetype, cardMap);
  }
  
  const mulligan = [];
  let score = 0;
  
  // Verificar priority cards
  const hasPriority = rules.priority_cards?.some(card => 
    hand.some(h => h.toLowerCase().includes(card.toLowerCase()))
  );
  
  if (hasPriority) score += 30;
  
  // Verificar avoid cards
  for (let i = 0; i < hand.length; i++) {
    const cardInHand = hand[i].toLowerCase();
    
    const shouldAvoid = rules.avoid_cards?.some(avoid => 
      cardInHand.includes(avoid.toLowerCase())
    );
    
    if (shouldAvoid) {
      mulligan.push(i);
      score -= 20;
    }
  }
  
  // Verificar curva ideal
  if (rules.ideal_curve && cardMap) {
    const handCosts = hand.map(card => extractCostFromCard(card, cardMap));
    const idealCosts = rules.ideal_curve.split('-').map(Number);
    
    const matchesCurve = idealCosts.some(cost => handCosts.includes(cost));
    if (matchesCurve) score += 20;
  }
  
  // Decisão
  let decision = 'keep';
  let reason = rules.reason || 'Hand is acceptable';
  let confidence = (score + 50) / 100;
  
  if (score < -10) {
    decision = 'mulligan';
    reason = `Hand has cards we want to avoid. ${rules.reason || ''}`;
    confidence = 0.8;
  } else if (!hasPriority && rules.priority_cards?.length > 0) {
    decision = 'mulligan';
    reason = `Missing key cards: ${rules.priority_cards.join(', ')}`;
    confidence = 0.7;
  }
  
  return {
    decision,
    reason,
    mulligan,
    confidence: Math.max(0, Math.min(1, confidence))
  };
}

function analyzeGenericMulligan(hand, archetype, cardMap) {
  const mulligan = [];
  
  // ✅ FIX: Usar custos reais do banco
  for (let i = 0; i < hand.length; i++) {
    const cost = extractCostFromCard(hand[i], cardMap);
    
    // Evitar custos muito altos (8+) ou muito baixos (0)
    if (cost >= 8 || cost === 0) {
      mulligan.push(i);
    }
  }
  
  const decision = mulligan.length >= 4 ? 'mulligan' : 'keep';
  const reason = mulligan.length >= 4
    ? 'Hand has too many expensive or unplayable cards'
    : 'Hand curve is acceptable';
  
  return {
    decision,
    reason,
    mulligan,
    confidence: 0.6
  };
}

// ═══════════════════════════════════════════════════════════════════
// POST /api/deck/simulate-mulligan
// ═══════════════════════════════════════════════════════════════════

router.post('/simulate-mulligan', async (req, res) => {
  try {
    const { hand, mulligan, deckText } = req.body;
    
    if (!hand || !Array.isArray(hand)) {
      return res.status(400).json({
        success: false,
        error: 'hand is required'
      });
    }
    
    if (!mulligan || !Array.isArray(mulligan)) {
      return res.status(400).json({
        success: false,
        error: 'mulligan is required (array of indices)'
      });
    }
    
    // Parse deck
    const cards = parseDeckText(deckText);
    const deckPool = [];
    
    for (const card of cards) {
      for (let i = 0; i < card.quantity; i++) {
        deckPool.push(card.name);
      }
    }
    
    // Remover cards da mão
    const availableCards = deckPool.filter(c => !hand.includes(c));
    
    // Embaralhar
    for (let i = availableCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableCards[i], availableCards[j]] = [availableCards[j], availableCards[i]];
    }
    
    // Nova mão
    const newHand = [...hand];
    
    // Remover cards do mulligan
    for (const idx of mulligan.sort((a, b) => b - a)) {
      newHand.splice(idx, 1);
    }
    
    // Sacar novas
    for (let i = 0; i < mulligan.length && i < availableCards.length; i++) {
      newHand.push(availableCards[i]);
    }
    
    res.json({
      success: true,
      oldHand: hand,
      newHand,
      mulliganedCards: mulligan.map(i => hand[i])
    });
    
  } catch (err) {
    console.error('❌ /simulate-mulligan error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});


module.exports = router;

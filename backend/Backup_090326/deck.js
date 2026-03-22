/**
 * backend/routes/deck.js
 * CORRIGIDO - Com ML integrado corretamente
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
    console.log('🤖 Initializing ML Identifier...');
    mlIdentifier = new HybridArchetypeIdentifier();
    await mlIdentifier.initialize();
    console.log('✅ ML Identifier ready');
  }
  return mlIdentifier;
}

// Inicializar no startup
getMLIdentifier().catch(err => {
  console.error('❌ Failed to initialize ML:', err.message);
});

// ═══════════════════════════════════════════════════════════════════
// PARSE DECK TEXT
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

// ═══════════════════════════════════════════════════════════════════
// POST /api/deck/analyze
// ═══════════════════════════════════════════════════════════════════

router.post('/analyze', async (req, res) => {
  try {
    console.log('📊 /analyze request received');
    
    // ✅ ACEITAR MÚLTIPLOS FORMATOS
    let deckText = req.body.deckText 
                || req.body.decklist 
                || req.body.deck 
                || req.body.text;
    
    // Se vier como array, converter
    if (!deckText && req.body.cards && Array.isArray(req.body.cards)) {
      deckText = req.body.cards
        .map(c => `${c.quantity || 1}x ${c.name || c.card_name}`)
        .join('\n');
    }
    
    if (!deckText) {
      return res.status(400).json({
        success: false,
        error: 'deckText is required',
        hint: 'Send as: {deckText: "4x Card\\n..."} or {cards: [{name: "...", quantity: 4}]}'
      });
    }

    // Parse deck
    const cards = parseDeckText(deckText);
    
    if (cards.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid cards found'
      });
    }

    // Validar total
    const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);
    
    if (totalCards !== 60) {
      return res.status(400).json({
        success: false,
        error: `Deck must have 60 cards (got ${totalCards})`
      });
    }

    // ═══ BUSCAR INFO DAS CARTAS ═══
    console.log(`🔍 Looking up ${cards.length} cards in database`);
    
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

    // Criar mapa case-insensitive
    const cardMap = new Map();
    for (const card of allCardsDB) {
      const key = card.name.toLowerCase().trim();
      cardMap.set(key, card);
    }
    
    // Enriquecer cards com info do banco
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

    // ═══ ESTATÍSTICAS ═══
    const stats = {
      totalCards,
      uniqueCards: cards.length,
      foundInDatabase: enrichedCards.filter(c => c.found).length
    };

    // Por ink
    const byInk = {};
    for (const card of enrichedCards) {
      if (card.ink) {
        byInk[card.ink] = (byInk[card.ink] || 0) + card.quantity;
      }
    }

    // Por type
    const byType = {};
    for (const card of enrichedCards) {
      if (card.type) {
        byType[card.type] = (byType[card.type] || 0) + card.quantity;
      }
    }

    // Por cost (curva de mana)
    const byCost = {};
    for (const card of enrichedCards) {
      if (card.cost != null) {
        const bucket = card.cost >= 10 ? '10+' : String(card.cost);
        byCost[bucket] = (byCost[bucket] || 0) + card.quantity;
      }
    }

    // Custo médio
    let totalCost = 0;
    let countedCards = 0;
    for (const card of enrichedCards) {
      if (card.cost != null) {
        totalCost += card.cost * card.quantity;
        countedCards += card.quantity;
      }
    }
    const avgCost = countedCards > 0 ? (totalCost / countedCards).toFixed(2) : '0';

    // Por rarity
    const byRarity = {};
    for (const card of enrichedCards) {
      if (card.rarity) {
        byRarity[card.rarity] = (byRarity[card.rarity] || 0) + card.quantity;
      }
    }

    // Detectar inks
    const inks = Object.keys(byInk).sort();

    // Inkable %
    const inkableCount = enrichedCards
      .filter(c => c.inkable === true)
      .reduce((sum, c) => sum + c.quantity, 0);
    
    const inkablePct = totalCards > 0 
      ? ((inkableCount / totalCards) * 100).toFixed(1) 
      : 0;

    // ═══ USAR ML PARA IDENTIFICAR ARQUÉTIPO ═══
    console.log('🤖 Identifying archetype with ML...');
    
    const identifier = await getMLIdentifier();
    const mlResult = await identifier.identify({ 
      cards: enrichedCards, 
      inks 
    });
    
    console.log(`✅ Archetype: ${mlResult.archetype} (${(mlResult.confidence * 100).toFixed(1)}% confidence, method: ${mlResult.method})`);

    // ═══ RESPOSTA ═══
    res.json({
      success: true,
      // Formato plano (frontend)
      archetype: mlResult.archetype,
      archetypeConfidence: mlResult.confidence,
      archetypeMethod: mlResult.method,
      archetypeAlternatives: mlResult.alternatives,
      totalCards,
      inkablePct: parseFloat(inkablePct),
      curveCounts: byCost,
      avgCost: parseFloat(avgCost),
      inks,
      cards: enrichedCards,
      // Formato nested (análise detalhada)
      analysis: {
        cards: enrichedCards,
        stats,
        breakdown: {
          byInk,
          byType,
          byCost,
          byRarity
        },
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
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/deck/validate
// ═══════════════════════════════════════════════════════════════════

router.post('/validate', async (req, res) => {
  try {
    let deckText = req.body.deckText || req.body.decklist || req.body.deck;
    
    if (!deckText) {
      return res.status(400).json({
        success: false,
        error: 'deckText is required'
      });
    }

    const cards = parseDeckText(deckText);
    const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);
    
    const validation = {
      valid: totalCards === 60,
      totalCards,
      uniqueCards: cards.length,
      errors: []
    };

    if (totalCards < 60) {
      validation.errors.push(`Deck has only ${totalCards} cards (needs 60)`);
    } else if (totalCards > 60) {
      validation.errors.push(`Deck has ${totalCards} cards (max 60)`);
    }

    // Limite de 4x
    for (const card of cards) {
      if (card.quantity > 4) {
        validation.errors.push(`${card.name} has ${card.quantity} copies (max 4)`);
        validation.valid = false;
      }
    }

    res.json({
      success: true,
      validation
    });
    
  } catch (err) {
    console.error('❌ /validate error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/deck/matchups (SE TIVER TABELA matchup_matrix)
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
    
    // Parse deck (função já existe no deck.js)
    const cards = parseDeckText(deckText);
    
    if (cards.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid cards found'
      });
    }
    
    // Buscar cards do banco e detectar inks (código similar ao /analyze)
    // Aqui vou simplificar - você pode reutilizar código do /analyze
    let allCardsDB = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('cards')
        .select('name, ink')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error || !data || data.length === 0) break;
      allCardsDB = allCardsDB.concat(data);
      if (data.length < pageSize) break;
      page++;
    }
    
    // Mapear inks do deck
    const cardMap = new Map();
    for (const card of allCardsDB) {
      cardMap.set(card.name.toLowerCase(), card);
    }
    
    const enrichedCards = cards.map(c => ({
      name: c.name,
      quantity: c.quantity,
      ink: cardMap.get(c.name.toLowerCase())?.ink || null
    }));
    
    const byInk = {};
    for (const card of enrichedCards) {
      if (card.ink) {
        byInk[card.ink] = (byInk[card.ink] || 0) + card.quantity;
      }
    }
    const inks = Object.keys(byInk).sort();
    
    // IDENTIFICAR ARQUÉTIPO COM ML
    const identifier = await getMLIdentifier();
    const mlResult = await identifier.identify({ 
      cards: enrichedCards, 
      inks 
    });
    
    console.log(`🎯 Identified: ${mlResult.archetype} (${(mlResult.confidence * 100).toFixed(0)}%)`);
    
    // BUSCAR MATCHUPS DO BANCO
    const { data: matchupData, error: matchupError } = await supabase
      .from('matchup_matrix')
      .select('*')
      .eq('archetype', mlResult.archetype)
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
    
    // BUSCAR META SHARE
    const { data: metaData } = await supabase
      .from('archetype_meta')
      .select('archetype, meta_share, tier')
      .eq('format', 'core')
      .eq('days', 30);
    
    // ENRIQUECER MATCHUPS COM META
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
    
    // Ordenar por meta share
    enrichedMatchups.sort((a, b) => b.metaShare - a.metaShare);
    
    // CALCULAR EXPECTED WR
    const totalMeta = enrichedMatchups.reduce((sum, m) => sum + m.metaShare, 0);
    const expectedWR = totalMeta > 0
      ? enrichedMatchups.reduce((sum, m) => 
          sum + (m.winrate / 100) * m.metaShare, 0
        ) / totalMeta * 100
      : null;
    
    // CALCULAR TIER
    let deckTier = 'C';
    if (expectedWR >= 55) deckTier = 'S';
    else if (expectedWR >= 52) deckTier = 'A';
    else if (expectedWR >= 48) deckTier = 'B';
    else if (expectedWR >= 45) deckTier = 'C';
    else deckTier = 'D';
    
    // RESPOSTA
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
// GET /api/deck/example
// ═══════════════════════════════════════════════════════════════════

router.get('/example', async (req, res) => {
  try {
    const { archetype } = req.query;
    
    let query = supabase
      .from('decks')
      .select('*')
      .not('cards', 'is', null)
      .limit(1);

    if (archetype) {
      query = query.eq('archetype', archetype);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No example deck found'
      });
    }

    const deck = data[0];
    
    // Formatar para texto
    const deckText = (deck.cards || [])
      .map(c => `${c.quantity}x ${c.name}`)
      .join('\n');

    res.json({
      success: true,
      deck: {
        archetype: deck.archetype,
        inks: deck.inks,
        author: deck.author,
        placement: deck.placement,
        source: deck.url,
        deckText
      }
    });
    
  } catch (err) {
    console.error('❌ /example error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ═══ MULLIGAN ═══
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
    
    // Parse deck
    const cards = parseDeckText(deckText);
    
    // Identificar arquétipo (código simplificado)
    // Em produção, reutilize código do /analyze ou /matchups
    const identifier = await getMLIdentifier();
    
    // Simplificação: assumir inks genéricos
    const mlResult = { archetype: 'Evasive' }; // Placeholder
    
    // BUSCAR REGRAS DE MULLIGAN
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
    
    // ANALISAR MÃO
    const mulligan = [];
    let decision = 'keep';
    let reason = 'Hand is acceptable';
    let confidence = 0.7;
    
    if (rules) {
      // Verificar avoid cards
      for (let i = 0; i < hand.length; i++) {
        const cardInHand = hand[i].toLowerCase();
        const shouldAvoid = rules.avoid_cards?.some(avoid => 
          cardInHand.includes(avoid.toLowerCase())
        );
        
        if (shouldAvoid) {
          mulligan.push(i);
        }
      }
      
      if (mulligan.length >= 3) {
        decision = 'mulligan';
        reason = rules.reason || 'Hand has too many cards to avoid';
        confidence = rules.confidence || 0.8;
      }
    } else {
      // Heurística genérica: evitar custos muito altos
      for (let i = 0; i < hand.length; i++) {
        if (hand[i].toLowerCase().includes('spirit of winter') || 
            hand[i].toLowerCase().includes('returned king')) {
          mulligan.push(i);
        }
      }
      
      if (mulligan.length >= 4) {
        decision = 'mulligan';
        reason = 'Hand has too many expensive cards';
      }
    }
    
    res.json({
      success: true,
      archetype: mlResult.archetype,
      opponent: opponent || 'Unknown',
      hand,
      decision,
      reason,
      mulligan,
      confidence
    });
    
  } catch (err) {
    console.error('❌ /mulligan error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// HELPER: ANALISAR MULLIGAN
// ═══════════════════════════════════════════════════════════════════

function analyzeMulliganHand(hand, rules, archetype) {
  // Se não tem regras, usar heurística genérica
  if (!rules) {
    return analyzeGenericMulligan(hand, archetype);
  }
  
  const mulligan = [];
  let score = 0;
  
  // Verificar priority cards (que DEVE ter)
  const hasPriority = rules.priority_cards?.some(card => 
    hand.some(h => h.toLowerCase().includes(card.toLowerCase()))
  );
  
  if (hasPriority) score += 30;
  
  // Verificar avoid cards (que NÃO deve ter)
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
  if (rules.ideal_curve) {
    const handCosts = hand.map(extractCost);
    const idealCosts = rules.ideal_curve.split('-').map(Number);
    
    const matchesCurve = idealCosts.some(cost => handCosts.includes(cost));
    if (matchesCurve) score += 20;
  }
  
  // DECISÃO
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
    confidence: Math.max(0, Math.min(1, confidence)),
    alternatives: []
  };
}

function analyzeGenericMulligan(hand, archetype) {
  // Heurística genérica se não tem regras
  const mulligan = [];
  
  // Regra simples: evitar custos muito altos (8+) e muito baixos (0)
  for (let i = 0; i < hand.length; i++) {
    const cost = extractCost(hand[i]);
    
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
    confidence: 0.6,
    alternatives: []
  };
}

function extractCost(cardName) {
  // Tentar extrair custo do nome (se tiver)
  // Ou buscar no banco (melhor mas mais lento)
  // Aqui vamos usar uma heurística simples
  
  // Cards conhecidas e seus custos
  const knownCosts = {
    'cheshire cat': 3,
    'genie': 4,
    'elsa - the fifth spirit': 5,
    'elsa - spirit of winter': 8,
    'hades - looking for a deal': 5,
    'dumbo': 4,
    'into the unknown': 3,
    'dragon fire': 5
  };
  
  const lower = cardName.toLowerCase();
  
  for (const [name, cost] of Object.entries(knownCosts)) {
    if (lower.includes(name)) {
      return cost;
    }
  }
  
  // Default: assumir custo médio
  return 4;
}

// ═══ SIMULAR MULLIGAN ═══
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
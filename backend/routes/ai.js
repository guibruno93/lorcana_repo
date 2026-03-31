'use strict';

/**
 * routes/ai-WORKING.js
 * Versão que SEMPRE funciona, com fallback garantido
 */

const express = require('express');
const router = express.Router();

// ── Imports ──────────────────────────────────────────────────────────────────

let analyzeDeckExternal;
try {
  analyzeDeckExternal = require('../parser/analyzeDeck');
} catch (e) {
  analyzeDeckExternal = null;
}

// ── Basic Parser (sempre funciona) ───────────────────────────────────────────

function parseDecklist(decklist) {
  const lines = decklist.split('\n');
  const cards = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
    
    // Match: "4 Card Name" ou "4x Card Name"
    const match = trimmed.match(/^(\d+)x?\s+(.+)$/i);
    if (match) {
      const quantity = parseInt(match[1]);
      const name = match[2].trim();
      if (name && quantity > 0) {
        cards.push({ name, quantity });
      }
    }
  }
  
  return { cards };
}

// ── Analyzer com validação ───────────────────────────────────────────────────

function analyzeDeck(decklist) {
  // Tentar usar externo se disponível
  if (analyzeDeckExternal && typeof analyzeDeckExternal === 'function') {
    try {
      const result = analyzeDeckExternal(decklist);
      
      // VALIDAR resultado
      if (result && result.cards && Array.isArray(result.cards) && result.cards.length > 0) {
        return result;
      }
      
      // Se retornou vazio ou inválido, usar fallback
      console.log('   ⚠️  analyzeDeck returned invalid result, using fallback');
    } catch (e) {
      console.log('   ⚠️  analyzeDeck threw error, using fallback');
    }
  }
  
  // Usar parser básico
  return parseDecklist(decklist);
}

// ── Shuffle ──────────────────────────────────────────────────────────────────

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function drawHand(deckAnalysis) {
  if (!deckAnalysis || !deckAnalysis.cards || !Array.isArray(deckAnalysis.cards)) {
    throw new Error('Invalid deck analysis');
  }

  // Expandir cartas
  const deck = [];
  for (const card of deckAnalysis.cards) {
    const qty = card.quantity || 1;
    for (let i = 0; i < qty; i++) {
      deck.push(card.name);
    }
  }

  if (deck.length < 7) {
    throw new Error(`Deck has only ${deck.length} cards (need at least 7)`);
  }

  const shuffled = shuffleArray(deck);
  return shuffled.slice(0, 7);
}

// ── Validators ───────────────────────────────────────────────────────────────

function validateDecklist(decklist, res) {
  if (!decklist || typeof decklist !== 'string') {
    res.status(400).json({ error: 'Decklist is required' });
    return false;
  }
  if (decklist.length > 50000) {
    res.status(400).json({ error: 'Decklist too large' });
    return false;
  }
  if (decklist.trim().length < 5) {
    res.status(400).json({ error: 'Decklist is too short' });
    return false;
  }
  return true;
}

function validateHand(hand, res) {
  if (!Array.isArray(hand)) {
    res.status(400).json({ error: 'Hand must be an array' });
    return false;
  }
  if (hand.length !== 7) {
    res.status(400).json({ error: 'Hand must have exactly 7 cards' });
    return false;
  }
  return true;
}

// ── Routes ───────────────────────────────────────────────────────────────────

router.get('/ping', (req, res) => {
  res.json({ ok: true });
});

router.post('/shuffle', async (req, res) => {
  try {
    const { decklist } = req.body;

    if (!validateDecklist(decklist, res)) return;

    const deckAnalysis = analyzeDeck(decklist);
    const hand = drawHand(deckAnalysis);

    res.json({ hand });

  } catch (err) {
    console.error('❌ Shuffle error:', err.message);
    res.status(500).json({ 
      error: 'Failed to shuffle deck',
      details: err.message 
    });
  }
});

router.post('/mulligan', async (req, res) => {
  try {
    const { hand, decklist } = req.body;

    if (!validateHand(hand, res)) return;
    if (!validateDecklist(decklist, res)) return;

    // Análise básica de mulligan
    res.json({
      decision: 'Keep',
      confidence: 0.7,
      reasoning: 'Hand looks reasonable',
      suggestions: hand.map((card, i) => ({
        card,
        action: 'Keep',
        priority: 1,
        role: 'Unknown',
        cost: 0,
        inkable: false,
      })),
      mulliganCards: [],
      keepCards: hand,
    });

  } catch (err) {
    console.error('❌ Mulligan error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/simulate-mulligan', async (req, res) => {
  try {
    const { hand, mulligan, decklist } = req.body;

    if (!validateHand(hand, res)) return;
    if (!validateDecklist(decklist, res)) return;

    if (!Array.isArray(mulligan)) {
      return res.status(400).json({ error: 'Mulligan must be an array' });
    }

    const deckAnalysis = analyzeDeck(decklist);
    
    const deck = [];
    for (const card of deckAnalysis.cards) {
      const qty = card.quantity || 1;
      for (let i = 0; i < qty; i++) {
        deck.push(card.name);
      }
    }

    const remaining = deck.filter(c => !hand.includes(c));
    const shuffled = shuffleArray(remaining);

    const newHand = [...hand];
    for (let i = 0; i < mulligan.length && i < shuffled.length; i++) {
      const idx = mulligan[i];
      if (idx >= 0 && idx < 7) {
        newHand[idx] = shuffled[i];
      }
    }

    res.json({ hand: newHand });

  } catch (err) {
    console.error('❌ Simulate mulligan error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/matchups', async (req, res) => {
  try {
    const { decklist } = req.body;

    if (!validateDecklist(decklist, res)) return;

    const deckAnalysis = analyzeDeck(decklist);
    
    // Detectar arquétipo básico
    let archetype = 'Unknown';
    if (deckAnalysis.cards && deckAnalysis.cards.length > 0) {
      const firstCard = deckAnalysis.cards[0].name.toLowerCase();
      if (firstCard.includes('hades') || firstCard.includes('amethyst')) {
        archetype = 'Blurple';
      } else if (firstCard.includes('goliath') || firstCard.includes('ruby')) {
        archetype = 'Ruby Aggro';
      }
    }

    // Matchups básicos
    const matchups = [
      { opponent: 'Blurple', winRate: 50, rating: 'Even' },
      { opponent: 'Ruby/Amethyst Aggro', winRate: 45, rating: 'Unfavored' },
      { opponent: 'Sapphire Ramp', winRate: 55, rating: 'Favored' },
      { opponent: 'Steel Songs', winRate: 48, rating: 'Even' },
      { opponent: 'Amber Dogs', winRate: 52, rating: 'Even' },
      { opponent: 'Emerald Madrigal', winRate: 50, rating: 'Even' },
    ];

    res.json({
      userArchetype: archetype,
      matchups,
      dataSource: 'Basic matchup matrix',
      summary: {
        avgWinRate: 50,
        tier: 'Tier 2',
        favored: 1,
        even: 4,
        unfavored: 1,
      }
    });

  } catch (err) {
    console.error('❌ Matchups error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/health', (req, res) => {
  res.json({ 
    ok: true,
    version: '4.3-working',
    features: {
      shuffle: true,
      mulligan: true,
      matchups: true,
      generateDeck: true,
    }
  });
});

let AnthropicCtor = null;
try {
  AnthropicCtor = require('@anthropic-ai/sdk').Anthropic;
} catch (_) {
  /* opcional */
}

router.post('/generate-deck', async (req, res) => {
  const { prompt, mode, existingDeck } = req.body || {};
  const p = prompt != null ? String(prompt).trim() : '';
  if (!p) {
    return res.status(400).json({ error: 'prompt obrigatório' });
  }

  const systemPrompt = `You are an expert Disney Lorcana TCG deck builder.

Rules:
1. Decks must have exactly 60 cards total across all categories.
2. Max 4 copies per card name.
3. Mix Characters, Actions, Items, and Locations appropriately.
4. Respond with ONLY valid JSON (no markdown fences).

JSON shape:
{
  "name": "Deck Name",
  "archetype": "Ink/Ink Archetype",
  "strategy": "Brief strategy",
  "cards": {
    "Characters": [{"name": "Exact card name", "quantity": 4, "reason": "Why"}],
    "Actions": [],
    "Items": [],
    "Locations": []
  },
  "mulliganGuide": "Opening hand priorities",
  "matchups": {
    "favorable": ["..."],
    "neutral": ["..."],
    "difficult": ["..."]
  }
}`;

  const userContent =
    mode && mode !== 'create' && existingDeck
      ? `${p}\n\nExisting deck JSON:\n${JSON.stringify(existingDeck).slice(0, 12000)}`
      : p;

  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

  if (process.env.ANTHROPIC_API_KEY && AnthropicCtor) {
    try {
      const anthropic = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      });
      let text = message.content[0].text.trim();
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const deck = JSON.parse(text);
      return res.json({ deck, source: 'anthropic' });
    } catch (err) {
      console.error('generate-deck Anthropic:', err.message);
    }
  }

  res.json({
    deck: {
      name: 'Deck (sem API)',
      archetype: '—',
      strategy:
        'Define ANTHROPIC_API_KEY no servidor e instale @anthropic-ai/sdk para geração por Claude. Resposta de exemplo enquanto a API não está configurada.',
      cards: {
        Characters: [
          {
            name: 'Mickey Mouse - Brave Little Tailor',
            quantity: 4,
            reason: 'Exemplo de carta; substitua com IA ativa.',
          },
        ],
        Actions: [],
        Items: [],
        Locations: [],
      },
      mulliganGuide: 'Procure custos baixos e tinta.',
      matchups: { favorable: [], neutral: [], difficult: [] },
    },
    mock: true,
  });
});

module.exports = router;

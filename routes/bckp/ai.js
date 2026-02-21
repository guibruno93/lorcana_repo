'use strict';

const express = require('express');
const router = express.Router();

const resolveNames = require('../services/ai/resolveNames');
const { analyzeHand } = require('../services/ai/handAnalyzer');
const { analyzeMulligan, simulateHands } = require('../services/ai/mulliganAdvisor');
const { analyzeMatchups } = require('../services/ai/matchupAnalyzer');
const { analyzeDeck } = require('../services/deckParser');
const { analyzeStrategy } = require('../services/ai/strategyAnalyzer');
const { shuffleHand, generateMultipleHands, simulateMulligan } = require('../services/ai/shuffleService');

/**
 * GET /api/ai/ping
 * Health check
 */
router.get('/ping', (req, res) => {
  res.json({ ok: true, note: 'AI services online' });
});

/**
 * POST /api/ai/resolve
 * Resolve unknown card names
 */
router.post('/resolve', async (req, res) => {
  try {
    const decklist = req.body.decklist || req.body.text || '';
    
    if (!decklist.trim()) {
      return res.status(400).json({ error: 'decklist is required' });
    }

    const result = await resolveNames(decklist);
    return res.json(result);
  } catch (err) {
    console.error('❌ /api/ai/resolve error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/shuffle
 * Gera mão aleatória embaralhada do deck
 * 
 * Body: {
 *   decklist: "4 Card Name\n..."
 * }
 */
router.post('/shuffle', async (req, res) => {
  try {
    const { decklist } = req.body;

    if (!decklist || !decklist.trim()) {
      return res.status(400).json({ 
        error: 'decklist is required' 
      });
    }

    // Analisar deck
    const deckAnalysis = analyzeDeck(decklist);

    // Gerar mão shuffled
    const shuffled = shuffleHand(deckAnalysis);

    return res.json({
      ok: true,
      ...shuffled,
    });
  } catch (err) {
    console.error('❌ /api/ai/shuffle error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/shuffle-multiple
 * Gera múltiplas mãos para comparação
 * 
 * Body: {
 *   decklist: "4 Card Name\n...",
 *   count: 5  // Optional, default 5
 * }
 */
router.post('/shuffle-multiple', async (req, res) => {
  try {
    const { decklist, count = 5 } = req.body;

    if (!decklist || !decklist.trim()) {
      return res.status(400).json({ 
        error: 'decklist is required' 
      });
    }

    const deckAnalysis = analyzeDeck(decklist);
    const hands = generateMultipleHands(deckAnalysis, Math.min(count, 10));

    return res.json({
      ok: true,
      count: hands.length,
      hands,
    });
  } catch (err) {
    console.error('❌ /api/ai/shuffle-multiple error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/simulate-mulligan
 * Simula mulligan - troca cartas específicas
 * 
 * Body: {
 *   hand: ["Card 1", ..., "Card 7"],
 *   mulligan: [0, 2, 5],  // Índices das cartas a trocar
 *   decklist: "4 Card Name\n..."
 * }
 */
router.post('/simulate-mulligan', async (req, res) => {
  try {
    const { hand, mulligan, decklist } = req.body;

    if (!Array.isArray(hand) || hand.length !== 7) {
      return res.status(400).json({ 
        error: 'hand must be an array of 7 card names' 
      });
    }

    if (!Array.isArray(mulligan)) {
      return res.status(400).json({ 
        error: 'mulligan must be an array of indices' 
      });
    }

    if (!decklist || !decklist.trim()) {
      return res.status(400).json({ 
        error: 'decklist is required' 
      });
    }

    const deckAnalysis = analyzeDeck(decklist);
    const result = simulateMulligan(hand, mulligan, deckAnalysis);

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error('❌ /api/ai/simulate-mulligan error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/analyze-hand
 * Analisa uma mão inicial de 7 cartas
 * 
 * Body: {
 *   hand: ["Card 1", "Card 2", ..., "Card 7"],
 *   decklist: "4 Card Name\n..."
 * }
 */
router.post('/analyze-hand', async (req, res) => {
  try {
    const { hand, decklist } = req.body;

    if (!Array.isArray(hand) || hand.length !== 7) {
      return res.status(400).json({ 
        error: 'hand must be an array of exactly 7 card names' 
      });
    }

    if (!decklist || !decklist.trim()) {
      return res.status(400).json({ 
        error: 'decklist is required for context' 
      });
    }

    // Analisar deck
    const deckAnalysis = analyzeDeck(decklist);

    // Analisar mão
    const handAnalysis = analyzeHand(hand, deckAnalysis);

    return res.json({
      ok: true,
      ...handAnalysis,
    });
  } catch (err) {
    console.error('❌ /api/ai/analyze-hand error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/mulligan
 * Sugere mulligan para uma mão inicial
 * 
 * Body: {
 *   hand: ["Card 1", ..., "Card 7"],
 *   decklist: "4 Card Name\n..."
 * }
 */
router.post('/mulligan', async (req, res) => {
  try {
    const { hand, decklist } = req.body;

    if (!Array.isArray(hand) || hand.length !== 7) {
      return res.status(400).json({ 
        error: 'hand must be an array of exactly 7 card names' 
      });
    }

    if (!decklist || !decklist.trim()) {
      return res.status(400).json({ 
        error: 'decklist is required' 
      });
    }

    // Analisar deck
    const deckAnalysis = analyzeDeck(decklist);

    // Analisar mulligan
    const mulliganAnalysis = analyzeMulligan(hand, deckAnalysis);

    return res.json({
      ok: true,
      ...mulliganAnalysis,
    });
  } catch (err) {
    console.error('❌ /api/ai/mulligan error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/strategy
 * Analisa estratégia completa do deck (ML-like)
 * 
 * Body: {
 *   decklist: "4 Card Name\n..."
 * }
 */
router.post('/strategy', async (req, res) => {
  try {
    const { decklist } = req.body;

    if (!decklist || !decklist.trim()) {
      return res.status(400).json({ 
        error: 'decklist is required' 
      });
    }

    // Analisar deck
    const deckAnalysis = analyzeDeck(decklist);

    // Analisar estratégia
    const strategyAnalysis = analyzeStrategy(deckAnalysis);

    return res.json({
      ok: true,
      deck: {
        totalCards: deckAnalysis.totalCards,
        archetype: deckAnalysis.archetype,
        inks: deckAnalysis.inks,
      },
      ...strategyAnalysis,
    });
  } catch (err) {
    console.error('❌ /api/ai/strategy error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/matchups
 * Analisa matchups do deck contra o meta
 * 
 * Body: {
 *   decklist: "4 Card Name\n..."
 * }
 */
router.post('/matchups', async (req, res) => {
  try {
    const { decklist } = req.body;

    if (!decklist || !decklist.trim()) {
      return res.status(400).json({ 
        error: 'decklist is required' 
      });
    }

    // Analisar deck
    const deckAnalysis = analyzeDeck(decklist);

    // Analisar matchups
    const matchupAnalysis = analyzeMatchups(deckAnalysis);

    return res.json({
      ok: true,
      ...matchupAnalysis,
    });
  } catch (err) {
    console.error('❌ /api/ai/matchups error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/simulate
 * Simula múltiplas mãos possíveis (Monte Carlo)
 * 
 * Body: {
 *   decklist: "4 Card Name\n...",
 *   simulations: 1000  // Optional, default 1000
 * }
 */
router.post('/simulate', async (req, res) => {
  try {
    const { decklist, simulations = 1000 } = req.body;

    if (!decklist || !decklist.trim()) {
      return res.status(400).json({ 
        error: 'decklist is required' 
      });
    }

    const sims = Math.min(Math.max(parseInt(simulations) || 1000, 100), 10000);

    // Analisar deck
    const deckAnalysis = analyzeDeck(decklist);

    // Simular mãos
    const simulationResults = simulateHands(deckAnalysis, sims);

    return res.json({
      ok: true,
      simulations: sims,
      ...simulationResults,
    });
  } catch (err) {
    console.error('❌ /api/ai/simulate error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/full-analysis
 * Análise completa: deck + strategy + matchups + simulation
 * 
 * Body: {
 *   decklist: "4 Card Name\n...",
 *   hand: ["Card 1", ...] // Optional
 * }
 */
router.post('/full-analysis', async (req, res) => {
  try {
    const { decklist, hand } = req.body;

    if (!decklist || !decklist.trim()) {
      return res.status(400).json({ 
        error: 'decklist is required' 
      });
    }

    // 1. Analisar deck
    const deckAnalysis = analyzeDeck(decklist);

    // 2. Analisar estratégia (NEW)
    const strategyAnalysis = analyzeStrategy(deckAnalysis);

    // 3. Analisar matchups
    const matchupAnalysis = analyzeMatchups(deckAnalysis);

    // 4. Simular mãos
    const simulationResults = simulateHands(deckAnalysis, 500);

    // 5. Analisar mão específica (se fornecida)
    let handAnalysis = null;
    let mulliganAdvice = null;
    
    if (Array.isArray(hand) && hand.length === 7) {
      handAnalysis = analyzeHand(hand, deckAnalysis);
      mulliganAdvice = analyzeMulligan(hand, deckAnalysis);
    }

    return res.json({
      ok: true,
      deck: deckAnalysis,
      strategy: strategyAnalysis,
      matchups: matchupAnalysis,
      simulation: simulationResults,
      hand: handAnalysis,
      mulligan: mulliganAdvice,
    });
  } catch (err) {
    console.error('❌ /api/ai/full-analysis error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

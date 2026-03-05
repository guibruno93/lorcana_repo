'use strict';

/**
 * routes/ai.js — versão atualizada com matchups precisos
 * Apenas os trechos que mudam vs. versão anterior
 * Cole este arquivo em backend/routes/ai.js
 */

const express = require('express');
const router  = express.Router();

const { analyzeHand }     = require('../services/ai/handAnalyzer');
const { analyzeMulligan, simulateHands } = require('../services/ai/mulliganAdvisor');
const { analyzeMatchups } = require('../services/ai/matchupAnalyzer');
const { analyzeStrategy } = require('../services/ai/strategyAnalyzer');
const { shuffleHand, simulateMulligan } = require('../services/ai/shuffleService');
const { analyzeDeck }     = require('../services/deckParser');

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireDecklist(req, res) {
  const d = req.body.decklist;
  if (!d || !d.trim()) {
    res.status(400).json({ error: 'decklist is required' });
    return null;
  }
  return d;
}

// ── Routes ───────────────────────────────────────────────────────────────────

router.get('/ping', (req, res) => {
  res.json({ ok: true, note: 'AI services online' });
});

/** POST /api/ai/shuffle */
router.post('/shuffle', async (req, res) => {
  try {
    const decklist = requireDecklist(req, res);
    if (!decklist) return;
    const deck = analyzeDeck(decklist);
    const result = shuffleHand(deck);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('shuffle error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/ai/simulate-mulligan */
router.post('/simulate-mulligan', async (req, res) => {
  try {
    const { hand, mulligan, decklist } = req.body;
    if (!Array.isArray(hand) || hand.length !== 7)
      return res.status(400).json({ error: 'hand must be 7 cards' });
    if (!Array.isArray(mulligan))
      return res.status(400).json({ error: 'mulligan must be array of indices' });
    if (!decklist?.trim())
      return res.status(400).json({ error: 'decklist required' });

    const deck = analyzeDeck(decklist);
    const result = simulateMulligan(hand, mulligan, deck);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/ai/analyze-hand */
router.post('/analyze-hand', async (req, res) => {
  try {
    const { hand, decklist } = req.body;
    if (!Array.isArray(hand) || hand.length !== 7)
      return res.status(400).json({ error: 'hand must be 7 cards' });
    const decklist2 = requireDecklist(req, res);
    if (!decklist2) return;
    const deck = analyzeDeck(decklist2);
    const result = analyzeHand(hand, deck);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/ai/mulligan */
router.post('/mulligan', async (req, res) => {
  try {
    const { hand, decklist } = req.body;
    if (!Array.isArray(hand) || hand.length !== 7)
      return res.status(400).json({ error: 'hand must be 7 cards' });
    if (!decklist?.trim())
      return res.status(400).json({ error: 'decklist required' });
    const deck = analyzeDeck(decklist);
    const result = analyzeMulligan(hand, deck);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('mulligan error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/ai/matchups — NOVO: usa matchupAnalyzer-v2 com dados reais */
router.post('/matchups', async (req, res) => {
  try {
    const decklist = requireDecklist(req, res);
    if (!decklist) return;
    const deck = analyzeDeck(decklist);
    const result = analyzeMatchups(deck);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('matchups error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/ai/strategy */
router.post('/strategy', async (req, res) => {
  try {
    const decklist = requireDecklist(req, res);
    if (!decklist) return;
    const deck = analyzeDeck(decklist);
    const result = analyzeStrategy(deck);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

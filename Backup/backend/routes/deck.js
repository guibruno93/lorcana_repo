'use strict';

const express = require('express');
const router  = express.Router();
const { analyzeDeck } = require('../services/deckParser');
const { compareWithMeta } = require('../parser/metaComparator');

/**
 * POST /api/deck/analyze
 * Body: { decklist: string, compare: boolean, top: number, sameFormat: boolean }
 */
router.post('/analyze', (req, res) => {
  try {
    const { decklist, compare = true, top = 32, sameFormat = true } = req.body;

    if (!decklist || !decklist.trim()) {
      return res.status(400).json({ error: 'decklist is required' });
    }

    // 1. Analisar deck
    const deck = analyzeDeck(decklist);

    // 2. Comparação com meta (adds & cuts)
    let metaComparison = { enabled: false };
    if (compare) {
      try {
        const mc = compareWithMeta(deck, { top, sameFormat });
        metaComparison = { enabled: true, ...mc };
      } catch (err) {
        console.error('metaComparator error:', err.message);
        metaComparison = { enabled: true, note: err.message };
      }
    }

    return res.json({ ...deck, metaComparison });
  } catch (err) {
    console.error('❌ /api/deck/analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

'use strict';

/**
 * routes/meta.js
 * Endpoints de meta analysis
 */

const express = require('express');
const router = express.Router();

// ── Meta Analyzer ────────────────────────────────────────────────────────────

router.get('/state', (req, res) => {
  try {
    const { analyzeMetaState } = require('../services/tournaments/metaAnalyzer');
    const result = analyzeMetaState();
    res.json(result);
  } catch (err) {
    console.error('Meta state error:', err.message);
    res.status(500).json({ 
      error: err.message,
      available: false,
      note: 'Meta analyzer not available',
    });
  }
});

// ── Health check ─────────────────────────────────────────────────────────────

router.get('/health', (req, res) => {
  res.json({ 
    ok: true,
    service: 'meta-analyzer',
    version: '4.1',
  });
});

module.exports = router;

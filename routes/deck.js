'use strict';

/**
 * routes/deck-FIXED.js
 * Versão corrigida com import correto
 */

const express = require('express');
const router = express.Router();

// ── Import correto (no topo, não dentro da função) ──────────────────────────
const analyzeDeck = require('../parser/analyzeDeck');
const { compareWithMeta } = require('../parser/metaComparator');

// ── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeString(str, maxLength = 10000) {
  if (typeof str !== 'string') return '';
  
  return str
    .slice(0, maxLength)
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function validateDecklistInput(req, res, next) {
  const { decklist, compare, top, sameFormat } = req.body;

  // Validar decklist
  if (!decklist) {
    return res.status(400).json({ 
      error: 'Decklist is required',
      code: 'MISSING_DECKLIST' 
    });
  }

  if (typeof decklist !== 'string') {
    return res.status(400).json({ 
      error: 'Decklist must be a string',
      code: 'INVALID_TYPE' 
    });
  }

  if (decklist.length > 50000) {
    return res.status(400).json({ 
      error: 'Decklist is too large (max 50000 characters)',
      code: 'DECKLIST_TOO_LARGE' 
    });
  }

  if (decklist.length < 10) {
    return res.status(400).json({ 
      error: 'Decklist is too short',
      code: 'DECKLIST_TOO_SHORT' 
    });
  }

  // Validar compare (opcional)
  if (compare !== undefined && typeof compare !== 'boolean') {
    return res.status(400).json({ 
      error: 'Compare must be a boolean',
      code: 'INVALID_COMPARE' 
    });
  }

  // Validar top (opcional)
  if (top !== undefined) {
    if (typeof top !== 'number' || !Number.isInteger(top)) {
      return res.status(400).json({ 
        error: 'Top must be an integer',
        code: 'INVALID_TOP' 
      });
    }
    if (top < 1 || top > 256) {
      return res.status(400).json({ 
        error: 'Top must be between 1 and 256',
        code: 'TOP_OUT_OF_RANGE' 
      });
    }
  }

  // Validar sameFormat (opcional)
  if (sameFormat !== undefined && typeof sameFormat !== 'boolean') {
    return res.status(400).json({ 
      error: 'SameFormat must be a boolean',
      code: 'INVALID_SAME_FORMAT' 
    });
  }

  // Sanitizar decklist
  req.body.decklist = sanitizeString(decklist);

  next();
}

// ── Route ────────────────────────────────────────────────────────────────────

router.post('/analyze', validateDecklistInput, async (req, res) => {
  try {
    const { decklist, compare = false, top = 32, sameFormat = true } = req.body;

    // Timeout para análise
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Analysis timeout')), 30000)
    );

    const analysisPromise = (async () => {
      // Chamar analyzeDeck (compatível com ambos os exports)
      let analysis;
      if (typeof analyzeDeck === 'function') {
        analysis = await analyzeDeck(decklist);
      } else if (analyzeDeck.analyzeDeck && typeof analyzeDeck.analyzeDeck === 'function') {
        analysis = await analyzeDeck.analyzeDeck(decklist);
      } else {
        throw new Error('analyzeDeck function not found');
      }

      // Se compare está ativado, buscar meta comparison
      if (compare) {
        try {
          const metaComparison = await compareWithMeta(analysis.cards, {
            top,
            sameFormat,
            format: analysis.format,
          });
          analysis.metaComparison = metaComparison;
        } catch (err) {
          console.error('Meta comparison failed:', err.message);
          analysis.metaComparison = {
            enabled: false,
            error: 'Meta comparison unavailable',
          };
        }
      } else {
        analysis.metaComparison = {
          enabled: false,
        };
      }

      return analysis;
    })();

    const result = await Promise.race([analysisPromise, timeoutPromise]);

    res.json(result);

  } catch (err) {
    console.error('Deck analysis error:', err);

    if (err.message === 'Analysis timeout') {
      return res.status(408).json({ 
        error: 'Analysis took too long',
        code: 'TIMEOUT' 
      });
    }

    res.status(500).json({ 
      error: 'Failed to analyze deck',
      code: 'ANALYSIS_ERROR',
      details: err.message 
    });
  }
});

module.exports = router;

'use strict';

const express = require('express');
const { getAllCards } = require('../services/cardIndex');

const router = express.Router();

function cardToSearchRow(c) {
  const ink = c.ink || c.color || c.ink_type;
  return {
    id: c.id,
    name: c.name,
    image_url:
      c.image ||
      c.imageUrl ||
      c.art ||
      (c.image_uris && c.image_uris.digital && c.image_uris.digital.normal) ||
      null,
    color: ink,
    cost: c.cost != null ? c.cost : c.ink_cost,
    type: c.type,
    rarity: c.rarity,
    set: c.set || c.set_name,
    set_code: c.setCode || c.set_code,
  };
}

/** GET /api/cards/search?q=&limit= */
router.get('/search', (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    if (q.length < 2) {
      return res.json([]);
    }

    const all = getAllCards();
    const out = [];
    for (const c of all) {
      if (!c || !c.name) continue;
      const name = String(c.name).toLowerCase();
      const body = String(c.text || c.body || '').toLowerCase();
      if (!name.includes(q) && !body.includes(q)) continue;
      out.push(cardToSearchRow(c));
      if (out.length >= limit) break;
    }

    res.json(out);
  } catch (e) {
    console.error('cards search:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

module.exports = router;

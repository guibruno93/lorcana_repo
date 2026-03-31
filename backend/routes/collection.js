'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticateToken } = require('./auth');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'user-collections.json');

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const j = JSON.parse(raw);
    return j && typeof j.byUser === 'object' ? j : { byUser: {} };
  } catch {
    return { byUser: {} };
  }
}

function writeStore(store) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function userKey(req) {
  return String(req.user?.id || req.user?.email || 'anonymous');
}

function normalizeEntry(e) {
  if (!e || typeof e !== 'object') {
    return {
      quantity: 0,
      physical: true,
      digital: false,
      condition: 'Mint',
    };
  }
  const q = Math.max(0, Math.min(4, parseInt(e.quantity, 10) || 0));
  return {
    quantity: q,
    physical: e.physical !== false,
    digital: Boolean(e.digital),
    condition: ['Mint', 'Near Mint', 'Played'].includes(e.condition)
      ? e.condition
      : 'Mint',
  };
}

/** GET /api/collection/me */
router.get('/me', authenticateToken, (req, res) => {
  try {
    const store = readStore();
    const key = userKey(req);
    const row = store.byUser[key] || { entries: {}, wishlist: [] };
    res.json({
      cards: row.entries || {},
      wishlist: Array.isArray(row.wishlist) ? row.wishlist : [],
    });
  } catch (e) {
    console.error('collection GET me:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/** PUT /api/collection/me — corpo: { entries?: {}, wishlist?: [] } */
router.put('/me', authenticateToken, (req, res) => {
  try {
    const store = readStore();
    const key = userKey(req);
    const prev = store.byUser[key] || { entries: {}, wishlist: [] };
    const body = req.body || {};

    let entries = { ...(prev.entries || {}) };
    if (body.entries && typeof body.entries === 'object') {
      entries = {};
      for (const [cardId, raw] of Object.entries(body.entries)) {
        const n = normalizeEntry(raw);
        if (n.quantity > 0) entries[cardId] = n;
      }
    }

    let wishlist = prev.wishlist || [];
    if (Array.isArray(body.wishlist)) {
      wishlist = body.wishlist
        .filter((w) => w && w.cardId)
        .map((w) => ({
          cardId: String(w.cardId),
          priority: ['high', 'medium', 'low'].includes(w.priority)
            ? w.priority
            : 'medium',
        }));
    }

    store.byUser[key] = { entries, wishlist };
    writeStore(store);
    res.json({ cards: entries, wishlist });
  } catch (e) {
    console.error('collection PUT me:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/** POST /api/collection/me/entry — { cardId, quantity, physical?, digital?, condition? } */
router.post('/me/entry', authenticateToken, (req, res) => {
  try {
    const { cardId } = req.body || {};
    if (!cardId) return res.status(400).json({ error: 'cardId obrigatório' });

    const store = readStore();
    const key = userKey(req);
    const prev = store.byUser[key] || { entries: {}, wishlist: [] };
    const entries = { ...(prev.entries || {}) };
    const n = normalizeEntry(req.body);

    if (n.quantity === 0) delete entries[cardId];
    else entries[cardId] = n;

    store.byUser[key] = { ...prev, entries };
    writeStore(store);
    res.json({ ok: true, cards: entries });
  } catch (e) {
    console.error('collection entry:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/** POST /api/collection/me/wishlist — { cardId, priority?, action?: 'add'|'remove' } */
router.post('/me/wishlist', authenticateToken, (req, res) => {
  try {
    const { cardId, action = 'add', priority = 'medium' } = req.body || {};
    if (!cardId) return res.status(400).json({ error: 'cardId obrigatório' });

    const store = readStore();
    const key = userKey(req);
    const prev = store.byUser[key] || { entries: {}, wishlist: [] };
    let wishlist = [...(prev.wishlist || [])];

    if (action === 'remove') {
      wishlist = wishlist.filter((w) => w.cardId !== cardId);
    } else {
      wishlist = wishlist.filter((w) => w.cardId !== cardId);
      wishlist.push({
        cardId: String(cardId),
        priority: ['high', 'medium', 'low'].includes(priority)
          ? priority
          : 'medium',
      });
    }

    store.byUser[key] = { ...prev, wishlist };
    writeStore(store);
    res.json({ ok: true, wishlist });
  } catch (e) {
    console.error('collection wishlist:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/** GET /api/collection/me/deck-suggestions — placeholder */
router.get('/me/deck-suggestions', authenticateToken, (req, res) => {
  res.json({ decks: [], message: 'Em breve: sugestões com base na coleção.' });
});

module.exports = router;

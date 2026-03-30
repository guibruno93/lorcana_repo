'use strict';

/**
 * Tier lists personalizadas: CRUD em ficheiro local + opcional Supabase.
 * Montagem: /api/tier-lists
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'tier-lists.json');

const { authenticateToken } = require('./auth');

function getSupabaseOptional() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch {
    return null;
  }
}

function readFileStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const j = JSON.parse(raw);
    return Array.isArray(j.lists) ? j : { lists: [] };
  } catch {
    return { lists: [] };
  }
}

function writeFileStore(store) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function normalizeTiers(tiers) {
  const base = { S: [], A: [], B: [], C: [], D: [] };
  if (!tiers || typeof tiers !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (Array.isArray(tiers[k])) base[k] = tiers[k];
  }
  return base;
}

/**
 * GET /api/tier-lists/community?sort=popular|recent
 */
router.get('/community', async (req, res) => {
  try {
    const sort = req.query.sort === 'recent' ? 'recent' : 'popular';
    const supabase = getSupabaseOptional();
    if (supabase) {
      const q = supabase
        .from('tier_lists')
        .select('id, user_id, title, description, likes, agree, disagree, created_at')
        .order(sort === 'recent' ? 'created_at' : 'likes', {
          ascending: false,
        })
        .limit(50);
      const { data, error } = await q;
      if (!error && data) {
        return res.json({ lists: data, source: 'supabase' });
      }
    }
    const store = readFileStore();
    const lists = [...store.lists].sort((a, b) => {
      if (sort === 'recent')
        return new Date(b.created_at) - new Date(a.created_at);
      return (b.likes || 0) - (a.likes || 0);
    });
    res.json({
      lists: lists.map((l) => ({
        id: l.id,
        user_id: l.user_id,
        title: l.title,
        description: l.description,
        likes: l.likes || 0,
        agree: l.agree || 0,
        disagree: l.disagree || 0,
        created_at: l.created_at,
      })),
      source: 'file',
    });
  } catch (e) {
    console.error('community tier lists:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/**
 * GET /api/tier-lists/mine — requer JWT
 */
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const uid =
      req.user?.sub || req.user?.id || req.user?.email || String(req.user?.userId || '');
    const supabase = getSupabaseOptional();
    if (supabase) {
      const { data, error } = await supabase
        .from('tier_lists')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      if (!error && data) return res.json({ lists: data, source: 'supabase' });
    }
    const store = readFileStore();
    const mine = store.lists.filter((l) => l.user_id === uid);
    res.json({ lists: mine, source: 'file' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/**
 * POST /api/tier-lists
 * body: { title, description, tiers, tier_labels? }
 */
router.post('/', async (req, res) => {
  try {
    const { title, description, tiers, tier_labels: tierLabels } = req.body || {};
    if (!title || String(title).trim() === '') {
      return res.status(400).json({ error: 'title required' });
    }

    const normalized = normalizeTiers(tiers);
    const authHeader = req.headers.authorization;
    let userId = 'anonymous';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET =
          process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
        const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
        userId =
          payload.sub || payload.id || payload.email || userId;
      } catch {
        /* ignore invalid token */
      }
    }

    const row = {
      id: crypto.randomUUID(),
      user_id: userId,
      title: String(title).trim(),
      description: description != null ? String(description) : '',
      tiers: normalized,
      tier_labels:
        tierLabels && typeof tierLabels === 'object' ? tierLabels : null,
      likes: 0,
      agree: 0,
      disagree: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseOptional();
    if (supabase) {
      const insertPayload = {
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        description: row.description,
        tiers: row.tiers,
        tier_labels: row.tier_labels,
        likes: 0,
        agree: 0,
        disagree: 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      const { data, error } = await supabase
        .from('tier_lists')
        .insert(insertPayload)
        .select()
        .single();
      if (!error && data) {
        return res.status(201).json({ ...data, source: 'supabase' });
      }
      if (error) console.warn('Supabase tier_lists insert failed, using file:', error.message);
    }

    const store = readFileStore();
    store.lists.push(row);
    writeFileStore(store);
    res.status(201).json({ ...row, source: 'file' });
  } catch (e) {
    console.error('POST tier-lists:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/**
 * GET /api/tier-lists/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'community' || id === 'mine') return res.status(404).end();

    const supabase = getSupabaseOptional();
    if (supabase) {
      const { data, error } = await supabase
        .from('tier_lists')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) {
        if (typeof data.tiers === 'string') {
          try {
            data.tiers = JSON.parse(data.tiers);
          } catch {
            /* keep */
          }
        }
        return res.json({ ...data, source: 'supabase' });
      }
    }

    const store = readFileStore();
    const found = store.lists.find((l) => l.id === id);
    if (!found) return res.status(404).json({ error: 'Not found' });
    res.json({ ...found, source: 'file' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/**
 * POST /api/tier-lists/:id/vote  { "vote": "agree" | "disagree" }
 */
router.post('/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const vote = req.body?.vote;
    if (vote !== 'agree' && vote !== 'disagree') {
      return res.status(400).json({ error: 'vote must be agree or disagree' });
    }

    const supabase = getSupabaseOptional();
    if (supabase) {
      const { data: row, error: fetchErr } = await supabase
        .from('tier_lists')
        .select('agree, disagree')
        .eq('id', id)
        .single();
      if (!fetchErr && row) {
        const patch = {
          agree: Number(row.agree || 0) + (vote === 'agree' ? 1 : 0),
          disagree: Number(row.disagree || 0) + (vote === 'disagree' ? 1 : 0),
          updated_at: new Date().toISOString(),
        };
        const { error: upErr } = await supabase
          .from('tier_lists')
          .update(patch)
          .eq('id', id);
        if (!upErr)
          return res.json({
            success: true,
            agree: patch.agree,
            disagree: patch.disagree,
            source: 'supabase',
          });
      }
    }

    const store = readFileStore();
    const idx = store.lists.findIndex((l) => l.id === id);
    if (idx < 0) return res.status(404).json({ error: 'Not found' });
    if (vote === 'agree') store.lists[idx].agree = (store.lists[idx].agree || 0) + 1;
    else store.lists[idx].disagree = (store.lists[idx].disagree || 0) + 1;
    store.lists[idx].updated_at = new Date().toISOString();
    writeFileStore(store);
    res.json({
      success: true,
      agree: store.lists[idx].agree,
      disagree: store.lists[idx].disagree,
      source: 'file',
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/**
 * POST /api/tier-lists/:id/like
 */
router.post('/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseOptional();
    if (supabase) {
      const { data: row, error: fetchErr } = await supabase
        .from('tier_lists')
        .select('likes')
        .eq('id', id)
        .single();
      if (!fetchErr && row) {
        const { error } = await supabase
          .from('tier_lists')
          .update({
            likes: Number(row.likes || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        if (!error) return res.json({ success: true, likes: Number(row.likes || 0) + 1 });
      }
    }

    const store = readFileStore();
    const idx = store.lists.findIndex((l) => l.id === id);
    if (idx < 0) return res.status(404).json({ error: 'Not found' });
    store.lists[idx].likes = (store.lists[idx].likes || 0) + 1;
    store.lists[idx].updated_at = new Date().toISOString();
    writeFileStore(store);
    res.json({ success: true, likes: store.lists[idx].likes, source: 'file' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/**
 * DELETE /api/tier-lists/:id — opcional; requer mesmo user (JWT)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const uid =
      req.user?.sub || req.user?.id || req.user?.email || '';

    const supabase = getSupabaseOptional();
    if (supabase) {
      const { error } = await supabase
        .from('tier_lists')
        .delete()
        .eq('id', id)
        .eq('user_id', uid);
      if (!error) return res.json({ success: true });
    }

    const store = readFileStore();
    const idx = store.lists.findIndex(
      (l) => l.id === id && l.user_id === uid
    );
    if (idx < 0) return res.status(404).json({ error: 'Not found' });
    store.lists.splice(idx, 1);
    writeFileStore(store);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

module.exports = router;

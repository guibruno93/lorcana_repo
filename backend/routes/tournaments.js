'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { authenticateToken } = require('./auth');
const { generateSwissPairings } = require('../utils/swiss-pairings');

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'tournaments.json');

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const j = JSON.parse(raw);
    return j && Array.isArray(j.tournaments) ? j : { tournaments: [] };
  } catch {
    return { tournaments: [] };
  }
}

function writeStore(store) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function organizerKey(req) {
  return String(req.user?.id || req.user?.email);
}

/** GET /api/tournaments/user/me */
router.get('/user/me', authenticateToken, (req, res) => {
  try {
    const key = organizerKey(req);
    const { tournaments } = readStore();
    const mine = tournaments.filter((t) => String(t.organizerId) === key);
    res.json(mine);
  } catch (e) {
    console.error('tournaments list:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/** POST /api/tournaments */
router.post('/', authenticateToken, (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name || !body.date) {
      return res.status(400).json({ error: 'name e date são obrigatórios' });
    }

    const id = crypto.randomUUID();
    const tournament = {
      id,
      organizerId: organizerKey(req),
      name: String(body.name),
      date: body.date,
      time: body.time || '14:00',
      location: body.location || '',
      format: body.format || 'swiss',
      rounds: parseInt(body.rounds, 10) || 4,
      topCut: parseInt(body.topCut, 10) || 8,
      maxPlayers: parseInt(body.maxPlayers, 10) || 32,
      registrationType: body.registrationType || 'open',
      status: 'registration',
      currentRound: 0,
      players: [],
      matches: [],
      matchHistory: {},
      createdAt: new Date().toISOString(),
    };

    const store = readStore();
    store.tournaments.unshift(tournament);
    writeStore(store);
    res.status(201).json(tournament);
  } catch (e) {
    console.error('tournament create:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
});

/** GET /api/tournaments/:id */
router.get('/:id', authenticateToken, (req, res) => {
  const store = readStore();
  const t = store.tournaments.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Não encontrado' });
  if (String(t.organizerId) !== organizerKey(req)) {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  res.json(t);
});

/** POST /api/tournaments/:id/start */
router.post('/:id/start', authenticateToken, (req, res) => {
  const store = readStore();
  const idx = store.tournaments.findIndex((x) => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Não encontrado' });
  const t = store.tournaments[idx];
  if (String(t.organizerId) !== organizerKey(req)) {
    return res.status(403).json({ error: 'Sem permissão' });
  }

  const players = (t.players || []).map((p) => ({
    ...p,
    points: p.points || 0,
    wins: p.wins || 0,
    losses: p.losses || 0,
    draws: p.draws || 0,
  }));

  if (players.length < 2) {
    return res.status(400).json({ error: 'Adicione pelo menos 2 jogadores' });
  }

  const history = new Map();
  t.matchHistory = t.matchHistory || {};
  for (const [a, setObj] of Object.entries(t.matchHistory)) {
    history.set(a, new Set(Object.keys(setObj || {})));
  }

  const pairings = generateSwissPairings(players, 1, history);
  const matches = pairings.map((pair, i) => ({
    id: crypto.randomUUID(),
    tournamentId: t.id,
    round: 1,
    tableNumber: pair.bye ? 0 : i + 1,
    player1Id: pair.player1?.id,
    player2Id: pair.player2?.id,
    winnerId: pair.bye ? pair.player1?.id : null,
    result: pair.bye ? 'bye' : null,
  }));

  t.status = 'in-progress';
  t.currentRound = 1;
  t.matches = [...(t.matches || []), ...matches];

  for (const m of matches) {
    if (m.player1Id && m.player2Id) {
      const a = String(m.player1Id);
      const b = String(m.player2Id);
      if (!t.matchHistory[a]) t.matchHistory[a] = {};
      if (!t.matchHistory[b]) t.matchHistory[b] = {};
      t.matchHistory[a][b] = true;
      t.matchHistory[b][a] = true;
    }
  }

  if (pairings.some((p) => p.bye)) {
    const byeP = players.find((p) =>
      pairings.some((pr) => pr.bye && pr.player1?.id === p.id)
    );
    if (byeP) {
      byeP.points = (byeP.points || 0) + 3;
      byeP.wins = (byeP.wins || 0) + 1;
    }
  }

  store.tournaments[idx] = t;
  writeStore(store);
  res.json(t);
});

/** POST /api/tournaments/:id/players — { playerName, playerId?, deckName? } */
router.post('/:id/players', authenticateToken, (req, res) => {
  const store = readStore();
  const idx = store.tournaments.findIndex((x) => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Não encontrado' });
  const t = store.tournaments[idx];
  if (String(t.organizerId) !== organizerKey(req)) {
    return res.status(403).json({ error: 'Sem permissão' });
  }

  const { playerName, playerId, deckName } = req.body || {};
  if (!playerName) return res.status(400).json({ error: 'playerName obrigatório' });

  const players = t.players || [];
  if (players.length >= (t.maxPlayers || 999)) {
    return res.status(400).json({ error: 'Limite de jogadores' });
  }

  const player = {
    id: crypto.randomUUID(),
    playerName: String(playerName),
    playerId: playerId || '',
    deckName: deckName || '',
    points: 0,
    wins: 0,
    losses: 0,
    draws: 0,
  };
  t.players = [...players, player];
  store.tournaments[idx] = t;
  writeStore(store);
  res.json(player);
});

/** POST /api/tournaments/matches/:matchId/report — { winnerId | result: 'draw' } */
router.post('/matches/:matchId/report', authenticateToken, (req, res) => {
  const { matchId } = req.params;
  const { winnerId, result } = req.body || {};

  const store = readStore();
  let foundT = null;
  let foundM = null;
  for (const t of store.tournaments) {
    const m = (t.matches || []).find((x) => x.id === matchId);
    if (m) {
      foundT = t;
      foundM = m;
      break;
    }
  }
  if (!foundT || !foundM) return res.status(404).json({ error: 'Match não encontrado' });
  if (String(foundT.organizerId) !== organizerKey(req)) {
    return res.status(403).json({ error: 'Sem permissão' });
  }

  const players = foundT.players || [];
  const p1 = players.find((p) => p.id === foundM.player1Id);
  const p2 = players.find((p) => p.id === foundM.player2Id);

  if (result === 'draw' && p1 && p2) {
    foundM.result = 'draw';
    foundM.winnerId = null;
    p1.points = (p1.points || 0) + 1;
    p2.points = (p2.points || 0) + 1;
    p1.draws = (p1.draws || 0) + 1;
    p2.draws = (p2.draws || 0) + 1;
  } else if (winnerId && p1 && p2) {
    const w = players.find((p) => p.id === winnerId);
    const l = winnerId === p1.id ? p2 : p1;
    if (!w || (w.id !== p1.id && w.id !== p2.id)) {
      return res.status(400).json({ error: 'winnerId inválido' });
    }
    foundM.winnerId = winnerId;
    foundM.result = 'win';
    w.points = (w.points || 0) + 3;
    w.wins = (w.wins || 0) + 1;
    l.losses = (l.losses || 0) + 1;
  } else {
    return res.status(400).json({ error: 'Envie winnerId ou result: draw' });
  }

  foundM.reportedAt = new Date().toISOString();
  writeStore(store);
  res.json({ ok: true, match: foundM, tournament: foundT });
});

/** GET /api/tournaments/:id/standings */
router.get('/:id/standings', authenticateToken, (req, res) => {
  const store = readStore();
  const t = store.tournaments.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Não encontrado' });
  if (String(t.organizerId) !== organizerKey(req)) {
    return res.status(403).json({ error: 'Sem permissão' });
  }

  const sorted = [...(t.players || [])].sort(
    (a, b) =>
      (b.points || 0) - (a.points || 0) ||
      (b.wins || 0) - (a.wins || 0) ||
      String(a.playerName).localeCompare(String(b.playerName))
  );

  res.json({ standings: sorted });
});

/** POST /api/tournaments/:id/next-round */
router.post('/:id/next-round', authenticateToken, (req, res) => {
  const store = readStore();
  const idx = store.tournaments.findIndex((x) => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Não encontrado' });
  const t = store.tournaments[idx];
  if (String(t.organizerId) !== organizerKey(req)) {
    return res.status(403).json({ error: 'Sem permissão' });
  }

  const pending = (t.matches || []).filter(
    (m) => m.round === t.currentRound && !m.result && !m.winnerId
  );
  if (pending.length) {
    return res.status(400).json({ error: 'Ainda há mesas sem resultado nesta rodada' });
  }

  const next = (t.currentRound || 0) + 1;
  if (next > (t.rounds || 4)) {
    return res.status(400).json({ error: 'Número máximo de rodadas Swiss atingido' });
  }

  const history = new Map();
  for (const [a, setObj] of Object.entries(t.matchHistory || {})) {
    history.set(a, new Set(Object.keys(setObj || {})));
  }

  const pairings = generateSwissPairings(t.players || [], next, history);
  const baseIdx = (t.matches || []).length;
  const matches = pairings.map((pair, i) => ({
    id: crypto.randomUUID(),
    tournamentId: t.id,
    round: next,
    tableNumber: pair.bye ? 0 : i + 1,
    player1Id: pair.player1?.id,
    player2Id: pair.player2?.id,
    winnerId: pair.bye ? pair.player1?.id : null,
    result: pair.bye ? 'bye' : null,
  }));

  t.currentRound = next;
  t.matches = [...(t.matches || []), ...matches];

  for (const m of matches) {
    if (m.player1Id && m.player2Id) {
      const a = String(m.player1Id);
      const b = String(m.player2Id);
      if (!t.matchHistory[a]) t.matchHistory[a] = {};
      if (!t.matchHistory[b]) t.matchHistory[b] = {};
      t.matchHistory[a][b] = true;
      t.matchHistory[b][a] = true;
    }
  }

  if (pairings.some((p) => p.bye)) {
    const byeP = (t.players || []).find((p) =>
      pairings.some((pr) => pr.bye && pr.player1?.id === p.id)
    );
    if (byeP) {
      byeP.points = (byeP.points || 0) + 3;
      byeP.wins = (byeP.wins || 0) + 1;
    }
  }

  store.tournaments[idx] = t;
  writeStore(store);
  res.json(t);
});

module.exports = router;

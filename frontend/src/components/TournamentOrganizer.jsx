import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RoundTimer from './RoundTimer';
import MatchResultInput from './MatchResultInput';
import './TournamentOrganizer.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

function headersAuth() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function isTournamentComplete(tournament) {
  if (!tournament || tournament.status !== 'in-progress') return false;
  const totalRounds = tournament.rounds || 0;
  const cr = tournament.currentRound || 0;
  if (totalRounds <= 0 || cr !== totalRounds) return false;
  const roundMatches = (tournament.matches || []).filter((m) => m.round === cr);
  if (roundMatches.length === 0) return false;
  return roundMatches.every((m) => m.result || m.winnerId);
}

export default function TournamentOrganizer() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('list');
  const [tournaments, setTournaments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    date: '',
    time: '14:00',
    location: '',
    format: 'swiss',
    matchFormat: 'bo1',
    roundTimeMinutes: 50,
    rounds: 4,
    topCut: 8,
    maxPlayers: 32,
    registrationType: 'open',
  });

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/tournaments/user/me`, {
        headers: headersAuth(),
      });
      if (!r.ok) throw new Error('Falha ao carregar');
      const data = await r.json();
      setTournaments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const refreshTournament = async (id) => {
    const r = await fetch(`${API_URL}/api/tournaments/${id}`, {
      headers: headersAuth(),
    });
    if (!r.ok) return;
    const tdata = await r.json();
    setSelected(tdata);
    setTournaments((prev) => prev.map((x) => (x.id === id ? tdata : x)));
  };

  const createTournament = async () => {
    if (!form.name || !form.date) {
      window.alert(t('tournamentsOrg.nameDateRequired'));
      return;
    }
    try {
      const r = await fetch(`${API_URL}/api/tournaments`, {
        method: 'POST',
        headers: headersAuth(),
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || r.status);
      }
      const tdata = await r.json();
      setTournaments((prev) => [tdata, ...prev]);
      setActiveTab('list');
      setForm({
        name: '',
        date: '',
        time: '14:00',
        location: '',
        format: 'swiss',
        matchFormat: 'bo1',
        roundTimeMinutes: 50,
        rounds: 4,
        topCut: 8,
        maxPlayers: 32,
        registrationType: 'open',
      });
      window.alert(t('tournamentsOrg.createdOk'));
    } catch (e) {
      window.alert(e.message || 'Erro ao criar');
    }
  };

  const startTournament = async (id) => {
    try {
      const r = await fetch(`${API_URL}/api/tournaments/${id}/start`, {
        method: 'POST',
        headers: headersAuth(),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || r.status);
      setSelected(data);
      setTournaments((prev) => prev.map((x) => (x.id === id ? data : x)));
      window.alert(t('tournamentsOrg.round1Ok'));
    } catch (e) {
      window.alert(e.message || 'Erro ao iniciar');
    }
  };

  const addPlayer = async () => {
    if (!selected || !newPlayerName.trim()) return;
    try {
      const r = await fetch(`${API_URL}/api/tournaments/${selected.id}/players`, {
        method: 'POST',
        headers: headersAuth(),
        body: JSON.stringify({ playerName: newPlayerName.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || r.status);
      setNewPlayerName('');
      await refreshTournament(selected.id);
    } catch (e) {
      window.alert(e.message || 'Erro');
    }
  };

  const report = async (matchId, payload) => {
    try {
      const r = await fetch(`${API_URL}/api/tournaments/matches/${matchId}/report`, {
        method: 'POST',
        headers: headersAuth(),
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || r.status);
      if (data.tournament) setSelected(data.tournament);
      await refreshTournament(selected.id);
    } catch (e) {
      window.alert(e.message || 'Erro ao reportar');
    }
  };

  const nextRound = async () => {
    if (!selected) return;
    try {
      const r = await fetch(`${API_URL}/api/tournaments/${selected.id}/next-round`, {
        method: 'POST',
        headers: headersAuth(),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || r.status);
      setSelected(data);
      setTournaments((prev) => prev.map((x) => (x.id === data.id ? data : x)));
    } catch (e) {
      window.alert(e.message || 'Erro');
    }
  };

  const goStandings = () => {
    if (!selected) return;
    navigate(`/tournaments/${selected.id}/standings`);
  };

  const handleEndTournament = async () => {
    if (!selected) return;
    if (!window.confirm(t('tournamentsOrg.confirmEnd'))) return;
    try {
      const r = await fetch(`${API_URL}/api/tournaments/${selected.id}/end`, {
        method: 'PATCH',
        headers: headersAuth(),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || r.status);
      setSelected(data.tournament);
      setTournaments((prev) =>
        prev.map((x) => (x.id === data.tournament.id ? data.tournament : x))
      );
      navigate(`/tournaments/${selected.id}/standings`);
    } catch (e) {
      console.error(e);
      window.alert(t('tournamentsOrg.errorEnding'));
    }
  };

  const onTimerUp = useCallback(() => {
    window.alert(t('tournamentsOrg.timeUp'));
  }, [t]);

  const nameOf = (pid) => {
    if (!selected?.players) return '?';
    const p = selected.players.find((x) => x.id === pid);
    return p?.playerName || '?';
  };

  const roundMatches =
    selected?.matches?.filter((m) => m.round === selected.currentRound) || [];

  const matchFormat = selected?.matchFormat || 'bo1';
  const canEnd = isTournamentComplete(selected);
  const showNextRound =
    selected?.status === 'in-progress' &&
    selected?.currentRound < (selected?.rounds || 0);

  return (
    <div className="tournament-org">
      <header className="tournament-org__head">
        <h1>{t('tournamentsOrg.title')}</h1>
        <nav className="tournament-org__tabs">
          <button
            type="button"
            className={activeTab === 'list' ? 'is-active' : ''}
            onClick={() => setActiveTab('list')}
          >
            {t('tournamentsOrg.tabList')}
          </button>
          <button
            type="button"
            className={activeTab === 'create' ? 'is-active' : ''}
            onClick={() => setActiveTab('create')}
          >
            {t('tournamentsOrg.tabCreate')}
          </button>
          <button
            type="button"
            className={activeTab === 'search' ? 'is-active' : ''}
            onClick={() => setActiveTab('search')}
          >
            {t('tournamentsOrg.tabSearch')}
          </button>
        </nav>
      </header>

      {activeTab === 'list' && (
        <section>
          {loading && <p className="tournament-org__muted">{t('common.loading')}…</p>}
          {!loading && tournaments.length === 0 && (
            <p className="tournament-org__muted">{t('tournamentsOrg.emptyList')}</p>
          )}
          <ul className="tournament-org__cards">
            {tournaments.map((titem) => (
              <li key={titem.id} className="tournament-org__card">
                <div className="tournament-org__card-head">
                  <strong>{titem.name}</strong>
                  <span className={`tournament-org__badge tournament-org__badge--${titem.status}`}>
                    {titem.status}
                  </span>
                </div>
                <div className="tournament-org__card-meta">
                  {titem.date} {titem.time} · {titem.location || '—'}
                </div>
                <div className="tournament-org__card-meta">
                  {(titem.players || []).length}/{titem.maxPlayers} {t('tournamentsOrg.players')}
                </div>
                <div className="tournament-org__card-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(titem);
                      setActiveTab('manage');
                    }}
                  >
                    {t('tournamentsOrg.manage')}
                  </button>
                  {(titem.status === 'in-progress' || titem.status === 'completed') && (
                    <button type="button" className="tournament-org__secondary" onClick={() => navigate(`/tournaments/${titem.id}/standings`)}>
                      {t('tournamentsOrg.viewStandings')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeTab === 'create' && (
        <section className="tournament-org__form">
          <label>
            {t('tournamentsOrg.name')}
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <div className="tournament-org__row">
            <label>
              {t('tournamentsOrg.date')}
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label>
              {t('tournamentsOrg.time')}
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </label>
          </div>
          <label>
            {t('tournamentsOrg.location')}
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </label>
          <label>
            {t('tournamentsOrg.structureFormat')}
            <select
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value })}
            >
              <option value="swiss">{t('tournamentsOrg.swiss')}</option>
              <option value="single-elim">{t('tournamentsOrg.singleElim')}</option>
              <option value="double-elim">{t('tournamentsOrg.doubleElim')}</option>
            </select>
          </label>
          <label>
            {t('tournamentsOrg.matchFormatLabel')}
            <select
              value={form.matchFormat}
              onChange={(e) => setForm({ ...form, matchFormat: e.target.value })}
            >
              <option value="bo1">{t('tournamentsOrg.bo1')}</option>
              <option value="bo3">{t('tournamentsOrg.bo3')}</option>
            </select>
          </label>
          <p className="tournament-org__hint">
            {form.matchFormat === 'bo1'
              ? t('tournamentsOrg.formatBo1Hint')
              : t('tournamentsOrg.formatBo3Hint')}
          </p>
          <label>
            {t('tournamentsOrg.roundDuration')}
            <input
              type="number"
              min={10}
              max={120}
              value={form.roundTimeMinutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  roundTimeMinutes: parseInt(e.target.value, 10) || 50,
                })
              }
            />
          </label>
          <p className="tournament-org__hint">{t('tournamentsOrg.roundDurationHint')}</p>
          {form.format === 'swiss' && (
            <div className="tournament-org__row">
              <label>
                {t('tournamentsOrg.rounds')}
                <select
                  value={form.rounds}
                  onChange={(e) =>
                    setForm({ ...form, rounds: parseInt(e.target.value, 10) })
                  }
                >
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </label>
              <label>
                {t('tournamentsOrg.topCut')}
                <select
                  value={form.topCut}
                  onChange={(e) =>
                    setForm({ ...form, topCut: parseInt(e.target.value, 10) })
                  }
                >
                  <option value={0}>{t('tournamentsOrg.topCutNone')}</option>
                  <option value={4}>Top 4</option>
                  <option value={8}>Top 8</option>
                  <option value={16}>Top 16</option>
                </select>
              </label>
            </div>
          )}
          <div className="tournament-org__row">
            <label>
              {t('tournamentsOrg.maxPlayers')}
              <input
                type="number"
                min={2}
                value={form.maxPlayers}
                onChange={(e) =>
                  setForm({ ...form, maxPlayers: parseInt(e.target.value, 10) })
                }
              />
            </label>
            <label>
              {t('tournamentsOrg.registration')}
              <select
                value={form.registrationType}
                onChange={(e) =>
                  setForm({ ...form, registrationType: e.target.value })
                }
              >
                <option value="open">{t('tournamentsOrg.open')}</option>
                <option value="private">{t('tournamentsOrg.private')}</option>
              </select>
            </label>
          </div>
          <button type="button" className="tournament-org__primary" onClick={createTournament}>
            {t('tournamentsOrg.createSubmit')}
          </button>
        </section>
      )}

      {activeTab === 'manage' && selected && (
        <section className="tournament-org__manage">
          <button type="button" className="tournament-org__back" onClick={() => setActiveTab('list')}>
            ← {t('tournamentsOrg.backList')}
          </button>
          <h2>{selected.name}</h2>
          <p className="tournament-org__muted">
            {(selected.players || []).length} {t('tournamentsOrg.players')} · {selected.format} ·{' '}
            {(selected.matchFormat || 'bo1').toUpperCase()} · {t('tournamentsOrg.state')}: {selected.status}
            {selected.currentRound ? ` · ${t('tournamentsOrg.round')} ${selected.currentRound}` : ''}
          </p>

          {selected.status === 'registration' && (
            <div className="tournament-org__block">
              <h3>{t('tournamentsOrg.registrations')}</h3>
              <div className="tournament-org__add-player">
                <input
                  placeholder={t('tournamentsOrg.playerPlaceholder')}
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                />
                <button type="button" onClick={addPlayer}>
                  {t('tournamentsOrg.addPlayer')}
                </button>
              </div>
              <ul>
                {(selected.players || []).map((p) => (
                  <li key={p.id}>{p.playerName}</li>
                ))}
              </ul>
              <button type="button" className="tournament-org__primary" onClick={() => startTournament(selected.id)}>
                {t('tournamentsOrg.startTournament')}
              </button>
            </div>
          )}

          {selected.status === 'in-progress' && (
            <div className="tournament-org__block">
              <h3>
                {t('tournamentsOrg.round')} {selected.currentRound}
              </h3>
              <RoundTimer
                key={`${selected.id}-${selected.currentRound}`}
                durationMinutes={selected.roundTimeMinutes || 50}
                roundNumber={selected.currentRound}
                onTimeUp={onTimerUp}
              />
              <ul className="tournament-org__pairings">
                {roundMatches.map((m) => {
                  if (m.result === 'bye') {
                    return (
                      <li key={m.id}>
                        Bye: {nameOf(m.player1Id)}
                      </li>
                    );
                  }
                  const done = m.result || m.winnerId;
                  return (
                    <li key={m.id}>
                      <div>
                        {t('tournamentsOrg.table')} {m.tableNumber}: {nameOf(m.player1Id)} vs{' '}
                        {nameOf(m.player2Id)}
                      </div>
                      {!done && (
                        <MatchResultInput
                          match={m}
                          player1Name={nameOf(m.player1Id)}
                          player2Name={nameOf(m.player2Id)}
                          matchFormat={matchFormat}
                          onReportBo1={(payload) => report(m.id, payload)}
                          onReportBo3={(payload) => report(m.id, payload)}
                        />
                      )}
                      {done && (
                        <span className="tournament-org__done">{t('tournamentsOrg.recorded')}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="tournament-org__row-btns">
                <button type="button" onClick={goStandings}>
                  {t('tournamentsOrg.standings')}
                </button>
                {showNextRound && (
                  <button type="button" className="tournament-org__primary" onClick={nextRound}>
                    {t('tournamentsOrg.nextRound')}
                  </button>
                )}
                {canEnd && (
                  <button type="button" className="btn-end-tournament" onClick={handleEndTournament}>
                    🏁 {t('tournamentsOrg.endTournament')}
                  </button>
                )}
              </div>
            </div>
          )}

          {selected.status === 'completed' && (
            <div className="tournament-org__block">
              <p className="tournament-org__muted">{t('tournamentsOrg.completed')}</p>
              <button type="button" className="tournament-org__primary" onClick={goStandings}>
                {t('tournamentsOrg.finalStandings')}
              </button>
            </div>
          )}
        </section>
      )}

      {activeTab === 'search' && (
        <p className="tournament-org__muted">{t('tournamentsOrg.searchSoon')}</p>
      )}
    </div>
  );
}

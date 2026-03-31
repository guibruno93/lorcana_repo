import React, { useState, useEffect, useCallback } from 'react';
import './TournamentOrganizer.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

function headersAuth() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function TournamentOrganizer() {
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
    const t = await r.json();
    setSelected(t);
    setTournaments((prev) => prev.map((x) => (x.id === id ? t : x)));
  };

  const createTournament = async () => {
    if (!form.name || !form.date) {
      window.alert('Nome e data são obrigatórios.');
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
      const t = await r.json();
      setTournaments((prev) => [t, ...prev]);
      setActiveTab('list');
      setForm({
        name: '',
        date: '',
        time: '14:00',
        location: '',
        format: 'swiss',
        rounds: 4,
        topCut: 8,
        maxPlayers: 32,
        registrationType: 'open',
      });
      window.alert('Torneio criado.');
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
      window.alert('Rodada 1 gerada.');
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

  const loadStandings = async () => {
    if (!selected) return;
    const r = await fetch(`${API_URL}/api/tournaments/${selected.id}/standings`, {
      headers: headersAuth(),
    });
    if (!r.ok) return;
    const data = await r.json();
    const lines = (data.standings || [])
      .map(
        (p, i) =>
          `${i + 1}. ${p.playerName} — ${p.points} pts (${p.wins}-${p.losses}-${p.draws})`
      )
      .join('\n');
    window.alert(lines || 'Sem dados');
  };

  const nameOf = (pid) => {
    if (!selected?.players) return '?';
    const p = selected.players.find((x) => x.id === pid);
    return p?.playerName || '?';
  };

  const roundMatches =
    selected?.matches?.filter((m) => m.round === selected.currentRound) || [];

  return (
    <div className="tournament-org">
      <header className="tournament-org__head">
        <h1>Organizador de torneios</h1>
        <nav className="tournament-org__tabs">
          <button
            type="button"
            className={activeTab === 'list' ? 'is-active' : ''}
            onClick={() => setActiveTab('list')}
          >
            Meus torneios
          </button>
          <button
            type="button"
            className={activeTab === 'create' ? 'is-active' : ''}
            onClick={() => setActiveTab('create')}
          >
            Criar
          </button>
          <button
            type="button"
            className={activeTab === 'search' ? 'is-active' : ''}
            onClick={() => setActiveTab('search')}
          >
            Procurar
          </button>
        </nav>
      </header>

      {activeTab === 'list' && (
        <section>
          {loading && <p className="tournament-org__muted">A carregar…</p>}
          {!loading && tournaments.length === 0 && (
            <p className="tournament-org__muted">Ainda não criaste torneios.</p>
          )}
          <ul className="tournament-org__cards">
            {tournaments.map((t) => (
              <li key={t.id} className="tournament-org__card">
                <div className="tournament-org__card-head">
                  <strong>{t.name}</strong>
                  <span className={`tournament-org__badge tournament-org__badge--${t.status}`}>
                    {t.status}
                  </span>
                </div>
                <div className="tournament-org__card-meta">
                  {t.date} {t.time} · {t.location || '—'}
                </div>
                <div className="tournament-org__card-meta">
                  {(t.players || []).length}/{t.maxPlayers} jogadores
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(t);
                    setActiveTab('manage');
                  }}
                >
                  Gerir
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeTab === 'create' && (
        <section className="tournament-org__form">
          <label>
            Nome
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <div className="tournament-org__row">
            <label>
              Data
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label>
              Hora
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </label>
          </div>
          <label>
            Local
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </label>
          <label>
            Formato
            <select
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value })}
            >
              <option value="swiss">Swiss</option>
              <option value="single-elim">Eliminação simples</option>
              <option value="double-elim">Eliminação dupla</option>
            </select>
          </label>
          {form.format === 'swiss' && (
            <div className="tournament-org__row">
              <label>
                Rodadas
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
                Top cut
                <select
                  value={form.topCut}
                  onChange={(e) =>
                    setForm({ ...form, topCut: parseInt(e.target.value, 10) })
                  }
                >
                  <option value={0}>Nenhum</option>
                  <option value={4}>Top 4</option>
                  <option value={8}>Top 8</option>
                  <option value={16}>Top 16</option>
                </select>
              </label>
            </div>
          )}
          <div className="tournament-org__row">
            <label>
              Máx. jogadores
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
              Registo
              <select
                value={form.registrationType}
                onChange={(e) =>
                  setForm({ ...form, registrationType: e.target.value })
                }
              >
                <option value="open">Aberto</option>
                <option value="private">Privado</option>
              </select>
            </label>
          </div>
          <button type="button" className="tournament-org__primary" onClick={createTournament}>
            Criar torneio
          </button>
        </section>
      )}

      {activeTab === 'manage' && selected && (
        <section className="tournament-org__manage">
          <button type="button" className="tournament-org__back" onClick={() => setActiveTab('list')}>
            ← Lista
          </button>
          <h2>{selected.name}</h2>
          <p className="tournament-org__muted">
            {(selected.players || []).length} jogadores · {selected.format} · estado: {selected.status}
            {selected.currentRound ? ` · Ronda ${selected.currentRound}` : ''}
          </p>

          {selected.status === 'registration' && (
            <div className="tournament-org__block">
              <h3>Inscrições</h3>
              <div className="tournament-org__add-player">
                <input
                  placeholder="Nome do jogador"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                />
                <button type="button" onClick={addPlayer}>
                  Adicionar
                </button>
              </div>
              <ul>
                {(selected.players || []).map((p) => (
                  <li key={p.id}>{p.playerName}</li>
                ))}
              </ul>
              <button type="button" className="tournament-org__primary" onClick={() => startTournament(selected.id)}>
                Iniciar torneio
              </button>
            </div>
          )}

          {selected.status === 'in-progress' && (
            <div className="tournament-org__block">
              <h3>Ronda {selected.currentRound}</h3>
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
                        Mesa {m.tableNumber}: {nameOf(m.player1Id)} vs {nameOf(m.player2Id)}
                      </div>
                      {!done && (
                        <div className="tournament-org__report">
                          <button
                            type="button"
                            onClick={() => report(m.id, { winnerId: m.player1Id })}
                          >
                            Vitória {nameOf(m.player1Id)}
                          </button>
                          <button type="button" onClick={() => report(m.id, { result: 'draw' })}>
                            Empate
                          </button>
                          <button
                            type="button"
                            onClick={() => report(m.id, { winnerId: m.player2Id })}
                          >
                            Vitória {nameOf(m.player2Id)}
                          </button>
                        </div>
                      )}
                      {done && <span className="tournament-org__done">Registado</span>}
                    </li>
                  );
                })}
              </ul>
              <div className="tournament-org__row-btns">
                <button type="button" onClick={loadStandings}>
                  Standings
                </button>
                <button type="button" className="tournament-org__primary" onClick={nextRound}>
                  Próxima ronda
                </button>
              </div>
            </div>
          )}

          {selected.status === 'completed' && (
            <p className="tournament-org__muted">Torneio concluído.</p>
          )}
        </section>
      )}

      {activeTab === 'search' && (
        <p className="tournament-org__muted">Em breve: torneios públicos perto de ti.</p>
      )}
    </div>
  );
}

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './TournamentStandings.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

function headersAuth() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function TournamentStandings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tournament, setTournament] = useState(null);
  const [standings, setStandings] = useState([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStandings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API_URL}/api/tournaments/${id}/standings`, {
        headers: headersAuth(),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || r.status);
      }
      const data = await r.json();
      setTournament(data.tournament);
      setStandings(data.standings || []);
      setTotalMatches(data.totalMatches ?? 0);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Error');
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStandings();
  }, [fetchStandings]);

  const exportCSV = () => {
    if (!standings.length) return;
    const isBo3 = (tournament?.matchFormat || 'bo1') === 'bo3';
    const header = isBo3
      ? [
          t('tournamentsOrg.position'),
          t('tournamentsOrg.player'),
          t('tournamentsOrg.matchWins'),
          t('tournamentsOrg.matchLosses'),
          t('tournamentsOrg.matchWinPercent'),
          t('tournamentsOrg.gameWins'),
          t('tournamentsOrg.gameLosses'),
          t('tournamentsOrg.gameWinPercent'),
        ]
      : [
          t('tournamentsOrg.position'),
          t('tournamentsOrg.player'),
          t('tournamentsOrg.matchWins'),
          t('tournamentsOrg.matchLosses'),
          t('tournamentsOrg.matchWinPercent'),
        ];
    const rows = standings.map((p) => {
      const base = [
        p.position,
        `"${String(p.name || p.playerName).replace(/"/g, '""')}"`,
        p.wins,
        p.losses,
        (p.matchWinPercentage ?? 0).toFixed(1),
      ];
      if (isBo3) {
        base.push(
          p.gameWins ?? 0,
          p.gameLosses ?? 0,
          p.gameWinPercentage != null ? p.gameWinPercentage.toFixed(1) : 'N/A'
        );
      }
      return base.join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(tournament?.name || 'tournament').replace(/[/\\?%*:|"<>]/g, '-')}_standings.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatLabel =
    (tournament?.matchFormat || 'bo1') === 'bo3'
      ? t('tournamentsOrg.formatBo3Label')
      : t('tournamentsOrg.formatBo1Label');

  const durationLabel = () => {
    if (!tournament?.createdAt) return '—';
    const end = tournament.completedAt || new Date().toISOString();
    const ms = new Date(end) - new Date(tournament.createdAt);
    if (ms < 0) return '—';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (loading) {
    return (
      <div className="tournament-standings tournament-standings--loading">
        <p>{t('common.loading')}…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tournament-standings">
        <p className="standings-error">{error}</p>
        <button type="button" className="btn-back" onClick={() => navigate('/tournaments')}>
          ← {t('common.back')}
        </button>
      </div>
    );
  }

  const top3 = standings.slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="tournament-standings">
      <header className="standings-header">
        <div className="standings-header-left">
          <button type="button" className="btn-back" onClick={() => navigate(-1)}>
            ← {t('common.back')}
          </button>
          <h1>
            {tournament?.name} — {t('tournamentsOrg.finalStandings')}
          </h1>
        </div>
        <div className="standings-header-actions">
          <button type="button" className="btn-export" onClick={exportCSV}>
            📊 {t('tournamentsOrg.export')}
          </button>
          {tournament?.status === 'in-progress' && (
            <Link to="/tournaments" className="btn-new-round">
              {t('tournamentsOrg.newRound')}
            </Link>
          )}
        </div>
      </header>

      {top3.length > 0 && (
        <div className="podium">
          {[
            { idx: 1, place: 2, medal: medals[1] },
            { idx: 0, place: 1, medal: medals[0] },
            { idx: 2, place: 3, medal: medals[2] },
          ].map(({ idx, place, medal }) => {
            const player = top3[idx];
            if (!player) return null;
            return (
              <div key={player.id} className={`podium-place place-${place}`}>
                <div className="podium-medal">{medal}</div>
                <div className="podium-name">{player.name || player.playerName}</div>
                <div className="podium-record">
                  {player.wins}-{player.losses}
                  {(player.draws || 0) > 0 ? `-${player.draws}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="standings-table-wrap">
        <table className="standings-table">
          <thead>
            <tr>
              <th>{t('tournamentsOrg.position')}</th>
              <th>{t('tournamentsOrg.player')}</th>
              <th>{t('tournamentsOrg.matchWins')}</th>
              <th>{t('tournamentsOrg.matchLosses')}</th>
              <th>{t('tournamentsOrg.matchWinPercent')}</th>
              {(tournament?.matchFormat || 'bo1') === 'bo3' && (
                <>
                  <th>{t('tournamentsOrg.gameWins')}</th>
                  <th>{t('tournamentsOrg.gameLosses')}</th>
                  <th>{t('tournamentsOrg.gameWinPercent')}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {standings.map((player) => (
              <tr
                key={player.id}
                className={player.position <= 3 ? 'top-three' : ''}
              >
                <td className="position">#{player.position}</td>
                <td>{player.name || player.playerName}</td>
                <td>{player.wins}</td>
                <td>{player.losses}</td>
                <td>{(player.matchWinPercentage ?? 0).toFixed(1)}%</td>
                {(tournament?.matchFormat || 'bo1') === 'bo3' && (
                  <>
                    <td>{player.gameWins ?? 0}</td>
                    <td>{player.gameLosses ?? 0}</td>
                    <td>
                      {player.gameWinPercentage != null
                        ? `${player.gameWinPercentage.toFixed(1)}%`
                        : '—'}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="tournament-stats" aria-label={t('tournamentsOrg.stats')}>
        <div className="stat">
          <span className="stat-label">{t('tournamentsOrg.totalRounds')}</span>
          <span className="stat-value">{tournament?.rounds ?? 0}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{t('tournamentsOrg.totalMatches')}</span>
          <span className="stat-value">{totalMatches}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{t('tournamentsOrg.format')}</span>
          <span className="stat-value stat-value--small">{formatLabel}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{t('tournamentsOrg.duration')}</span>
          <span className="stat-value stat-value--small">{durationLabel()}</span>
        </div>
      </section>
    </div>
  );
}

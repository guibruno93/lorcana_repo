import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3002';

async function apiFetch(endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const api = {
  matchups: (text) => apiFetch("/api/deck/matchups", { deckText: text }),
};

export default function Matchups(props) {
  const ctx = useOutletContext() || {};
  const deckText = ctx.deckText ?? props.deckText ?? '';
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  async function run() {
    if (!deckText.trim()) return setErr(t('deckAnalyzer.paste'));
    setLoading(true);
    setErr("");
    try {
      const d = await api.matchups(deckText);
      setData(d);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (deckText.trim()) run();
    // eslint-disable-next-line
  }, []);

  let matchups = data?.matchups || [];
  
  if (typeof matchups === 'string') {
    try {
      matchups = JSON.parse(matchups);
    } catch (e) {
      matchups = [];
    }
  }
  
  if (matchups && typeof matchups === 'object' && !Array.isArray(matchups)) {
    matchups = matchups.data || matchups.items || matchups.list || matchups.matchups || [];
  }
  
  if (!Array.isArray(matchups)) {
    matchups = [];
  }
  
  const normalizedMatchups = matchups.map((m, idx) => {
    if (!m || typeof m !== 'object') {
      return null;
    }
    
    return {
      opponent: m.opponent || m.name || m.archetype || 'Unknown',
      winrate: Number(m.winrate || m.winRate || m.win_rate || 50),
      difficulty: m.difficulty || m.rating || 'unknown'
    };
  }).filter(Boolean);

  const summary = data?.summary || {};
  const deckInfo = {
    archetype: data?.archetype || data?.deckArchetype || t('common.loading'),
    tier: data?.tier || '-',
    expectedWinrate: data?.expectedWinrate || data?.expected_winrate || null
  };

  return (
    <div className="tab-layout">
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">⚔️ {t('matchups.title')}</span>
          <button className="btn btn-primary btn-sm" onClick={run} disabled={loading}>
            {loading ? `⏳ ${t('matchups.calculating')}` : `🔄 ${t('matchups.recalculate')}`}
          </button>
        </div>

        {err && <div className="err-box">{err}</div>}

        {data && (
          <div className="panel-body">
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
              gap: '16px',
              marginBottom: '20px',
              padding: '16px',
              background: 'rgba(139, 92, 246, 0.1)',
              borderRadius: '8px'
            }}>
              <div>
                <div style={{ fontSize: '11px', opacity: 0.6, marginBottom: '4px' }}>
                  {t('matchups.archetype')}
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>
                  {deckInfo.archetype}
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: '11px', opacity: 0.6, marginBottom: '4px' }}>
                  {t('matchups.tier')}
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>
                  {deckInfo.tier}
                </div>
              </div>

              {deckInfo.expectedWinrate && (
                <div>
                  <div style={{ fontSize: '11px', opacity: 0.6, marginBottom: '4px' }}>
                    {t('matchups.expectedWR')}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600' }}>
                    {deckInfo.expectedWinrate}%
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {summary && (
          <div className="panel-body">
            <div className="aggregate-row">
              {summary.avgWinRate != null && (
                <div className="agg-item">
                  <span className="agg-label">{t('matchups.avgWinRate')}</span>
                  <span className="agg-val">{summary.avgWinRate}%</span>
                </div>
              )}
              {summary.tier && (
                <div className="agg-item">
                  <span className="agg-label">{t('matchups.tier')}</span>
                  <span className="agg-val">{summary.tier}</span>
                </div>
              )}
              {(summary.favorable != null || summary.favored != null) && (
                <div className="agg-item">
                  <span className="agg-label">{t('matchups.favorable')}</span>
                  <span className="agg-val" style={{ color: "#4ade80" }}>
                    {summary.favorable || summary.favored || 0}
                  </span>
                </div>
              )}
              {summary.even != null && (
                <div className="agg-item">
                  <span className="agg-label">{t('matchups.even')}</span>
                  <span className="agg-val" style={{ color: "#f59e0b" }}>
                    {summary.even || 0}
                  </span>
                </div>
              )}
              {(summary.unfavorable != null || summary.unfavored != null) && (
                <div className="agg-item">
                  <span className="agg-label">{t('matchups.unfavorable')}</span>
                  <span className="agg-val" style={{ color: "#f87171" }}>
                    {summary.unfavorable || summary.unfavored || 0}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {normalizedMatchups.length === 0 && !loading && !err && (
          <div className="panel-body">
            <div className="empty-state">
              <div className="empty-icon">⚔️</div>
              {deckText.trim()
                ? t('matchups.clickToRecalculate')
                : t('matchups.emptyState')}
            </div>
          </div>
        )}

        {normalizedMatchups.length > 0 && (
          <div className="panel-body">
            <h4 style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              marginBottom: '12px',
              opacity: 0.8
            }}>
              {normalizedMatchups.length} {t('matchups.count')}
            </h4>
            
            <div className="matchup-grid">
              {normalizedMatchups.map((m, i) => {
                const wr = Number(m.winrate) || 50;
                
                const wrClass =
                  wr >= 55 ? "wr-favored" :
                  wr >= 45 ? "wr-even" :
                  wr >= 37 ? "wr-unfavored" : "wr-heavy";
                  
                const barClass =
                  wr >= 55 ? "bar-favored" :
                  wr >= 45 ? "bar-even" :
                  wr >= 37 ? "bar-unfavored" : "bar-heavy";

                return (
                  <div key={i} className="matchup-row">
                    <div className="matchup-opponent">{m.opponent}</div>
                    <div className="matchup-bar-wrap">
                      <div
                        className={`matchup-bar ${barClass}`}
                        style={{ width: `${wr}%` }}
                      />
                    </div>
                    <div className={`matchup-wr ${wrClass}`}>{wr}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

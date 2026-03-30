import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts';
import './MetaDashboard.css';
import { ArchetypeWithIcons } from './InkIcons';

function MetaShareTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="scraped-recharts-tooltip">
      <div className="scraped-recharts-tooltip-title">
        <ArchetypeWithIcons archetype={p.fullName} />
      </div>
      <div className="scraped-recharts-tooltip-meta">
        {p.percentage}% · {p.count} decks
      </div>
    </div>
  );
}

const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:3002').replace(
  /\/$/,
  ''
);

const CHART_COLORS = [
  '#c9a227',
  '#b8860b',
  '#9ca3af',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#0ea5e9',
  '#64748b',
];

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function ScrapedMetaDashboard({ embedded = false }) {
  const navigate = useNavigate();
  const [metaShare, setMetaShare] = useState(null);
  const [tierList, setTierList] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetaData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [shareRes, tierRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/meta/share`),
        fetch(`${API_BASE}/api/meta/tier-list`),
        fetch(`${API_BASE}/api/meta/stats`),
      ]);

      if (!shareRes.ok || !tierRes.ok || !statsRes.ok) {
        const parts = [
          !shareRes.ok && `share ${shareRes.status}`,
          !tierRes.ok && `tier-list ${tierRes.status}`,
          !statsRes.ok && `stats ${statsRes.status}`,
        ].filter(Boolean);
        throw new Error(parts.join(', ') || 'Failed to fetch meta data');
      }

      const [shareData, tierData, statsData] = await Promise.all([
        shareRes.json(),
        tierRes.json(),
        statsRes.json(),
      ]);

      setMetaShare(shareData);
      setTierList(tierData);
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching meta data:', err);
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetaData();
  }, [fetchMetaData]);

  const chartData = useMemo(() => {
    const list = metaShare?.archetypes?.slice(0, 10) || [];
    return list.map((a) => ({
      name:
        a.archetype && a.archetype.length > 22
          ? `${a.archetype.slice(0, 20)}…`
          : a.archetype || 'Unknown',
      fullName: a.archetype || 'Unknown',
      percentage: a.percentage,
      count: a.count,
    }));
  }, [metaShare]);

  const popularPct = useMemo(() => {
    const t = stats?.total_decks;
    const c = stats?.most_popular_count;
    if (!t || t <= 0 || c == null) return '0.0';
    return ((c / t) * 100).toFixed(1);
  }, [stats]);

  if (loading && !metaShare && !tierList && !stats) {
    return (
      <div className="scraped-meta-dashboard scraped-meta-loading" aria-busy="true">
        <div className="scraped-meta-spinner" aria-hidden />
        <p>A carregar dados de meta…</p>
      </div>
    );
  }

  if (error && !metaShare && !tierList && !stats) {
    return (
      <div className="scraped-meta-dashboard scraped-meta-error">
        <h2>Erro ao carregar a meta</h2>
        <p role="alert">{error}</p>
        <button type="button" className="scraped-meta-btn-primary" onClick={fetchMetaData}>
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div
      className={`scraped-meta-dashboard${
        embedded ? ' scraped-meta-dashboard--embedded' : ''
      }`}
    >
      {!embedded && (
        <button
          type="button"
          className="scraped-meta-back"
          onClick={() => navigate('/meta')}
        >
          ← Voltar à meta
        </button>
      )}

      <header className="scraped-meta-hero">
        <div className="scraped-meta-hero-glow" aria-hidden />
        <h1>Lorcana — Meta &amp; tiers</h1>
        <p className="scraped-meta-sub">
          Dados em tempo real a partir de <code>scraped_decks</code> (share, colocações e cobertura).
        </p>
        <div className="scraped-meta-hero-stats">
          <span className="scraped-meta-pill">
            <strong>{stats?.total_decks ?? 0}</strong> decks
          </span>
          <span className="scraped-meta-pill">
            <strong>{stats?.unique_archetypes ?? 0}</strong> arquétipos
          </span>
          <span className="scraped-meta-pill">
            Atualizado <strong>{formatDate(stats?.latest_scrape)}</strong>
          </span>
        </div>
      </header>

      {error && (
        <div className="scraped-meta-banner-warn" role="status">
          Aviso: {error} — a mostrar dados em cache se existirem.
        </div>
      )}

      <section className="scraped-meta-stat-grid" aria-label="Estatísticas gerais">
        <article className="scraped-meta-stat-card">
          <h3>Mais popular</h3>
          <p className="scraped-meta-stat-value">{stats?.most_popular ?? '—'}</p>
          <p className="scraped-meta-stat-detail">
            {stats?.most_popular_count ?? 0} decks ({popularPct}%)
          </p>
        </article>
        <article className="scraped-meta-stat-card">
          <h3>Cobertura de colocação</h3>
          <p className="scraped-meta-stat-value">{stats?.with_standing_pct ?? 0}%</p>
          <p className="scraped-meta-stat-detail">Decks com placement / standing</p>
        </article>
        <article className="scraped-meta-stat-card">
          <h3>Eventos</h3>
          <p className="scraped-meta-stat-value">{stats?.with_event_pct ?? 0}%</p>
          <p className="scraped-meta-stat-detail">Decks com nome de evento</p>
        </article>
      </section>

      <section className="scraped-meta-section" aria-labelledby="tier-heading">
        <h2 id="tier-heading">Tier list</h2>
        <p className="scraped-meta-section-lead">
          Baseada em meta share e desempenho agregado (Top 8 / 16 / 32).
        </p>

        {['S', 'A', 'B', 'C'].map((tier) => (
          <div key={tier} className={`scraped-tier scraped-tier-${tier}`}>
            <div className="scraped-tier-header">
              <span className="scraped-tier-label">{tier}</span>
              <span className="scraped-tier-count">
                {tierList?.tiers?.[tier]?.length ?? 0} arquétipos
              </span>
            </div>
            <div className="scraped-tier-body">
              {tierList?.tiers?.[tier]?.length > 0 ? (
                tierList.tiers[tier].map((arch) => (
                  <div key={arch.archetype} className="scraped-archetype-card">
                    <div className="scraped-archetype-title">
                      <ArchetypeWithIcons archetype={arch.archetype} />
                    </div>
                    <div className="scraped-archetype-row">
                      <span className="scraped-meta-share">{arch.meta_share}% meta</span>
                      <span className="scraped-deck-count">{arch.deck_count} decks</span>
                      {arch.avg_standing != null && (
                        <span className="scraped-avg-standing" title="Média aproximada de colocação">
                          Ø rank {arch.avg_standing}
                        </span>
                      )}
                    </div>
                    <div className="scraped-finishes">
                      {arch.top8_finishes > 0 && (
                        <span className="scraped-finish scraped-finish-t8">
                          Top 8: {arch.top8_finishes}
                        </span>
                      )}
                      {arch.top16_finishes > 0 && (
                        <span className="scraped-finish scraped-finish-t16">
                          Top 16: {arch.top16_finishes}
                        </span>
                      )}
                      {arch.top32_finishes > 0 && (
                        <span className="scraped-finish scraped-finish-t32">
                          Top 32: {arch.top32_finishes}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="scraped-tier-empty">Nenhum arquétipo neste tier.</p>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="scraped-meta-section" aria-labelledby="share-heading">
        <h2 id="share-heading">Meta share — top 10</h2>
        <p className="scraped-meta-section-lead">
          Gráfico interativo; passa o rato para ver o nome completo e contagem.
        </p>
        <div className="scraped-chart-wrap">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={420}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis
                  type="number"
                  domain={[0, 'dataMax']}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  unit="%"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={132}
                  tick={{ fill: '#cbd5e1', fontSize: 11 }}
                />
                <Tooltip content={<MetaShareTooltip />} />
                <Bar dataKey="percentage" radius={[0, 6, 6, 0]} maxBarSize={28}>
                  {chartData.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="scraped-tier-empty">Sem dados de meta share.</p>
          )}
        </div>

        {chartData.length === 0 && (
          <div className="scraped-meta-bars-fallback">
            <h3 className="scraped-meta-bars-title">Lista compacta</h3>
            {metaShare?.archetypes?.slice(0, 10).map((arch, index) => (
              <div key={arch.archetype} className="scraped-chart-row">
                <div className="scraped-chart-label">
                  <span className="scraped-rank">#{index + 1}</span>
                  <span className="scraped-arch-name">
                    <ArchetypeWithIcons archetype={arch.archetype} size="sm" />
                  </span>
                </div>
                <div className="scraped-chart-track">
                  <div
                    className="scraped-chart-fill"
                    style={{
                      width: `${Math.min(100, arch.percentage)}%`,
                      background: CHART_COLORS[index % CHART_COLORS.length],
                    }}
                  >
                    <span className="scraped-bar-value">{arch.percentage}%</span>
                  </div>
                </div>
                <div className="scraped-chart-count">{arch.count} decks</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="scraped-meta-footer">
        <button
          type="button"
          className="scraped-meta-btn-primary"
          onClick={fetchMetaData}
          disabled={loading}
        >
          {loading ? 'A atualizar…' : 'Atualizar dados'}
        </button>
        {tierList?.generated_at && (
          <span className="scraped-meta-generated">
            Tier list gerada: {new Date(tierList.generated_at).toLocaleString()}
          </span>
        )}
      </footer>
    </div>
  );
}

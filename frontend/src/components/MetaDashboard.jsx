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

const INKDECKS_WINRATE_MATRIX_URL =
  'https://inkdecks.com/meta/winrate?metagame_id=16&hide_banned=0&relevance=&date_range=all&start_date=&end_date=&group_by=archetypes';

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

const WR_TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function ScrapedMetaDashboard({ embedded = false }) {
  const navigate = useNavigate();
  const [metaShare, setMetaShare] = useState(null);
  const [wrTiers, setWrTiers] = useState(null);
  const [glossaryDoc, setGlossaryDoc] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wrError, setWrError] = useState(null);

  const fetchMetaData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setWrError(null);

      const [shareRes, statsRes, wrRes, glossRes] = await Promise.all([
        fetch(`${API_BASE}/api/meta/share`),
        fetch(`${API_BASE}/api/meta/stats`),
        fetch(`${API_BASE}/api/meta-analysis/scraped-tier-list?min_games=1`),
        fetch(`${API_BASE}/api/meta/glossary`),
      ]);

      if (!shareRes.ok || !statsRes.ok) {
        const parts = [
          !shareRes.ok && `share ${shareRes.status}`,
          !statsRes.ok && `stats ${statsRes.status}`,
        ].filter(Boolean);
        throw new Error(parts.join(', ') || 'Failed to fetch meta data');
      }

      const [shareData, statsData] = await Promise.all([
        shareRes.json(),
        statsRes.json(),
      ]);

      setMetaShare(shareData);
      setStats(statsData);

      if (wrRes.ok) {
        const wrJson = await wrRes.json();
        setWrTiers(wrJson);
      } else {
        setWrTiers(null);
        setWrError(`Win-rate tiers: HTTP ${wrRes.status}`);
      }

      if (glossRes.ok) {
        const g = await glossRes.json();
        setGlossaryDoc(g);
      } else {
        setGlossaryDoc(null);
      }
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

  const distributionRows = useMemo(
    () => metaShare?.archetypes || [],
    [metaShare]
  );

  const glossaryByArch = useMemo(() => {
    const map = {};
    for (const e of glossaryDoc?.entries || []) {
      if (e && e.archetype) map[e.archetype] = e;
    }
    return map;
  }, [glossaryDoc]);

  const popularPct = useMemo(() => {
    const t = stats?.total_decks;
    const c = stats?.most_popular_count;
    if (!t || t <= 0 || c == null) return '0.0';
    return ((c / t) * 100).toFixed(1);
  }, [stats]);

  if (loading && !metaShare && !stats) {
    return (
      <div className="scraped-meta-dashboard scraped-meta-loading" aria-busy="true">
        <div className="scraped-meta-spinner" aria-hidden />
        <p>A carregar dados de meta…</p>
      </div>
    );
  }

  if (error && !metaShare && !stats) {
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
          Dados a partir de <code>scraped_decks</code> (campo <code>archetype</code> por deck). A
          recolha de listagens corre no{' '}
          <strong>GitHub Actions</strong> (agendado); o glossário com IA pode correr de madrugada
          no backend se <code>ENABLE_INKDECKS_NIGHTLY_CRON=true</code>.
        </p>
        <p className="scraped-meta-sub scraped-meta-sub--link">
          Matriz global de win rate por arquétipo (referência Inkdecks):{' '}
          <a href={INKDECKS_WINRATE_MATRIX_URL} target="_blank" rel="noopener noreferrer">
            inkdecks.com/meta/winrate…
          </a>
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
      {wrError && (
        <div className="scraped-meta-banner-warn" role="status">
          {wrError}
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

      <section className="scraped-meta-section" aria-labelledby="dist-heading">
        <h2 id="dist-heading">Distribuição de Arquétipos</h2>
        <p className="scraped-meta-section-lead">
          Contagem de decks por valor de <code>archetype</code> na base (todos os registos).
        </p>
        <div className="scraped-table-scroll">
          <table className="scraped-meta-dist-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Arquétipo</th>
                <th>Partilha</th>
                <th>Decks</th>
              </tr>
            </thead>
            <tbody>
              {distributionRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="scraped-tier-empty">
                    Sem dados de arquétipo.
                  </td>
                </tr>
              ) : (
                distributionRows.map((row, idx) => (
                  <tr key={row.archetype || idx}>
                    <td>{idx + 1}</td>
                    <td>
                      <ArchetypeWithIcons archetype={row.archetype} size="sm" />
                    </td>
                    <td>{row.percentage}%</td>
                    <td>{row.count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="scraped-meta-section" aria-labelledby="tier-wr-heading">
        <h2 id="tier-wr-heading">Tier list (por win rate agregado)</h2>
        <p className="scraped-meta-section-lead">
          Agrupa arquétipos com registo W–L nos decks scrapeados; tiers S–D por percentil de score
          (WR + meta share). Compara com a matriz oficial em{' '}
          <a href={INKDECKS_WINRATE_MATRIX_URL} target="_blank" rel="noopener noreferrer">
            Inkdecks
          </a>
          .
        </p>

        {WR_TIER_ORDER.map((tier) => (
          <div key={tier} className={`scraped-tier scraped-tier-${tier}`}>
            <div className="scraped-tier-header">
              <span className="scraped-tier-label">{tier}</span>
              <span className="scraped-tier-count">
                {wrTiers?.tier_list?.[tier]?.length ?? 0} arquétipos
              </span>
            </div>
            <div className="scraped-tier-body">
              {(wrTiers?.tier_list?.[tier] || []).length > 0 ? (
                wrTiers.tier_list[tier].map((arch) => (
                  <div key={arch.archetype} className="scraped-archetype-card">
                    <div className="scraped-archetype-title">
                      <ArchetypeWithIcons archetype={arch.archetype} />
                    </div>
                    <div className="scraped-archetype-row">
                      <span className="scraped-meta-share" title="Win rate agregado (W/(W+L))">
                        WR {arch.win_rate}%
                      </span>
                      <span className="scraped-deck-count">{arch.meta_share}% meta</span>
                      <span className="scraped-deck-count">{arch.deck_count} decks</span>
                      {arch.total_games > 0 && (
                        <span className="scraped-avg-standing" title="Partidas com registo">
                          {arch.total_games} partidas
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

      {(glossaryDoc?.entries?.length > 0 || glossaryDoc?.generated_at) && (
        <section className="scraped-meta-section" aria-labelledby="glossary-heading">
          <h2 id="glossary-heading">Glossário &amp; como jogar</h2>
          <p className="scraped-meta-section-lead">
            Texto gerado por LLM a partir dos arquétipos mais frequentes em{' '}
            <code>scraped_decks</code>. Última geração:{' '}
            {glossaryDoc?.generated_at
              ? new Date(glossaryDoc.generated_at).toLocaleString()
              : '—'}
            .
          </p>
          <div className="scraped-glossary-grid">
            {(glossaryDoc?.entries || []).map((entry) => (
              <article key={entry.archetype} className="scraped-glossary-card">
                <h3>
                  <ArchetypeWithIcons archetype={entry.archetype} />
                </h3>
                <h4 className="scraped-glossary-sub">Glossário</h4>
                <p className="scraped-glossary-body">{entry.glossary}</p>
                <h4 className="scraped-glossary-sub">Como o deck funciona</h4>
                <p className="scraped-glossary-body">{entry.how_it_plays}</p>
              </article>
            ))}
          </div>
        </section>
      )}

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

      {distributionRows.length > 0 && (
        <section className="scraped-meta-section" aria-labelledby="guides-heading">
          <h2 id="guides-heading">Painel por arquétipo (resumo)</h2>
          <p className="scraped-meta-section-lead">
            Combina a tabela de distribuição com o glossário (quando existir entrada para o mesmo
            nome de arquétipo).
          </p>
          <div className="scraped-glossary-grid">
            {distributionRows.slice(0, 12).map((row) => {
              const g = glossaryByArch[row.archetype];
              if (!g) return null;
              return (
                <article key={`dash-${row.archetype}`} className="scraped-glossary-card">
                  <h3>
                    <ArchetypeWithIcons archetype={row.archetype} />{' '}
                    <span className="scraped-dash-count">
                      ({row.count} decks · {row.percentage}%)
                    </span>
                  </h3>
                  <p className="scraped-glossary-body">{g.how_it_plays || g.glossary}</p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <footer className="scraped-meta-footer">
        <button
          type="button"
          className="scraped-meta-btn-primary"
          onClick={fetchMetaData}
          disabled={loading}
        >
          {loading ? 'A atualizar…' : 'Atualizar dados'}
        </button>
        {wrTiers?.meta?.total_decks != null && (
          <span className="scraped-meta-generated">
            Tiers WR: {wrTiers.meta.total_decks} decks ·{' '}
            {wrTiers.meta.total_archetypes ?? 0} arquétipos com jogos registados
          </span>
        )}
      </footer>
    </div>
  );
}

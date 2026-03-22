import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './DeckAnalyzer.css';
import DeckComparison from './components/DeckComparison';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3002';

// ══════════════════════════════════════════════════════════════════════════════
// VERSÃO COM i18n - MANTENDO 100% DA ESTRUTURA ORIGINAL
// ══════════════════════════════════════════════════════════════════════════════

// ── Process curveCounts ──────────────────────────────────────────────────────

function processCurveCounts(curveCounts) {
  if (!curveCounts || typeof curveCounts !== 'object') {
    return null;
  }

  const inkCurve = {};
  for (let i = 0; i <= 10; i++) {
    inkCurve[i] = { count: 0 };
  }

  let totalCount = 0;
  let earlyGameCount = 0;

  for (const [key, value] of Object.entries(curveCounts)) {
    const count = Number(value) || 0;
    const bucket = key === '10+' ? 10 : Math.max(0, Math.min(10, Number(key)));
    
    inkCurve[bucket].count += count;
    totalCount += count;
    
    if (bucket <= 2) {
      earlyGameCount += count;
    }
  }

  // Calculate avg cost
  let totalCost = 0;
  for (let i = 0; i <= 10; i++) {
    totalCost += i * inkCurve[i].count;
  }
  
  const avgCost = totalCount > 0 ? (totalCost / totalCount).toFixed(2) : '0';
  const earlyGamePct = totalCount > 0 ? ((earlyGameCount / totalCount) * 100).toFixed(1) : '0';

  return {
    inkCurve,
    avgCost,
    earlyGamePct,
    earlyGameCount,
    totalCount,
  };
}

// ── InkCurveChart ────────────────────────────────────────────────────────────

function InkCurveChart({ inkCurve, t }) {
  const maxCount = Math.max(...Object.values(inkCurve).map(v => v.count), 1);

  return (
    <div className="ink-curve-chart">
      <div className="ink-curve-bars">
        {Object.entries(inkCurve).map(([bucket, data]) => {
          const count = data.count;
          const height = (count / maxCount) * 100;
          const label = bucket === '10' ? '10+' : bucket;

          return (
            <div key={bucket} className="ink-curve-bar-wrap">
              <div
                className="ink-curve-bar"
                style={{ 
                  height: `${Math.max(height, 2)}%`,
                  minHeight: count > 0 ? '20px' : '4px',
                  background: 'linear-gradient(180deg, #7c3aed 0%, #8b5cf6 100%)',
                }}
                title={`${label} ${t('deckAnalyzer.inkCost')}: ${count} ${t('deckAnalyzer.cards')}`}
              >
                {count > 0 && (
                  <span className="ink-curve-bar-value">{count}</span>
                )}
              </div>
              <div className="ink-curve-label">{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function DeckAnalyzerTab({ deckText, setDeckText }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [opts, setOpts] = useState({ compare: true, top: 32 });

  const lines = useMemo(() => {
    return String(deckText || '').split(/\r?\n/).filter(l => l.trim().length).length;
  }, [deckText]);

  // Process curveCounts from analysis
  const curveStats = useMemo(() => {
    if (!analysis || !analysis.curveCounts) {
      return null;
    }
    return processCurveCounts(analysis.curveCounts);
  }, [analysis]);

  async function run() {
    setErr('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/deck/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decklist: deckText, ...opts }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setAnalysis(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sidebar-layout">
      {/* Sidebar */}
      <div className="flex flex-col gap-3">
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">
              <span className="icon">📋</span> {t('deckAnalyzer.decklistTitle')}
            </span>
            <span className="badge badge-gray">
              {lines} {t('deckAnalyzer.lineCount', { count: lines })}
            </span>
          </div>
          <div className="panel-body">
            <div className="controls-row">
              <label className="checkbox-group">
                <input
                  type="checkbox"
                  checked={opts.compare}
                  onChange={e => setOpts(o => ({ ...o, compare: e.target.checked }))}
                />
                {t('deckAnalyzer.compareMeta')}
              </label>
            </div>

            <textarea
              className="decklist-area"
              value={deckText}
              onChange={e => setDeckText(e.target.value)}
              placeholder={t('deckAnalyzer.placeholder')}
            />
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={run}
          disabled={loading}
        >
          {loading ? `⏳ ${t('deckAnalyzer.analyzing')}` : `⚡ ${t('deckAnalyzer.analyze')}`}
        </button>

        {err && <div className="err-box">{err}</div>}
      </div>

      {/* Results */}
      <div className="flex flex-col gap-4">
        {!analysis ? (
          <div className="panel">
            <div className="empty-state">
              <div className="empty-icon">🃏</div>
              {t('deckAnalyzer.emptyState')}
            </div>
          </div>
        ) : (
          <>
            {/* Summary com ML*/}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">
                  <span className="icon">📊</span> {t('deckAnalyzer.summary')}
                </span>
                {analysis.archetypeMethod && (
                  <span 
                    className={`badge ${analysis.archetypeMethod === 'rules' ? 'badge-green' : 'badge-blue'}`}
                    title={analysis.archetypeMethod === 'rules' ? t('deckAnalyzer.identifiedByRules') : t('deckAnalyzer.identifiedByML')}
                  >
                    {analysis.archetypeMethod === 'rules' ? `🎯 ${t('deckAnalyzer.rules')}` : `🤖 ${t('deckAnalyzer.ml')}`}
                  </span>
                )}
              </div>
              <div className="panel-body">
                <div className="stat-grid">
                  <div className="stat-item">
                    <div className="stat-label">{t('deckAnalyzer.archetype')}</div>
                    <div className="stat-value" style={{ fontSize: 14 }}>
                      {analysis.archetype || 'Unknown'}
                      {analysis.archetypeConfidence && (
                        <span style={{ 
                          fontSize: 11, 
                          marginLeft: 8, 
                          opacity: 0.7,
                          fontWeight: 'normal'
                        }}>
                          ({(analysis.archetypeConfidence * 100).toFixed(0)}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">{t('deckAnalyzer.cards')}</div>
                    <div className="stat-value">{analysis.totalCards}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">{t('deckAnalyzer.inkable')}</div>
                    <div className="stat-value">{analysis.inkablePct}%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Curve Stats */}
            {curveStats && (
              <>
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">
                      <span className="icon">📊</span> {t('deckAnalyzer.manaCurve')}
                    </span>
                    <span className="badge badge-gray">
                      {t('deckAnalyzer.average')}: {curveStats.avgCost}
                    </span>
                  </div>
                  <div className="panel-body">
                    <InkCurveChart inkCurve={curveStats.inkCurve} t={t} />
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">
                      <span className="icon">📈</span> {t('deckAnalyzer.statistics')}
                    </span>
                  </div>
                  <div className="panel-body">
                    <div className="advanced-stats-grid">
                      <div className="stat-card">
                        <div className="stat-icon">💰</div>
                        <div className="stat-content">
                          <div className="stat-value">{curveStats.avgCost}</div>
                          <div className="stat-label">{t('deckAnalyzer.avgCost')}</div>
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-icon">⚡</div>
                        <div className="stat-content">
                          <div className="stat-value">{curveStats.earlyGamePct}%</div>
                          <div className="stat-label">{t('deckAnalyzer.earlyGame')}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Deck Comparison */}
            {analysis && analysis.cards && (
              <DeckComparison analysis={analysis} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

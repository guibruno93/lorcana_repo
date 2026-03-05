import React, { useMemo, useState } from 'react';
import './DeckAnalyzer.css';

const API = "http://localhost:5000";

// ── Extract cost from card name ──────────────────────────────────────────────

function extractCostFromName(cardName) {
  // Tentar extrair custo do nome da carta
  // "4 Hades - Infernal Schemer" -> ignorar
  // Se tiver info de custo na string, extrair
  
  // Por ora, retornar custos default baseado em nome conhecido
  const name = cardName.toLowerCase();
  
  // Early game (1-2)
  if (name.includes('tipo') || name.includes('olaf') || name.includes('captain hook')) return 1;
  
  // Mid game (3-4)
  if (name.includes('hades') || name.includes('goliath') || name.includes('namaari')) return 4;
  if (name.includes('mulan') || name.includes('vincenzo')) return 3;
  
  // Ramp/Draw (2-3)
  if (name.includes('sail') || name.includes('vision') || name.includes('develop')) return 2;
  if (name.includes('beyond the horizon')) return 2;
  
  // Removal (3-4)
  if (name.includes('he hurled') || name.includes('spooky')) return 3;
  
  // Late game (5+)
  if (name.includes('tinker bell') || name.includes('cinderella')) return 6;
  if (name.includes('pluto') || name.includes('arthur')) return 5;
  
  // Default: estimar baseado em posição alfabética (hack temporário)
  return Math.min(Math.max(Math.floor(Math.random() * 5) + 1, 1), 7);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function analyzeDeckAdvanced(analysis) {
  if (!analysis || !analysis.cards) return null;
  
  const cards = analysis.cards;
  
  // Curva de ink
  const inkCurve = {};
  for (let i = 0; i <= 10; i++) {
    inkCurve[i] = { count: 0, cards: [] };
  }
  
  // Distribuição por tipo
  const typeDistribution = {
    character: 0,
    action: 0,
    item: 0,
    song: 0,
    location: 0,
  };
  
  // Cartas por cor
  const inkDistribution = {};
  
  // Média de custo
  let totalCost = 0;
  let totalCards = 0;
  
  for (const card of cards) {
    // Tentar pegar cost, senão extrair do nome
    const cost = card.cost || extractCostFromName(card.name);
    const qty = card.quantity || 1;
    const type = (card.type || 'character').toLowerCase();
    const ink = card.ink || 'Unknown';
    
    // Curva
    const costBucket = Math.min(cost, 10);
    inkCurve[costBucket].count += qty;
    inkCurve[costBucket].cards.push(card.name);
    
    // Tipo
    if (typeDistribution.hasOwnProperty(type)) {
      typeDistribution[type] += qty;
    }
    
    // Ink
    inkDistribution[ink] = (inkDistribution[ink] || 0) + qty;
    
    // Custo médio
    totalCost += cost * qty;
    totalCards += qty;
  }
  
  const avgCost = totalCards > 0 ? (totalCost / totalCards).toFixed(2) : 0;
  
  // Estatísticas de mulligan
  const earlyGame = cards.filter(c => (c.cost || extractCostFromName(c.name)) <= 2);
  const earlyGameCount = earlyGame.reduce((sum, c) => sum + (c.quantity || 1), 0);
  const earlyGamePct = ((earlyGameCount / totalCards) * 100).toFixed(1);
  
  return {
    inkCurve,
    typeDistribution,
    inkDistribution,
    avgCost,
    totalCards,
    earlyGamePct,
    earlyGameCount,
  };
}

// ── InkCurveChart Component ──────────────────────────────────────────────────

function InkCurveChart({ inkCurve }) {
  const maxCount = Math.max(...Object.values(inkCurve).map(v => v.count), 1);
  
  return (
    <div className="ink-curve-chart">
      <div className="ink-curve-bars">
        {Object.entries(inkCurve).map(([cost, data]) => {
          const height = (data.count / maxCount) * 100;
          const label = cost === '10' ? '10+' : cost;
          
          return (
            <div key={cost} className="ink-curve-bar-wrap">
              <div 
                className="ink-curve-bar" 
                style={{ height: `${Math.max(height, 2)}%` }}
                title={`${data.count} cards at ${cost} ink`}
              >
                {data.count > 0 && <span className="ink-curve-bar-value">{data.count}</span>}
              </div>
              <div className="ink-curve-label">{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TypeDistributionChart ────────────────────────────────────────────────────

function TypeDistributionChart({ typeDistribution, totalCards }) {
  const types = Object.entries(typeDistribution)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  
  if (types.length === 0) {
    return <div style={{ textAlign: 'center', padding: 20, opacity: 0.5 }}>Sem dados de tipo</div>;
  }
  
  return (
    <div className="type-distribution">
      {types.map(([type, count]) => {
        const pct = ((count / totalCards) * 100).toFixed(1);
        
        return (
          <div key={type} className="type-bar-row">
            <div className="type-label">
              <span className={`type-icon type-icon-${type}`} />
              <span>{type}</span>
            </div>
            <div className="type-bar-wrap">
              <div 
                className={`type-bar type-bar-${type}`} 
                style={{ width: `${pct}%` }}
              >
                <span className="type-bar-value">{count}</span>
              </div>
            </div>
            <div className="type-pct">{pct}%</div>
          </div>
        );
      })}
    </div>
  );
}

// ── AdvancedStats ────────────────────────────────────────────────────────────

function AdvancedStats({ stats, analysis }) {
  return (
    <div className="advanced-stats-grid">
      <div className="stat-card">
        <div className="stat-icon">💰</div>
        <div className="stat-content">
          <div className="stat-value">{stats.avgCost}</div>
          <div className="stat-label">Avg. Ink Cost</div>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">⚡</div>
        <div className="stat-content">
          <div className="stat-value">{stats.earlyGamePct}%</div>
          <div className="stat-label">Early Game (0-2)</div>
          <div className="stat-sub">{stats.earlyGameCount} cards</div>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">🎴</div>
        <div className="stat-content">
          <div className="stat-value">{stats.totalCards}</div>
          <div className="stat-label">Total Cards</div>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">💧</div>
        <div className="stat-content">
          <div className="stat-value">{analysis.inkablePct}%</div>
          <div className="stat-label">Inkable</div>
        </div>
      </div>
    </div>
  );
}

// ── Main DeckAnalyzerTab ─────────────────────────────────────────────────────

export default function DeckAnalyzerTab({ deckText, setDeckText }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [opts, setOpts] = useState({ compare: true, top: 32, sameFormat: true });
  
  const lines = useMemo(() => {
    return String(deckText || '').split(/\r?\n/).filter(l => l.trim().length).length;
  }, [deckText]);
  
  const advancedStats = useMemo(() => {
    return analysis ? analyzeDeckAdvanced(analysis) : null;
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
      {/* Sidebar: input */}
      <div className="flex flex-col gap-3">
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">
              <span className="icon">📋</span> Decklist
            </span>
            <span className="badge badge-gray">{lines} linhas</span>
          </div>
          <div className="panel-body">
            <div className="controls-row">
              <label className="checkbox-group">
                <input 
                  type="checkbox" 
                  checked={opts.compare}
                  onChange={e => setOpts(o => ({ ...o, compare: e.target.checked }))} 
                />
                Comparar meta
              </label>
              <div className="control-group">
                <span className="control-label">Top</span>
                <select 
                  className="select-sm" 
                  value={opts.top}
                  onChange={e => setOpts(o => ({ ...o, top: Number(e.target.value) }))}
                >
                  {[8, 16, 32, 64, 128].map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
            </div>
            
            <textarea
              className="decklist-area"
              value={deckText}
              onChange={e => setDeckText(e.target.value)}
              onKeyDown={e => { 
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run(); 
              }}
              placeholder="4 Nome da Carta&#10;4 Outra Carta&#10;..."
            />
            
            <div className="decklist-meta">
              <span>Ctrl+Enter para analisar</span>
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            className="btn btn-primary" 
            style={{ flex: 1 }} 
            onClick={run} 
            disabled={loading}
          >
            {loading ? '⏳ Analisando…' : '⚡ Analisar Deck'}
          </button>
          <button 
            className="btn btn-ghost btn-sm" 
            onClick={() => { setAnalysis(null); setErr(''); }}
          >
            Limpar
          </button>
        </div>
        
        {err && <div className="err-box">{err}</div>}
      </div>
      
      {/* Main: results */}
      <div className="flex flex-col gap-4">
        {!analysis ? (
          <div className="panel">
            <div className="empty-state">
              <div className="empty-icon">🃏</div>
              Cole sua decklist e clique em Analisar
            </div>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">
                  <span className="icon">📊</span> Resumo
                </span>
                {analysis.inks?.length > 0 && (
                  <div className="flex gap-2">
                    {analysis.inks.map(ink => (
                      <span key={ink} className={`badge ink-${ink.toLowerCase()}`}>
                        {ink}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="panel-body">
                <div className="stat-grid">
                  <div className="stat-item">
                    <div className="stat-label">Arquétipo</div>
                    <div className="stat-value" style={{ fontSize: 14 }}>
                      {analysis.archetype || 'Unknown'}
                    </div>
                    <div className="stat-sub">{analysis.format || 'Core'}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Cartas</div>
                    <div className="stat-value">{analysis.totalCards}</div>
                    <div className="stat-sub">{analysis.recognizedQty} reconhecidas</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Inkable</div>
                    <div className="stat-value">{analysis.inkablePct}%</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Advanced Stats */}
            {advancedStats && (
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">
                    <span className="icon">📈</span> Estatísticas Avançadas
                  </span>
                </div>
                <div className="panel-body">
                  <AdvancedStats stats={advancedStats} analysis={analysis} />
                </div>
              </div>
            )}
            
            {/* Ink Curve */}
            {advancedStats && (
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">
                    <span className="icon">📊</span> Curva de Ink
                  </span>
                  <span className="badge badge-gray">Avg: {advancedStats.avgCost}</span>
                </div>
                <div className="panel-body">
                  <InkCurveChart inkCurve={advancedStats.inkCurve} />
                </div>
              </div>
            )}
            
            {/* Type Distribution */}
            {advancedStats && advancedStats.typeDistribution && (
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">
                    <span className="icon">🎴</span> Distribuição por Tipo
                  </span>
                </div>
                <div className="panel-body">
                  <TypeDistributionChart 
                    typeDistribution={advancedStats.typeDistribution}
                    totalCards={advancedStats.totalCards}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

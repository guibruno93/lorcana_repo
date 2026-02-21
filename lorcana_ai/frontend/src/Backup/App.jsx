import React, { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { analyzeDeckApi, pingAiApi } from "./api";
import MetaComparison from "./MetaComparison";
import MetaDashboard from "./MetaDashboard";
import Login from './Login';
import DeckAnalyzer from './DeckAnalyzer';

function countLines(text) {
  return String(text || "").split(/\r?\n/).filter((l) => l.trim().length).length;
}

// ═══════════════════════════════════════════════════════════════════════════
//  API HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const API = "http://localhost:5000";

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
  analyze:     (text, opts) => apiFetch("/api/deck/analyze", { decklist: text, ...opts }),
  matchups:    (text)   => apiFetch("/api/ai/matchups", { decklist: text }),
  shuffle:     (text)   => apiFetch("/api/ai/shuffle", { decklist: text }),
  mulligan:    (hand, text) => apiFetch("/api/ai/mulligan", { hand, decklist: text }),
  simMulligan: (hand, indices, text) =>
    apiFetch("/api/ai/simulate-mulligan", { hand, mulligan: indices, decklist: text }),
};

// ═══════════════════════════════════════════════════════════════════════════
//  DECK ANALYZER TAB
// ═══════════════════════════════════════════════════════════════════════════

function DeckAnalyzerTab({ deckText, setDeckText }) {
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [opts, setOpts] = useState({ compare: true, top: 32, sameFormat: true });

  const lines = useMemo(() => countLines(deckText), [deckText]);

  async function run() {
    setErr(""); setLoading(true);
    try {
      const data = await api.analyze(deckText, opts);
      setAnalysis(data);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  const meta = analysis?.metaComparison;

  return (
    <div className="sidebar-layout">
      {/* Sidebar: input */}
      <div className="flex flex-col gap-3">
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title"><span className="icon">📋</span> Decklist</span>
            <span className="badge badge-gray">{lines} linhas</span>
          </div>
          <div className="panel-body">
            <div className="controls-row">
              <label className="checkbox-group">
                <input type="checkbox" checked={opts.compare}
                  onChange={e => setOpts(o => ({...o, compare: e.target.checked}))} />
                Comparar meta
              </label>
              <div className="control-group">
                <span className="control-label">Top</span>
                <select className="select-sm" value={opts.top}
                  onChange={e => setOpts(o => ({...o, top: Number(e.target.value)}))}>
                  {[8,16,32,64,128].map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
              <label className="checkbox-group">
                <input type="checkbox" checked={opts.sameFormat}
                  onChange={e => setOpts(o => ({...o, sameFormat: e.target.checked}))} />
                Mesmo formato
              </label>
            </div>

            <textarea
              className="decklist-area"
              value={deckText}
              onChange={e => setDeckText(e.target.value)}
              onKeyDown={e => { if ((e.ctrlKey||e.metaKey) && e.key==="Enter") run(); }}
              placeholder={"4 Nome da Carta\n4 Outra Carta\n..."}
            />
            <div className="decklist-meta">
              <span>Ctrl+Enter para analisar</span>
              <span>{deckText.split(/\s+/).filter(Boolean).length} tokens</span>
            </div>
          </div>
        </div>

        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-primary" style={{flex:1}} onClick={run} disabled={loading}>
            {loading ? "⏳ Analisando…" : "⚡ Analisar Deck"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setAnalysis(null); setErr(""); }}>
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
                <span className="panel-title"><span className="icon">📊</span> Resumo</span>
                {analysis.inks?.length > 0 && (
                  <div className="flex gap-2">
                    {analysis.inks.map(ink => (
                      <span key={ink} className={`badge ink-${ink.toLowerCase()}`}>{ink}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="panel-body">
                <div className="stat-grid">
                  <div className="stat-item">
                    <div className="stat-label">Cartas</div>
                    <div className="stat-value">{analysis.totalCards}</div>
                    <div className="stat-sub">{analysis.recognizedQty} reconhecidas</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Inkable</div>
                    <div className="stat-value">{analysis.inkablePct}%</div>
                    <div className="stat-sub">{analysis.format || "Core"}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Arquétipo</div>
                    <div className="stat-value" style={{fontSize:14,lineHeight:1.3}}>
                      {analysis.archetype || "—"}
                    </div>
                    <div className="stat-sub">{analysis.unknownQty > 0 ? `${analysis.unknownQty} desconhecidas` : "Todas reconhecidas"}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Meta comparison */}
            {meta && meta.enabled && (
              <>
                {meta.aggregate && (
                  <div className="panel">
                    <div className="panel-header">
                      <span className="panel-title"><span className="icon">🏆</span> Meta — Top {opts.top}</span>
                      <span className="badge badge-gray">{meta.totalChecked ?? meta.aggregate.count} decks analisados</span>
                    </div>
                    <div className="panel-body">
                      {meta.note && <div className="err-box mb-4">{meta.note}</div>}
                      <div className="aggregate-row">
                        <div className="agg-item">
                          <span className="agg-label">Decks similares</span>
                          <span className="agg-val">{meta.aggregate.count}</span>
                        </div>
                        <div className="agg-item">
                          <span className="agg-label">Melhor colocação</span>
                          <span className="agg-val">#{meta.aggregate.bestFinish}</span>
                        </div>
                        <div className="agg-item">
                          <span className="agg-label">Média colocação</span>
                          <span className="agg-val">#{meta.aggregate.avgFinish}</span>
                        </div>
                        <div className="agg-item">
                          <span className="agg-label">Taxa Top 8</span>
                          <span className="agg-val">{Math.round((meta.aggregate.top8Rate||0)*100)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(meta.adds?.length > 0 || meta.cuts?.length > 0) && (
                  <div className="panel">
                    <div className="panel-header">
                      <span className="panel-title"><span className="icon">✂️</span> Adds &amp; Cuts</span>
                      <span className="text-sm text-muted">Baseado em {meta.aggregate?.count} decks similares</span>
                    </div>
                    <div className="panel-body">
                      <div className="adds-cuts-grid">
                        {/* ADDS */}
                        <div className="adds-section">
                          <div className="ac-title">Considere adicionar</div>
                          {(!meta.adds || meta.adds.length === 0) ? (
                            <div className="ac-empty">Nenhuma sugestão</div>
                          ) : (
                            meta.adds.map((c, i) => (
                              <div key={i} className="ac-row">
                                <span className="ac-qty">+{c.avgQty}</span>
                                <span className="ac-name">{c.card}</span>
                                <span className="ac-pct">{c.pct}%</span>
                              </div>
                            ))
                          )}
                        </div>

                        {/* CUTS */}
                        <div className="cuts-section">
                          <div className="ac-title">Considere cortar</div>
                          {(!meta.cuts || meta.cuts.length === 0) ? (
                            <div className="ac-empty">Nenhuma sugestão</div>
                          ) : (
                            meta.cuts.map((c, i) => (
                              <div key={i} className="ac-row">
                                <span className="ac-qty">−{c.avgQty}</span>
                                <span className="ac-name">{c.card}</span>
                                <span className="ac-pct">{c.pct}%</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  HAND ANALYZER TAB
// ═══════════════════════════════════════════════════════════════════════════

function HandAnalyzerTab({ deckText }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  const [hand, setHand]       = useState([]);
  const [mulligan, setMulligan]   = useState(null);
  const [mulliganSimulation, setMulliganSimulation] = useState(null);

  async function shuffle() {
    if (!deckText.trim()) return setErr("Cole uma decklist primeiro.");
    setErr(""); setLoading(true);
    try {
      const d = await api.shuffle(deckText);
      setHand(d.hand || []);
      setMulligan(null);
      setMulliganSimulation(null);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function askMulligan() {
    if (!hand.length) return setErr("Shuffle uma mão primeiro.");
    setLoading(true); setErr("");
    try {
      const d = await api.mulligan(hand, deckText);
      setMulligan(d);
      setMulliganSimulation(null);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function simulateMulligan(indices) {
    setLoading(true); setErr("");
    try {
      const d = await api.simMulligan(hand, indices, deckText);
      setMulliganSimulation(d);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  const handEmpty = !hand || hand.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" onClick={shuffle} disabled={loading}>
          {loading && !mulligan && !mulliganSimulation ? "⏳ Embaralhando…" : "🔀 Embaralhar"}
        </button>
        {!handEmpty && (
          <button className="btn btn-secondary" onClick={askMulligan} disabled={loading}>
            {loading && mulligan ? "⏳ Analisando…" : "🤔 Análise de Mulligan"}
          </button>
        )}
      </div>

      {err && <div className="err-box">{err}</div>}

      {handEmpty && !loading && (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-icon">🎴</div>
            {deckText.trim() ? "Clique em Embaralhar para simular uma mão inicial" : "Cole uma decklist para começar"}
          </div>
        </div>
      )}

      {!handEmpty && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title"><span className="icon">🎴</span> Mão Inicial</span>
          </div>
          <div className="panel-body">
            <div className="hand-grid">
              {hand.map((card, i) => {
                const suggestKeep = mulligan?.keep?.includes(i);
                const suggestMull = mulligan?.mulligan?.includes(i);

                return (
                  <div key={i} className={`hand-card ${suggestMull ? "mull-card" : ""}`}>
                    <div className="card-name">{card}</div>
                    {suggestKeep && <div className="keep-badge">✓ Manter</div>}
                    {suggestMull && <div className="mull-badge">✗ Trocar</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {mulligan && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title"><span className="icon">💡</span> Recomendação</span>
          </div>
          <div className="panel-body">
            <div className="mulligan-advice">
              <strong>{mulligan.decision || "Decisão desconhecida"}</strong>
              <div className="mt-2 text-sm opacity-80">{mulligan.reasoning || ""}</div>
            </div>

            {mulligan.mulligan && mulligan.mulligan.length > 0 && (
              <div className="mt-4">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => simulateMulligan(mulligan.mulligan)}
                  disabled={loading}
                >
                  {loading && mulliganSimulation ? "⏳ Simulando…" : "🔄 Simular Troca"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {mulliganSimulation && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title"><span className="icon">✨</span> Após Mulligan</span>
          </div>
          <div className="panel-body">
            <div className="hand-grid">
              {mulliganSimulation.newHand && mulliganSimulation.newHand.map((card, i) => (
                <div key={i} className="hand-card">
                  <div className="card-name">{card}</div>
                </div>
              ))}
            </div>
            {mulliganSimulation.note && (
              <div className="mt-4 text-sm opacity-80">{mulliganSimulation.note}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MATCHUPS TAB
// ═══════════════════════════════════════════════════════════════════════════

function MatchupsTab({ deckText }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  const [data, setData]       = useState(null);

  async function run() {
    if (!deckText.trim()) return setErr("Cole uma decklist primeiro.");
    setLoading(true); setErr("");
    try {
      const d = await api.matchups(deckText);
      setData(d);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (deckText.trim()) run();
  }, []);

  const matchups = data?.matchups || [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button className="btn btn-primary btn-sm" onClick={run} disabled={loading}>
          {loading ? "⏳ Calculando…" : "🔄 Recalcular"}
        </button>
        {data?.userArchetype && (
          <span className="text-sm text-muted">
            Detectado como <strong style={{color:"var(--text)"}}>{data.userArchetype}</strong>
          </span>
        )}
        {data?.dataSource && (
          <span className="badge badge-gray text-xs">{data.dataSource}</span>
        )}
      </div>

      {err && <div className="err-box">{err}</div>}

      {data?.summary && (
        <div className="aggregate-row">
          <div className="agg-item">
            <span className="agg-label">WR Médio</span>
            <span className="agg-val">{data.summary.avgWinRate}%</span>
          </div>
          <div className="agg-item">
            <span className="agg-label">Tier</span>
            <span className="agg-val">{data.summary.tier}</span>
          </div>
          <div className="agg-item">
            <span className="agg-label">Favorável</span>
            <span className="agg-val" style={{color:"#4ade80"}}>{data.summary.favored}</span>
          </div>
          <div className="agg-item">
            <span className="agg-label">Equilibrado</span>
            <span className="agg-val" style={{color:"var(--accent2)"}}>{data.summary.even}</span>
          </div>
          <div className="agg-item">
            <span className="agg-label">Desfavorável</span>
            <span className="agg-val" style={{color:"#f87171"}}>{data.summary.unfavored}</span>
          </div>
        </div>
      )}

      {matchups.length === 0 && !loading && !err && (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-icon">⚔️</div>
            {deckText.trim() ? "Clique em Recalcular para ver os matchups" : "Cole uma decklist para ver os matchups"}
          </div>
        </div>
      )}

      {matchups.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title"><span className="icon">⚔️</span> Matchups vs. Meta</span>
          </div>
          <div className="panel-body">
            <div className="matchup-grid">
              {matchups.map((m, i) => {
                const wrClass = m.winRate >= 55 ? "wr-favored" 
                  : m.winRate >= 45 ? "wr-even"
                  : m.winRate >= 37 ? "wr-unfavored" : "wr-heavy";
                const barClass = m.winRate >= 55 ? "bar-favored"
                  : m.winRate >= 45 ? "bar-even"
                  : m.winRate >= 37 ? "bar-unfavored" : "bar-heavy";
                const badgeClass = m.rating === "Favored" ? "badge-green"
                  : m.rating === "Even" ? "badge-purple"
                  : m.rating === "Unfavored" ? "badge-yellow" : "badge-red";
                
                return (
                  <div key={i} className="matchup-row">
                    <div className="matchup-opponent">{m.opponent}</div>
                    <div className="matchup-bar-wrap">
                      <div className={`matchup-bar ${barClass}`} style={{width:`${m.winRate}%`}} />
                    </div>
                    <div className={`matchup-wr ${wrClass}`}>{m.winRate}%</div>
                    <div className="matchup-badge">
                      <span className={`badge ${badgeClass}`}>{m.rating}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  ROOT APP
// ═══════════════════════════════════════════════════════════════════════════

const SAMPLE = `Cole sua decklist aqui`;

export default function App() {
  const [tab, setTab]           = useState("deck");
  const [deckText, setDeckText] = useState(SAMPLE);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Verificar se usuário está logado
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  return (
    <div className="App">
      <header>
        <h1>Lorcana AI</h1>
        <div className="user-info">
          <span>Olá, {user.email}</span>
          <button onClick={handleLogout}>Sair</button>
        </div>
      </header>
      
      <DeckAnalyzer />
    </div>
  );
}

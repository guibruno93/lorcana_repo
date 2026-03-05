import React, { useEffect, useMemo, useState, useCallback } from "react";
import "./styles.css";

const API = "http://localhost:5000";

// ── API helpers ────────────────────────────────────────────────────────────────

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
  ping:        ()       => fetch(`${API}/api/ai/ping`).then(r => r.json()),
  analyze:     (text, opts) => apiFetch("/api/deck/analyze", { decklist: text, ...opts }),
  matchups:    (text)   => apiFetch("/api/ai/matchups", { decklist: text }),
  shuffle:     (text)   => apiFetch("/api/ai/shuffle", { decklist: text }),
  mulligan:    (hand, text) => apiFetch("/api/ai/mulligan", { hand, decklist: text }),
  simMulligan: (hand, indices, text) =>
    apiFetch("/api/ai/simulate-mulligan", { hand, mulligan: indices, decklist: text }),
  strategy:    (text)   => apiFetch("/api/ai/strategy", { decklist: text }),
};

// ── Tiny helpers ───────────────────────────────────────────────────────────────

function countLines(t) {
  return String(t || "").split(/\r?\n/).filter(l => l.trim()).length;
}

function inkBadgeClass(ink) {
  const m = { Amber: "ink-amber", Amethyst: "ink-amethyst", Emerald: "ink-emerald",
               Ruby: "ink-ruby", Sapphire: "ink-sapphire", Steel: "ink-steel" };
  return m[ink] || "badge-gray";
}

function wrBarClass(wr) {
  if (wr >= 55) return "bar-favored";
  if (wr >= 45) return "bar-even";
  if (wr >= 37) return "bar-unfavored";
  return "bar-heavy";
}
function wrTextClass(wr) {
  if (wr >= 55) return "wr-favored";
  if (wr >= 45) return "wr-even";
  if (wr >= 37) return "wr-unfavored";
  return "wr-heavy";
}
function wrBadge(rating) {
  const m = { "Favored": "badge-green", "Even": "badge-purple",
              "Unfavored": "badge-yellow", "Heavily Unfavored": "badge-red" };
  return m[rating] || "badge-gray";
}
function priorityBadge(p) {
  return p === "High" ? "badge-red" : p === "Medium" ? "badge-yellow" : "badge-gray";
}

// ── SAMPLE DECKLIST ───────────────────────────────────────────────────────────

const SAMPLE = `4 Tipo - Growing Son
4 Sail the Azurite Sea
4 Vision of the Future
2 Spooky Sight
4 Hades - Infernal Schemer
3 Mulan - Disguised Soldier
4 Vincenzo Santorini - The Explosives Expert
4 He Hurled His Thunderbolt
4 Namaari - Single-Minded Rival
2 Beyond the Horizon
4 Develop Your Brain
4 Goliath - Clan Leader
1 Pluto - Steel Champion
1 Arthur - King Victorious
4 Tinker Bell - Giant Fairy
4 Cinderella - Dream Come True
2 Jasmine - Fearless Princess
2 Inkrunner
3 Jafar - Tyrannical Hypnotist`;

// ═══════════════════════════════════════════════════════════════════════════════
//  DECK ANALYZER TAB
// ═══════════════════════════════════════════════════════════════════════════════

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
      {/* ── Sidebar: input ── */}
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

      {/* ── Main: results ── */}
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
                      <span key={ink} className={`badge ${inkBadgeClass(ink)}`}>{ink}</span>
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

            {/* Meta comparison / Adds & Cuts */}
            {meta && meta.enabled && (
              <>
                {/* Aggregate */}
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

                {/* Adds & Cuts */}
                {(meta.adds?.length > 0 || meta.cuts?.length > 0) && (
                  <div className="panel">
                    <div className="panel-header">
                      <span className="panel-title"><span className="icon">✂️</span> Adds &amp; Cuts</span>
                      <span className="text-sm text-muted">Baseado em {meta.aggregate?.count} decks similares</span>
                    </div>
                    <div className="panel-body">
                      <div className="adds-cuts-grid">
                        {/* ADDS */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="badge badge-green">+ ADDS</span>
                            <span className="text-xs text-faint">Cartas frequentes no meta que você não usa</span>
                          </div>
                          <div className="ac-list">
                            {(meta.adds || []).length === 0 && (
                              <div className="text-sm text-muted">Nenhuma sugestão de add.</div>
                            )}
                            {(meta.adds || []).map((c, i) => (
                              <div key={i} className="ac-item add">
                                <div style={{flex:1,minWidth:0}}>
                                  <div className="ac-name" title={c.name}>{c.name}</div>
                                  <div className="text-xs text-faint mt-1">
                                    Em {c.metaPresence}% dos top decks
                                  </div>
                                </div>
                                <div className="ac-meta">
                                  <span className={`badge ${priorityBadge(c.priority)}`}>{c.priority}</span>
                                  <span className="qty-chip qty-yours">{c.yourQty}x</span>
                                  <span className="qty-chip qty-meta">→ {c.suggestedQty}x</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* CUTS */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="badge badge-red">− CUTS</span>
                            <span className="text-xs text-faint">Cartas do seu deck raras no meta</span>
                          </div>
                          <div className="ac-list">
                            {(meta.cuts || []).length === 0 && (
                              <div className="text-sm text-muted">Nenhuma sugestão de cut.</div>
                            )}
                            {(meta.cuts || []).map((c, i) => (
                              <div key={i} className="ac-item cut">
                                <div style={{flex:1,minWidth:0}}>
                                  <div className="ac-name" title={c.name}>{c.name}</div>
                                  <div className="text-xs text-faint mt-1">
                                    Apenas {c.metaPresence}% dos top decks
                                  </div>
                                </div>
                                <div className="ac-meta">
                                  <span className={`badge ${priorityBadge(c.priority)}`}>{c.priority}</span>
                                  <span className="qty-chip qty-yours">{c.yourQty}x</span>
                                  <span className="qty-chip qty-cut">− {c.suggestedCut}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Similar Decks */}
                {meta.similarDecks?.length > 0 && (
                  <div className="panel">
                    <div className="panel-header">
                      <span className="panel-title"><span className="icon">🔍</span> Decks Similares</span>
                    </div>
                    <div className="panel-body" style={{padding:0}}>
                      <table className="similar-table">
                        <thead>
                          <tr>
                            <th>Sim.</th>
                            <th>Arquétipo</th>
                            <th>Colocação</th>
                            <th>Evento</th>
                            <th>Link</th>
                          </tr>
                        </thead>
                        <tbody>
                          {meta.similarDecks.map((d, i) => (
                            <tr key={i}>
                              <td><span className="sim-score">{d.score}%</span></td>
                              <td>{d.archetype || "—"}</td>
                              <td><span className="badge badge-gray">{d.finish || "—"}</span></td>
                              <td className="truncate" style={{maxWidth:200}} title={d.event}>{d.event || "—"}</td>
                              <td>
                                {d.url
                                  ? <a href={d.url} target="_blank" rel="noreferrer" className="link-btn">Ver ↗</a>
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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

// ═══════════════════════════════════════════════════════════════════════════════
//  HAND ANALYZER TAB
// ═══════════════════════════════════════════════════════════════════════════════

function HandAnalyzerTab({ deckText }) {
  const [hand, setHand]         = useState(Array(7).fill(""));
  const [mulligan, setMulligan] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [shuffling, setShuffling] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");

  async function doShuffle() {
    if (!deckText.trim()) return setErr("Cole uma decklist primeiro.");
    setShuffling(true); setErr(""); setMulligan(null); setAnalysis(null);
    try {
      const d = await api.shuffle(deckText);
      setHand(d.hand || Array(7).fill(""));
    } catch(e) { setErr(e.message); }
    finally { setShuffling(false); }
  }

  async function doAnalyze() {
    const filled = hand.filter(c => c.trim());
    if (filled.length !== 7) return setErr("Preencha todos os 7 slots ou use Embaralhar.");
    if (!deckText.trim()) return setErr("Cole uma decklist primeiro.");
    setLoading(true); setErr("");
    try {
      const [mulData] = await Promise.all([
        api.mulligan(filled, deckText),
      ]);
      setMulligan(mulData);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  async function doSimMulligan() {
    if (!mulligan?.suggestions) return;
    const indices = mulligan.suggestions.map((s,i) => s.action==="Mulligan" ? i : -1).filter(i=>i>=0);
    if (!indices.length) return;
    setShuffling(true); setErr("");
    try {
      const d = await api.simMulligan(hand, indices, deckText);
      setHand(d.hand || hand);
      setMulligan(null); setAnalysis(null);
    } catch(e) { setErr(e.message); }
    finally { setShuffling(false); }
  }

  const decisionKey = mulligan?.decision?.toLowerCase().includes("full") ? "full"
    : mulligan?.decision?.toLowerCase().includes("partial") ? "partial" : "keep";

  return (
    <div className="flex flex-col gap-4">
      {/* Hand grid */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title"><span className="icon">🎴</span> Mão Inicial</span>
          {mulligan?.strategy && (
            <span className="badge badge-purple">{mulligan.strategy.type}</span>
          )}
        </div>
        <div className="panel-body">
          <div className="hand-grid">
            {hand.map((card, i) => {
              const sug = mulligan?.suggestions?.[i];
              const cls = sug ? (sug.action === "Keep" ? "keep" : "mulligan") : "";
              return (
                <div key={i} className="hand-input-wrap">
                  <span className="hand-slot-label">Carta {i+1}</span>
                  <input
                    className={`hand-slot-input ${cls}`}
                    value={card}
                    onChange={e => {
                      const h = [...hand]; h[i] = e.target.value; setHand(h);
                    }}
                    placeholder={`Carta ${i+1}`}
                  />
                </div>
              );
            })}
          </div>

          <div className="hand-actions">
            <button className="btn btn-ghost" onClick={doShuffle} disabled={shuffling||!deckText.trim()}>
              {shuffling ? "⏳" : "🎲"} Embaralhar
            </button>
            <button className="btn btn-primary" onClick={doAnalyze} disabled={loading}>
              {loading ? "⏳ Analisando…" : "🔬 Analisar Mão"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setHand(Array(7).fill("")); setMulligan(null); setErr(""); }}>
              Limpar
            </button>
          </div>

          {err && <div className="err-box mt-3">{err}</div>}
        </div>
      </div>

      {/* Mulligan decision */}
      {mulligan && (
        <>
          <div className={`decision-banner ${decisionKey}`}>
            <div>
              <div className="decision-label">{mulligan.decision}</div>
              <div className="decision-desc mt-1">{mulligan.reasoning}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div className="decision-confidence">{Math.round((mulligan.confidence||0)*100)}% confiança</div>
              {mulligan.expectedImprovement > 0 && (
                <div className="badge badge-green mt-1">+{mulligan.expectedImprovement}% melhora esperada</div>
              )}
            </div>
          </div>

          {/* Card-by-card */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title"><span className="icon">📋</span> Análise por Carta</span>
              {mulligan.mulliganCards?.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={doSimMulligan} disabled={shuffling}>
                  {shuffling ? "⏳" : "🔄"} Simular Mulligan ({mulligan.mulliganCards.length})
                </button>
              )}
            </div>
            <div className="panel-body">
              <div className="mulligan-cards">
                {(mulligan.suggestions || []).map((sug, i) => (
                  <div key={i} className={`mulligan-card-row ${sug.action === "Keep" ? "keep" : "mull"}`}>
                    <div>
                      <div className="card-name-row">{sug.card}</div>
                      <div className="card-role">{sug.role || ""} {sug.inkable ? "· 💧 Inkable" : ""}</div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="badge badge-gray font-mono">{sug.cost ?? "?"} ink</span>
                      {sug.priority > 0 && (
                        <span className={`badge ${sug.priority===3?"badge-red":sug.priority===2?"badge-yellow":"badge-blue"}`}>
                          P{sug.priority}
                        </span>
                      )}
                    </div>
                    <span className={`badge ${sug.action === "Keep" ? "badge-green" : "badge-red"}`}>
                      {sug.action === "Keep" ? "✓ Manter" : "✗ Trocar"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Reasons */}
              {mulligan.suggestions?.some(s => s.reasons?.length) && (
                <details className="mt-4" style={{color:"var(--text2)",fontSize:13}}>
                  <summary style={{cursor:"pointer",color:"var(--text3)"}}>Ver motivos detalhados</summary>
                  <div className="flex flex-col gap-2 mt-3">
                    {mulligan.suggestions.map((sug, i) => (
                      sug.reasons?.length ? (
                        <div key={i}>
                          <strong style={{color:"var(--text)"}}>{sug.card}</strong>
                          <ul style={{marginLeft:16, marginTop:4}}>
                            {sug.reasons.map((r,j) => <li key={j}>{r}</li>)}
                          </ul>
                          {sug.alternatives?.length > 0 && (
                            <div className="text-xs text-faint mt-1">
                              Buscar: {sug.alternatives.join(" · ")}
                            </div>
                          )}
                        </div>
                      ) : null
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        </>
      )}

      {!deckText.trim() && (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            Cole uma decklist na aba Deck Analyzer para usar o simulador
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MATCHUPS TAB
// ═══════════════════════════════════════════════════════════════════════════════

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
  }, []); // run once on mount

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
              {matchups.map((m, i) => (
                <div key={i} className="matchup-row">
                  <div className="matchup-opponent">{m.opponent}</div>
                  <div className="matchup-bar-wrap">
                    <div
                      className={`matchup-bar ${wrBarClass(m.winRate)}`}
                      style={{ width: `${m.winRate}%` }}
                    />
                  </div>
                  <div className={`matchup-wr ${wrTextClass(m.winRate)}`}>{m.winRate}%</div>
                  <div className="matchup-badge">
                    <span className={`badge ${wrBadge(m.rating)}`}>{m.rating}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Key tips */}
            {matchups.some(m => m.keyTips?.length) && (
              <div className="mt-4">
                <hr className="divider" />
                <div className="flex flex-col gap-3">
                  {matchups.filter(m => m.keyTips?.length).slice(0,3).map((m, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium">{m.opponent}</span>
                        <span className={`badge ${wrBadge(m.rating)}`}>{m.winRate}%</span>
                      </div>
                      <ul style={{marginLeft:16,fontSize:12,color:"var(--text2)",display:"flex",flexDirection:"column",gap:4}}>
                        {m.keyTips.map((tip, j) => <li key={j}>{tip}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [tab, setTab]           = useState("deck");
  const [deckText, setDeckText] = useState(SAMPLE);
  const [aiOnline, setAiOnline] = useState(null);

  useEffect(() => {
    api.ping().then(r => setAiOnline(!!r.ok)).catch(() => setAiOnline(false));
  }, []);

  const tabs = [
    { id: "deck",    label: "Deck Analyzer", icon: "🃏" },
    { id: "hand",    label: "Hand Analyzer", icon: "🎴" },
    { id: "matchups",label: "Matchups",      icon: "⚔️" },
  ];

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>
          <span className="logo-dot" />
          Lorcana Analyzer
        </h1>
        <div className="status-chip">
          <span className={`status-dot ${aiOnline === true ? "on" : ""}`} />
          {aiOnline === null ? "Conectando…" : aiOnline ? "AI Online" : "AI Offline"}
        </div>
      </header>

      <div className="wrap">
        <div className="tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === "deck"     && <DeckAnalyzerTab deckText={deckText} setDeckText={setDeckText} />}
        {tab === "hand"     && <HandAnalyzerTab deckText={deckText} />}
        {tab === "matchups" && <MatchupsTab deckText={deckText} />}
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import "./styles.css";
import Login from './Login';
import DeckAnalyzer from './DeckAnalyzer';
import MetaDashboard from "./MetaDashboard";

function countLines(text) {
  return String(text || "").split(/\r?\n/).filter((l) => l.trim().length).length;
}

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
  analyze: (text, opts) => apiFetch("/api/deck/analyze", { decklist: text, ...opts }),
  matchups: (text) => apiFetch("/api/ai/matchups", { decklist: text }),
  shuffle: (text) => apiFetch("/api/ai/shuffle", { decklist: text }),
  mulligan: (hand, text) => apiFetch("/api/ai/mulligan", { hand, decklist: text }),
  simMulligan: (hand, indices, text) =>
    apiFetch("/api/ai/simulate-mulligan", { hand, mulligan: indices, decklist: text }),
};

// ═══════════════════════════════════════════════════════════════════════════
//  HAND ANALYZER TAB
// ═══════════════════════════════════════════════════════════════════════════

function HandAnalyzerTab({ deckText }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [hand, setHand] = useState([]);
  const [advice, setAdvice] = useState(null);
  const [simulated, setSimulated] = useState(null);

  async function shuffle() {
    if (!deckText.trim()) {
      setErr('Cole uma decklist primeiro');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const data = await api.shuffle(deckText);
      setHand(data.hand || []);
      setAdvice(null);
      setSimulated(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function analyze() {
    if (hand.length === 0) return;
    setLoading(true);
    setErr('');
    try {
      const data = await api.mulligan(hand, deckText);
      setAdvice(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function simulateMulligan() {
    if (!advice || !advice.mulligan) return;
    setLoading(true);
    setErr('');
    try {
      const data = await api.simMulligan(hand, advice.mulligan, deckText);
      setSimulated(data.newHand || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tab-layout">
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">🎴 Hand Analyzer</span>
        </div>
        <div className="panel-body">
          <button onClick={shuffle} disabled={loading} className="btn btn-primary">
            {loading ? '⏳ Embaralhando…' : '🔀 Embaralhar e Sacar 7'}
          </button>

          {err && <div className="err-box">{err}</div>}

          {hand.length > 0 && (
            <>
              <div className="hand-grid">
                {hand.map((card, i) => {
                  const shouldMull = advice?.mulligan?.includes(i);
                  return (
                    <div key={i} className={`hand-card ${shouldMull ? 'mull-card' : ''}`}>
                      <span className="card-name">{card}</span>
                      {advice && (
                        <span className={shouldMull ? 'mull-badge' : 'keep-badge'}>
                          {shouldMull ? 'MULL' : 'KEEP'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {!advice && (
                <button onClick={analyze} disabled={loading} className="btn btn-primary">
                  {loading ? '⏳ Analisando…' : '🤖 Analisar Mulligan'}
                </button>
              )}

              {advice && (
                <>
                  <div className="mulligan-advice">
                    <strong>Recomendação:</strong> {advice.decision}
                    <br />
                    <em>{advice.reason}</em>
                  </div>

                  {advice.mulligan && advice.mulligan.length > 0 && !simulated && (
                    <button onClick={simulateMulligan} disabled={loading} className="btn btn-primary">
                      {loading ? '⏳ Simulando…' : '🔄 Simular Mulligan'}
                    </button>
                  )}

                  {simulated && (
                    <>
                      <h4>Nova Mão (após mulligan):</h4>
                      <div className="hand-grid">
                        {simulated.map((card, i) => (
                          <div key={i} className="hand-card">
                            <span className="card-name">{card}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
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
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MATCHUPS TAB
// ═══════════════════════════════════════════════════════════════════════════

function MatchupsTab({ deckText }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  async function run() {
    if (!deckText.trim()) return setErr("Cole uma decklist primeiro.");
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
  }, []);

  const matchups = data?.matchups || [];

  return (
    <div className="tab-layout">
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">⚔️ Matchups vs. Meta</span>
          <button className="btn btn-primary btn-sm" onClick={run} disabled={loading}>
            {loading ? "⏳ Calculando…" : "🔄 Recalcular"}
          </button>
        </div>

        {err && <div className="err-box">{err}</div>}

        {data?.summary && (
          <div className="panel-body">
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
                <span className="agg-val" style={{ color: "#4ade80" }}>
                  {data.summary.favored}
                </span>
              </div>
              <div className="agg-item">
                <span className="agg-label">Equilibrado</span>
                <span className="agg-val" style={{ color: "#f59e0b" }}>
                  {data.summary.even}
                </span>
              </div>
              <div className="agg-item">
                <span className="agg-label">Desfavorável</span>
                <span className="agg-val" style={{ color: "#f87171" }}>
                  {data.summary.unfavored}
                </span>
              </div>
            </div>
          </div>
        )}

        {matchups.length === 0 && !loading && !err && (
          <div className="panel-body">
            <div className="empty-state">
              <div className="empty-icon">⚔️</div>
              {deckText.trim()
                ? "Clique em Recalcular para ver os matchups"
                : "Cole uma decklist para ver os matchups"}
            </div>
          </div>
        )}

        {matchups.length > 0 && (
          <div className="panel-body">
            <div className="matchup-grid">
              {matchups.map((m, i) => {
                const wrClass =
                  m.winRate >= 55
                    ? "wr-favored"
                    : m.winRate >= 45
                    ? "wr-even"
                    : m.winRate >= 37
                    ? "wr-unfavored"
                    : "wr-heavy";
                const barClass =
                  m.winRate >= 55
                    ? "bar-favored"
                    : m.winRate >= 45
                    ? "bar-even"
                    : m.winRate >= 37
                    ? "bar-unfavored"
                    : "bar-heavy";

                return (
                  <div key={i} className="matchup-row">
                    <div className="matchup-opponent">{m.opponent}</div>
                    <div className="matchup-bar-wrap">
                      <div
                        className={`matchup-bar ${barClass}`}
                        style={{ width: `${m.winRate}%` }}
                      />
                    </div>
                    <div className={`matchup-wr ${wrClass}`}>{m.winRate}%</div>
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

// ═══════════════════════════════════════════════════════════
//  ROOT APP
// ═══════════════════════════════════════════════════════════

export default function App() {
  const [tab, setTab] = useState("deck");
  const [deckText, setDeckText] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  const tabs = [
    { id: "deck", label: "Deck Analyzer", icon: "🃏" },
    { id: "hand", label: "Hand Analyzer", icon: "🎴" },
    { id: "matchups", label: "Matchups", icon: "⚔️" },
    { id: "meta", label: "Meta Dashboard", icon: "📊" },
  ];

  return (
    <div className="App">
      <header className="app-header">
        <h1>🃏 Lorcana AI</h1>
        <div className="user-info">
          <span>
            Olá, <strong>{user.username || user.email}</strong>
          </span>
          <button onClick={handleLogout} className="btn-logout">
            Sair
          </button>
        </div>
      </header>

      <div className="app-main">
        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {tab === "deck" && <DeckAnalyzer deckText={deckText} setDeckText={setDeckText} />}
          {tab === "hand" && <HandAnalyzerTab deckText={deckText} />}
          {tab === "matchups" && <MatchupsTab deckText={deckText} />}
          {tab === "meta" && <MetaDashboard />}
        </div>
      </div>
    </div>
  );
}

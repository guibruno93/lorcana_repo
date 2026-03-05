import React, { useEffect, useMemo, useState } from "react";
import "./styles-premium.css";
import { analyzeDeckApi, pingAiApi, resolveNamesApi } from "./api";
import MetaComparison from "./MetaComparison";
import CurveChart from "./CurveChart";

function countLines(text) {
  return String(text || "").split(/\r?\n/).filter((l) => l.trim().length).length;
}

export default function App() {
  const [deckText, setDeckText] = useState(`4 Tipo - Growing Son
4 Sail The Azurite Sea
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
3 Jafar - Tyrannical Hypnotist
`);

  const [compare, setCompare] = useState(true);
  const [top, setTop] = useState(32);
  const [sameFormat, setSameFormat] = useState(true);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [aiOnline, setAiOnline] = useState(false);
  const [aiNote, setAiNote] = useState("");

  const [analysis, setAnalysis] = useState(null);

  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [nameSugLoading, setNameSugLoading] = useState(false);

  const linesCount = useMemo(() => countLines(deckText), [deckText]);

  useEffect(() => {
    (async () => {
      try {
        const r = await pingAiApi();
        setAiOnline(!!r.ok);
        setAiNote(r.note || "");
      } catch (e) {
        setAiOnline(false);
        setAiNote(e.message);
      }
    })();
  }, []);

  async function runAnalyze() {
    setErr("");
    setLoading(true);
    try {
      const data = await analyzeDeckApi(deckText, { compare, top, sameFormat });
      setAnalysis(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function runResolveNames() {
    setErr("");
    setNameSugLoading(true);
    try {
      const r = await resolveNamesApi(deckText);
      setNameSuggestions(r.suggestions || []);
      if (!aiOnline) setAiOnline(!!r.ok);
    } catch (e) {
      setErr(e.message);
    } finally {
      setNameSugLoading(false);
    }
  }

  function clearAll() {
    setErr("");
    setAnalysis(null);
    setNameSuggestions([]);
  }

  // ✨ Cores por ink
  const inkColors = {
    Amber: "#F59E0B",
    Amethyst: "#A855F7",
    Emerald: "#10B981",
    Ruby: "#EF4444",
    Sapphire: "#3B82F6",
    Steel: "#64748B",
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="container">
          <h1 className="title">
            <span className="icon">🃏</span>
            Lorcana Deck Analyzer
            <span className="badge">Premium</span>
          </h1>
          
          <div className="header-stats">
            <div className={`status-indicator ${aiOnline ? "online" : "offline"}`}>
              <span className="status-dot" />
              <span>AI {aiOnline ? "Online" : "Offline"}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container">
        {/* Main Card */}
        <div className="main-card">
          {/* Controls */}
          <div className="controls">
            <label className="checkbox-label">
              <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
              <span>Compare with Meta</span>
            </label>

            <label className="select-label">
              <span>Top</span>
              <select value={top} onChange={(e) => setTop(Number(e.target.value))}>
                <option value={8}>8</option>
                <option value={16}>16</option>
                <option value={32}>32</option>
                <option value={64}>64</option>
                <option value={128}>128</option>
              </select>
            </label>

            <label className="checkbox-label">
              <input type="checkbox" checked={sameFormat} onChange={(e) => setSameFormat(e.target.checked)} />
              <span>Same Format Only</span>
            </label>

            <div className="controls-actions">
              <button className="btn btn-primary" onClick={runAnalyze} disabled={loading}>
                {loading ? "⏳ Analyzing..." : "🔍 Analyze Deck"}
              </button>
              <button className="btn btn-secondary" onClick={clearAll} disabled={loading || nameSugLoading}>
                🗑️ Clear
              </button>
              <button className="btn btn-ai" onClick={runResolveNames} disabled={nameSugLoading}>
                {nameSugLoading ? "⏳ Thinking..." : "🤖 AI Suggestions"}
              </button>
            </div>
          </div>

          {/* Deck Input */}
          <div className="deck-input-section">
            <div className="input-header">
              <label>📝 Paste your decklist</label>
              <span className="input-info">{linesCount} lines • Ctrl+Enter to analyze</span>
            </div>

            <textarea
              className="deck-input"
              value={deckText}
              onChange={(e) => setDeckText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") runAnalyze();
              }}
              placeholder="4 Card Name - Subtitle&#10;4 Another Card&#10;..."
            />

            {err && <div className="alert alert-error">❌ {err}</div>}
          </div>
        </div>

        {/* Results Grid */}
        {analysis && (
          <div className="results-grid">
            {/* Stats Overview */}
            <div className="stats-card">
              <h3 className="card-title">📊 Deck Statistics</h3>
              
              <div className="stats-row">
                <div className="stat-item">
                  <div className="stat-label">Total Cards</div>
                  <div className="stat-value">{analysis.totalCards}</div>
                </div>
                
                <div className="stat-item">
                  <div className="stat-label">Recognized</div>
                  <div className="stat-value" style={{ color: "#10B981" }}>
                    {analysis.recognizedQty}
                  </div>
                </div>
                
                <div className="stat-item">
                  <div className="stat-label">Inkable</div>
                  <div className="stat-value">{analysis.inkablePct}%</div>
                  <div className="stat-progress">
                    <div 
                      className="stat-progress-bar" 
                      style={{ width: `${analysis.inkablePct}%`, backgroundColor: "#3B82F6" }}
                    />
                  </div>
                </div>
                
                <div className="stat-item">
                  <div className="stat-label">Unknown</div>
                  <div className="stat-value" style={{ color: analysis.unknownQty > 0 ? "#EF4444" : "#10B981" }}>
                    {analysis.unknownQty}
                  </div>
                </div>
              </div>

              {/* Inks */}
              {analysis.inks && analysis.inks.length > 0 && (
                <div className="inks-section">
                  <div className="stat-label">Inks</div>
                  <div className="inks-row">
                    {analysis.inks.map((ink) => (
                      <div 
                        key={ink} 
                        className="ink-badge"
                        style={{ 
                          backgroundColor: inkColors[ink] || "#64748B",
                          boxShadow: `0 0 20px ${inkColors[ink]}40`
                        }}
                      >
                        {ink}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Archetype & Format */}
              <div className="stats-row">
                <div className="stat-item">
                  <div className="stat-label">Archetype</div>
                  <div className="stat-value-text">{analysis.archetype || "Unknown"}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Format</div>
                  <div className="stat-value-text">{analysis.format || "Core"}</div>
                </div>
              </div>
            </div>

            {/* Curve Chart */}
            {analysis.curveCounts && (
              <div className="chart-card">
                <h3 className="card-title">📈 Mana Curve</h3>
                <CurveChart curveCounts={analysis.curveCounts} />
              </div>
            )}

            {/* Meta Comparison */}
            {analysis.metaComparison && (
              <div className="meta-card">
                <MetaComparison meta={analysis.metaComparison} />
              </div>
            )}
          </div>
        )}

        {/* AI Suggestions */}
        {nameSuggestions.length > 0 && (
          <div className="ai-card">
            <h3 className="card-title">🤖 AI Name Corrections</h3>
            <div className="suggestions-table">
              <table>
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Input</th>
                    <th>Best Match</th>
                    <th>Confidence</th>
                    <th>Alternatives</th>
                  </tr>
                </thead>
                <tbody>
                  {nameSuggestions.map((s, i) => (
                    <tr key={i}>
                      <td>#{s.lineIndex + 1}</td>
                      <td className="input-name">{s.qty}x {s.inputName}</td>
                      <td className="best-match">
                        {s.best ? s.best.name : "-"}
                      </td>
                      <td>
                        {s.best && (
                          <span 
                            className="confidence-badge"
                            style={{
                              backgroundColor: s.best.score > 0.8 ? "#10B981" : s.best.score > 0.6 ? "#F59E0B" : "#EF4444"
                            }}
                          >
                            {Math.round((s.best.score || 0) * 100)}%
                          </span>
                        )}
                      </td>
                      <td className="alternatives">
                        {(s.candidates || []).slice(0, 2).map((c, j) => (
                          <span key={j} className="alt-badge">
                            {c.name} ({Math.round((c.score || 0) * 100)}%)
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>Made with ❤️ for the Lorcana community</p>
        </div>
      </footer>
    </div>
  );
}

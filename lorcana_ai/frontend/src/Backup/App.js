import React, { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { analyzeDeckApi, pingAiApi, resolveNamesApi } from "./api";
import MetaComparison from "./MetaComparison";

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

  return (
    <div className="wrap">
      <h1>Lorcana Deck Analyzer</h1>

      <div className="row muted" style={{ marginBottom: 12 }}>
        <span className={`statusDot ${aiOnline ? "on" : ""}`} />
        <span>AI: {aiOnline ? "online" : "offline"}</span>
        {aiNote ? <span className="muted">• {aiNote}</span> : null}
      </div>

      <div className="card">
        <div className="controls" style={{ marginBottom: 10 }}>
          <label>
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
            Comparar com meta
          </label>

          <label>
            Top
            <select value={top} onChange={(e) => setTop(Number(e.target.value))}>
              <option value={8}>8</option>
              <option value={16}>16</option>
              <option value={32}>32</option>
              <option value={64}>64</option>
              <option value={128}>128</option>
            </select>
          </label>

          <label>
            <input type="checkbox" checked={sameFormat} onChange={(e) => setSameFormat(e.target.checked)} />
            Somente mesmo formato
          </label>

          <button onClick={runAnalyze} disabled={loading}>
            {loading ? "Analisando..." : "Analisar"}
          </button>
          <button onClick={clearAll} disabled={loading || nameSugLoading}>Limpar</button>

          <button onClick={runResolveNames} disabled={nameSugLoading}>
            {nameSugLoading ? "Sugerindo..." : "Sugerir correções (AI)"}
          </button>
        </div>

        <div className="muted" style={{ marginBottom: 8 }}>
          Cole sua decklist (Ctrl+Enter para analisar) — Linhas: {linesCount}
        </div>

        <textarea
          value={deckText}
          onChange={(e) => setDeckText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") runAnalyze();
          }}
        />

        {err ? <div className="err" style={{ marginTop: 10 }}>Erro: {err}</div> : null}
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Resumo</h3>
          {!analysis ? (
            <div className="muted">Sem análise ainda.</div>
          ) : (
            <div className="row">
              <div><b>Cartas reconhecidas</b><div>{analysis.recognizedQty}/{analysis.totalCards}</div></div>
              <div><b>Total cards</b><div>{analysis.totalCards}</div></div>
              <div><b>Inkable %</b><div>{analysis.inkablePct}%</div></div>
              <div><b>Não reconhecidas</b><div>{analysis.unknownQty} cópias</div></div>
              <div><b>Arquétipo</b><div>{analysis.archetype}</div></div>
              <div><b>Formato</b><div>{analysis.format}</div></div>
            </div>
          )}
        </div>

        <MetaComparison meta={analysis?.metaComparison} />
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Correções de nomes (AI)</h3>
        {nameSuggestions.length === 0 ? (
          <div className="muted">Sem sugestões (ou tudo reconhecido).</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Linha</th>
                <th>Entrada</th>
                <th>Melhor sugestão</th>
                <th>Candidatos</th>
              </tr>
            </thead>
            <tbody>
              {nameSuggestions.map((s, i) => (
                <tr key={i}>
                  <td>{s.lineIndex + 1}</td>
                  <td>{s.qty} {s.inputName}</td>
                  <td>{s.best ? `${s.best.name} (${Math.round((s.best.score || 0) * 100)}%)` : "-"}</td>
                  <td>
                    {(s.candidates || []).slice(0, 3).map((c, j) => (
                      <span key={j} style={{ marginRight: 8 }}>
                        {c.name} ({Math.round((c.score || 0) * 100)}%)
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

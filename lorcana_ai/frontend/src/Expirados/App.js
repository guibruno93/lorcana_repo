// frontend/src/App.js
import React, { useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Link } from "react-router-dom";
import "./styles.css";

import { analyzeDeckApi } from "./api";
import MetaComparison from "./MetaComparison";

// ---------- helpers ----------
const TYPE_ORDER = ["Character", "Action", "Item", "Song", "Other"];

function getQty(c) {
  return Number(c?.quantity ?? c?.qty ?? c?.count ?? 0) || 0;
}
function getRawCost(c) {
  return c?.cost ?? c?.inkCost ?? c?.ink_cost ?? c?.cmc;
}
function getTypeBucket(typeValue) {
  const t = String(typeValue || "").toLowerCase();
  if (t.includes("song")) return "Song";
  if (t.includes("character")) return "Character";
  if (t.includes("action")) return "Action";
  if (t.includes("item")) return "Item";
  return "Other";
}

// ---------- layout ----------
function Layout({ children }) {
  return (
    <>
      <div className="nav">
        <div className="navInner">
          <div className="brand">
            <span className="logoDot" />
            <span>Lorcana AI</span>
            <span className="badge">beta</span>
          </div>

          <div className="navLinks">
            <NavLink to="/" end className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
              Home
            </NavLink>
            <NavLink to="/analyzer" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
              Analyzer
            </NavLink>
            <NavLink to="/faq" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
              FAQ
            </NavLink>
          </div>
        </div>
      </div>

      <div className="container">{children}</div>

      <div className="footer">
        <div className="hr" />
        <div>
          API: <span className="muted">{process.env.REACT_APP_API_BASE_URL || "http://localhost:5000"}</span>
        </div>
      </div>
    </>
  );
}

// ---------- pages ----------
function HomePage() {
  return (
    <Layout>
      <div className="hero">
        <h1>Lorcana Deck Analyzer</h1>
        <p>
          Cole sua decklist, veja curva de custo, inkable %, cartas desconhecidas e compare com decks do meta
          (Top 32 / Top 16 / Top 8).
        </p>

        <div className="row">
          <Link to="/analyzer" className="btn btnPrimary">Abrir Analyzer</Link>
          <Link to="/faq" className="btn">Ver FAQ</Link>
        </div>
      </div>

      <div className="hr" />

      <div className="grid2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>O que o app faz</h3>
          <ul className="muted" style={{ lineHeight: 1.7 }}>
            <li>Reconhece cartas via banco do backend (cards.json)</li>
            <li>Calcula Inkable %, curva de custo e resumo</li>
            <li>Mostra tabela com cartas reconhecidas</li>
            <li>Compara sua lista com decks de torneio (meta) de forma determinística</li>
          </ul>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Atalhos</h3>
          <div className="muted" style={{ lineHeight: 1.7 }}>
            • Ctrl+Enter para analisar<br />
            • Use Top 32/16/8 para filtrar a comparação<br />
            • Use “Agrupar por tipo” para separar Character/Action/Item/Song
          </div>
        </div>
      </div>
    </Layout>
  );
}
//---------FAQ--------------
function FAQPage() {
  const items = [
    {
      q: "Como colar a decklist?",
      a: 'Uma carta por linha no padrão "4 Nome da Carta". Ex.: "4 A Whole New World". Você pode também exportar do dreamborn (ou outra plataforma de deckbuilding) e colar no área de texto ',
    },
    {
      q: "O que significa “cartas reconhecidas”?",
      a: "São as cartas que estão dentro do banco de dados após normalização. Essas cartas aparecem na tabela com custo, tipo, ink e inkable.",
    },
    {
      q: "Como funciona o cálculo de Inkable % e curva de custo?",
      a: "Inkable % é calculado usando o campo inkable de cada carta reconhecida no banco. A curva usa o custo real (ink cost) vindo do mesmo banco.",
    },
    {
      q: "O que é a comparação com o meta?",
      a: "O backend mantém uma base de decks de torneios, atualmente como referência o site Inkdecks. Ao comparar, ele calcula similaridade determinística (ponderada por quantidades) e retorna os decks mais parecidos.",
    },
    {
      q: "O que fazem os filtros Top 32 / Top 16 / Top 8?",
      a: "Eles filtram os decks do meta para comparar apenas contra decks que tiveram colocação dentro do Top escolhido. Isso deixa a comparação mais relevante.",
    },
    {
      q: "Meu deck precisa ter exatamente 60 cartas?",
      a: "Não. Lorcana permite 60+. O analyzer funciona para qualquer tamanho, mas o backend pode validar “mínimo 60” dependendo de como você configurar.",
    },
  ];

  return (
    <Layout>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>FAQ</h2>
        <div className="muted">Como o Analyzer e a comparação com o meta funcionam.</div>

        <div className="hr" />

        <div style={{ display: "grid", gap: 10 }}>
          {items.map((it) => (
            <details key={it.q} className="card" style={{ boxShadow: "none" }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>{it.q}</summary>
              <div className="muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
                {it.a}
              </div>
            </details>
          ))}
        </div>

        <div className="hr" />

        <div className="row">
          <Link to="/" className="btn">Home</Link>
          <Link to="/analyzer" className="btn btnPrimary">Analyzer</Link>
        </div>
      </div>
    </Layout>
  );
}
//----------GRÁFICO--------------
function CurveChart({ cards }) {
  const { curve, max } = useMemo(() => {
    const buckets = new Array(11).fill(0);
    for (const c of cards || []) {
      const qty = getQty(c);
      const raw = getRawCost(c);
      const cost = Number(raw);
      if (!Number.isFinite(cost)) continue;
      const idx = cost >= 10 ? 10 : Math.max(0, Math.min(9, cost));
      buckets[idx] += qty;
    }
    return { curve: buckets, max: Math.max(1, ...buckets) };
  }, [cards]);

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 style={{ marginTop: 0 }}>Curva de Tinta</h3>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 1fr)", gap: 8, alignItems: "end" }}>
        {curve.map((v, i) => {
          const label = i === 10 ? "10+" : String(i);
          const h = Math.round((v / max) * 120);
          return (
            <div key={label} style={{ textAlign: "center" }}>
              <div className="muted" style={{ fontSize: 12 }}>{v}</div>
              <div style={{ height: 120, display: "flex", alignItems: "flex-end" }}>
                <div
                  style={{
                    width: "100%",
                    height: h,
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "linear-gradient(180deg, rgba(124,92,255,.35), rgba(45,226,230,.12))",
                  }}
                />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecognizedCardsTable({ cards, groupByType }) {
  const { rows, groups, countsByType, totalQty } = useMemo(() => {
    const list = Array.isArray(cards) ? cards : [];

    // reconhecidas: tem dados suficientes (no seu backend atual, normalmente todas já vêm completas)
    const recognized = list.filter((c) => {
      const inkableIsBool = typeof c?.inkable === "boolean";
      const hasSomeData = c?.type != null || c?.ink != null || getRawCost(c) != null;
      return inkableIsBool || hasSomeData;
    });

    const prepared = recognized.map((c) => ({
      ...c,
      _bucket: getTypeBucket(c?.type),
      _costNum: Number(getRawCost(c)),
      _qty: getQty(c),
    }));

    // ordenação padrão por tipo, depois custo, depois qty, depois nome
    prepared.sort((a, b) => {
      const ta = TYPE_ORDER.indexOf(a._bucket);
      const tb = TYPE_ORDER.indexOf(b._bucket);
      if (ta !== tb) return ta - tb;

      const aHasCost = Number.isFinite(a._costNum);
      const bHasCost = Number.isFinite(b._costNum);
      if (aHasCost && bHasCost && a._costNum !== b._costNum) return a._costNum - b._costNum;
      if (aHasCost !== bHasCost) return aHasCost ? -1 : 1;

      if (a._qty !== b._qty) return b._qty - a._qty;

      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });

    const counts = {};
    for (const t of TYPE_ORDER) counts[t] = 0;

    let tot = 0;
    for (const c of prepared) {
      counts[c._bucket] = (counts[c._bucket] || 0) + c._qty;
      tot += c._qty;
    }

    const g = {};
    for (const t of TYPE_ORDER) g[t] = [];
    for (const c of prepared) g[c._bucket].push(c);

    return { rows: prepared, groups: g, countsByType: counts, totalQty: tot };
  }, [cards]);

  if (!rows.length) return null;

  function renderTable(list) {
    return (
      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead className="thead">
            <tr>
              {["Qtd", "Nome", "Tipo", "Custo", "Ink", "Inkable", "Set"].map((h) => (
                <th key={h} className="th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((c, idx) => {
              const costLabel = Number.isFinite(c._costNum) ? String(c._costNum) : "-";
              const inkableLabel =
                typeof c?.inkable === "boolean" ? (c.inkable ? "Sim" : "Não") : "-";

              const key = c?.cardId || c?.normalizedName || `${c?.name}-${idx}`;

              return (
                <tr key={key}>
                  <td className="td" style={{ width: 70 }}><b>{c._qty}</b></td>
                  <td className="td">{c?.name || "-"}</td>
                  <td className="td" style={{ width: 110 }}>{c._bucket}</td>
                  <td className="td" style={{ width: 70 }}>{costLabel}</td>
                  <td className="td" style={{ width: 120 }}>{c?.ink || "-"}</td>
                  <td className="td" style={{ width: 90 }}>{inkableLabel}</td>
                  <td className="td" style={{ width: 90 }}>{c?.setCode || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h3 style={{ marginTop: 0, marginBottom: 6 }}>Cartas reconhecidas</h3>
          <div className="muted" style={{ fontSize: 13 }}>
            Ordenação: <b style={{ color: "var(--text)" }}>Character → Action → Item → Song</b>
            {groupByType ? " • Agrupado por tipo" : " • Tabela única"}
          </div>
        </div>

        <div className="row">
          <span className="badge">Total: {totalQty}</span>
          <span className="badge">Char: {countsByType.Character || 0}</span>
          <span className="badge">Action: {countsByType.Action || 0}</span>
          <span className="badge">Item: {countsByType.Item || 0}</span>
          <span className="badge">Song: {countsByType.Song || 0}</span>
        </div>
      </div>

      <div className="hr" />

      {!groupByType ? (
        renderTable(rows)
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {TYPE_ORDER.filter((t) => (groups[t] || []).length > 0).map((t) => (
            <div key={t} className="card" style={{ boxShadow: "none" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h4 style={{ margin: 0 }}>{t}</h4>
                <span className="badge">{countsByType[t]} cartas</span>
              </div>
              <div style={{ marginTop: 10 }}>{renderTable(groups[t])}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyzerPage() {
  const [deckText, setDeckText] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [compareMode, setCompareMode] = useState("32"); // none | 32 | 16 | 8
  const [groupByType, setGroupByType] = useState(true); // ✅ toggle

  const linesCount = useMemo(() => {
    return deckText.split("\n").map((l) => l.trim()).filter(Boolean).length;
  }, [deckText]);

  async function runAnalyze() {
    setErr("");
    setLoading(true);
    setResult(null);

    try {
      const compare = compareMode !== "none";
      const top = compare ? Number(compareMode) : undefined;
      const data = await analyzeDeckApi(deckText, { compare, top });
      setResult(data);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.ctrlKey && e.key === "Enter") runAnalyze();
  }

  const inkablePct = result?.inkablePercentage ?? result?.inkablePct ?? null;
  const metaComparison = result?.metaComparisonDeterministic || result?.metaComparison || null;

  return (
    <Layout>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0 }}>Analyzer</h2>
            <div className="muted" style={{ marginTop: 4 }}>
              Cole a decklist e analise (Ctrl+Enter).
            </div>
          </div>

          <div className="row">
            <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Comparar:
              <select
                className="select"
                value={compareMode}
                onChange={(e) => setCompareMode(e.target.value)}
                style={{ width: 160 }}
              >
                <option value="none">Não comparar</option>
                <option value="32">Top 32</option>
                <option value="16">Top 16</option>
                <option value="8">Top 8</option>
              </select>
            </label>

            {/* ✅ Toggle agrupamento */}
            <button
              className={`btn ${groupByType ? "btnActive" : ""}`}
              onClick={() => setGroupByType((v) => !v)}
              type="button"
              title="Alterna entre tabela única e agrupamento por tipo"
            >
              {groupByType ? "Agrupar: ON" : "Agrupar: OFF"}
            </button>

            <button className="btn btnPrimary" onClick={runAnalyze} disabled={loading}>
              {loading ? "Analisando..." : "Analisar"}
            </button>

            <button
              className="btn"
              onClick={() => {
                setDeckText("");
                setResult(null);
                setErr("");
              }}
              type="button"
            >
              Limpar
            </button>
          </div>
        </div>

        <div className="muted" style={{ marginTop: 10 }}>
          Linhas: <b style={{ color: "var(--text)" }}>{linesCount}</b>
        </div>

        <textarea
          className="textarea"
          value={deckText}
          onChange={(e) => setDeckText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`4 Donald Duck - Perfect Gentleman\n4 ...`}
          style={{ marginTop: 10 }}
        />

        {err ? (
          <div className="card error" style={{ marginTop: 12, boxShadow: "none" }}>
            <b>Erro:</b> {err}
          </div>
        ) : null}
      </div>

      {result ? (
        <>
          <div className="grid2" style={{ marginTop: 12 }}>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Resumo</h3>
              <div><b>Total cards:</b> {result.totalCards ?? "-"}</div>
              <div><b>Inkable %:</b> {inkablePct != null ? `${inkablePct}%` : "—"}</div>
              <div><b>Arquétipo:</b> {result.archetype ?? "-"}</div>
              <div><b>Formato:</b> {result.format ?? "-"}</div>

              {result.unknownCards && Object.keys(result.unknownCards).length ? (
                <div style={{ marginTop: 10 }}>
                  <div><b>Cartas desconhecidas:</b></div>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      margin: "8px 0 0",
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "rgba(0,0,0,.18)",
                      color: "var(--muted)",
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(result.unknownCards, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="muted" style={{ marginTop: 10 }}>
                  ✅ Nenhuma carta desconhecida.
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0 }}>Navegação</h3>
              <div className="muted" style={{ lineHeight: 1.7 }}>
                • Ctrl+Enter para analisar<br />
                • Filtro Top melhora relevância do meta<br />
                • Agrupar ON separa por tipo e mantém ordenação interna
              </div>

              <div className="hr" />
              <div className="row">
                <Link to="/" className="btn">Home</Link>
                <Link to="/faq" className="btn">FAQ</Link>
              </div>
            </div>
          </div>

          <CurveChart cards={result.cards} />

          <RecognizedCardsTable cards={result.cards} groupByType={groupByType} />

          <MetaComparison metaComparison={metaComparison} />
        </>
      ) : null}
    </Layout>
  );
}

function NotFound() {
  return (
    <Layout>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Página não encontrada</h2>
        <div className="muted">Volte para a Home ou abra o Analyzer.</div>
        <div className="row" style={{ marginTop: 12 }}>
          <Link to="/" className="btn">Home</Link>
          <Link to="/analyzer" className="btn btnPrimary">Analyzer</Link>
        </div>
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/analyzer" element={<AnalyzerPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

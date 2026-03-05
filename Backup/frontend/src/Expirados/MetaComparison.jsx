// frontend/src/MetaComparison.jsx
import React from "react";

export default function MetaComparison({ metaComparison }) {
  if (!metaComparison || metaComparison.enabled !== true) return null;

  const { requestedTop, comparedCount, note, filters, similarDecks } = metaComparison;

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 style={{ marginTop: 0 }}>Comparação com Meta de Torneios</h3>

      <div className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
        <div>
          <b style={{ color: "var(--text)" }}>Filtro:</b>{" "}
          {requestedTop ? `Top ${requestedTop}` : "Sem filtro Top"}{" "}
          {filters?.sameInksPreferred ? "(preferindo mesma combinação de inks)" : ""}
        </div>

        <div>
          <b style={{ color: "var(--text)" }}>Amostra comparada:</b> {comparedCount} decks
        </div>

        {note ? (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "rgba(0,0,0,.18)",
            }}
          >
            <b style={{ color: "var(--text)" }}>Nota:</b> <span className="muted">{note}</span>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 12 }}>
        <h4 style={{ margin: "0 0 8px 0" }}>Decks mais parecidos</h4>

        {Array.isArray(similarDecks) && similarDecks.length ? (
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {similarDecks.slice(0, 10).map((d, idx) => (
              <li key={`${d.url || d.title}-${idx}`} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                  <span><b>{d.similarity}%</b></span>

                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noreferrer">
                      {d.title}
                    </a>
                  ) : (
                    <span>{d.title}</span>
                  )}

                  {d.placement ? <span className="muted">(#{d.placement})</span> : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="muted">Nenhum deck similar encontrado.</div>
        )}
      </div>
    </div>
  );
}

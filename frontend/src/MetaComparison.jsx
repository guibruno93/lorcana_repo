import React from "react";

export default function MetaComparison({ meta }) {
  if (!meta) return null;

  const enabled = !!meta.enabled;
  const top = meta.requestedTop ?? meta.filters?.top ?? null;
  const sameFormat = meta.filters?.sameFormat;

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Meta Comparison</h3>

      {!enabled ? (
        <div className="muted">Desligado</div>
      ) : (
        <>
          <div className="muted">
            enabled â€¢ Top {top ?? "-"} â€¢ sameFormat={String(!!sameFormat)}
          </div>

          {meta.note ? <div className="err">Aviso: {meta.note}</div> : null}

          {meta.aggregate ? (
            <div style={{ marginTop: 10 }}>
              <div className="row">
                <div><b>Count:</b> {meta.aggregate.count ?? 0}</div>
                <div><b>Best:</b> {meta.aggregate.bestFinish ?? "-"}</div>
                <div><b>Avg:</b> {meta.aggregate.avgFinish ?? "-"}</div>
                <div><b>Top8:</b> {meta.aggregate.top8Rate != null ? `${Math.round(meta.aggregate.top8Rate * 100)}%` : "-"}</div>
              </div>
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 10 }}>Sem agregado</div>
          )}

          <div style={{ marginTop: 14 }}>
            <h4 style={{ margin: "10px 0" }}>Similar decks</h4>
            {Array.isArray(meta.similarDecks) && meta.similarDecks.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Score</th>
                    <th>Archetype</th>
                    <th>Inks</th>
                    <th>Finish</th>
                    <th>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {meta.similarDecks.map((d, i) => (
                    <tr key={i}>
                      <td>{d.score != null ? `${d.score}%` : "-"}</td>
                      <td>{d.archetype || d.name || "-"}</td>
                      <td>{Array.isArray(d.inks) ? d.inks.join(" / ") : "-"}</td>
                      <td>{d.finish || "-"}</td>
                      <td>
                        {d.url ? (
                          <a href={d.url} target="_blank" rel="noreferrer">Inkdecks</a>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="muted">Nenhum deck similar retornado.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
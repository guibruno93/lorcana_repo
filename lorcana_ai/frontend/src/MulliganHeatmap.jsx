export default function MulliganHeatmap({ data }) {
  if (!Array.isArray(data) || data.length === 0) return null;

  const inkables = [...new Set(data.map(d => d.inkables))].sort();
  const lowCosts = [...new Set(data.map(d => d.lowCost))].sort();

  const getCell = (i, l) =>
    data.find(d => d.inkables === i && d.lowCost === l)?.rate ?? 0;

  const color = rate =>
    rate >= 30 ? "#16a34a" : rate >= 20 ? "#f59e0b" : "#dc2626";

  return (
    <div>
      <h3>🔥 Mulligan Heatmap</h3>

      <table style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th></th>
            {lowCosts.map(l => (
              <th key={l}>Low {l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inkables.map(i => (
            <tr key={i}>
              <td><strong>Ink {i}</strong></td>
              {lowCosts.map(l => {
                const rate = getCell(i, l);
                return (
                  <td
                    key={`${i}-${l}`}
                    style={{
                      background: color(rate),
                      color: "white",
                      padding: 8,
                      textAlign: "center"
                    }}
                  >
                    {rate}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

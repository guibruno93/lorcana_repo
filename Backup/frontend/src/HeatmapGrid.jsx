export default function HeatmapGrid({ data }) {
  const max = Math.max(...data.map(d => d.rate));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
      {data.map((c, i) => (
        <div
          key={i}
          style={{
            padding: 10,
            background: `rgba(0, 200, 0, ${c.rate / max})`,
            color: "white",
            borderRadius: 6,
            textAlign: "center"
          }}
        >
          {c.inkables} Ink / {c.lowCost} Low<br />
          {c.rate}%
        </div>
      ))}
    </div>
  );
}

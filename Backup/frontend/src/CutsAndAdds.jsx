function CutsAndAdds({ data = [] }) {
  if (!data.length) {
    return <p>✅ Nenhuma alteração crítica sugerida</p>;
  }

  return (
    <div style={{ marginTop: 20 }}>
      <h3>✂️ Cuts & 🔁 Adds Recomendados</h3>

      {data.map((s, i) => (
        <div
          key={`swap-${i}`}
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
            marginBottom: 10,
            background: "#fafafa"
          }}
        >
          <p>
            🔻 <strong>Cut:</strong>{" "}
            <span style={{ color: "#c0392b" }}>{s.cut}</span>
          </p>

          <p>
            🔺 <strong>Add:</strong>{" "}
            <span style={{ color: "#27ae60" }}>{s.add}</span>
          </p>

          <p style={{ fontStyle: "italic", color: "#555" }}>
            {s.reason}
          </p>
        </div>
      ))}
    </div>
  );
}

export default CutsAndAdds;

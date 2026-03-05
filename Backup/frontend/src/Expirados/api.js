// frontend/src/api.js
const API_BASE = (process.env.REACT_APP_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

async function readJsonOrThrow(res) {
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // backend pode responder HTML em erro
  }

  if (!res.ok) {
    const msg = json?.error || json?.message || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export async function analyzeDeckApi(decklist, { compare = true, top = 32 } = {}) {
  const params = new URLSearchParams();

  if (!compare) {
    params.set("compare", "0");
  } else if (top != null && Number.isFinite(Number(top)) && Number(top) > 0) {
    params.set("top", String(Math.trunc(Number(top))));
  }

  const url = `${API_BASE}/api/analyzeDeck${params.toString() ? `?${params.toString()}` : ""}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decklist }),
  });

  return readJsonOrThrow(res);
}

// opcional (se você quiser abrir um deck do meta depois)
export async function getMetaDeckApi(deckId) {
  const url = `${API_BASE}/api/meta/deck/${encodeURIComponent(deckId)}`;
  const res = await fetch(url);
  return readJsonOrThrow(res);
}

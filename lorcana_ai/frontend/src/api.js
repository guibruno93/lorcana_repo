// src/api.js
// API base fica "invisível" no UI. Troque via .env (REACT_APP_API_BASE) se necessário.
export const API_BASE =
  (process.env.REACT_APP_API_BASE && process.env.REACT_APP_API_BASE.trim()) ||
  "http://localhost:5000";

function qs(params = {}) {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    u.set(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : "";
}

async function fetchJson(url, opts = {}) {
  const r = await fetch(url, opts);
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!r.ok) {
    const msg = (data && data.error) ? data.error : (typeof data === "string" ? data : r.statusText);
    throw new Error(msg);
  }
  return data;
}

export async function analyzeDeckApi(decklist, { apiBaseUrl = API_BASE, compare = false, top = 32, sameFormat = true } = {}) {
  const url = `${apiBaseUrl}/api/analyzeDeck${qs({
    compare: compare ? 1 : 0,
    top,
    sameFormat: sameFormat ? 1 : 0,
  })}`;
  return fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decklist }),
  });
}

export async function pingAiApi({ apiBaseUrl = API_BASE } = {}) {
  const url = `${apiBaseUrl}/api/ai/ping`;
  return fetchJson(url, { method: "GET" });
}

export async function resolveNamesApi(decklist, { apiBaseUrl = API_BASE, maxCandidates = 5, threshold = 0.55 } = {}) {
  const url = `${apiBaseUrl}/api/ai/resolve-names${qs({ maxCandidates, threshold })}`;
  return fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decklist }),
  });
}

/**
 * services/cardIndex.js
 *
 * Singleton para index de cards.json usado por:
 * - routes/ai (ping e resolve-names)
 *
 * Formato:
 *   {
 *     size: number,
 *     byName: Map<normalizedName, Array<card>>,
 *     updatedAt: ISO string
 *   }
 */
const fs = require("fs");
const path = require("path");
const { normalizeName } = require("./deckParser");

let _cache = null;
let _mtime = 0;
let _path = null;

function resolveCardsPath() {
  const candidates = [
    process.env.CARDS_PATH,
    path.join(process.cwd(), "db", "cards.json"),
    path.join(process.cwd(), "data", "cards.json"),
    path.join(__dirname, "..", "db", "cards.json"),
    path.join(__dirname, "..", "data", "cards.json"),
    path.join(process.cwd(), "cards.json"),
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (e) {}
  }
  return null;
}

function buildCardIndex(cards) {
  const byName = new Map();
  for (const c of cards) {
    if (!c || !c.name) continue;
    const n = normalizeName(c.name);
    if (!n) continue;
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push({ ...c, normalizedName: n });
  }
  return {
    size: byName.size,
    byName,
    updatedAt: new Date().toISOString(),
  };
}

function getCardIndex() {
  const p = resolveCardsPath();
  if (!p) {
    // devolve um index vazio, mas não quebra a API
    return {
      size: 0,
      byName: new Map(),
      updatedAt: new Date().toISOString(),
      note: "cards.json não encontrado",
    };
  }

  try {
    const st = fs.statSync(p);
    if (_cache && _path === p && _mtime === st.mtimeMs) return _cache;

    const raw = fs.readFileSync(p, "utf-8");
    const json = JSON.parse(raw);
    const cards = Array.isArray(json) ? json : (json.cards || []);
    const idx = buildCardIndex(cards);

    _cache = idx;
    _path = p;
    _mtime = st.mtimeMs;
    return idx;
  } catch (e) {
    return {
      size: 0,
      byName: new Map(),
      updatedAt: new Date().toISOString(),
      note: `Erro ao ler cards.json: ${e.message}`,
    };
  }
}

module.exports = { getCardIndex, normalizeName };

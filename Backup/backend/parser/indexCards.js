// backend/parser/indexCards.js
const { normalizeName } = require("./normalize");

function pickFirst(...vals) {
  for (const v of vals) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    return v;
  }
  return null;
}

function toId(card) {
  // prioridade: code (seu DB), depois fallbacks
  const id = pickFirst(card.code, card.cardId, card.cardIdentifier, card.id, card.uuid);
  return id == null ? null : String(id);
}

/**
 * buildIndex(cardsDb)
 *
 * ✅ Retorna um Map (compat com código antigo: idx.get(...))
 * ✅ Também expõe:
 *   - idx.byNormName (o próprio Map)
 *   - idx.byId (Map id -> card)
 */
function buildIndex(cardsDb) {
  const byNormName = new Map(); // normName -> card (primeiro vence)
  const byId = new Map();       // id(code) -> card

  for (const c of Array.isArray(cardsDb) ? cardsDb : []) {
    // index por ID
    const id = toId(c);
    if (id && !byId.has(id)) byId.set(id, c);

    // index por nomes
    const keys = [c.fullName, c.printedName, c.simpleName, c.name].filter(Boolean);
    for (const k of keys) {
      const nk = normalizeName(k);
      if (!nk) continue;

      // mantém o primeiro (mais estável). Se quiser "último vence", troque para: byNormName.set(nk, c)
      if (!byNormName.has(nk)) byNormName.set(nk, c);
    }
  }

  // 👇 compat máxima: retorna o Map (pra quem usa idx.get)
  // e anexa os mapas auxiliares
  byNormName.byNormName = byNormName;
  byNormName.byId = byId;

  // helpers opcionais
  byNormName.getById = (id) => (id == null ? null : byId.get(String(id)) || null);

  return byNormName;
}

module.exports = { buildIndex };

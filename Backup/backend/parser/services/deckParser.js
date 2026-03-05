/**
 * backend/services/deckParser.js
 *
 * Responsável por:
 * - carregar cards.json (db)
 * - construir índices de lookup por nome (normalizado)
 * - parsear decklist (qty + nome)
 * - analisar deck (cards reconhecidas, curva, inks, etc.)
 *
 * Observação importante:
 * O cards.json atual costuma ter:
 *  - name (ex: "Tipo")
 *  - version (ex: "Growing Son")
 *  - fullName (ex: "Tipo - Growing Son")
 *  - simpleName (ex: "tipo growing son")  // já normalizado
 *
 * Para reconhecer corretamente "Nome - Versão" na decklist, o índice PRECISA
 * considerar fullName/simpleName, não apenas name.
 */

"use strict";

const fs = require("fs");
const path = require("path");

// -------- utils --------

function normalizeName(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`"]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function toInt(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function parseBool(v, def = false) {
  if (v === undefined || v === null) return def;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return def;
}

function safeJsonRead(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    // tenta limpar BOM
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  }
}

// -------- db paths --------

function resolveCardsDbPath() {
  // permite override sem quebrar o repo
  return (
    process.env.CARDS_DB_PATH ||
    path.join(__dirname, "..", "db", "cards.json")
  );
}

// -------- normalize card shape --------

function computeDisplayName(raw) {
  // Preferir fullName se existir.
  const full = raw.fullName || raw.full_name || raw.printName || raw.displayName;
  if (full) return String(full);

  const name = raw.name || raw.cardName || raw.title || raw.card || "";
  const ver = raw.version || raw.subtitle || raw.variant || "";
  if (name && ver) return `${name} - ${ver}`;
  return String(name || "");
}

function parseInks(raw) {
  // Pode vir como string (color) ou array (inks)
  const inks =
    raw.inks ||
    raw.ink ||
    raw.color ||
    raw.colors ||
    raw.colour ||
    raw.identity ||
    null;

  if (Array.isArray(inks)) return inks.filter(Boolean).map(String);
  if (typeof inks === "string") return [inks];
  return [];
}

function normalizeRawCard(raw) {
  const name = computeDisplayName(raw);

  // simpleName costuma já ser o nome "normalizado" do fullName
  const normalizedName = normalizeName(raw.simpleName || raw.simple_name || name);

  return {
    id: raw.id || raw.cardIdentifier || raw.card_identifier || raw.code || null,
    code: raw.code || null,

    // exibição
    name,

    // lookup
    normalizedName,

    // principais attrs
    ink: (parseInks(raw)[0] || null),
    inks: parseInks(raw),
    type: raw.type || raw.cardType || raw.card_type || null,
    cost: toInt(raw.cost ?? raw.inkCost ?? raw.ink_cost ?? 0, 0),
    lore: toInt(raw.lore ?? 0, 0),
    strength: raw.strength ?? raw.attack ?? null,
    willpower: raw.willpower ?? raw.defense ?? raw.defence ?? null,
    rarity: raw.rarity ?? null,
    inkable: raw.inkable ?? raw.isInkable ?? raw.is_inkable ?? null,

    setCode: raw.setCode ?? raw.set_code ?? raw.set ?? null,
    setName: raw.setName ?? raw.set_name ?? null,
  };
}

// -------- index --------

function buildIndex(cards) {
  const byName = new Map();
  const byCode = new Map();

  function prefer(a, b) {
    // decide qual card manter em colisão de chave:
    // preferir maior setCode numérico (reprint "mais novo"), senão manter o primeiro
    const aSet = toInt(a?.setCode, -1);
    const bSet = toInt(b?.setCode, -1);
    return bSet > aSet ? b : a;
  }

  for (const raw of cards) {
    const card = normalizeRawCard(raw);

    if (card.code) byCode.set(String(card.code), card);
    if (card.id) byCode.set(String(card.id), card);

    const keys = new Set();

    // chave principal
    if (card.normalizedName) keys.add(card.normalizedName);

    // redundâncias (ajuda em bases diferentes)
    const full = raw.fullName || raw.full_name;
    const simple = raw.simpleName || raw.simple_name;
    const baseName = raw.name || raw.cardName || raw.title;

    if (simple) keys.add(normalizeName(simple));
    if (full) keys.add(normalizeName(full));
    if (card.name) keys.add(normalizeName(card.name));
    if (baseName) keys.add(normalizeName(baseName));

    const ver = raw.version || raw.subtitle || raw.variant;
    if (baseName && ver) keys.add(normalizeName(`${baseName} - ${ver}`));

    for (const k of keys) {
      if (!k) continue;
      if (!byName.has(k)) byName.set(k, card);
      else byName.set(k, prefer(byName.get(k), card));
    }
  }

  return { byName, byCode };
}

let _index = null;

function getCardsIndex(forceReload = false) {
  if (_index && !forceReload) return _index;

  const dbPath = resolveCardsDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `cards.json não encontrado em: ${dbPath}. Configure CARDS_DB_PATH ou gere backend/db/cards.json.`
    );
  }

  const cards = safeJsonRead(dbPath);
  if (!Array.isArray(cards)) {
    throw new Error("cards.json inválido: esperado um array de cartas.");
  }

  _index = buildIndex(cards);
  _index.count = cards.length;
  _index.dbPath = dbPath;

  return _index;
}

// -------- decklist parsing --------

function parseDecklist(decklistText) {
  const lines = String(decklistText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed = [];
  for (const line of lines) {
    // padrão: "4 Nome da Carta"
    const m = line.match(/^(\d+)\s+(.+)$/);
    if (!m) continue;
    const qty = toInt(m[1], 0);
    const name = m[2].trim();
    if (!qty || !name) continue;

    parsed.push({
      quantity: qty,
      name,
      normalizedName: normalizeName(name),
    });
  }

  return parsed;
}

// -------- analysis --------

function curveBucket(cost) {
  if (cost >= 10) return "10+";
  return String(Math.max(0, cost));
}

function analyzeDeck(decklistText, opts = {}) {
  const cardIndex = buildIndex();

  const parsed = parseDecklist(decklistText);
  const cards = [];
  const unknownCards = [];

  let totalCards = 0;
  let recognizedQty = 0;
  let unknownQty = 0;
  let inkableCount = 0;

  const curveCounts = {
    "0": 0,
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
    "6": 0,
    "7": 0,
    "8": 0,
    "9": 0,
    "10+": 0,
  };

  const inksSet = new Set();

  for (const item of parsed) {
    totalCards += item.quantity;

    const hit = idx.byName.get(item.normalizedName);
    if (!hit) {
      unknownQty += item.quantity;
      unknownCards.push({
        name: item.name,
        normalizedName: item.normalizedName,
        quantity: item.quantity,
      });
      cards.push({
        quantity: item.quantity,
        name: item.name,
        normalizedName: item.normalizedName,
        status: "Não reconhecida",
      });
      continue;
    }

    recognizedQty += item.quantity;

    const bucket = curveBucket(hit.cost);
    curveCounts[bucket] = (curveCounts[bucket] || 0) + item.quantity;

    if (hit.inkable === true) inkableCount += item.quantity;

    if (hit.ink) inksSet.add(hit.ink);
    if (Array.isArray(hit.inks)) hit.inks.forEach((x) => x && inksSet.add(x));

    cards.push({
      ...hit,
      quantity: item.quantity,
      status: "Reconhecida",
    });
  }

  const inkablePct =
    totalCards > 0 ? Math.round((inkableCount / totalCards) * 100) : 0;

  // Sprint "core-only": sempre tratar como Core
  const format = "Core";

  // heurística simples; você pode trocar depois
  const archetype =
    inksSet.size === 0
      ? "Tempo / Hybrid"
      : inksSet.has("Ruby") && inksSet.has("Sapphire")
        ? "Control"
        : inksSet.has("Amber") && inksSet.has("Steel")
          ? "Aggro"
          : "Control";

  return {
    totalCards,
    cards,
    unknownCards,
    recognizedQty,
    unknownQty,
    inkableCount,
    inkablePct,
    curveCounts,
    inks: Array.from(inksSet),
    archetype,
    format,
  };
}


function buildIndex() {
  try {
    const possiblePaths = [
      path.join(__dirname, '../db/cards.json'),
      path.join(__dirname, '../../db/cards.json'),
      path.join(process.cwd(), 'backend/db/cards.json'),
      path.join(process.cwd(), 'db/cards.json'),
    ];

    let cardsData = null;
    let foundPath = null;

    for (const cardPath of possiblePaths) {
      if (fs.existsSync(cardPath)) {
        const rawData = fs.readFileSync(cardPath, 'utf8');
        cardsData = JSON.parse(rawData);
        foundPath = cardPath;
        break;
      }
    }

    if (!cardsData) {
      throw new Error('cards.json not found! Run: node mergeSets.js');
    }

    let cardsArray;
    
    if (Array.isArray(cardsData)) {
      cardsArray = cardsData;
    } else if (cardsData.cards && Array.isArray(cardsData.cards)) {
      cardsArray = cardsData.cards;
    } else if (typeof cardsData === 'object') {
      cardsArray = Object.values(cardsData);
    } else {
      throw new Error('cards.json has invalid format');
    }

    if (!Array.isArray(cardsArray)) {
      throw new Error('cards is not iterable. Got: ' + typeof cardsArray);
    }

    const index = new Map();
    
    for (const card of cardsArray) {
      if (!card || typeof card !== 'object') continue;
      
      const name = (card.name || card.Name || '').toLowerCase().trim();
      if (!name) continue;
      
      index.set(name, card);
    }

    console.log('Card index built: ' + index.size + ' cards from ' + foundPath);
    return index;
    
  } catch (err) {
    console.error('Error in buildIndex:', err.message);
    throw err;
  }
}

module.exports = {
  analyzeDeck,
  normalizeName,
  buildIndex,
  getCardsIndex,
  parseDecklist,
};

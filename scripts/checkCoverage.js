const fs = require("fs");
const path = require("path");

function normalizeName(s) {
  return String(s || "")
    .replace(/\u00A0/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseDecklistText(text) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const cards = [];
  for (const line of lines) {
    const m = line.match(/^(\d+)\s*(?:x)?\s+(.+)$/i);
    if (!m) continue;
    const qty = Number(m[1]);
    const name = m[2].trim();
    cards.push({ qty, name, norm: normalizeName(name) });
  }
  return cards;
}

function getFullName(card) {
  // Preferir fullName. Se não existir, tenta compor.
  if (card.fullName) return card.fullName;
  if (card.name && card.version) return `${card.name} - ${card.version}`;
  return card.name || "";
}

const cardsPath = path.join(__dirname, "..", "db", "cards.json");
const deckPath = process.argv[2];

if (!fs.existsSync(cardsPath)) {
  console.error("Não achei db/cards.json em:", cardsPath);
  process.exit(1);
}
if (!deckPath || !fs.existsSync(deckPath)) {
  console.error("Uso: node scripts/checkCoverage.js caminho/para/deck.txt");
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(cardsPath, "utf-8"));

// ✅ indexa por fullName e simpleName (e também por name como fallback)
const dbSet = new Set();
for (const c of db) {
  const full = getFullName(c);
  if (full) dbSet.add(normalizeName(full));
  if (c.simpleName) dbSet.add(normalizeName(c.simpleName));
  if (c.name) dbSet.add(normalizeName(c.name));
}

const deckText = fs.readFileSync(deckPath, "utf-8");
const deckCards = parseDecklistText(deckText);

let missingQty = 0;
let totalQty = 0;
const missing = [];

for (const c of deckCards) {
  totalQty += c.qty;
  if (!dbSet.has(c.norm)) {
    missingQty += c.qty;
    missing.push(c);
  }
}

console.log("Total de cópias no deck:", totalQty);
console.log("Cópias NÃO encontradas no cards.json:", missingQty);
console.log("Cartas não encontradas:");
missing.forEach((x) => console.log(`- ${x.qty}x ${x.name}`));

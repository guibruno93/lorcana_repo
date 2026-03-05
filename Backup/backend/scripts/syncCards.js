const fs = require("fs");
const path = require("path");

// ⚠️ URL EXEMPLO — troque pela API real quando definir
const API_URL = "https://api.lorcania.com/cards";

async function syncCards() {
  console.log("🔄 Sincronizando cartas da API...");

  const res = await fetch(API_URL);

  if (!res.ok) {
    throw new Error(
      `Erro ao buscar cartas da API (${res.status})`
    );
  }

  const cards = await res.json();

  if (!Array.isArray(cards)) {
    throw new Error("Formato inesperado da API (esperado array)");
  }

  // Normalização para o formato do app
  const normalized = cards.map(card => ({
    id: card.id ?? null,
    name: card.name,
    ink: card.ink,
    type: card.type,
    cost: Number(card.cost ?? 0),
    strength: card.strength ?? null,
    willpower: card.willpower ?? null
  }));

  const dbDir = path.join(__dirname, "db");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
  }

  const outputPath = path.join(dbDir, "cards.json");

  fs.writeFileSync(
    outputPath,
    JSON.stringify(normalized, null, 2),
    "utf-8"
  );

  console.log(`✅ ${normalized.length} cartas exportadas para db/cards.json`);
}

syncCards().catch(err => {
  console.error("❌ Erro ao sincronizar cartas:", err);
  process.exit(1);
});

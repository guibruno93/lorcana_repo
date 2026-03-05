const fs = require("fs");
const path = require("path");

const setsFolder = __dirname; // pasta com os setdata.X.json
const outputFile = path.join(setsFolder, "db/cards.json");

// Lê todos os arquivos setdata.X.json
const files = fs
  .readdirSync(setsFolder)
  .filter((f) => f.startsWith("setdata") && f.endsWith(".json"));

const cards = [];

files.forEach((file) => {
  const filePath = path.join(setsFolder, file);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");

    // Tenta parsear JSON e ignora arquivos inválidos
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.warn(`⚠️ Ignorando ${file} (JSON inválido): ${parseErr.message}`);
      return;
    }

    if (!parsed.cards || !Array.isArray(parsed.cards)) return;

    parsed.cards.forEach((card) => {
      if (!card || typeof card !== "object") return; // garante que card é objeto
      if (!card.name || typeof card.name !== "string") return; // pula cards sem nome válido

      // Monta o objeto limpo
      const cleanCard = {
        code: card.code ?? null,
        color: card.color ?? null,
        name: card.name,
        fullName: card.fullName ?? null,
        simpleName: card.simpleName ?? null,
        type: card.type ?? "Desconhecido",
        subtypes: Array.isArray(card.subtypes) ? card.subtypes : [],
        cost: typeof card.cost === "number" ? card.cost : 0,
        inkable: Boolean(card.inkwell),
        ink: card.ink ?? null,
        effect: card.effect ?? null,
        fullText: card.fullText ?? null,
        lore: typeof card.lore === "number" ? card.lore : null,
        strength: typeof card.strength === "number" ? card.strength : null,
        number: card.number ?? null,
        willpower: typeof card.willpower === "number" ? card.willpower : null,
        rarity: card.rarity ?? null,
        story: card.story ?? null,
        version: card.version ?? null,
      };

      cards.push(cleanCard);
    });
  } catch (err) {
    console.error(`❌ Falha ao processar ${file}: ${err.message}`);
  }
});

// Cria pasta "db" se não existir
if (!fs.existsSync(path.dirname(outputFile))) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
}

// Salva o JSON final
try {
  fs.writeFileSync(outputFile, JSON.stringify(cards, null, 2), "utf-8");
  console.log(`✅ Exportados ${cards.length} cards para ${outputFile}`);
} catch (writeErr) {
  console.error(`❌ Falha ao salvar ${outputFile}: ${writeErr.message}`);
}

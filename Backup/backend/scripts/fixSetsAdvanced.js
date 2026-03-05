// scripts/fixSetsAdvanced.js
const fs = require("fs");
const path = require("path");
const JSON5 = require("json5");

const SETS_DIR = path.join(__dirname, "../data");

function cleanCard(card) {
  // Remove propriedades problemáticas
  delete card.cardTraderUrl;
  delete card.tcgPlayerUrl;
  delete card.full;

  // Se tiver nested objects como externalLinks
  if (card.externalLinks) {
    delete card.externalLinks.cardTraderUrl;
    delete card.externalLinks.tcgPlayerUrl;
  }

  // Se tiver abilities, garante que strings estão escapadas
  if (card.abilities) {
    card.abilities.forEach(ab => {
      if (ab.fullText) ab.fullText = ab.fullText.replace(/\r?\n/g, "\\n");
      if (ab.effect) ab.effect = ab.effect.replace(/\r?\n/g, "\\n");
    });
  }

  return card;
}

function cleanSet(set) {
  if (set.cards && Array.isArray(set.cards)) {
    set.cards = set.cards.map(cleanCard);
  }
  return set;
}

fs.readdirSync(SETS_DIR)
  .filter(f => f.endsWith(".json"))
  .forEach(file => {
    const filePath = path.join(SETS_DIR, file);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON5.parse(raw); // usa json5 para ler JSON quebrado
      const cleaned = cleanSet(parsed);
      fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), "utf-8");
      console.log(`✅ Limpo com sucesso: ${file}`);
    } catch (err) {
      console.error(`❌ Falha ao limpar ${file}: ${err.message}`);
    }
  });

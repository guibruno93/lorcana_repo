const fs = require("fs");
const path = require("path");

const SETS_DIR = path.join(__dirname, "../data");

/* ---------- UTIL ---------- */
function findBadCharsInCard(cardStr, cardIndex, file, setName) {
  for (let i = 0; i < cardStr.length; i++) {
    const code = cardStr.charCodeAt(i);
    if (code >= 0 && code <= 31 && ![9, 10, 13].includes(code)) {
      console.log(
        `❌ Problema em arquivo "${file}", set "${setName}", card index ${cardIndex}`
      );
      console.log(
        `   Caractere inválido: código ${code}, posição no card ${i}, trecho: "${cardStr.slice(i-10, i+10)}"`
      );
      return true;
    }
  }
  return false;
}

function inspectSets() {
  const files = fs.readdirSync(SETS_DIR).filter((f) => f.endsWith(".json"));
  let problemsFound = false;

  for (const file of files) {
    const fullPath = path.join(SETS_DIR, file);
    const content = fs.readFileSync(fullPath, "utf-8");

    let raw;
    try {
      raw = JSON.parse(content); // só para acessar cards
    } catch {
      console.warn(`⚠️ Não foi possível parsear JSON padrão de ${file}. Tentando inspeção bruta...`);
      // Inspeção bruta: procurar aspas duplas que começam strings
      continue;
    }

    const setName = raw.setName || raw.name || file.replace(".json", "");
    const cards = raw.cards || raw.cardData || raw;

    if (!Array.isArray(cards)) continue;

    cards.forEach((card, index) => {
      const cardStr = JSON.stringify(card);
      if (findBadCharsInCard(cardStr, index, file, setName)) {
        problemsFound = true;
      }
    });
  }

  if (!problemsFound) {
    console.log("✅ Nenhum caractere inválido encontrado em cards.");
  }
}

inspectSets();

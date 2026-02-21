const fs = require("fs");
const path = require("path");

const SETS_DIR = path.join(__dirname, "../data");

/**
 * Limpa um arquivo JSON de Lorcana problemático
 */
function cleanSetFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");

    // Remove linhas com URLs e full
    let cleaned = raw
      .split("\n")
      .filter(line =>
        !line.includes('"cardTraderUrl"') &&
        !line.includes('"tcgPlayerUrl"') &&
        !line.includes('"full"')
      )
      .join("\n");

    // Remove comentários // e /* */
    cleaned = cleaned.replace(/\/\/.*$/gm, "");
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//gm, "");

    // Remove caracteres de controle que quebram JSON
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F]/g, "");

    // Substitui aspas inválidas (ex.: smart quotes) por aspas duplas
    cleaned = cleaned.replace(/[“”]/g, '"');
    cleaned = cleaned.replace(/[‘’]/g, "'");

    // Salva o arquivo limpo
    fs.writeFileSync(filePath, cleaned, "utf-8");

    console.log(`✅ Limpeza concluída: ${path.basename(filePath)}`);
  } catch (err) {
    console.error(`❌ Falha ao limpar ${path.basename(filePath)}: ${err.message}`);
  }
}

// Processa todos os arquivos JSON na pasta de sets
fs.readdirSync(SETS_DIR)
  .filter(f => f.endsWith(".json"))
  .forEach(f => cleanSetFile(path.join(SETS_DIR, f)));

// scripts/removeUrls.js
const fs = require("fs");
const path = require("path");

const SETS_DIR = path.join(__dirname, "../data");

fs.readdirSync(SETS_DIR)
  .filter(f => f.endsWith(".json"))
  .forEach(file => {
    const filePath = path.join(SETS_DIR, file);
    try {
      let lines = fs.readFileSync(filePath, "utf-8").split("\n");
      lines = lines.filter(line => 
        !line.includes("cardTraderUrl") &&
        !line.includes("tcgPlayerUrl") &&
        !line.includes('"full"')
      );
      fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
      console.log(`✅ URLs removidas: ${file}`);
    } catch (err) {
      console.error(`❌ Falha em ${file}: ${err.message}`);
    }
  });

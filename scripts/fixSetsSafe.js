const fs = require('fs');
const path = require('path');

const setsFolder = __dirname; // pasta atual
const outputFile = path.join(setsFolder, 'db/cards.json');

if (!fs.existsSync(path.join(setsFolder, 'db'))) {
  fs.mkdirSync(path.join(setsFolder, 'db'));
}

const files = fs.readdirSync(setsFolder)
  .filter(f => f.startsWith('setdata') && f.endsWith('.json'));

let allCards = [];

files.forEach(file => {
  const filePath = path.join(setsFolder, file);
  try {
    let raw = fs.readFileSync(filePath, 'utf-8');

    // 1️⃣ Remove comentários e campos problemáticos
    raw = raw.replace(/\/\/.*$/gm, ''); // remove //comentários
    raw = raw.replace(/"cardTraderUrl"\s*:\s*".*?",?/g, '');
    raw = raw.replace(/"tcgPlayerUrl"\s*:\s*".*?",?/g, '');
    raw = raw.replace(/"full"\s*:\s*".*?",?/g, '');

    // 2️⃣ Remove caracteres de controle inválidos
    raw = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

    // 3️⃣ Tenta separar objetos quebrados e envolver em array
    raw = raw.replace(/}\s*{/g, '},{');
    if (!raw.trim().startsWith('[')) {
      raw = `[${raw}]`;
    }

    // 4️⃣ Função para tentar corrigir vírgulas dentro do objeto
    function fixCommas(str) {
      return str.replace(/"(\w+)"\s*:\s*"([^"]*)"\s*"(\w+)"/g, '"$1":"$2","$3"'); // corrige casos como "a":"x" "b":"y"
    }

    raw = fixCommas(raw);

    // 5️⃣ Tenta parsear normalmente
    let parsed;
    try {
      parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) parsed = [parsed];
    } catch {
      // 6️⃣ Se falhar, parseia objeto por objeto usando regex
      const objectRegex = /{[^{}]*}/g;
      const matches = raw.match(objectRegex);
      if (!matches) {
        console.warn(`❌ Nenhum card válido encontrado em ${file}`);
        return;
      }

      parsed = [];
      matches.forEach(objStr => {
        try {
          objStr = fixCommas(objStr); // aplica correção de vírgulas em cada objeto
          const obj = JSON.parse(objStr);
          parsed.push(obj);
        } catch {
          // ignora objetos ainda quebrados
        }
      });
    }

    if (parsed.length > 0) {
      allCards = allCards.concat(parsed);
      console.log(`✅ Recuperados ${parsed.length} cards de ${file}`);
    } else {
      console.warn(`⚠️ Nenhum card recuperável em ${file}`);
    }

  } catch (err) {
    console.error(`❌ Falha ao processar ${file}: ${err.message}`);
  }
});

// 7️⃣ Salva todos os cards válidos
fs.writeFileSync(outputFile, JSON.stringify(allCards, null, 2), 'utf-8');
console.log(`\n🎯 Todos os cards exportados para ${outputFile}`);

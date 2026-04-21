const fs = require('fs');
const path = require('path');

/**
 * Monta texto de deck com 60 cartas (4x cada) a partir de cards.json local.
 */
function buildSampleDeckText() {
  const candidates = [
    process.env.CARDS_PATH,
    path.join(__dirname, '..', '..', 'db', 'cards.json'),
    path.join(__dirname, '..', '..', 'data', 'cards.json'),
  ].filter(Boolean);

  let rawPath = null;
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        rawPath = p;
        break;
      }
    } catch (_) {
      /* ignore */
    }
  }
  if (!rawPath) {
    throw new Error('cards.json não encontrado para testes de /api/deck/analyze');
  }

  const cards = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const names = [];
  for (const c of cards) {
    if (c && c.name && names.length < 15) names.push(c.name);
  }
  if (names.length < 15) {
    throw new Error('cards.json não tem cartas suficientes');
  }

  const lines = [];
  for (const name of names) {
    lines.push(`4 ${name}`);
  }
  return lines.join('\n');
}

module.exports = { buildSampleDeckText };

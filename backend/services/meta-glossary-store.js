'use strict';

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'meta_archetype_glossary.json');

function readGlossary() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object') {
      return { entries: [], generated_at: null };
    }
    if (!Array.isArray(j.entries)) j.entries = [];
    return j;
  } catch {
    return { entries: [], generated_at: null };
  }
}

function writeGlossary(doc) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const out = {
    entries: Array.isArray(doc.entries) ? doc.entries : [],
    generated_at: doc.generated_at || new Date().toISOString(),
    source: doc.source || 'anthropic',
  };
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  return out;
}

module.exports = {
  readGlossary,
  writeGlossary,
  glossaryFilePath: DATA_FILE,
};

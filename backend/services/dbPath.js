// backend/services/dbPath.js
"use strict";

const path = require("path");
const fs = require("fs");

/**
 * Caminho absoluto para backend/db/<...parts>
 * (este arquivo fica em backend/services, então ".." sobe para backend/)
 */
function dbPath(...parts) {
  return path.resolve(__dirname, "..", "db", ...parts);
}

/**
 * Resolve um arquivo do db:
 * - primeiro backend/db/<filename>
 * - depois cwd/db/<filename> (caso você rode node fora de backend)
 */
function resolveDbFile(filename) {
  const p1 = dbPath(filename);
  if (fs.existsSync(p1)) return p1;

  const p2 = path.resolve(process.cwd(), "db", filename);
  if (fs.existsSync(p2)) return p2;

  // fallback: retorna o padrão (melhor mensagem de erro)
  return p1;
}

module.exports = { dbPath, resolveDbFile };

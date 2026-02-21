"use strict";

const fs = require("fs");
const path = require("path");

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(
    d.getMinutes()
  )}-${pad(d.getSeconds())}`;
}

function parseArg(name, def = null) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return def;
  return arg.split("=").slice(1).join("=");
}

function safeCopy(src, dst) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️ não achei: ${src}`);
    return false;
  }
  fs.copyFileSync(src, dst);
  console.log(`✅ backup: ${path.basename(src)} -> ${dst}`);
  return true;
}

function main() {
  const baseDir = path.join(__dirname, ".."); // backend/
  const dbDir = path.join(baseDir, "db");

  const outDirArg = parseArg("out", null);
  const outDir = outDirArg
    ? path.resolve(baseDir, outDirArg)
    : path.join(dbDir, "_snapshots", nowStamp());

  fs.mkdirSync(outDir, { recursive: true });

  const cardsPath = process.env.CARDS_DB_PATH || path.join(dbDir, "cards.json");
  const metaPath = process.env.TOURNAMENT_META_PATH || path.join(dbDir, "tournamentMeta.json");
  const metaIndexPath = path.join(dbDir, "metaIndex.json");

  safeCopy(cardsPath, path.join(outDir, "cards.json"));
  safeCopy(metaPath, path.join(outDir, "tournamentMeta.json"));
  safeCopy(metaIndexPath, path.join(outDir, "metaIndex.json"));

  console.log(`\n📦 snapshots em: ${outDir}`);
}

main();

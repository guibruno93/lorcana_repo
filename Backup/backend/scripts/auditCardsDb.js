// backend/scripts/auditCardsDb.js
"use strict";

const fs = require("fs");
const path = require("path");

const cardsPath = path.join(__dirname, "..", "db", "cards.json");

function normalizeName(s) {
  return String(s || "")
    .replace(/\u00A0/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function fullNameOf(c) {
  return c.fullName || (c.name && c.version ? `${c.name} - ${c.version}` : c.name) || "";
}

function gameplaySig(c) {
  // assinatura “de jogo” (reprint ok se isso for igual)
  return [
    c.cost,
    c.inkable,
    c.color || c.ink,
    c.type,
    c.lore,
    c.strength,
    c.willpower,
  ].join("|");
}

function textSig(c) {
  // variações de texto/line breaks não necessariamente são problema
  return [c.effect || "", c.fullText || ""].join("||");
}

function main() {
  const strictText = process.argv.includes("--strictText");

  if (!fs.existsSync(cardsPath)) {
    console.error("cards.json não encontrado em:", cardsPath);
    process.exit(1);
  }

  const db = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
  const cards = Array.isArray(db) ? db : (db.cards || []);
  console.log("Cards carregadas:", cards.length);

  // 1) validar campos mínimos + code único
  const codeMap = new Map();
  let fieldProblems = 0;
  for (const c of cards) {
    const errs = [];

    if (!c.code) errs.push("missing code");
    if (!c.name) errs.push("missing name");
    if (!c.fullName) errs.push("missing fullName");
    if (!c.simpleName) errs.push("missing simpleName");
    if (c.cost === undefined || c.cost === null) errs.push("missing cost");
    if (typeof c.inkable !== "boolean") errs.push("inkable not boolean");

    if (errs.length) {
      fieldProblems++;
      if (fieldProblems <= 30) {
        console.log("⚠️", fullNameOf(c), "->", errs.join(", "));
      }
    }

    if (c.code) {
      if (codeMap.has(c.code)) {
        console.log("❗ DUP CODE:", c.code, "=>", fullNameOf(codeMap.get(c.code)), "||", fullNameOf(c));
        // code duplicado é problema real
        process.exit(2);
      }
      codeMap.set(c.code, c);
    }
  }

  // 2) agrupar por fullName normalizado
  const groups = new Map();
  for (const c of cards) {
    const k = normalizeName(fullNameOf(c));
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }

  const dupGroups = [...groups.entries()].filter(([, arr]) => arr.length > 1);

  // 3) checar se duplicatas são só reprints (gameplay igual) ou conflito real
  let gameplayConflicts = 0;
  let textWarnings = 0;

  for (const [k, arr] of dupGroups) {
    const gSigs = new Set(arr.map(gameplaySig));
    if (gSigs.size > 1) {
      gameplayConflicts++;
      console.log("❗ CONFLITO GAMEPLAY:", k, "=>", arr.map(fullNameOf).join(" || "));
      console.log("   sigs:", [...gSigs].slice(0, 6));
      if (gameplayConflicts >= 30) break;
      continue;
    }

    const tSigs = new Set(arr.map(textSig));
    if (tSigs.size > 1) {
      textWarnings++;
      // imprime só alguns exemplos
      if (textWarnings <= 30) {
        console.log("⚠️ REPRINT com texto diferente:", k, "=>", arr.map(a => `${fullNameOf(a)} [set=${a.setCode}]`).join(" || "));
      }
    }
  }

  console.log("Problemas de campos:", fieldProblems);
  console.log("Grupos com duplicata (reprints):", dupGroups.length);
  console.log("Conflitos reais de gameplay:", gameplayConflicts);
  console.log("Avisos de texto diferente:", textWarnings);

  if (fieldProblems > 0) process.exit(2);
  if (gameplayConflicts > 0) process.exit(2);
  if (strictText && textWarnings > 0) process.exit(2);

  console.log("✅ cards.json OK (reprints detectados são esperados)");
}

main();

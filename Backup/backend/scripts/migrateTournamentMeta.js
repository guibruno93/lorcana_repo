"use strict";

const fs = require("fs");
const path = require("path");

const INPUT = path.join(__dirname, "..", "db", "tournamentMeta.json");
const OUTPUT = path.join(__dirname, "..", "db", "tournamentMeta.migrated.json");

function parseCountAndName(raw) {
  const cleaned = String(raw || "").replace(/\u00A0/g, " ").trim();
  // aceita: "4\tCard", "4  Card", "4x Card", "4× Card"
  const m = cleaned.match(/^(\d+)\s*(?:x|×)?\s+(.+?)\s*$/i);
  if (!m) return null;
  return { qty: Number(m[1]) || 0, name: String(m[2] || "").trim() };
}

function migrate(meta) {
  const decks = Array.isArray(meta?.decks) ? meta.decks : Array.isArray(meta) ? meta : [];

  const outDecks = decks.map((d) => {
    const cardsIn = Array.isArray(d.cards) ? d.cards : [];
    let totalQty = 0;

    const cards = cardsIn.map((c) => {
      const rawLine = c?.name ?? "";
      const parsed = parseCountAndName(rawLine);

      // custo antigo estava no qty (muito comum no seu meta)
      const cost = Number(c?.qty ?? c?.cost ?? 0);
      const safeCost = Number.isFinite(cost) ? cost : 0;

      if (!parsed) {
        // fallback: mantém o que der pra manter, mas não soma
        return {
          qty: Number(c?.qty ?? 0) || 0,
          name: String(rawLine || "").trim(),
          cost: safeCost,
          raw: rawLine,
        };
      }

      totalQty += parsed.qty;

      return {
        qty: parsed.qty,
        name: parsed.name,
        cost: safeCost,
        raw: rawLine, // útil pra debug (pode remover depois)
      };
    });

    return {
      ...d,
      cards,
      totalQty, // ✅ agora totalQty fica certo
      totalQtySource: d.totalQty ?? null, // guarda o antigo só pra debug
    };
  });

  if (Array.isArray(meta)) return outDecks;

  return {
    schemaVersion: meta?.schemaVersion ?? 1,
    source: meta?.source ?? "inkdecks",
    updatedAt: meta?.updatedAt ?? null,
    scrapedAt: meta?.scrapedAt ?? null,
    decks: outDecks,
  };
}

function main() {
  const raw = JSON.parse(fs.readFileSync(INPUT, "utf8"));
  const migrated = migrate(raw);

  fs.writeFileSync(OUTPUT, JSON.stringify(migrated, null, 2), "utf8");
  console.log("✅ Migrado com sucesso!");
  console.log("Input :", INPUT);
  console.log("Output:", OUTPUT);
  console.log("Dica: revise e depois substitua tournamentMeta.json pelo .migrated.json");
}

main();

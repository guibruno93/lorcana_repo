// backend/services/ai/resolveNames.js
"use strict";

const fs = require("fs");
const path = require("path");

const { resolveDbFile, dbPath } = require("../dbPath");
const { findCardCandidates } = require("../cardCandidates");

// ===== Snapshot (OPCIONAL) =====
function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
    d.getHours()
  )}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function safeCopy(src, dst) {
  try {
    if (!src || !fs.existsSync(src)) return false;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    return true;
  } catch {
    return false;
  }
}

function safeResolve(name) {
  try {
    return resolveDbFile(name);
  } catch {
    return null;
  }
}

/**
 * Cria snapshot em backend/db/_snapshots/<timestamp>/
 * NÃO roda automaticamente — só se você chamar.
 */
function createDbSnapshot(opts = {}) {
  const outRoot = opts.outRoot || dbPath("_snapshots");
  const outDir = path.join(outRoot, nowStamp());

  fs.mkdirSync(outDir, { recursive: true });

  const copied = [];

  const cardsPath = safeResolve("cards.json");
  const metaPath = safeResolve("tournamentMeta.json");
  const metaIndexPath = safeResolve("metaIndex.json"); // pode não existir

  if (safeCopy(cardsPath, path.join(outDir, "cards.json"))) copied.push("cards.json");
  if (safeCopy(metaPath, path.join(outDir, "tournamentMeta.json"))) copied.push("tournamentMeta.json");
  if (safeCopy(metaIndexPath, path.join(outDir, "metaIndex.json"))) copied.push("metaIndex.json");

  return { outDir, copied };
}

// ===== Resolver de nomes (MVP) =====
/**
 * Resolve/sugere matches para nomes desconhecidos.
 * - input: array de nomes (strings)
 * - output: lista com candidates + best (quando confiante)
 */
function resolveNames(unknownNames, opts = {}) {
  const names = Array.isArray(unknownNames) ? unknownNames : [];
  const limit = Number.isFinite(Number(opts.limit)) ? Number(opts.limit) : 8;
  const minScore = Number.isFinite(Number(opts.minScore)) ? Number(opts.minScore) : 0.45;

  const results = names
    .map((n) => String(n || "").trim())
    .filter(Boolean)
    .map((n) => findCardCandidates(n, { limit, minScore }));

  return {
    ok: true,
    params: { limit, minScore },
    results,
  };
}

// Export compatível para não quebrar chamadas antigas:
// - require(...) -> function
// - const { resolveNames } = require(...) -> também funciona
resolveNames.resolveNames = resolveNames;
resolveNames.createDbSnapshot = createDbSnapshot;

module.exports = resolveNames;
module.exports.resolveNames = resolveNames;
module.exports.createDbSnapshot = createDbSnapshot;

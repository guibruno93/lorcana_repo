// backend/routes/meta.js
"use strict";

const express = require("express");
const { loadMetaState } = require("../services/metaIndex");
const { analyzeDeck } = require("../parser/deckParser");
const { compareAnalysisToMeta } = require("../parser/metaComparator");

function parseIntOr(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseDeckCardEntry(entry) {
  // suporta entradas string do tipo "4 Card Name"
  if (typeof entry === "string") {
    const raw = String(entry).replace(/\u00A0/g, " ").trim();
    const m = raw.match(/^(\d+)\s*(?:x|×)?\s+(.+?)\s*$/i);
    if (m) return { count: Number(m[1]) || 0, name: String(m[2]).trim() };
    return { count: 0, name: raw };
  }

  const raw = String(entry?.name || entry?.cardName || entry?.card || "")
    .replace(/\u00A0/g, " ")
    .trim();

  // se o name vier com prefixo "4x "
  const m = raw.match(/^(\d+)\s*(?:x|×)?\s+(.+?)\s*$/i);
  if (m) return { count: Number(m[1]) || 0, name: String(m[2]).trim() };

  // ✅ inclui quantity (importante no seu meta)
  const count = Number(entry?.count ?? entry?.quantity ?? entry?.qty ?? 0) || 0;
  return { count, name: raw };
}

function createMetaRouter({ metaPath = null } = {}) {
  const router = express.Router();

  function getMeta() {
    return loadMetaState(metaPath || undefined);
  }

  router.get("/stats", (_req, res) => {
    try {
      const meta = getMeta();
      res.json({
        schemaVersion: meta.schemaVersion,
        source: meta.source,
        updatedAt: meta.updatedAt,
        scrapedAt: meta.scrapedAt,
        decks: meta.stats.decks,
        archetypes: meta.stats.archetypes,
        formats: meta.stats.formats, // ✅ corrigido
      });
    } catch (e) {
      res.status(500).json({ error: `Falha ao carregar meta: ${e?.message || String(e)}` });
    }
  });

  router.get("/deck/:deckId", (req, res) => {
    try {
      const meta = getMeta();
      const deck = meta.byId.get(req.params.deckId);
      if (!deck) return res.status(404).json({ error: "Deck não encontrado." });

      // tenta devolver uma lista “amigável” com nomes reais
      const cards = [];
      const arr = Array.isArray(deck.rawCards) ? deck.rawCards : [];
      for (const e of arr) {
        const { count, name } = parseDeckCardEntry(e);
        if (!count || !name) continue;
        cards.push({ count, name });
      }

      // fallback: se não houver rawCards bem formatado, devolve os normalized keys
      if (cards.length === 0) {
        for (const k of Object.keys(deck.counts || {})) {
          cards.push({ count: deck.counts[k], name: k });
        }
      }

      cards.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

      res.json({
        deckId: deck.id,
        url: deck.url,
        event: deck.event,
        location: deck.location,
        date: deck.date,
        standing: deck.standing,
        rankLabel: deck.rankLabel,
        players: deck.players,
        format: deck.format,
        archetype: deck.archetype,
        author: deck.author,
        cards,
      });
    } catch (e) {
      res.status(500).json({ error: `Falha ao carregar deck: ${e?.message || String(e)}` });
    }
  });

  router.post("/compare", (req, res) => {
    try {
      // compat: aceita vários nomes de campo
      const decklistText =
        req.body?.decklistText ??
        req.body?.deckText ??
        req.body?.decklist ??
        req.body?.text ??
        "";

      const topK = req.body?.topK;
      const onlyTop = req.body?.onlyTop;
      const sameFormat = req.body?.sameFormat;

      if (typeof decklistText !== "string" || !decklistText.trim()) {
        return res.status(400).json({
          error: 'Envie JSON com { decklistText: "..." } (linhas tipo "4 Card Name").',
        });
      }

      const analysis = analyzeDeck(decklistText);
      const meta = getMeta();

      const det = compareAnalysisToMeta(analysis, meta, {
        topK: parseIntOr(topK, 10),
        onlyTop: parseIntOr(onlyTop, 0),
        sameFormat: sameFormat !== false,
      });

      res.json({
        query: {
          totalCards: analysis.totalCards,
          recognizedQty: analysis.recognizedQty,
          unknown: analysis.unknown,
        },
        matches: det.top,
        aggregate: det.aggregate,
      });
    } catch (e) {
      res.status(500).json({ error: `Falha na comparação: ${e?.message || String(e)}` });
    }
  });

  return router;
}

module.exports = createMetaRouter;

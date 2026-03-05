// backend/server.js
"use strict";

const express = require("express");
const cors = require("cors");

const createMetaRouter = require("./routes/meta");
const { getCardIndex } = require("./services/cardIndex");
const { loadMetaState } = require("./services/metaIndex");
const { makeLogger } = require("./services/logger");
const { requestLogger } = require("./services/requestLogger");

// ✅ força o Node a carregar o arquivo analyzeDeck.js (evita resolver pasta/index por engano)
const analyzeDeckMod = require("./parser/analyzeDeck.js");

// ✅ aceita export em objeto { analyzeDeckFromDecklist } ou export direto (module.exports = function)
const analyzeDeckFromDecklist =
  (analyzeDeckMod && analyzeDeckMod.analyzeDeckFromDecklist) ||
  (analyzeDeckMod && analyzeDeckMod.default) ||
  (typeof analyzeDeckMod === "function" ? analyzeDeckMod : null);

const log = makeLogger();
const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger());

// Se ainda assim der mismatch, não derruba o server: avisa no console e falha só no endpoint.
if (typeof analyzeDeckFromDecklist !== "function") {
  const keys =
    analyzeDeckMod && typeof analyzeDeckMod === "object"
      ? Object.keys(analyzeDeckMod)
      : String(typeof analyzeDeckMod);

  console.warn(
    "⚠️ parser/analyzeDeck.js carregado, mas não encontrei analyzeDeckFromDecklist.\n" +
      "   Exports encontrados:",
    keys
  );
}

function parseBool(value, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const s = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return defaultValue;
}

function parseIntOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

app.get("/", (_req, res) => res.json({ ok: true, service: "lorcana-backend" }));

app.get("/api/health", (_req, res) => {
  let cardsCount = null;
  let metaDecks = null;

  try {
    cardsCount = getCardIndex().size;
  } catch (_) {}

  try {
    // loadMetaState já tem cache; se TOURnAMENT_META_PATH estiver vazio, ele pode estourar
    const metaPath = process.env.TOURNAMENT_META_PATH || undefined;
    metaDecks = loadMetaState(metaPath).decks.length;
  } catch (_) {}

  res.json({
    ok: true,
    cardsDb: { count: cardsCount },
    meta: { decks: metaDecks },
  });
});

// rota do meta
app.use("/api/meta", createMetaRouter({ metaPath: process.env.TOURNAMENT_META_PATH || null }));

// endpoint principal
app.post("/api/analyzeDeck", async (req, res, next) => {
  const t0 = process.hrtime.bigint();
  try {
    const deckText =
      req.body?.decklist ??
      req.body?.deck ??
      req.body?.text ??
      req.body?.decklistText;

    if (typeof deckText !== "string" || !deckText.trim()) {
      return res.status(400).json({
        error: 'Body inválido. Envie JSON com { decklist: "..." } (ou { deck: "..." }).',
      });
    }

    if (typeof analyzeDeckFromDecklist !== "function") {
      return res.status(500).json({
        error:
          "analyzeDeckFromDecklist não está disponível. " +
          "Verifique se backend/parser/analyzeDeck.js exporta { analyzeDeckFromDecklist }.",
      });
    }

    const compare = parseBool(req.query.compare, true);

    // compat: alguns analyzers usam top (ex: TOP8/TOP16/TOP32), outros usam onlyTop
    const onlyTop = parseIntOrNull(req.query.top) ?? 0;
    const topK = parseIntOrNull(req.query.topK) ?? 10;

    const result = await Promise.resolve(
      analyzeDeckFromDecklist(deckText, {
        compare,

        // ✅ manda os dois, pra cobrir versões diferentes do analyzer:
        top: onlyTop,
        onlyTop,
        topK,

        metaPath: process.env.TOURNAMENT_META_PATH || undefined,
        sameFormat: true,
      })
    );

    const t1 = process.hrtime.bigint();
    const ms = Number(t1 - t0) / 1e6;

    log.info("analyze_deck", {
      reqId: req.reqId,
      totalCards: result?.totalCards,
      recognizedQty: result?.recognizedQty,
      unknown: result?.unknown,
      compareEnabled: Boolean(result?.metaComparisonDeterministic?.enabled || result?.metaComparison?.enabled),
      durationMs: Number(ms.toFixed(2)),
    });

    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// handler de erro
app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "JSON inválido no body (verifique aspas/chaves)." });
  }
  log.error("unhandled_error", { message: err?.message, stack: err?.stack });
  return res.status(err?.status || 500).json({ error: err?.message || "Erro interno" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => log.info("server_started", { port: PORT }));

"use strict";

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use('/api/deck', require('./routes/deck'));
app.use('/api/M3ta', require('./routes/M3ta'));
app.use(express.json({ limit: "2mb" }));

// CORS simples (evita dor de cabeça com CRA/porta 3000/3001)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

function parseBool(v, def = false) {
  if (v === undefined || v === null) return def;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v !== "string") return def;
  const s = v.trim().toLowerCase();
  if (["1", "true", "yes", "on", "y"].includes(s)) return true;
  if (["0", "false", "no", "off", "n"].includes(s)) return false;
  return def;
}

function parseTop(v, def = 32) {
  if (v == null) return def;
  const s = String(v).trim();
  if (!s) return def;
  const m = s.match(/(\d+)/);
  if (!m) return def;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : def;
}

// Analyzer
const analyzerMod = require("./parser/analyzeDeck");
const analyzeDeckFromDecklist =
  typeof analyzerMod === "function"
    ? analyzerMod
    : analyzerMod.analyzeDeckFromDecklist;

if (typeof analyzeDeckFromDecklist !== "function") {
  throw new Error(
    "parser/analyzeDeck não exporta analyzeDeckFromDecklist (função)."
  );
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/analyzeDeck", async (req, res) => {
  try {
    const decklist = (req.body && (req.body.decklist || req.body.text)) || "";
    if (!String(decklist).trim()) {
      return res.status(400).json({
        error: "Envie { decklist: '4 Card Name\\n...' } no body.",
      });
    }

    const compare = parseBool(req.query.compare, false);
    const top = parseTop(req.query.top, 32);
    // default true para manter comportamento anterior
    const sameFormat = parseBool(req.query.sameFormat, true);

    const result = await analyzeDeckFromDecklist(decklist, {
      compare,
      top,
      sameFormat,
    });

    return res.json(result);
  } catch (err) {
    console.error("❌ /api/analyzeDeck error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

// AI router (se existir)
try {
  const aiRouter = require("./routes/ai");
  app.use("/api/ai", aiRouter);
} catch (e) {
  console.warn("⚠️ AI router não carregado:", e.message);
}

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`✅ API on: http://localhost:${PORT}`);
});

server.on("error", (e) => {
  if (e && e.code === "EADDRINUSE") {
    console.error(
      `❌ Porta ${PORT} já está em uso. Feche o processo anterior ou altere PORT.`
    );
  } else {
    console.error("❌ Server error:", e);
  }
});

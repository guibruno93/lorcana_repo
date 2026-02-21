"use strict";

/**
 * server-COMPLETE.js
 * Backend completo com todas as rotas necessárias
 */
require('dotenv').config();
const express = require("express");
const cors = require("cors");


const app = express();

// ── Middlewares ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── Logging middleware ───────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ── Rotas ────────────────────────────────────────────────────────────────────

// Deck analyzer
try {
  const deckRouter = require("./routes/deck");
  app.use("/api/deck", deckRouter);
  console.log("✅ Deck router carregado: /api/deck");
} catch (e) {
  console.error("❌ Deck router não carregado:", e.message);
}

// AI services
try {
  const aiRouter = require("./routes/ai");
  app.use("/api/ai", aiRouter);
  console.log("✅ AI router carregado: /api/ai");
  
  // Test if shuffle endpoint exists
  const endpoints = aiRouter.stack
    .filter(r => r.route)
    .map(r => Object.keys(r.route.methods)[0].toUpperCase() + ' ' + r.route.path);
  
  console.log("   Available AI endpoints:");
  endpoints.forEach(e => console.log(`   - ${e}`));
  
} catch (e) {
  console.error("❌ AI router não carregado:", e.message);
}

// Meta analyzer
try {
  const metaRouter = require("./routes/meta");
  app.use("/api/meta", metaRouter);
  console.log("✅ Meta router carregado: /api/meta");
} catch (e) {
  console.warn("⚠️  Meta router não carregado:", e.message);
}

// Após outras rotas existentes
const deckComparison = require('./routes/deckComparison');
app.use('/api/deck-comparison', deckComparison);
console.log("✅ Deck Comparison carregado");

const auth = require('./routes/auth');
app.use('/api/auth', auth);
console.log("✅ Auth carregado");

// Rotas protegidas (exemplo)
const { authenticateToken } = require('./routes/auth');
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({ message: 'Protected route', user: req.user });
});

// ── Catch-all 404 ────────────────────────────────────────────────────────────
app.use((req, res) => {
  console.warn(`⚠️  404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Not Found',
    path: req.path,
    method: req.method
  });
});

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message 
  });
});

// ── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3002;
const server = app.listen(PORT, () => {
  console.log(`\n✅ API on: http://localhost:${PORT}\n`);
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

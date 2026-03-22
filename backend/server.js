"use strict";

/**
 * server-COMPLETE.js
 * Backend completo com todas as rotas necessárias
 * ✅ CORREÇÃO: Auth carregado ANTES de Deck
 */
require('dotenv').config();
const express = require("express");
const cors = require("cors");
const userRoutes = require('./routes/user');
const app = express();
//const metaCron = require('./jobs/meta-cron'); - comentado até implementar scraper usando puppeteer; 


// ── Middlewares ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use('/api/user', userRoutes);


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

// ══════════════════════════════════════════════════════════════════════════════
// TODAS AS ROTAS - ORDEM CORRETA! ✅
// Auth PRECISA ser carregado ANTES de Deck (deck.js importa authenticateToken)
// ══════════════════════════════════════════════════════════════════════════════

// ✅ 1. AUTH 
try {
  const auth = require('./routes/auth');
  app.use('/api/auth', auth);
  console.log("✅ Auth carregado: /api/auth");
  
  // Rotas protegidas
  const { authenticateToken } = require('./routes/auth');
  app.get('/api/protected', authenticateToken, (req, res) => {
    res.json({ message: 'Protected route', user: req.user });
  });
} catch (e) {
  console.error("❌ Auth não carregado:", e.message);
}

// ✅ 2. DECK 
try {
  const deckRouter = require("./routes/deck");
  app.use("/api/deck", deckRouter);
  console.log("✅ Deck router carregado: /api/deck");
} catch (e) {
  console.error("❌ Deck router não carregado:", e.message);
}

// 3. AI services
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

// 4. Meta analyzer
try {
  const metaRouter = require("./routes/M3ta");
  app.use("/api/meta", metaRouter);
  console.log("✅ Meta router carregado: /api/meta");
} catch (e) {
  console.warn("⚠️  Meta router não carregado:", e.message);
}

// 5. Deck Comparison
try {
  const deckComparison = require('./routes/deckComparison');
  app.use('/api/deck-comparison', deckComparison);
  console.log("✅ Deck Comparison carregado: /api/deck-comparison");
} catch (e) {
  console.warn("⚠️  Deck Comparison não carregado:", e.message);
}

// 6. Meta Analysis
try {
  const metaAnalysisRoutes = require('./routes/meta-analysis');
  app.use('/api/meta-analysis', metaAnalysisRoutes);
  console.log("✅ Meta Analysis carregado: /api/meta-analysis");
} catch (e) {
  console.warn("⚠️  Meta Analysis não carregado:", e.message);
}

// ══════════════════════════════════════════════════════════════════════════════
// 404 E ERROR HANDLERS - SEMPRE POR ÚLTIMO!
// ══════════════════════════════════════════════════════════════════════════════

// ── Catch-all 404 ────────────────────────────────────────────────────────────
app.use((req, res) => {
  console.warn(`⚠️  404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Not Found',
    path: req.path,
    method: req.method,
    availableRoutes: [
      '/api/auth/*',
      '/api/deck/*',
      '/api/ai/*',
      '/api/meta/*',
      '/api/meta-analysis/*',
      '/api/deck-comparison/*'
    ]
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

// ══════════════════════════════════════════════════════════════════════════════
// START SERVER
// ══════════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3002;

const server = app.listen(PORT, () => {
  console.log(`\n✅ API on: http://localhost:${PORT}\n`);
  console.log('📋 Available routes:');
  console.log('   - /api/auth/*');
  console.log('   - /api/deck/*');
  console.log('   - /api/ai/*');
  console.log('   - /api/meta/*');
  console.log('   - /api/meta-analysis/*');
  console.log('   - /api/deck-comparison/*');
  console.log('');
  
  // Initialize cron jobs DEPOIS do servidor iniciar
  if (process.env.ENABLE_CRON !== 'false') {
    metaCron.init();
  } else {
    console.log('⚠️  Cron jobs desabilitados');
  }
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

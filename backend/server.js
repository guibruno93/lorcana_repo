"use strict";

/**
 * server-COMPLETE.js
 * Backend completo com todas as rotas necessárias
 * Auth carregado antes de Deck (deck.js usa authenticateToken).
 */
require('dotenv').config();

try {
  const { logEmailBootstrap } = require('./services/email-service');
  logEmailBootstrap();
} catch (e) {
  console.warn('Email bootstrap:', e.message);
}

if (String(process.env.AUTO_APPROVE_USERS || '').toLowerCase() === 'true') {
  console.log(
    'Auth: AUTO_APPROVE_USERS=true — novos cadastros são aprovados sem email; JWT devolvido no registo.'
  );
} else {
  console.log(
    'Auth: verificação por email no registo/login (defina AUTO_APPROVE_USERS=true para beta sem Resend).'
  );
}

const express = require("express");
const cors = require("cors");
const userRoutes = require('./routes/user');
const app = express();
// const metaCron = require('./jobs/meta-cron'); // torneios legacy

// ── CORS (Vercel + browser preflight) ───────────────────────────────────────
const extraOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowedCorsOrigin(origin) {
  if (process.env.CORS_ALLOW_ALL === "true") return true;
  const allow = new Set([
    "https://inkwell-labs.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    ...extraOrigins,
  ]);
  if (allow.has(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    if (host === "vercel.app" || host.endsWith(".vercel.app")) return true;
  } catch (_) {}
  return false;
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (isAllowedCorsOrigin(origin)) return callback(null, true);
    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "Origin",
    "X-Requested-With",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers",
  ],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

const corsMiddleware = cors(corsOptions);
app.use(corsMiddleware);
app.options("*", corsMiddleware);

// ── Middlewares ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use('/api/user', userRoutes);

// ── Logging middleware ───────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ══════════════════════════════════════════════════════════════════════════════
// Todas as rotas — ordem: Auth antes de Deck (deck.js importa authenticateToken).
// ══════════════════════════════════════════════════════════════════════════════

// 1. Auth
try {
  const auth = require('./routes/auth');
  app.use('/api/auth', auth);
  console.log("Auth carregado: /api/auth");
  
  // Rotas protegidas
  const { authenticateToken } = require('./routes/auth');
  app.get('/api/protected', authenticateToken, (req, res) => {
    res.json({ message: 'Protected route', user: req.user });
  });
} catch (e) {
  console.error("Auth não carregado:", e.message);
}

// 2. Deck
try {
  const deckRouter = require("./routes/deck");
  app.use("/api/deck", deckRouter);
  console.log("Deck router carregado: /api/deck");
} catch (e) {
  console.error("Deck router não carregado:", e.message);
}

// 3. AI services
try {
  const aiRouter = require("./routes/ai");
  app.use("/api/ai", aiRouter);
  console.log("AI router carregado: /api/ai");
  
  // Test if shuffle endpoint exists
  const endpoints = aiRouter.stack
    .filter(r => r.route)
    .map(r => Object.keys(r.route.methods)[0].toUpperCase() + ' ' + r.route.path);
  
  console.log("   Available AI endpoints:");
  endpoints.forEach(e => console.log(`   - ${e}`));
  
} catch (e) {
  console.error("AI router não carregado:", e.message);
}

// 4. Meta analyzer (/state) + análise scraped_decks (/share, /tier-list, /stats)
try {
  const metaRouter = require("./routes/M3ta");
  app.use("/api/meta", metaRouter);
  const scrapedMetaRouter = require("./routes/scraped-meta");
  app.use("/api/meta", scrapedMetaRouter);
  console.log(
    "Meta router carregado: /api/meta (state + share, tier-list, stats)"
  );
} catch (e) {
  console.warn("Meta router não carregado:", e.message);
}

// 5. Deck Comparison
try {
  const deckComparison = require('./routes/deckComparison');
  app.use('/api/deck-comparison', deckComparison);
  console.log("Deck Comparison carregado: /api/deck-comparison");
} catch (e) {
  console.warn("Deck Comparison não carregado:", e.message);
}

// 6. Meta Analysis
try {
  const metaAnalysisRoutes = require('./routes/meta-analysis');
  app.use('/api/meta-analysis', metaAnalysisRoutes);
  console.log("Meta Analysis carregado: /api/meta-analysis");
} catch (e) {
  console.warn("Meta Analysis não carregado:", e.message);
}

// 7. Tier lists (personalizadas + comunidade)
try {
  const tierListsRouter = require("./routes/tier-lists");
  app.use("/api/tier-lists", tierListsRouter);
  console.log("Tier lists: /api/tier-lists");
} catch (e) {
  console.warn("Tier lists não carregado:", e.message);
}

// 8. Coleção + wishlist (ficheiro local por utilizador autenticado)
try {
  const collectionRouter = require("./routes/collection");
  app.use("/api/collection", collectionRouter);
  console.log("Collection: /api/collection");
} catch (e) {
  console.warn("Collection não carregado:", e.message);
}

// 9. Busca de cartas (cards.json local)
try {
  const cardsRouter = require("./routes/cards");
  app.use("/api/cards", cardsRouter);
  console.log("Cards: /api/cards");
} catch (e) {
  console.warn("Cards API não carregado:", e.message);
}

// 10. Torneios (Swiss simplificado, ficheiro local)
try {
  const tournamentsRouter = require("./routes/tournaments");
  app.use("/api/tournaments", tournamentsRouter);
  console.log("Tournaments: /api/tournaments");
} catch (e) {
  console.warn("Tournaments não carregado:", e.message);
}

// ══════════════════════════════════════════════════════════════════════════════
// 404 E ERROR HANDLERS - SEMPRE POR ÚLTIMO!
// ══════════════════════════════════════════════════════════════════════════════

// ── Catch-all 404 ────────────────────────────────────────────────────────────
app.use((req, res) => {
  console.warn(`404 Not Found: ${req.method} ${req.path}`);
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
      '/api/deck-comparison/*',
      '/api/tier-lists/*',
      '/api/collection/*',
      '/api/cards/*',
      '/api/tournaments/*'
    ]
  });
});

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message 
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// START SERVER
// ══════════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3002;

let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`\nAPI on: http://localhost:${PORT}\n`);
    console.log('Available routes:');
    console.log('   - /api/auth/*');
    console.log('   - /api/deck/*');
    console.log('   - /api/ai/*');
    console.log('   - /api/meta/*');
    console.log('   - /api/meta-analysis/*');
    console.log('   - /api/deck-comparison/*');
    console.log('');

    if (process.env.ENABLE_CRON !== 'false') {
      // metaCron.init(); // legacy torneios
    } else {
      console.log('Cron jobs desabilitados (ENABLE_CRON=false)');
    }

    if (String(process.env.ENABLE_INKDECKS_NIGHTLY_CRON || '').toLowerCase() === 'true') {
      try {
        const inkCron = require('./jobs/inkdecks-meta-cron');
        inkCron.start();
        console.log('⏰ Cron meta: glossário LLM noturno ativo (ENABLE_INKDECKS_NIGHTLY_CRON).');
      } catch (e) {
        console.warn('inkdecks-meta-cron não iniciado:', e.message);
      }
    }
  });

  server.on('error', (e) => {
    if (e && e.code === 'EADDRINUSE') {
      console.error(
        `Porta ${PORT} já está em uso. Feche o processo anterior ou altere PORT.`
      );
    } else {
      console.error('Server error:', e);
    }
  });
}

module.exports = app;

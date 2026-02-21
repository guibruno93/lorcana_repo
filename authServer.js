// authServer.js
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");

const app = express();
app.use(cors({ origin: ["http://localhost:3000"], credentials: false }));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

// DB SQLite (arquivo local)
const db = new Database("auth.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    country TEXT,
    created_at TEXT NOT NULL
  );
`);

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name, country: row.country };
}

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name, country } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email e senha são obrigatórios" });
    if (String(password).length < 6) return res.status(400).json({ error: "Senha precisa ter pelo menos 6 caracteres" });

    const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (existing) return res.status(409).json({ error: "Email já cadastrado" });

    const password_hash = await bcrypt.hash(password, 10);
    const created_at = new Date().toISOString();

    const info = db.prepare(`
      INSERT INTO users (email, password_hash, name, country, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(email, password_hash, name || null, country || null, created_at);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
    const token = signToken(user);

    res.json({ token, user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: "Erro no register" });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email e senha são obrigatórios" });

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: "Erro no login" });
  }
});

// Middleware opcional pra proteger rotas
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Token ausente" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// Exemplo de rota protegida
app.get("/api/me", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log("Auth API rodando na porta", PORT));
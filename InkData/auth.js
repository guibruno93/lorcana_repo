/**
 * backend/routes/auth.js
 * Sistema de autenticação com JWT + bcrypt
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configurações
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';
const USERS_FILE = path.join(__dirname, '../data/users.json');

// Inicializar arquivo de usuários se não existir
function initUsersFile() {
  if (!fs.existsSync(USERS_FILE)) {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

// Carregar usuários
function loadUsers() {
  initUsersFile();
  const data = fs.readFileSync(USERS_FILE, 'utf8');
  return JSON.parse(data);
}

// Salvar usuários
function saveUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

// Criptografar dados sensíveis (AES-256)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

/**
 * Middleware: Verificar token JWT
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    next();
  });
}

/**
 * POST /api/auth/register
 * Registrar novo usuário
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, country } = req.body;
    
    // Validações
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters' 
      });
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }
    
    // Carregar usuários
    const data = loadUsers();
    
    // Verificar se email já existe
    const emailLower = email.toLowerCase();
    const exists = data.users.some(u => decrypt(u.email).toLowerCase() === emailLower);
    
    if (exists) {
      return res.status(409).json({ 
        error: 'Email already registered' 
      });
    }
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Criar usuário
    const user = {
      id: crypto.randomUUID(),
      email: encrypt(email),
      password: hashedPassword,
      name: name ? encrypt(name) : null,
      country: country ? encrypt(country) : null,
      createdAt: new Date().toISOString(),
      lastLogin: null,
    };
    
    // Salvar
    data.users.push(user);
    saveUsers(data);
    
    // Gerar token
    const token = jwt.sign(
      { 
        id: user.id,
        email: emailLower, // Email não criptografado no token (só ID + email)
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: emailLower,
        name: name || null,
        country: country || null,
      },
    });
    
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

/**
 * POST /api/auth/login
 * Login de usuário
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }
    
    // Carregar usuários
    const data = loadUsers();
    
    // Buscar usuário por email
    const emailLower = email.toLowerCase();
    const user = data.users.find(u => {
      try {
        return decrypt(u.email).toLowerCase() === emailLower;
      } catch {
        return false;
      }
    });
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }
    
    // Verificar senha
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }
    
    // Atualizar último login
    user.lastLogin = new Date().toISOString();
    saveUsers(data);
    
    // Gerar token
    const token = jwt.sign(
      { 
        id: user.id,
        email: emailLower,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: emailLower,
        name: user.name ? decrypt(user.name) : null,
        country: user.country ? decrypt(user.country) : null,
      },
    });
    
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

/**
 * GET /api/auth/me
 * Obter dados do usuário autenticado
 */
router.get('/me', authenticateToken, (req, res) => {
  try {
    const data = loadUsers();
    const user = data.users.find(u => u.id === req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: decrypt(user.email),
        name: user.name ? decrypt(user.name) : null,
        country: user.country ? decrypt(user.country) : null,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
    
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

/**
 * PUT /api/auth/me
 * Atualizar dados do usuário
 */
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const { name, country, newPassword } = req.body;
    
    const data = loadUsers();
    const user = data.users.find(u => u.id === req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    // Atualizar campos
    if (name !== undefined) {
      user.name = name ? encrypt(name) : null;
    }
    
    if (country !== undefined) {
      user.country = country ? encrypt(country) : null;
    }
    
    if (newPassword) {
      if (newPassword.length < 8) {
        return res.status(400).json({ 
          error: 'Password must be at least 8 characters' 
        });
      }
      user.password = await bcrypt.hash(newPassword, 10);
    }
    
    saveUsers(data);
    
    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: user.id,
        email: decrypt(user.email),
        name: user.name ? decrypt(user.name) : null,
        country: user.country ? decrypt(user.country) : null,
      },
    });
    
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Exportar middleware também
module.exports = router;
module.exports.authenticateToken = authenticateToken;

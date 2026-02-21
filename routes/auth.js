/**
 * backend/routes/auth.js
 * Sistema de autenticação com Supabase
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email-service');

// Configurações
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Gerar token de verificação
 */
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Buscar usuário por email
 */
async function findUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = not found (é esperado)
    console.error('Error finding user:', error);
    return null;
  }

  return data;
}

// ══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Middleware para verificar token JWT
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado' });
    }
    req.user = user;
    next();
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ROTAS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auth/register
 * Registrar novo usuário
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, country } = req.body;

    // Validações
    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Usuário deve ter no mínimo 3 caracteres' });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 8 caracteres' });
    }

    // Validar força da senha
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ error: 'Senha deve conter pelo menos uma letra maiúscula' });
    }
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({ error: 'Senha deve conter pelo menos uma letra minúscula' });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Senha deve conter pelo menos um número' });
    }

    // Verificar se email já existe
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Criar usuário no Supabase
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          username,
          email,
          password_hash: passwordHash,
          country: country || null,
          email_verified: false,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return res.status(500).json({ error: 'Erro ao criar usuário' });
    }

    // Gerar token de verificação
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const { error: tokenError } = await supabase
      .from('verification_tokens')
      .insert([
        {
          user_id: newUser.id,
          token: verificationToken,
          token_type: 'email_verification',
          email: email,
          expires_at: expiresAt.toISOString(),
        },
      ]);

    if (tokenError) {
      console.error('Token error:', tokenError);
      // Não falhar o registro se token não criar
    }

    // Enviar email de verificação
    try {
      await sendVerificationEmail(email, username, verificationToken);
    } catch (emailErr) {
      console.error('Error sending verification email:', emailErr);
      // Não falhar o registro se email não enviar
    }

    res.json({
      success: true,
      message: 'Usuário criado com sucesso! Verifique seu email.',
      userId: newUser.id,
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erro ao criar usuário' });
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
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    // Verificar senha
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    // Verificar se email foi verificado
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Email não verificado. Verifique sua caixa de entrada.',
        emailVerified: false,
      });
    }

    // Atualizar last_login e contador
    await supabase
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        login_count: (user.login_count || 0) + 1,
      })
      .eq('id', user.id);

    // Gerar token JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        country: user.country,
        emailVerified: user.email_verified,
      },
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

/**
 * GET /api/auth/verify-email/:token
 * Verificar email do usuário
 */
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Buscar token
    const { data: tokenData, error: tokenError } = await supabase
      .from('verification_tokens')
      .select('*')
      .eq('token', token)
      .eq('token_type', 'email_verification')
      .is('used_at', null)
      .single();

    if (tokenError || !tokenData) {
      return res.status(400).json({ error: 'Token inválido ou expirado' });
    }

    // Verificar expiração
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Token expirado. Solicite um novo email de verificação.' });
    }

    // Marcar usuário como verificado
    const { error: updateError } = await supabase
      .from('users')
      .update({
        email_verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', tokenData.user_id);

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({ error: 'Erro ao verificar email' });
    }

    // Marcar token como usado
    await supabase
      .from('verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    res.json({
      success: true,
      message: 'Email verificado com sucesso! Você já pode fazer login.',
    });

  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Erro ao verificar email' });
  }
});

/**
 * POST /api/auth/resend-verification
 * Reenviar email de verificação
 */
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    // Buscar usuário
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email já verificado' });
    }

    // Remover tokens antigos deste usuário
    await supabase
      .from('verification_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('token_type', 'email_verification');

    // Gerar novo token
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await supabase
      .from('verification_tokens')
      .insert([
        {
          user_id: user.id,
          token: verificationToken,
          token_type: 'email_verification',
          email: email,
          expires_at: expiresAt.toISOString(),
        },
      ]);

    // Reenviar email
    await sendVerificationEmail(email, user.username, verificationToken);

    res.json({
      success: true,
      message: 'Email de verificação reenviado!',
    });

  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Erro ao reenviar email' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Solicitar recuperação de senha
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    // Buscar usuário
    const user = await findUserByEmail(email);
    if (!user) {
      // Por segurança, retornar sucesso mesmo se usuário não existe
      return res.json({
        success: true,
        message: 'Se o email estiver cadastrado, você receberá instruções para recuperar sua senha.',
      });
    }

    // Remover tokens antigos de reset
    await supabase
      .from('verification_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('token_type', 'password_reset');

    // Gerar token de reset
    const resetToken = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await supabase
      .from('verification_tokens')
      .insert([
        {
          user_id: user.id,
          token: resetToken,
          token_type: 'password_reset',
          email: email,
          expires_at: expiresAt.toISOString(),
        },
      ]);

    // Enviar email
    await sendPasswordResetEmail(email, user.username, resetToken);

    res.json({
      success: true,
      message: 'Se o email estiver cadastrado, você receberá instruções para recuperar sua senha.',
    });

  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Erro ao processar solicitação' });
  }
});

/**
 * POST /api/auth/reset-password
 * Resetar senha com token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
    }

    // Validar nova senha
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 8 caracteres' });
    }

    // Buscar token
    const { data: tokenData, error: tokenError } = await supabase
      .from('verification_tokens')
      .select('*')
      .eq('token', token)
      .eq('token_type', 'password_reset')
      .is('used_at', null)
      .single();

    if (tokenError || !tokenData) {
      return res.status(400).json({ error: 'Token inválido ou expirado' });
    }

    // Verificar expiração
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Token expirado' });
    }

    // Atualizar senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokenData.user_id);

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({ error: 'Erro ao resetar senha' });
    }

    // Marcar token como usado
    await supabase
      .from('verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    res.json({
      success: true,
      message: 'Senha alterada com sucesso!',
    });

  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Erro ao resetar senha' });
  }
});

/**
 * GET /api/auth/me
 * Retornar dados do usuário autenticado
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, country, email_verified, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({
      success: true,
      user,
    });

  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

/**
 * PUT /api/auth/me
 * Atualizar dados do usuário
 */
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const { username, country } = req.body;

    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (username) updates.username = username;
    if (country !== undefined) updates.country = country;

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id);

    if (error) {
      console.error('Update error:', error);
      return res.status(500).json({ error: 'Erro ao atualizar dados' });
    }

    res.json({
      success: true,
      message: 'Dados atualizados com sucesso',
    });

  } catch (err) {
    console.error('Update me error:', err);
    res.status(500).json({ error: 'Erro ao atualizar dados' });
  }
});

// Exportar middleware também
module.exports = router;
module.exports.authenticateToken = authenticateToken;

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

/** Beta: cadastros sem email de verificação; login não exige email_verified. */
const AUTO_APPROVE_USERS = String(process.env.AUTO_APPROVE_USERS || '').toLowerCase() === 'true';

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
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function findUserByEmail(email) {
  const q = normalizeEmail(email);
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', q)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = not found (é esperado)
    console.error('Error finding user:', error);
    return null;
  }

  return data;
}

async function findUserByUsername(username) {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error finding username:', error);
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
    const emailNorm = normalizeEmail(email);

    // Validações
    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Usuário deve ter no mínimo 3 caracteres' });
    }

    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
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

    const existingUsername = await findUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ error: 'Nome de usuário já em uso' });
    }

    const existingUser = await findUserByEmail(emailNorm);
    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    if (AUTO_APPROVE_USERS) {
      const now = new Date().toISOString();
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            username,
            email: emailNorm,
            password_hash: passwordHash,
            country: country || null,
            email_verified: true,
            verified_at: now,
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error('Insert error (auto-approve):', insertError);
        return res.status(500).json({ error: 'Erro ao criar usuário' });
      }

      await supabase
        .from('users')
        .update({
          last_login_at: now,
          login_count: (newUser.login_count || 0) + 1,
        })
        .eq('id', newUser.id);

      const token = jwt.sign(
        { id: newUser.id, email: newUser.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      const userPayload = {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        country: newUser.country,
        emailVerified: true,
      };

      console.log('✅ User registered (auto-approved):', {
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email,
      });

      return res.status(201).json({
        success: true,
        message: 'Conta criada com sucesso!',
        autoApproved: true,
        token,
        user: userPayload,
      });
    }

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          username,
          email: emailNorm,
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

    const verificationToken = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { error: tokenError } = await supabase
      .from('verification_tokens')
      .insert([
        {
          user_id: newUser.id,
          token: verificationToken,
          token_type: 'email_verification',
          email: emailNorm,
          expires_at: expiresAt.toISOString(),
        },
      ]);

    if (tokenError) {
      console.error('Token error:', tokenError);
    }

    let emailResult = {
      sent: false,
      hint: 'Serviço de email indisponível.',
    };
    try {
      emailResult = await sendVerificationEmail(emailNorm, username, verificationToken);
    } catch (emailErr) {
      console.error('Register: exceção ao enviar email (versão antiga do serviço?):', emailErr.message);
      emailResult = {
        sent: false,
        code: emailErr.code || 'EMAIL_EXCEPTION',
        hint:
          'O servidor não conseguiu enviar o email (ex.: SMTP timeout no Render). Atualiza o backend no Git ou usa Resend.',
      };
    }

    const payload = {
      success: true,
      autoApproved: false,
      message: emailResult.sent
        ? 'Usuário criado com sucesso! Verifique seu email.'
        : 'Conta criada, mas o email de verificação não foi enviado.',
      userId: newUser.id,
      emailSent: emailResult.sent,
      emailMethod: emailResult.method,
      ...(emailResult.hint != null && emailResult.hint !== '' && { emailHint: emailResult.hint }),
      ...(emailResult.debugVerificationLink && {
        debugVerificationLink: emailResult.debugVerificationLink,
      }),
    };

    console.log('Registration response:', {
      userId: newUser.id,
      emailSent: emailResult.sent,
      method: emailResult.method,
      hint: emailResult.hint,
    });

    res.status(200).json(payload);
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

    if (!AUTO_APPROVE_USERS && !user.email_verified) {
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
 * Verificar email. No browser (clique no link do email) redireciona para APP_URL/login se APP_URL estiver definido.
 * Resposta JSON: adiciona ?api=1 à URL (ou header Accept só application/json).
 */
function browserWantsRedirect(req) {
  if (req.query.api === '1' || req.query.format === 'json') return false;
  const appBase = (process.env.APP_URL || '').trim().replace(/\/$/, '');
  if (!appBase || /localhost|127\.0\.0\.1/i.test(appBase)) return false;
  const accept = req.get('accept') || '';
  if (accept.includes('text/html')) return true;
  if (accept.includes('*/*')) return true;
  if (!accept) return true;
  return false;
}

function redirectVerify(req, res, pathWithQuery) {
  const appBase = (process.env.APP_URL || '').trim().replace(/\/$/, '');
  const url = `${appBase}${pathWithQuery.startsWith('/') ? '' : '/'}${pathWithQuery}`;
  return res.redirect(302, url);
}

/**
 * GET /api/auth/verify-email/:token
 */
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const { data: tokenData, error: tokenError } = await supabase
      .from('verification_tokens')
      .select('*')
      .eq('token', token)
      .eq('token_type', 'email_verification')
      .is('used_at', null)
      .single();

    if (tokenError || !tokenData) {
      if (browserWantsRedirect(req)) {
        return redirectVerify(
          req,
          res,
          '/login?verify=error&reason=' + encodeURIComponent('Token inválido ou já utilizado.')
        );
      }
      return res.status(400).json({ error: 'Token inválido ou expirado' });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      if (browserWantsRedirect(req)) {
        return redirectVerify(
          req,
          res,
          '/login?verify=error&reason=' + encodeURIComponent('Link expirado. Ped um novo email de verificação.')
        );
      }
      return res.status(400).json({ error: 'Token expirado. Solicite um novo email de verificação.' });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({
        email_verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', tokenData.user_id);

    if (updateError) {
      console.error('Update error:', updateError);
      if (browserWantsRedirect(req)) {
        return redirectVerify(req, res, '/login?verify=error&reason=' + encodeURIComponent('Erro ao confirmar.'));
      }
      return res.status(500).json({ error: 'Erro ao verificar email' });
    }

    await supabase
      .from('verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    if (browserWantsRedirect(req)) {
      return redirectVerify(req, res, '/login?verified=1');
    }

    res.json({
      success: true,
      message: 'Email verificado com sucesso! Você já pode fazer login.',
    });
  } catch (err) {
    console.error('Verify email error:', err);
    if (browserWantsRedirect(req)) {
      return redirectVerify(req, res, '/login?verify=error&reason=' + encodeURIComponent('Erro no servidor.'));
    }
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

    let emailResult = {
      sent: false,
      hint: 'Serviço de email indisponível.',
    };
    try {
      emailResult = await sendVerificationEmail(
        email,
        user.username,
        verificationToken
      );
    } catch (emailErr) {
      console.error('Resend: exceção ao enviar email:', emailErr.message);
      emailResult = {
        sent: false,
        code: emailErr.code || 'EMAIL_EXCEPTION',
        hint:
          emailErr.message ||
          'Falha ao enviar (ex.: SMTP timeout). Faz deploy do código novo ou configura Resend.',
      };
    }

    res.status(200).json({
      success: true,
      emailSent: emailResult.sent,
      emailMethod: emailResult.method,
      message: emailResult.sent
        ? 'Email de verificação reenviado!'
        : 'Não foi possível enviar o email. Verifica RESEND_API_KEY ou SMTP no servidor.',
      ...(emailResult.hint != null && emailResult.hint !== '' && { hint: emailResult.hint }),
      ...(emailResult.hint != null && emailResult.hint !== '' && { emailHint: emailResult.hint }),
      ...(emailResult.error && !emailResult.sent && { code: emailResult.error }),
      ...(emailResult.debugVerificationLink && {
        debugVerificationLink: emailResult.debugVerificationLink,
      }),
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

    const mailResult = await sendPasswordResetEmail(
      email,
      user.username,
      resetToken
    );
    if (!mailResult.sent) {
      console.warn('[auth] Password reset email not sent:', mailResult.code, mailResult.hint);
    }

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

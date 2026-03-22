/**
 * backend/routes/user.js
 * Endpoints de gerenciamento de usuário
 * ✅ COMPATÍVEL com routes/auth.js existente
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const { authenticateToken } = require('./auth'); // ← Importa do auth.js existente

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ═══════════════════════════════════════════════════════════════════
// GET /api/user/profile - Obter perfil do usuário
// ═══════════════════════════════════════════════════════════════════

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, username, avatar_url, country, email_verified, created_at, last_login_at')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      user: data
    });

  } catch (err) {
    console.error('❌ /profile error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// PUT /api/user/profile - Atualizar perfil
// ═══════════════════════════════════════════════════════════════════

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { username, avatar_url, country } = req.body;

    // Validar username
    if (username && username.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Username deve ter no mínimo 3 caracteres'
      });
    }

    // Preparar updates
    const updates = {
      updated_at: new Date().toISOString()
    };

    if (username) updates.username = username.trim();
    if (avatar_url !== undefined) updates.avatar_url = avatar_url || null;
    if (country !== undefined) updates.country = country || null;

    // Atualizar
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    // Retornar sem password_hash
    const { password_hash, ...user } = data;

    res.json({
      success: true,
      user,
      message: 'Perfil atualizado com sucesso'
    });

  } catch (err) {
    console.error('❌ /profile PUT error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// PUT /api/user/password - Alterar senha
// ═══════════════════════════════════════════════════════════════════

router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Senha atual e nova senha são obrigatórias'
      });
    }

    // Validar nova senha (mesmas regras do register)
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Senha deve ter no mínimo 8 caracteres'
      });
    }

    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'Senha deve conter pelo menos uma letra maiúscula'
      });
    }

    if (!/[a-z]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'Senha deve conter pelo menos uma letra minúscula'
      });
    }

    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'Senha deve conter pelo menos um número'
      });
    }

    // Buscar hash atual
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', req.user.id)
      .single();

    if (fetchError) throw fetchError;

    // Verificar senha atual
    const valid = await bcrypt.compare(currentPassword, userData.password_hash);

    if (!valid) {
      return res.status(401).json({
        success: false,
        error: 'Senha atual incorreta'
      });
    }

    // Hash nova senha
    const newHash = await bcrypt.hash(newPassword, 10);

    // Atualizar
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Senha atualizada com sucesso'
    });

  } catch (err) {
    console.error('❌ /password error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/user/avatar - Upload de avatar
// ═══════════════════════════════════════════════════════════════════

router.post('/avatar', authenticateToken, async (req, res) => {
  try {
    // TODO: Implementar upload para Supabase Storage ou S3
    // Por enquanto, aceitar URL direta

    const { avatar_url } = req.body;

    if (!avatar_url) {
      return res.status(400).json({
        success: false,
        error: 'avatar_url é obrigatório'
      });
    }

    const { error } = await supabase
      .from('users')
      .update({
        avatar_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id);

    if (error) throw error;

    res.json({
      success: true,
      avatar_url,
      message: 'Avatar atualizado com sucesso'
    });

  } catch (err) {
    console.error('❌ /avatar error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /api/user/account - Deletar conta
// ═══════════════════════════════════════════════════════════════════

router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const { confirmation } = req.body;

    // Verificar confirmação (email do usuário)
    const { data: userData } = await supabase
      .from('users')
      .select('email')
      .eq('id', req.user.id)
      .single();

    if (confirmation !== userData.email) {
      return res.status(400).json({
        success: false,
        error: 'Email de confirmação não corresponde'
      });
    }

    // Deletar usuário (CASCADE vai deletar decks, deck_cards, verification_tokens)
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.user.id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Conta deletada com sucesso'
    });

  } catch (err) {
    console.error('❌ /account DELETE error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;

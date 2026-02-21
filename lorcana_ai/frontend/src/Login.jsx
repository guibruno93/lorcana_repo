import React, { useState } from 'react';
import axios from 'axios';
import './Login.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3002';

function Login({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login', 'register', 'verify', 'forgot'
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    country: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success', 'error', 'info'

  // ══════════════════════════════════════════════════════════
  // VALIDAÇÕES
  // ══════════════════════════════════════════════════════════

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validatePassword = (password) => {
    if (password.length < 8) {
      return 'Senha deve ter no mínimo 8 caracteres';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Senha deve conter pelo menos uma letra maiúscula';
    }
    if (!/[a-z]/.test(password)) {
      return 'Senha deve conter pelo menos uma letra minúscula';
    }
    if (!/[0-9]/.test(password)) {
      return 'Senha deve conter pelo menos um número';
    }
    return null;
  };

  const validateForm = () => {
    const newErrors = {};

    if (mode === 'register') {
      // Username
      if (!formData.username || formData.username.length < 3) {
        newErrors.username = 'Usuário deve ter no mínimo 3 caracteres';
      }
      
      // Email
      if (!formData.email) {
        newErrors.email = 'Email é obrigatório';
      } else if (!validateEmail(formData.email)) {
        newErrors.email = 'Email inválido';
      }

      // Password
      const passwordError = validatePassword(formData.password);
      if (passwordError) {
        newErrors.password = passwordError;
      }

      // Confirm Password
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'As senhas não coincidem';
      }
    }

    if (mode === 'login') {
      if (!formData.email) {
        newErrors.email = 'Email é obrigatório';
      }
      if (!formData.password) {
        newErrors.password = 'Senha é obrigatória';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ══════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Limpar erro do campo quando usuário começa a digitar
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setMessage('');
    setErrors({});

    try {
      const response = await axios.post(`${API_BASE}/api/auth/register`, {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        country: formData.country || null,
      });

      setMessageType('success');
      setMessage('Cadastro realizado! Verifique seu email para confirmar sua conta.');
      setMode('verify');
      
      // Limpar formulário
      setFormData({
        username: '',
        email: formData.email, // Manter email para verificação
        password: '',
        confirmPassword: '',
        country: '',
      });

    } catch (err) {
      console.error('Register error:', err);
      setMessageType('error');
      
      if (err.response?.data?.error) {
        setMessage(err.response.data.error);
      } else {
        setMessage('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setMessage('');
    setErrors({});

    try {
      const response = await axios.post(`${API_BASE}/api/auth/login`, {
        email: formData.email,
        password: formData.password,
      });

      // Verificar se email foi verificado
      if (!response.data.user.emailVerified) {
        setMessageType('info');
        setMessage('Por favor, verifique seu email antes de fazer login.');
        setMode('verify');
        return;
      }

      // Salvar token e user
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      // Callback de sucesso
      if (onLoginSuccess) {
        onLoginSuccess(response.data.user);
      }

    } catch (err) {
      console.error('Login error:', err);
      setMessageType('error');
      
      if (err.response?.data?.error) {
        setMessage(err.response.data.error);
      } else {
        setMessage('Erro ao fazer login. Verifique suas credenciais.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!formData.email) {
      setMessage('Digite seu email');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await axios.post(`${API_BASE}/api/auth/resend-verification`, {
        email: formData.email,
      });

      setMessageType('success');
      setMessage('Email de verificação reenviado! Verifique sua caixa de entrada.');
    } catch (err) {
      setMessageType('error');
      setMessage(err.response?.data?.error || 'Erro ao reenviar email');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();

    if (!formData.email) {
      setErrors({ email: 'Email é obrigatório' });
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await axios.post(`${API_BASE}/api/auth/forgot-password`, {
        email: formData.email,
      });

      setMessageType('success');
      setMessage('Instruções para recuperar sua senha foram enviadas para seu email.');
    } catch (err) {
      setMessageType('error');
      setMessage(err.response?.data?.error || 'Erro ao enviar email');
    } finally {
      setLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    const levels = [
      { strength: 0, label: '', color: '' },
      { strength: 1, label: 'Muito fraca', color: '#ef4444' },
      { strength: 2, label: 'Fraca', color: '#f97316' },
      { strength: 3, label: 'Média', color: '#f59e0b' },
      { strength: 4, label: 'Forte', color: '#84cc16' },
      { strength: 5, label: 'Muito forte', color: '#10b981' },
    ];

    return levels[strength];
  };

  const passwordStrength = mode === 'register' ? getPasswordStrength(formData.password) : null;

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="gradient-circle circle-1"></div>
        <div className="gradient-circle circle-2"></div>
        <div className="gradient-circle circle-3"></div>
      </div>

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-icon">🃏</span>
            <span className="logo-text">Lorcana AI</span>
          </div>
          <h2 className="login-title">
            {mode === 'login' && 'Bem-vindo de volta'}
            {mode === 'register' && 'Criar nova conta'}
            {mode === 'verify' && 'Verificar email'}
            {mode === 'forgot' && 'Recuperar senha'}
          </h2>
          <p className="login-subtitle">
            {mode === 'login' && 'Entre com suas credenciais'}
            {mode === 'register' && 'Preencha os dados abaixo'}
            {mode === 'verify' && 'Verifique sua caixa de entrada'}
            {mode === 'forgot' && 'Digite seu email cadastrado'}
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`message message-${messageType}`}>
            {messageType === 'success' && '✅ '}
            {messageType === 'error' && '❌ '}
            {messageType === 'info' && 'ℹ️ '}
            {message}
          </div>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="login-form">
            {/* Username */}
            <div className="form-group">
              <label htmlFor="username">Usuário *</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className={errors.username ? 'error' : ''}
                placeholder="Seu nome de usuário"
                disabled={loading}
              />
              {errors.username && <span className="error-text">{errors.username}</span>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? 'error' : ''}
                placeholder="seu@email.com"
                disabled={loading}
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="password">Senha *</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'error' : ''}
                placeholder="Mínimo 8 caracteres"
                disabled={loading}
              />
              {errors.password && <span className="error-text">{errors.password}</span>}
              
              {/* Password Strength */}
              {formData.password && passwordStrength && passwordStrength.strength > 0 && (
                <div className="password-strength">
                  <div className="strength-bar">
                    <div 
                      className="strength-fill"
                      style={{ 
                        width: `${(passwordStrength.strength / 5) * 100}%`,
                        backgroundColor: passwordStrength.color
                      }}
                    />
                  </div>
                  <span style={{ color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirmar Senha *</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={errors.confirmPassword ? 'error' : ''}
                placeholder="Digite a senha novamente"
                disabled={loading}
              />
              {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
              {!errors.confirmPassword && formData.confirmPassword && formData.password === formData.confirmPassword && (
                <span className="success-text">✓ Senhas coincidem</span>
              )}
            </div>

            {/* Country */}
            <div className="form-group">
              <label htmlFor="country">País (opcional)</label>
              <select
                id="country"
                name="country"
                value={formData.country}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="">Selecione seu país</option>
                <option value="BR">Brasil</option>
                <option value="US">Estados Unidos</option>
                <option value="PT">Portugal</option>
                <option value="ES">Espanha</option>
                <option value="UK">Reino Unido</option>
                <option value="FR">França</option>
                <option value="DE">Alemanha</option>
                <option value="IT">Itália</option>
                <option value="CA">Canadá</option>
                <option value="MX">México</option>
                <option value="AR">Argentina</option>
                <option value="CL">Chile</option>
                <option value="CO">Colômbia</option>
                <option value="OTHER">Outro</option>
              </select>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar Conta'}
            </button>

            <div className="form-footer">
              Já tem uma conta?{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode('login');
                  setMessage('');
                  setErrors({});
                }}
              >
                Entrar
              </button>
            </div>
          </form>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="login-form">
            {/* Email */}
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? 'error' : ''}
                placeholder="seu@email.com"
                disabled={loading}
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="password">Senha</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'error' : ''}
                placeholder="Sua senha"
                disabled={loading}
              />
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="link-button-small"
                onClick={() => {
                  setMode('forgot');
                  setMessage('');
                  setErrors({});
                }}
              >
                Esqueceu a senha?
              </button>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <div className="form-footer">
              Não tem uma conta?{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode('register');
                  setMessage('');
                  setErrors({});
                }}
              >
                Criar conta
              </button>
            </div>
          </form>
        )}

        {/* VERIFY EMAIL SCREEN */}
        {mode === 'verify' && (
          <div className="verify-screen">
            <div className="verify-icon">📧</div>
            <p className="verify-text">
              Um email de verificação foi enviado para <strong>{formData.email}</strong>
            </p>
            <p className="verify-subtext">
              Clique no link do email para ativar sua conta.
            </p>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleResendVerification}
              disabled={loading}
            >
              {loading ? 'Reenviando...' : 'Reenviar email'}
            </button>

            <div className="form-footer">
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode('login');
                  setMessage('');
                }}
              >
                Voltar para login
              </button>
            </div>
          </div>
        )}

        {/* FORGOT PASSWORD FORM */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? 'error' : ''}
                placeholder="seu@email.com"
                disabled={loading}
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar instruções'}
            </button>

            <div className="form-footer">
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode('login');
                  setMessage('');
                  setErrors({});
                }}
              >
                Voltar para login
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="login-footer">
        <p>© 2026 Lorcana AI. Todos os direitos reservados.</p>
      </div>
    </div>
  );
}

export default Login;

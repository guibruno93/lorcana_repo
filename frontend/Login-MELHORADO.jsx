import React, { useState } from 'react';
import axios from 'axios';
import './Login.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3002';

function Login({ onLoginSuccess }) {
  const [mode, setMode] = useState('login');
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); 
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
  const [messageType, setMessageType] = useState('');

  // ══════════════════════════════════════════════════════════
  // VALIDAÇÕES
  // ══════════════════════════════════════════════════════════

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  // ✅ MELHORADO: Validação de username
  const validateUsername = (username) => {
    if (!username || username.length < 3) {
      return 'Usuário deve ter no mínimo 3 caracteres';
    }
    if (username.length > 20) {
      return 'Usuário deve ter no máximo 20 caracteres';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return 'Usuário só pode conter letras, números e _';
    }
    return null;
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
      const usernameError = validateUsername(formData.username);
      if (usernameError) {
        newErrors.username = usernameError;
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
      
      setFormData({
        username: '',
        email: formData.email,
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

      if (!response.data.user.emailVerified) {
        setMessageType('info');
        setMessage('Por favor, verifique seu email antes de fazer login.');
        setMode('verify');
        return;
      }

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

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
  // RENDER HELPERS
  // ══════════════════════════════════════════════════════════

  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    const labels = ['Muito fraca', 'Fraca', 'Média', 'Forte', 'Muito forte'];
    const colors = ['#e74c3c', '#e67e22', '#f39c12', '#27ae60', '#16a085'];

    return {
      strength: Math.min(strength, 5),
      label: labels[strength - 1] || '',
      color: colors[strength - 1] || '#95a5a6'
    };
  };

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>🪶 Inkwell Labs</h1>
          <p className="login-subtitle">
            {mode === 'login' && 'Bem-vindo de volta!'}
            {mode === 'register' && 'Criar sua conta'}
            {mode === 'verify' && 'Verificar Email'}
            {mode === 'forgot' && 'Recuperar Senha'}
          </p>
        </div>

        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="login-form">
            {/* Username */}
            <div className="form-group">
              <label htmlFor="username">Usuário</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className={errors.username ? 'error' : ''}
                placeholder="usuario123"
                disabled={loading}
                autoFocus 
              />
              {errors.username && <span className="error-text">{errors.username}</span>}
            </div>

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

            {/* Password com Toggle */}
            <div className="form-group">
              <label htmlFor="password">Senha</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'} // TOGGLE
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={errors.password ? 'error' : ''}
                  placeholder="Sua senha segura"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.password && <span className="error-text">{errors.password}</span>}
              
              {/*Password Strength Visual */}
              {formData.password && (
                <div className="password-strength">
                  <div className="password-strength-bar">
                    <div 
                      className="strength-fill"
                      style={{ 
                        width: `${(passwordStrength.strength / 5) * 100}%`,
                        backgroundColor: passwordStrength.color
                      }}
                    />
                  </div>
                  <span className="strength-label" style={{ color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password com Toggle */}
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirmar Senha</label>
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'} //  TOGGLE
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={errors.confirmPassword ? 'error' : ''}
                  placeholder="Digite a senha novamente"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
            </div>

            {/* Country (optional) */}
            <div className="form-group">
              <label htmlFor="country">País (opcional)</label>
              <input
                type="text"
                id="country"
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="Brasil"
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar conta'}
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
                Fazer login
              </button>
            </div>
          </form>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="login-form">
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
                autoFocus // 
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="password">Senha</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'} //  TOGGLE
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={errors.password ? 'error' : ''}
                  placeholder="Sua senha"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
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
              Um e-mail de verificação foi enviado para <strong>{formData.email}</strong>
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
                autoFocus //  NOVO
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

      {/* Rodapé com botão estilizado */}
      <div className="login-footer">
        <button
          type="button"
          className="link-button-small"
          onClick={() => setShowDisclaimer(true)}
        >
          ⚠️ Avisos Importantes
        </button>
        <p>© 2026 Inkwell Labs. Projeto de fãs, não oficial.</p>
      </div>

      {/* MODAL DE DISCLAIMER */}
      {showDisclaimer && (
        <div className="disclaimer-overlay" onClick={() => setShowDisclaimer(false)}>
          <div className="disclaimer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="disclaimer-header">
              <h2>⚠️ Avisos Legais e Importantes</h2>
              <button 
                className="close-button"
                onClick={() => setShowDisclaimer(false)}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="disclaimer-content">
              <section className="disclaimer-section">
                <h3>🎴 Sobre o Conteúdo</h3>
                <p>
                  <strong>Inkwell Labs</strong> é um projeto de fãs, não oficial e sem fins lucrativos. 
                  Disney Lorcana™ é uma marca registrada da Disney Enterprises, Inc. 
                  Todas as imagens de cartas, logos e conteúdo relacionado são propriedade 
                  de seus respectivos donos.
                </p>
                <p>
                  Este site não é afiliado, endossado ou patrocinado pela Disney, 
                  Ravensburger ou qualquer outra empresa relacionada ao jogo Disney Lorcana.
                </p>
              </section>

              <section className="disclaimer-section">
                <h3>📊 Dados e Privacidade</h3>
                <ul>
                  <li>Seus dados de deck são armazenados de forma segura</li>
                  <li>Não vendemos ou compartilhamos suas informações pessoais</li>
                  <li>Você pode excluir sua conta a qualquer momento</li>
                  <li>Usamos cookies apenas para autenticação e melhorias de UX</li>
                </ul>
              </section>

              <section className="disclaimer-section">
                <h3>🤖 Meta-Análise e IA</h3>
                <p>
                  As análises de meta e sugestões de deck são geradas por algoritmos 
                  baseados em dados da comunidade. <strong>Não garantimos precisão absoluta</strong> 
                  e recomendamos usar como referência, não como verdade definitiva.
                </p>
                <p>
                  Os dados de winrate e popularidade são estimados com base em amostras 
                  limitadas e podem não refletir o meta competitivo global.
                </p>
              </section>

              <section className="disclaimer-section">
                <h3>⚖️ Termos de Uso</h3>
                <ul>
                  <li>Você é responsável pelo conteúdo que publica (nomes de deck, comentários)</li>
                  <li>Não toleramos discurso de ódio ou comportamento abusivo</li>
                  <li>Reservamos o direito de remover conteúdo inadequado</li>
                  <li>O serviço é fornecido "como está", sem garantias</li>
                </ul>
              </section>

              <section className="disclaimer-section">
                <h3>🚧 Beta e Bugs</h3>
                <p>
                  Inkwell Labs está em desenvolvimento ativo. Bugs podem ocorrer e 
                  funcionalidades podem mudar sem aviso prévio. Agradecemos seu feedback 
                  e paciência enquanto melhoramos a plataforma!
                </p>
              </section>

              <section className="disclaimer-section disclaimer-footer-section">
                <p style={{ textAlign: 'center', color: '#999', fontSize: '13px', marginTop: '20px' }}>
                  Ao usar Inkwell Labs, você concorda com estes termos.<br />
                  <strong>Versão 1.0 - Março 2026</strong>
                </p>
              </section>
            </div>

            <div className="disclaimer-actions">
              <button 
                className="btn-primary"
                onClick={() => setShowDisclaimer(false)}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;

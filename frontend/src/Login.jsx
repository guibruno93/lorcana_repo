import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './Login.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3002';

const ALLOWED_POST_LOGIN = new Set([
  '/deck',
  '/hand',
  '/meta',
  '/cards',
  '/deck-builder',
  '/matchups',
  '/profile',
]);

function Login({ onLoginSuccess, initialMode = 'login' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(initialMode);
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
  const [postRegisterRedirect, setPostRegisterRedirect] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (mode !== 'register') setPostRegisterRedirect(false);
  }, [mode]);

  useEffect(() => {
    if (searchParams.get('verified') === '1') {
      setMode('login');
      setMessageType('success');
      setMessage('Email verificado! Já podes fazer login.');
    }
    if (searchParams.get('verify') === 'error') {
      setMode('login');
      setMessageType('error');
      const reason = searchParams.get('reason');
      if (!reason) {
        setMessage('Link de verificação inválido ou expirado.');
      } else {
        try {
          setMessage(decodeURIComponent(reason.replace(/\+/g, ' ')));
        } catch {
          setMessage(reason);
        }
      }
    }
  }, [searchParams]);

  function resolvePostLoginPath() {
    const raw = searchParams.get('next');
    if (raw && ALLOWED_POST_LOGIN.has(raw)) return raw;
    return '/deck';
  }

  // ══════════════════════════════════════════════════════════
  // VALIDAÇÕES
  // ══════════════════════════════════════════════════════════

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

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

    let deferLoadingOff = false;
    try {
      const response = await axios.post(`${API_BASE}/api/auth/register`, {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        country: formData.country || null,
      });

      const data = response.data || {};

      if (data.autoApproved && data.token && data.user) {
        deferLoadingOff = true;
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }
        setPostRegisterRedirect(true);
        setMessageType('success');
        setMessage(t('auth.accountCreatedAndLoggedIn'));
        setFormData({
          username: '',
          email: '',
          password: '',
          confirmPassword: '',
          country: '',
        });
        const dest = resolvePostLoginPath();
        setTimeout(() => {
          setLoading(false);
          navigate(dest, { replace: true });
        }, 900);
      } else {
        const {
          emailSent,
          emailHint,
          emailMethod,
          debugVerificationLink,
        } = data;

        navigate('/verify-email', {
          state: {
            email: formData.email,
            emailSent: !!emailSent,
            emailHint,
            emailMethod,
            debugVerificationLink,
          },
        });

        setFormData({
          username: '',
          email: formData.email,
          password: '',
          confirmPassword: '',
          country: '',
        });
      }
    } catch (err) {
      console.error('Register error:', err);
      setPostRegisterRedirect(false);
      setMessageType('error');

      if (err.response?.data?.error) {
        setMessage(err.response.data.error);
      } else {
        setMessage(t('auth.registrationFailed'));
      }
    } finally {
      if (!deferLoadingOff) setLoading(false);
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

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      if (onLoginSuccess) {
        onLoginSuccess(response.data.user);
      }
      navigate(resolvePostLoginPath(), { replace: true });

    } catch (err) {
      console.error('Login error:', err);
      setMessageType('error');

      if (err.response?.status === 403 && err.response?.data?.emailVerified === false) {
        navigate('/verify-email', {
          state: {
            email: formData.email,
            emailSent: false,
            emailHint: err.response.data.error,
            emailMethod: 'none',
          },
        });
        return;
      }

      if (err.response?.data?.error) {
        setMessage(err.response.data.error);
      } else {
        setMessage('Erro ao fazer login. Verifique suas credenciais.');
      }
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
      <div className="login-main">
        <div className="login-card">
        <div className="login-breadcrumb">
          <Link to="/">← Voltar ao início</Link>
        </div>
        <div className="login-header">
          <h1>Inkwell Labs</h1>
          <p className="login-subtitle">
            {mode === 'login' && 'Bem-vindo de volta!'}
            {mode === 'register' && 'Criar sua conta'}
            {mode === 'forgot' && 'Recuperar Senha'}
          </p>
        </div>

        {message && (
          <div className={`message ${messageType}`}>
            {message}
            {postRegisterRedirect && (
              <p className="redirect-hint">{t('auth.redirecting')}…</p>
            )}
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
                autoComplete="email"
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
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? t('common.hidePassword') : t('common.showPassword')}
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
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? t('common.hidePassword') : t('common.showPassword')}
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
                autoComplete="email"
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
                  autoComplete="current-password"
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
                  {showPassword ? t('common.hidePassword') : t('common.showPassword')}
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
      </div>

      <footer className="login-footer" role="contentinfo">
        <div className="login-footer-inner">
          <button
            type="button"
            className="login-footer-disclaimer-btn"
            onClick={() => setShowDisclaimer(true)}
          >
            Avisos importantes
          </button>
          <p className="login-footer-copy">
            © 2026 Inkwell Labs. Projeto de fãs, não oficial.
          </p>
        </div>
      </footer>

      {/* MODAL DE DISCLAIMER */}
      {showDisclaimer && (
        <div className="disclaimer-overlay" onClick={() => setShowDisclaimer(false)}>
          <div className="disclaimer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="disclaimer-header">
              <h2>Avisos legais e importantes</h2>
              <button 
                className="close-button"
                onClick={() => setShowDisclaimer(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="disclaimer-content">
              <section className="disclaimer-section">
                <h3>Sobre o conteúdo</h3>
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
                <h3>Dados e privacidade</h3>
                <ul>
                  <li>Seus dados de deck são armazenados de forma segura</li>
                  <li>Não vendemos ou compartilhamos suas informações pessoais</li>
                  <li>Você pode excluir sua conta a qualquer momento</li>
                  <li>Usamos cookies apenas para autenticação e melhorias de UX</li>
                </ul>
              </section>

              <section className="disclaimer-section">
                <h3>Meta-análise e IA</h3>
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
                <h3>Termos de uso</h3>
                <ul>
                  <li>Você é responsável pelo conteúdo que publica (nomes de deck, comentários)</li>
                  <li>Não toleramos discurso de ódio ou comportamento abusivo</li>
                  <li>Reservamos o direito de remover conteúdo inadequado</li>
                  <li>O serviço é fornecido "como está", sem garantias</li>
                </ul>
              </section>

              <section className="disclaimer-section">
                <h3>Beta e bugs</h3>
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

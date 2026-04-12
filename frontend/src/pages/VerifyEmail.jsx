import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import '../Login.css';
import './VerifyEmail.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3002';

export default function VerifyEmail() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    email: stateEmail,
    emailSent,
    emailHint,
    emailMethod,
    debugVerificationLink: stateDebugLink,
  } = location.state || {};

  const [tokenStatus, setTokenStatus] = useState('idle');
  const [tokenError, setTokenError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendType, setResendType] = useState('');

  const token = searchParams.get('token');
  const email = stateEmail || '';

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;
    setTokenStatus('loading');

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/auth/verify-email/${encodeURIComponent(token)}`,
          {
            headers: { Accept: 'application/json' },
          }
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.success) {
          setTokenStatus('ok');
          navigate('/login?verified=1', { replace: true });
          return;
        }
        setTokenStatus('err');
        setTokenError(data.error || t('auth.verifyFailed'));
      } catch (e) {
        if (!cancelled) {
          setTokenStatus('err');
          setTokenError(e.message || t('auth.verifyFailed'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, navigate, t]);

  const methodLabel =
    emailMethod === 'resend'
      ? 'Resend'
      : emailMethod === 'smtp'
        ? 'SMTP'
        : emailMethod === 'debug'
          ? 'Debug'
          : emailMethod === 'none'
            ? '—'
            : emailMethod || '—';

  const extraHintForMethod = () => {
    if (emailMethod === 'resend') return t('auth.resendNotConfigured');
    if (emailMethod === 'smtp') return t('auth.smtpTimeout');
    if (emailMethod === 'none') return t('auth.noEmailService');
    return '';
  };

  const handleResend = useCallback(async () => {
    if (!email) {
      setResendType('error');
      setResendMessage(t('auth.registeredEmail') + ': —');
      return;
    }
    setLoading(true);
    setResendMessage('');
    setResendType('');
    try {
      const { data } = await axios.post(`${API_BASE}/api/auth/resend-verification`, {
        email,
      });
      if (data.emailSent) {
        setResendType('success');
        setResendMessage(data.message || t('auth.emailSentSuccess'));
      } else {
        setResendType('info');
        const hint = data.emailHint || data.hint || '';
        setResendMessage([data.message, hint].filter(Boolean).join('\n\n'));
      }
    } catch (err) {
      setResendType('error');
      setResendMessage(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [email, t]);

  if (token) {
    if (tokenStatus === 'loading' || tokenStatus === 'idle') {
      return (
        <div className="verify-email-page">
          <div className="verify-email-card">
            <p className="lead">{t('auth.verifying')}</p>
          </div>
        </div>
      );
    }
    if (tokenStatus === 'err') {
      return (
        <div className="verify-email-page">
          <div className="verify-email-card">
            <div className="verify-email-icon verify-email-icon--error" aria-hidden="true" />
            <h1>{t('auth.verifyFailed')}</h1>
            <p className="verify-email-hint">{tokenError}</p>
            <div className="verify-email-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate('/login')}
              >
                {t('auth.goToLogin')}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  if (!email && !stateEmail) {
    return (
      <div className="verify-email-page">
        <div className="verify-email-card">
          <div className="verify-email-breadcrumb">
            <Link to="/login">← {t('auth.backToLogin')}</Link>
          </div>
          <h1>{t('auth.verifyEmail')}</h1>
          <p className="lead">{t('auth.missingContext')}</p>
          <button type="button" className="btn-primary" onClick={() => navigate('/register')}>
            {t('auth.registerCta')}
          </button>
        </div>
      </div>
    );
  }

  const debugLink = stateDebugLink;

  return (
    <div className="verify-email-page">
      <div className="verify-email-card">
        <div className="verify-email-breadcrumb">
          <Link to="/login">← {t('auth.backToLogin')}</Link>
        </div>

        <h1>{t('auth.verifyEmail')}</h1>

        {emailSent ? (
          <>
            <div className="verify-email-icon verify-email-icon--success" aria-hidden="true" />
            <p className="lead">{t('auth.emailSentTo', { email })}</p>
            <p className="lead">{t('auth.checkInbox')}</p>
            <p className="lead" style={{ fontSize: '0.95rem' }}>
              {t('auth.sentVia')}: {methodLabel}
            </p>
          </>
        ) : (
          <>
            <div className="verify-email-icon verify-email-icon--error" aria-hidden="true" />
            <p className="lead">{t('auth.accountCreatedButNoEmail')}</p>
            <p className="lead">
              <strong>{t('auth.registeredEmail')}:</strong> {email}
            </p>
            {emailHint && (
              <div className="verify-email-hint">
                <strong>{t('auth.technicalDetails')}:</strong>
                <br />
                {emailHint}
              </div>
            )}
            {!emailHint && extraHintForMethod() && (
              <div className="verify-email-hint">{extraHintForMethod()}</div>
            )}
            {debugLink && (
              <div>
                <p className="lead" style={{ fontSize: '0.95rem' }}>
                  <strong>{t('auth.debugMode')}</strong> — {t('auth.useThisLink')}
                </p>
                <input
                  type="text"
                  value={debugLink}
                  readOnly
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => e.target.select()}
                  className="debug-link-input"
                  aria-label={t('auth.useThisLink')}
                />
                <div className="verify-email-actions" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => window.open(debugLink, '_blank', 'noopener,noreferrer')}
                  >
                    {t('auth.verifyNow')}
                  </button>
                </div>
              </div>
            )}
            <div className="verify-email-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/login')}
              >
                {t('auth.backToLogin')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleResend}
                disabled={loading}
              >
                {loading ? t('common.loading') + '…' : t('auth.resendEmail')}
              </button>
            </div>
            {resendMessage && (
              <div
                className={`verify-email-hint ${resendType === 'success' ? '' : ''}`}
                style={{
                  borderLeft:
                    resendType === 'success'
                      ? '4px solid #22c55e'
                      : resendType === 'error'
                        ? '4px solid #ef4444'
                        : '4px solid #94a3b8',
                }}
              >
                {resendMessage}
              </div>
            )}
            <div className="admin-note">
              <strong>{t('auth.adminNote')}</strong>
              <p style={{ margin: '8px 0 0 0' }}>{t('auth.configureResend')}</p>
              <code>RESEND_API_KEY=re_…</code>
              <code>RESEND_FROM=&quot;Inkwell Labs &lt;onboarding@resend.dev&gt;&quot;</code>
              <p style={{ marginTop: 12 }}>{t('auth.orEnableDebug')}</p>
              <code>AUTH_DEBUG_VERIFICATION_LINK=true</code>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

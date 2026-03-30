import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useNavigate,
  useLocation,
  Navigate,
  Outlet,
} from 'react-router-dom';
import Logo from './Logo';
import LanguageSelector from './LanguageSelector';

function LoadingSpinner() {
  return (
    <div className="loading-spinner">
      <div className="spinner" />
    </div>
  );
}

export default function AuthenticatedLayout({
  user,
  setUser,
  deckText,
  setDeckText,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const activeTab = location.pathname.split('/')[1] || 'deck';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/', { replace: true });
  };

  return (
    <div className="app-container">
      <header className="app-header glass">
        <div className="header-left">
          <Logo size="medium" animated />
        </div>
        <div className="header-right">
          <LanguageSelector />
          <span
            className="user-greeting"
            onClick={() => navigate('/profile')}
            style={{ cursor: 'pointer' }}
            title={t('userProfile.viewProfile')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate('/profile');
            }}
          >
            👤 {user.username || user.name}
          </span>
          <button type="button" onClick={handleLogout} className="btn btn-ghost">
            {t('auth.logout')}
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button
          type="button"
          onClick={() => navigate('/deck')}
          className={`tab ${activeTab === 'deck' ? 'tab-active' : ''}`}
        >
          📋 {t('tabs.deck')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/hand')}
          className={`tab ${activeTab === 'hand' ? 'tab-active' : ''}`}
        >
          🎴 {t('tabs.hand')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/cards')}
          className={`tab ${activeTab === 'cards' ? 'tab-active' : ''}`}
        >
          🃏 {t('tabs.cards')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/deck-builder')}
          className={`tab ${activeTab === 'deck-builder' ? 'tab-active' : ''}`}
        >
          🎨 {t('tabs.deckBuilder')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/matchups')}
          className={`tab ${activeTab === 'matchups' ? 'tab-active' : ''}`}
        >
          ⚔️ {t('tabs.matchups')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/meta')}
          className={`tab ${activeTab === 'meta' ? 'tab-active' : ''}`}
        >
          📊 {t('tabs.meta')}
        </button>
      </nav>

      <main className="app-main">
        <Suspense fallback={<LoadingSpinner />}>
          <Outlet context={{ user, setUser, deckText, setDeckText }} />
        </Suspense>
      </main>
    </div>
  );
}

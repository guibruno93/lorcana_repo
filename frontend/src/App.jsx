/* Inkwell Labs — rotas principais (não misturar com App.i18n.jsx) */
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import './styles.css';
import './DesignSystem.css';
import './LoadingSpinner.css';

import Login from './Login';
import LandingPage from './pages/LandingPage';
import LegalPage from './pages/LegalPage';
import AuthenticatedLayout from './components/AuthenticatedLayout';

const DeckAnalyzer = lazy(() => import('./DeckAnalyzer'));
const HandAnalyzer = lazy(() => import('./HandAnalyzer'));
const Matchups = lazy(() => import('./Matchups'));
const MetaDashboard = lazy(() => import('./MetaDashboard'));
const ArchetypePage = lazy(() => import('./components/ArchetypePage'));
const CardDatabase = lazy(() => import('./CardDatabase'));
const DeckBuilder = lazy(() => import('./DeckBuilder/DeckBuilder'));
const UserProfile = lazy(() => import('./UserProfile'));
const TierListGenerator = lazy(() => import('./components/TierListGenerator'));

function TierListSuspense() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '40vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            background: '#0f172a',
          }}
        >
          …
        </div>
      }
    >
      <TierListGenerator />
    </Suspense>
  );
}

const API = process.env.REACT_APP_API_URL || 'http://localhost:3002';

async function apiFetch(endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const api = {
  analyze: (text, opts) =>
    apiFetch('/api/deck/analyze', { decklist: text, ...opts }),
  matchups: (text) => apiFetch('/api/deck/matchups', { deckText: text }),
  shuffle: (text) => apiFetch('/api/ai/shuffle', { decklist: text }),
  mulligan: (hand, text) =>
    apiFetch('/api/ai/mulligan', { hand, decklist: text }),
  simMulligan: (hand, indices, text) =>
    apiFetch('/api/ai/simulate-mulligan', {
      hand,
      mulligan: indices,
      decklist: text,
    }),
};

export default function App() {
  const [user, setUser] = useState(null);
  const [deckText, setDeckText] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) return;
    try {
      setUser(JSON.parse(savedUser));
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            user ? <Navigate to="/deck" replace /> : <LandingPage />
          }
        />
        <Route path="/login" element={<Login onLoginSuccess={setUser} />} />
        <Route
          path="/register"
          element={<Login onLoginSuccess={setUser} initialMode="register" />}
        />
        <Route
          path="/terms"
          element={
            <LegalPage title="Termos de uso">
              <p>
                Os termos completos serão publicados aqui. O Inkwell Labs é um
                projeto de fãs, não oficial, dedicado a ferramentas para a
                comunidade Lorcana.
              </p>
            </LegalPage>
          }
        />
        <Route
          path="/privacy"
          element={
            <LegalPage title="Privacidade">
              <p>
                Política de privacidade em elaboração. Não vendemos os teus
                dados; a autenticação serve para melhorar a experiência na
                aplicação.
              </p>
            </LegalPage>
          }
        />

        <Route path="/tier-lists/:shareId" element={<TierListSuspense />} />

        <Route
          element={
            <AuthenticatedLayout
              user={user}
              setUser={setUser}
              deckText={deckText}
              setDeckText={setDeckText}
            />
          }
        >
          <Route path="/deck" element={<DeckAnalyzer />} />
          <Route path="/hand" element={<HandAnalyzer />} />
          <Route path="/cards" element={<CardDatabase />} />
          <Route path="/deck-builder" element={<DeckBuilder />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/matchups" element={<Matchups />} />
          <Route path="/meta" element={<MetaDashboard />} />
          <Route path="/meta/tier-lists" element={<TierListSuspense />} />
          <Route
            path="/meta/scraped-performance"
            element={<Navigate to="/meta" replace />}
          />
          <Route path="/archetype/:archetypeId" element={<ArchetypePage />} />
          <Route path="*" element={<Navigate to="/deck" replace />} />
        </Route>
      </Routes>
      <SpeedInsights />
    </>
  );
}

export { api, apiFetch };

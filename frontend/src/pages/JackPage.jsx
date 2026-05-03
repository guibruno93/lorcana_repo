import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../DeckAnalyzer.css';
import './CoachPages.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3002';

export default function JackPage() {
  const { t } = useTranslation();
  const { deckText } = useOutletContext() || {};
  const [localDeck, setLocalDeck] = useState(() =>
    deckText != null && deckText !== '' ? deckText : ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const loadDeckFromContext = () => {
    if (deckText != null) setLocalDeck(deckText);
  };

  const runJack = async () => {
    if (!localDeck.trim()) {
      setError(t('coach.jackNeedList'));
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API}/api/ai/jack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decklist: localDeck }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data);
    } catch (e) {
      setError(e.message || 'Erro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sidebar-layout coach-page">
      <div className="flex flex-col gap-3">
        <div className="coach-hero">
          <h1>
            {t('tabs.deckCoach')}
            {result?.source && (
              <span className="coach-badge">
                {result.source === 'anthropic' ? 'IA' : 'Local'}
              </span>
            )}
          </h1>
          <p>{t('coach.jackLead')}</p>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">
              <span className="icon icon--accent" aria-hidden="true" />{' '}
              {t('coach.decklistLabel')}
            </span>
          </div>
          <div className="panel-body">
            <textarea
              className="decklist-area"
              value={localDeck}
              onChange={(e) => setLocalDeck(e.target.value)}
              placeholder={t('deckAnalyzer.placeholder')}
              rows={12}
            />
            <div className="coach-panel-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={runJack}
                disabled={loading}
              >
                {loading ? t('coach.jackRunning') : t('coach.jackRun')}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={loadDeckFromContext}
              >
                {t('coach.loadFromDeckTab')}
              </button>
            </div>
            <p className="coach-sync-hint">{t('coach.jackSyncHint')}</p>
          </div>
        </div>

        {error && <div className="err-box">{error}</div>}
      </div>

      <div className="flex flex-col gap-4">
        {result && (
          <>
            {result.suggestedOpponent && (
              <div className="coach-result-block">
                <h3>{t('coach.jackOpponent')}</h3>
                <p>{result.suggestedOpponent}</p>
              </div>
            )}
            {result.hand && result.hand.length === 7 && (
              <div className="coach-result-block">
                <h3>{t('coach.jackHand')}</h3>
                <p className="coach-jack-hand">{result.hand.join(' · ')}</p>
              </div>
            )}
            <div className="coach-result-block">
              <h3>{t('coach.jackScenario')}</h3>
              <p>{result.scenario}</p>
            </div>
            <div className="coach-result-block">
              <h3>{t('coach.jackOpening')}</h3>
              <p>{result.openingPlan}</p>
            </div>
            <div className="coach-result-block">
              <h3>{t('coach.jackMulligan')}</h3>
              <p>{result.mulliganAdvice}</p>
            </div>
            {(result.pivotPlays || []).length > 0 && (
              <div className="coach-result-block">
                <h3>{t('coach.jackPivots')}</h3>
                <ul>
                  {(result.pivotPlays || []).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.riskNote && (
              <div className="coach-result-block">
                <h3>{t('coach.jackRisk')}</h3>
                <p className="coach-meta-note">{result.riskNote}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

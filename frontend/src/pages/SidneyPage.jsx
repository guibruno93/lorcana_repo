import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../DeckAnalyzer.css';
import './CoachPages.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3002';

export default function SidneyPage() {
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

  const runSidney = async () => {
    if (!localDeck.trim()) {
      setError(t('coach.sidneyNeedList'));
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API}/api/ai/sidney`, {
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

  const arch =
    result?.structured?.archetype ||
    result?.matchupsSummary?.deck?.archetype;

  return (
    <div className="sidebar-layout coach-page">
      <div className="flex flex-col gap-3">
        <div className="coach-hero">
          <h1>
            {t('coach.sidneyTitle')}
            {result?.source && (
              <span className="coach-badge">
                {result.source === 'anthropic' ? 'IA' : 'Local'}
              </span>
            )}
          </h1>
          <p>{t('coach.sidneyLead')}</p>
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
              rows={14}
            />
            <div className="coach-panel-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={runSidney}
                disabled={loading}
              >
                {loading ? t('coach.diagnosing') : t('coach.diagnose')}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={loadDeckFromContext}
              >
                {t('coach.loadFromDeckTab')}
              </button>
            </div>
            <p className="coach-sync-hint">{t('coach.sidneySyncHint')}</p>
          </div>
        </div>

        {error && <div className="err-box">{error}</div>}
      </div>

      <div className="flex flex-col gap-4">
        {result && (
          <>
            {arch && (
              <div className="coach-result-block">
                <h3>{t('coach.sidneyServerArchetype')}</h3>
                <p>
                  {arch}
                  {result.structured?.archetypeConfidence != null && (
                    <span className="coach-meta-note">
                      {' '}
                      ({Math.round((result.structured.archetypeConfidence || 0) * 100)}%)
                    </span>
                  )}
                </p>
              </div>
            )}
            <div className="coach-result-block">
              <h3>{t('coach.summary')}</h3>
              <p>{result.summary}</p>
            </div>
            <div className="coach-result-block">
              <h3>{t('coach.strengths')}</h3>
              <ul>
                {(result.strengths || []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="coach-result-block">
              <h3>{t('coach.weaknesses')}</h3>
              <ul>
                {(result.weaknesses || []).length ? (
                  (result.weaknesses || []).map((s, i) => <li key={i}>{s}</li>)
                ) : (
                  <li>{t('coach.noneListed')}</li>
                )}
              </ul>
            </div>
            {(result.swaps || []).length > 0 && (
              <div className="coach-result-block">
                <h3>{t('coach.swaps')}</h3>
                <table className="coach-swaps-table">
                  <thead>
                    <tr>
                      <th>{t('coach.swapOut')}</th>
                      <th>{t('coach.swapIn')}</th>
                      <th>{t('coach.swapWhy')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.swaps || []).map((row, i) => (
                      <tr key={i}>
                        <td>{row.out || row.remove || '—'}</td>
                        <td>{row.in || row.add || '—'}</td>
                        <td>{row.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result.metaNote && (
              <div className="coach-result-block">
                <h3>{t('coach.metaNote')}</h3>
                <p className="coach-meta-note">{result.metaNote}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

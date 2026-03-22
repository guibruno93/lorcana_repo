import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3002';

async function apiFetch(endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const api = {
  shuffle: (text) => apiFetch("/api/ai/shuffle", { decklist: text }),
  mulligan: (hand, text) => apiFetch("/api/ai/mulligan", { hand, decklist: text }),
  simMulligan: (hand, indices, text) =>
    apiFetch("/api/ai/simulate-mulligan", { hand, mulligan: indices, decklist: text }),
};

export default function HandAnalyzer({ deckText }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [hand, setHand] = useState([]);
  const [advice, setAdvice] = useState(null);
  const [simulated, setSimulated] = useState(null);

  async function shuffle() {
    if (!deckText.trim()) {
      setErr(t('deckAnalyzer.paste'));
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const data = await api.shuffle(deckText);
      setHand(data.hand || []);
      setAdvice(null);
      setSimulated(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function analyze() {
    if (hand.length === 0) return;
    setLoading(true);
    setErr('');
    try {
      const data = await api.mulligan(hand, deckText);
      setAdvice(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function simulateMulligan() {
    if (!advice || !advice.mulligan) return;
    setLoading(true);
    setErr('');
    try {
      const data = await api.simMulligan(hand, advice.mulligan, deckText);
      setSimulated(data.newHand || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tab-layout">
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">🎴 {t('handAnalyzer.title')}</span>
        </div>
        <div className="panel-body">
          <button onClick={shuffle} disabled={loading} className="btn btn-primary">
            {loading ? `⏳ ${t('handAnalyzer.shuffling')}` : `🔀 ${t('handAnalyzer.shuffle')}`}
          </button>

          {err && <div className="err-box">{err}</div>}

          {hand.length > 0 && (
            <>
              <div className="hand-grid">
                {hand.map((card, i) => {
                  const shouldMull = advice?.mulligan?.includes(i);
                  return (
                    <div key={i} className={`hand-card ${shouldMull ? 'mull-card' : ''}`}>
                      <span className="card-name">{card}</span>
                      {advice && (
                        <span className={shouldMull ? 'mull-badge' : 'keep-badge'}>
                          {shouldMull ? t('handAnalyzer.mulligan') : t('handAnalyzer.keep')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {!advice && (
                <button onClick={analyze} disabled={loading} className="btn btn-primary">
                  {loading ? `⏳ ${t('handAnalyzer.analyzing')}` : `🤖 ${t('handAnalyzer.analyze')}`}
                </button>
              )}

              {advice && (
                <>
                  <div className="mulligan-advice">
                    <strong>{t('handAnalyzer.recommendation')}:</strong> {advice.decision}
                    <br />
                    <em>{advice.reason || advice.reasoning}</em>
                  </div>

                  {advice.mulligan && advice.mulligan.length > 0 && !simulated && (
                    <button onClick={simulateMulligan} disabled={loading} className="btn btn-primary">
                      {loading ? `⏳ ${t('handAnalyzer.simulating')}` : `🔄 ${t('handAnalyzer.simulate')}`}
                    </button>
                  )}

                  {simulated && (
                    <>
                      <h4>{t('handAnalyzer.newHand')}:</h4>
                      <div className="hand-grid">
                        {simulated.map((card, i) => (
                          <div key={i} className="hand-card">
                            <span className="card-name">{card}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {!deckText.trim() && (
            <div className="panel">
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                {t('handAnalyzer.emptyState')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

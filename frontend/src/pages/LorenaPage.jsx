import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../DeckAnalyzer.css';
import './CoachPages.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3002';

export default function LorenaPage() {
  const { t } = useTranslation();
  const { deckText } = useOutletContext() || {};
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [includeDeck, setIncludeDeck] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: t('coach.lorenaWelcome'),
      },
    ]);
  }, [t]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setError(null);
    setLoading(true);
    try {
      const payload = {
        messages: next.map((m) => ({ role: m.role, content: m.content })),
      };
      if (includeDeck && deckText && deckText.trim().length > 20) {
        payload.decklist = deckText;
      }
      const res = await fetch(`${API}/api/ai/lorena`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply || t('coach.lorenaEmpty') },
      ]);
    } catch (e) {
      setError(e.message || 'Erro');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: t('coach.lorenaError', { msg: e.message || '' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="coach-page">
      <div className="coach-hero">
        <h1>{t('coach.lorenaTitle')}</h1>
        <p>{t('coach.lorenaLead')}</p>
      </div>

      {error && (
        <div className="err-box" style={{ marginBottom: '0.75rem' }}>
          {error}
        </div>
      )}

      <div className="sage-chat">
        <div className="sage-messages">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`sage-msg sage-msg--${m.role === 'user' ? 'user' : 'assistant'}`}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="sage-msg sage-msg--assistant">{t('coach.lorenaTyping')}</div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="sage-options">
          <label>
            <input
              type="checkbox"
              checked={includeDeck}
              onChange={(e) => setIncludeDeck(e.target.checked)}
            />
            {t('coach.lorenaIncludeDeck')}
          </label>
        </div>
        <div className="sage-input-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('coach.lorenaPlaceholder')}
            rows={2}
            disabled={loading}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={send}
            disabled={loading || !input.trim()}
          >
            {t('coach.send')}
          </button>
        </div>
      </div>
    </div>
  );
}

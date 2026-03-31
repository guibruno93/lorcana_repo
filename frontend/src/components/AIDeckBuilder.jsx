import React, { useState, useCallback } from 'react';
import './AIDeckBuilder.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

const EXAMPLES = {
  create: [
    'Deck Ruby/Amethyst aggro com pressão nos primeiros turnos',
    'Deck Sapphire/Steel de controle com remoção e card draw',
    'Mid-range Emerald/Amber com personagens médios',
  ],
  optimize: [
    'Torna o deck mais forte contra aggro',
    'Melhora a curva de mana',
    'Aumenta consistência (mais draw)',
  ],
  budget: [
    'Substitui as cartas mais caras por alternativas mais baratas',
    'Versão budget mantendo a estratégia geral',
  ],
};

function flattenDeckCards(cardsObj) {
  if (!cardsObj || typeof cardsObj !== 'object') return [];
  const lines = [];
  for (const [, list] of Object.entries(cardsObj)) {
    if (!Array.isArray(list)) continue;
    for (const c of list) {
      if (c && c.name && c.quantity)
        lines.push(`${c.quantity}x ${c.name}`);
    }
  }
  return lines.join('\n');
}

export default function AIDeckBuilder() {
  const [mode, setMode] = useState('create');
  const [prompt, setPrompt] = useState('');
  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateDeck = async () => {
    if (!prompt.trim()) {
      window.alert('Escreve o que queres que a IA faça.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/ai/generate-deck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          mode,
          existingDeck: mode !== 'create' ? deck : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDeck(data.deck);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Erro');
    } finally {
      setLoading(false);
    }
  };

  const saveDeck = useCallback(() => {
    if (!deck) return;
    try {
      const key = `ai_deck_${Date.now()}`;
      localStorage.setItem(
        key,
        JSON.stringify({ savedAt: new Date().toISOString(), deck })
      );
      window.alert('Deck guardado localmente no navegador.');
    } catch (e) {
      window.alert('Não foi possível guardar.');
    }
  }, [deck]);

  const copyList = useCallback(() => {
    if (!deck?.cards) return;
    const text = flattenDeckCards(deck.cards);
    navigator.clipboard.writeText(text).then(
      () => window.alert('Lista copiada.'),
      () => window.alert('Clipboard indisponível.')
    );
  }, [deck]);

  return (
    <div className="ai-deckbuilder">
      <header className="ai-deckbuilder__head">
        <h1>Construtor de decks (IA)</h1>
        <p>Descreve o deck; o servidor usa Claude se ANTHROPIC_API_KEY estiver definida.</p>
      </header>

      <div className="ai-deckbuilder__modes">
        {[
          ['create', 'Criar'],
          ['optimize', 'Otimizar'],
          ['budget', 'Budget'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={mode === id ? 'is-active' : ''}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="ai-deckbuilder__prompt">
        <label htmlFor="ai-prompt">Pedido</label>
        <textarea
          id="ai-prompt"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={EXAMPLES[mode][0]}
        />
        <div className="ai-deckbuilder__examples">
          <span>Exemplos:</span>
          {EXAMPLES[mode].map((ex) => (
            <button key={ex} type="button" onClick={() => setPrompt(ex)}>
              {ex}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ai-deckbuilder__go"
          disabled={loading || !prompt.trim()}
          onClick={generateDeck}
        >
          {loading ? 'A gerar…' : 'Gerar deck'}
        </button>
      </section>

      {loading && (
        <div className="ai-deckbuilder__loading">
          <div className="ai-deckbuilder__spinner" />
          <p>A processar…</p>
        </div>
      )}

      {error && (
        <div className="ai-deckbuilder__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setError(null)}>
            Fechar
          </button>
        </div>
      )}

      {deck && !loading && (
        <article className="ai-deckbuilder__result">
          <header>
            <h2>{deck.name}</h2>
            <p className="ai-deckbuilder__meta">
              {deck.archetype}
            </p>
          </header>
          {deck.strategy && (
            <section>
              <h3>Estratégia</h3>
              <p>{deck.strategy}</p>
            </section>
          )}
          <section>
            <h3>Decklist</h3>
            {deck.cards &&
              Object.entries(deck.cards).map(([cat, list]) => (
                <div key={cat} className="ai-deckbuilder__cat">
                  <h4>{cat}</h4>
                  {Array.isArray(list) &&
                    list.map((c, i) => (
                      <div key={i} className="ai-deckbuilder__line">
                        <span className="ai-deckbuilder__q">{c.quantity}×</span>
                        <span>
                          {c.name}
                          {c.reason && (
                            <span className="ai-deckbuilder__why"> — {c.reason}</span>
                          )}
                        </span>
                      </div>
                    ))}
                </div>
              ))}
          </section>
          {deck.mulliganGuide && (
            <section>
              <h3>Mulligan</h3>
              <p>{deck.mulliganGuide}</p>
            </section>
          )}
          {deck.matchups && (
            <section>
              <h3>Matchups</h3>
              {['favorable', 'neutral', 'difficult'].map((k) =>
                deck.matchups[k]?.length ? (
                  <div key={k}>
                    <strong>{k}</strong>
                    <ul>
                      {deck.matchups[k].map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ) : null
              )}
            </section>
          )}
          <div className="ai-deckbuilder__actions">
            <button type="button" onClick={saveDeck}>
              Guardar localmente
            </button>
            <button type="button" onClick={generateDeck}>
              Gerar outra vez
            </button>
            <button type="button" onClick={copyList}>
              Copiar lista
            </button>
          </div>
        </article>
      )}

      {!deck && !loading && !error && (
        <p className="ai-deckbuilder__empty">Escreve um pedido e carrega em Gerar deck.</p>
      )}
    </div>
  );
}

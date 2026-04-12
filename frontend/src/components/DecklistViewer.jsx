import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './DecklistViewer.css';

export default function DecklistViewer({ decklists }) {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const selectedDeck = decklists[selectedIndex];

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedDeck.decklist);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!decklists || decklists.length === 0) {
    return (
      <div className="empty-decklists">
        <p>{t('archetypePage.noDecklists')}</p>
      </div>
    );
  }

  return (
    <div className="decklist-viewer">
      {/* Deck Selector */}
      {decklists.length > 1 && (
        <div className="deck-selector">
          {decklists.map((deck, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`deck-tab ${idx === selectedIndex ? 'active' : ''}`}
            >
              <div className="deck-tab-name">{deck.name}</div>
              <div className="deck-tab-meta">
                {deck.placement && <span className="placement">{deck.placement}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Deck Info */}
      <div className="deck-info">
        <div className="deck-header">
          <div className="deck-title-section">
            <h3 className="deck-title">{selectedDeck.name}</h3>
            <div className="deck-meta">
              {selectedDeck.author && (
                <span className="deck-author">
                  {selectedDeck.author}
                </span>
              )}
              {selectedDeck.event && (
                <span className="deck-event">
                  {selectedDeck.event}
                </span>
              )}
              {selectedDeck.date && (
                <span className="deck-date">
                  {new Date(selectedDeck.date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {selectedDeck.placement && (
            <div className="placement-badge">
              {selectedDeck.placement}
            </div>
          )}
        </div>

        {/* Decklist */}
        <div className="decklist-container">
          <div className="decklist-header">
            <span className="decklist-label">{t('archetypePage.decklist')}</span>
            <button 
              onClick={handleCopy}
              className={`copy-button ${copied ? 'copied' : ''}`}
            >
              {copied ? t('archetypePage.copied') : t('archetypePage.copy')}
            </button>
          </div>

          <pre className="decklist-text">{selectedDeck.decklist}</pre>
        </div>
      </div>
    </div>
  );
}

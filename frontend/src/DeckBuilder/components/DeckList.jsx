// DeckList.jsx - Lista de cartas no deck
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './DeckList.css';

const DeckList = ({ deck, totalCards, onRemoveCard, onUpdateQuantity }) => {
  const { t } = useTranslation();

  // Group cards by ink type
  const groupedByInk = useMemo(() => {
    const groups = {};
    
    deck.forEach(entry => {
      const ink = entry.card.ink_type || 'None';
      if (!groups[ink]) {
        groups[ink] = [];
      }
      groups[ink].push(entry);
    });

    // Sort each group by cost
    Object.keys(groups).forEach(ink => {
      groups[ink].sort((a, b) => {
        return (a.card.ink_cost || 0) - (b.card.ink_cost || 0);
      });
    });

    return groups;
  }, [deck]);

  // Sort ink types
  const inkOrder = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel', 'None'];
  const sortedInks = Object.keys(groupedByInk).sort((a, b) => {
    return inkOrder.indexOf(a) - inkOrder.indexOf(b);
  });

  const handleIncrementQty = (cardId, currentQty) => {
    if (currentQty < 4) {
      onUpdateQuantity(cardId, currentQty + 1);
    }
  };

  const handleDecrementQty = (cardId, currentQty) => {
    if (currentQty > 1) {
      onUpdateQuantity(cardId, currentQty - 1);
    } else {
      onRemoveCard(cardId);
    }
  };

  const isValid = totalCards === 60;

  return (
    <div className="deck-list">
      <div className="deck-list-header">
        <h2>{t('deckBuilder.deckList')}</h2>
        <div className={`card-count ${isValid ? 'valid' : totalCards > 60 ? 'invalid' : 'incomplete'}`}>
          {totalCards} / 60
        </div>
      </div>

      {deck.length === 0 && (
        <div className="empty-deck">
          <p>{t('deckBuilder.emptyDeck')}</p>
          <p className="empty-deck-hint">{t('deckBuilder.emptyDeckHint')}</p>
        </div>
      )}

      <div className="deck-cards-container">
        {sortedInks.map(ink => (
          <div key={ink} className="ink-group">
            <h3 className={`ink-header ink-${ink.toLowerCase()}`}>
              {ink} ({groupedByInk[ink].reduce((sum, e) => sum + e.quantity, 0)})
            </h3>

            <div className="cards-list">
              {groupedByInk[ink].map((entry) => (
                <div key={entry.card.id} className="deck-card-entry">
                  <div className="card-quantity">
                    <button
                      onClick={() => handleDecrementQty(entry.card.id, entry.quantity)}
                      className="btn-qty btn-decrease"
                    >
                      −
                    </button>
                    <span className="quantity-value">{entry.quantity}</span>
                    <button
                      onClick={() => handleIncrementQty(entry.card.id, entry.quantity)}
                      className="btn-qty btn-increase"
                      disabled={entry.quantity >= 4}
                    >
                      +
                    </button>
                  </div>

                  <div className="card-info">
                    <div className="card-name">{entry.card.name}</div>
                    {entry.card.subtitle && (
                      <div className="card-subtitle">{entry.card.subtitle}</div>
                    )}
                  </div>

                  <div className="card-cost">
                    {entry.card.ink_cost !== null && entry.card.ink_cost !== undefined && (
                      <span>{entry.card.ink_cost}</span>
                    )}
                  </div>

                  <button
                    onClick={() => onRemoveCard(entry.card.id)}
                    className="btn-remove"
                    title={t('deckBuilder.removeCard')}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeckList;

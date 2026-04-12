// DeckBuilder.jsx — builder visual (grelha + filtros) + lista / export
import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import VisualCardGrid from './components/VisualCardGrid';
import DeckList from './components/DeckList';
import DeckStats from './components/DeckStats';
import DeckExporter from './components/DeckExporter';
import DeckSaver from './components/DeckSaver';
import { DeckBuilderService } from './services/deckBuilderService';
import { detectArchetype } from './services/archetypeDetector';
import { fetchAllCards } from '../services/cardService';
import './DeckBuilder.css';

const LOCAL_DECK_KEY = 'current-deck';

const DeckBuilder = () => {
  const { t } = useTranslation();

  const [deckService] = useState(() => new DeckBuilderService());
  const [deck, setDeck] = useState([]);
  const [allCards, setAllCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [validation, setValidation] = useState({
    valid: false,
    errors: [],
    warnings: [],
  });
  const [archetype, setArchetype] = useState('');
  const [deckName, setDeckName] = useState('Untitled Deck');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  const refreshDeck = useCallback(() => {
    setDeck([...deckService.deck]);
    const validationResult = deckService.validate();
    setValidation(validationResult);

    if (deckService.deck.length > 0) {
      setArchetype(detectArchetype(deckService.deck));
    } else {
      setArchetype('');
    }
  }, [deckService]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingCards(true);
        const cards = await fetchAllCards();
        if (!cancelled) setAllCards(cards);
      } catch (e) {
        console.error(e);
        if (!cancelled) setAllCards([]);
      } finally {
        if (!cancelled) setLoadingCards(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const getCount = useCallback(
    (cardId) =>
      deckService.deck.find((e) => e.card.id === cardId)?.quantity ?? 0,
    [deckService]
  );

  const bumpCard = useCallback(
    (card, delta) => {
      const q =
        deckService.deck.find((e) => e.card.id === card.id)?.quantity ?? 0;
      if (delta > 0) {
        if (q >= 4) return;
        if (deckService.getTotalCards() >= 60) return;
        deckService.addCard(card, 1);
      } else {
        if (q <= 0) return;
        if (q === 1) deckService.removeCard(card.id);
        else deckService.updateQuantity(card.id, q - 1);
      }
      refreshDeck();
    },
    [deckService, refreshDeck]
  );

  const handleRemoveCard = useCallback(
    (cardId) => {
      deckService.removeCard(cardId);
      refreshDeck();
    },
    [deckService, refreshDeck]
  );

  const handleUpdateQuantity = useCallback(
    (cardId, quantity) => {
      deckService.updateQuantity(cardId, quantity);
      refreshDeck();
    },
    [deckService, refreshDeck]
  );

  const handleClearDeck = useCallback(() => {
    if (window.confirm(t('deckBuilder.confirmClear'))) {
      deckService.clearDeck();
      refreshDeck();
      setDeckName('Untitled Deck');
    }
  }, [deckService, refreshDeck, t]);

  const handleExport = useCallback(
    (format) => {
      return deckService.export(format);
    },
    [deckService]
  );

  const handleSave = useCallback(async (name, description) => {
    try {
      console.log('Saving deck:', name, description);
      setDeckName(name);
      setSaveModalOpen(false);
    } catch (error) {
      console.error('Error saving deck:', error);
    }
  }, []);

  const handleLoad = useCallback(async (deckId) => {
    try {
      console.log('Loading deck:', deckId);
    } catch (error) {
      console.error('Error loading deck:', error);
    }
  }, []);

  const saveDeckLocal = useCallback(() => {
    const total = deckService.getTotalCards();
    const payload = {
      deckName,
      ...deckService.toJSON(),
      totalCards: total,
      createdAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(LOCAL_DECK_KEY, JSON.stringify(payload));
      alert(
        t('deckBuilder.saveLocalOk', {
          n: total,
        })
      );
    } catch (e) {
      console.error(e);
    }
  }, [deckName, deckService, t]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        setSaveModalOpen(true);
      }
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        setExportModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const totalCards = deckService.getTotalCards();
  const isValid = validation.valid && totalCards === 60;

  return (
    <div className="deck-builder deck-builder--visual">
      <div className="deck-builder-header">
        <div className="header-left">
          <h1 className="deck-name">{deckName}</h1>
          {archetype && (
            <span className="archetype-badge">{archetype}</span>
          )}
        </div>

        <div className="header-right">
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            className="btn-export"
            disabled={!isValid}
          >
            {t('deckBuilder.export')}
          </button>

          <button
            type="button"
            onClick={() => setSaveModalOpen(true)}
            className="btn-save"
          >
            {t('deckBuilder.save')}
          </button>

          <button
            type="button"
            onClick={handleClearDeck}
            className="btn-clear"
          >
            {t('deckBuilder.clear')}
          </button>
        </div>
      </div>

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="validation-summary">
          {validation.errors.map((error, i) => (
            <div key={i} className="validation-error">
              {error}
            </div>
          ))}
          {validation.warnings.map((warning, i) => (
            <div key={i} className="validation-warning">
              {warning}
            </div>
          ))}
        </div>
      )}

      <div className="deck-builder-visual-main">
        <VisualCardGrid
          allCards={allCards}
          loading={loadingCards}
          getCount={getCount}
          totalDeckCards={totalCards}
          uniqueInDeck={deck.length}
          onAdjust={bumpCard}
        />
      </div>

      <details className="deck-builder-details">
        <summary>{t('deckBuilder.deckExtras')}</summary>
        <div className="deck-builder-details-inner">
          <div className="deck-builder-decklist-panel">
            <h2 className="deck-builder-panel-title">
              {t('deckBuilder.deckList')}
            </h2>
            <DeckList
              deck={deck}
              totalCards={totalCards}
              onRemoveCard={handleRemoveCard}
              onUpdateQuantity={handleUpdateQuantity}
            />
          </div>
          <div className="deck-builder-stats-panel">
            <h2 className="deck-builder-panel-title">
              {t('deckBuilder.statistics')}
            </h2>
            <DeckStats deck={deck} />
          </div>
        </div>
      </details>

      <footer className="deck-builder-sticky-footer">
        <div className="deck-builder-footer-stats">
          <span>
            {t('deckBuilder.totalCards')}: {totalCards}/60
          </span>
          <span>
            {t('deckBuilder.uniqueShort')}: {deck.length}
          </span>
        </div>
        <button
          type="button"
          className="deck-builder-footer-save"
          onClick={saveDeckLocal}
          disabled={totalCards === 0}
        >
          {t('deckBuilder.saveDeck')}
        </button>
      </footer>

      {exportModalOpen && (
        <DeckExporter
          deck={deck}
          deckName={deckName}
          onExport={handleExport}
          onClose={() => setExportModalOpen(false)}
        />
      )}

      {saveModalOpen && (
        <DeckSaver
          deckName={deckName}
          deck={deck}
          onSave={handleSave}
          onLoad={handleLoad}
          onClose={() => setSaveModalOpen(false)}
        />
      )}
    </div>
  );
};

export default DeckBuilder;

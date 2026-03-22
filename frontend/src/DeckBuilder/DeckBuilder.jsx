// DeckBuilder.jsx - Container principal do Deck Builder
import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import CardSearch from './components/CardSearch';
import DeckList from './components/DeckList';
import DeckStats from './components/DeckStats';
import DeckExporter from './components/DeckExporter';
import DeckSaver from './components/DeckSaver';
import { DeckBuilderService } from './services/deckBuilderService';
import { detectArchetype } from './services/archetypeDetector';
import './DeckBuilder.css';

/**
 * DECK BUILDER VISUAL
 * 
 * Features:
 * - Card search com autocomplete
 * - Add/remove cards
 * - Validação (60 cards, max 4 cópias)
 * - Curve visualization
 * - Ink distribution
 * - Export (text, Pixelborn, Dreamborn)
 * - Save/load (Supabase)
 * - Archetype auto-detection
 */
const DeckBuilder = () => {
  const { t } = useTranslation();
  
  // State
  const [deckService] = useState(() => new DeckBuilderService());
  const [deck, setDeck] = useState([]);
  const [validation, setValidation] = useState({ valid: false, errors: [], warnings: [] });
  const [archetype, setArchetype] = useState('');
  const [deckName, setDeckName] = useState('Untitled Deck');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  // Update deck state quando deckService mudar
  const refreshDeck = useCallback(() => {
    setDeck([...deckService.deck]);
    const validationResult = deckService.validate();
    setValidation(validationResult);
    
    // Auto-detect archetype
    if (deckService.deck.length > 0) {
      const detected = detectArchetype(deckService.deck);
      setArchetype(detected);
    } else {
      setArchetype('');
    }
  }, [deckService]);

  // Add card to deck
  const handleAddCard = useCallback((card) => {
    deckService.addCard(card, 1);
    refreshDeck();
  }, [deckService, refreshDeck]);

  // Remove card from deck
  const handleRemoveCard = useCallback((cardId) => {
    deckService.removeCard(cardId);
    refreshDeck();
  }, [deckService, refreshDeck]);

  // Update card quantity
  const handleUpdateQuantity = useCallback((cardId, quantity) => {
    deckService.updateQuantity(cardId, quantity);
    refreshDeck();
  }, [deckService, refreshDeck]);

  // Clear deck
  const handleClearDeck = useCallback(() => {
    if (window.confirm(t('deckBuilder.confirmClear'))) {
      deckService.clearDeck();
      refreshDeck();
      setDeckName('Untitled Deck');
    }
  }, [deckService, refreshDeck, t]);

  // Export deck
  const handleExport = useCallback((format) => {
    const exported = deckService.export(format);
    return exported;
  }, [deckService]);

  // Save deck
  const handleSave = useCallback(async (name, description) => {
    try {
      // TODO: Implementar save no Supabase
      console.log('Saving deck:', name, description);
      setDeckName(name);
      setSaveModalOpen(false);
    } catch (error) {
      console.error('Error saving deck:', error);
    }
  }, []);

  // Load deck
  const handleLoad = useCallback(async (deckId) => {
    try {
      // TODO: Implementar load do Supabase
      console.log('Loading deck:', deckId);
    } catch (error) {
      console.error('Error loading deck:', error);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl+S: Save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        setSaveModalOpen(true);
      }
      
      // Ctrl+E: Export
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
    <div className="deck-builder">
      {/* Header */}
      <div className="deck-builder-header">
        <div className="header-left">
          <h1 className="deck-name">
            {deckName}
          </h1>
          {archetype && (
            <span className="archetype-badge">
              {archetype}
            </span>
          )}
        </div>
        
        <div className="header-right">
          <button 
            onClick={() => setExportModalOpen(true)}
            className="btn-export"
            disabled={!isValid}
          >
            📤 {t('deckBuilder.export')}
          </button>
          
          <button 
            onClick={() => setSaveModalOpen(true)}
            className="btn-save"
          >
            💾 {t('deckBuilder.save')}
          </button>
          
          <button 
            onClick={handleClearDeck}
            className="btn-clear"
          >
            🗑️ {t('deckBuilder.clear')}
          </button>
        </div>
      </div>

      {/* Validation Summary */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="validation-summary">
          {validation.errors.map((error, i) => (
            <div key={i} className="validation-error">
              ❌ {error}
            </div>
          ))}
          {validation.warnings.map((warning, i) => (
            <div key={i} className="validation-warning">
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}

      {/* Main Content - 3 Columns */}
      <div className="deck-builder-content">
        {/* Left: Card Search */}
        <div className="deck-builder-search">
          <CardSearch onAddCard={handleAddCard} />
        </div>

        {/* Center: Deck List */}
        <div className="deck-builder-decklist">
          <DeckList
            deck={deck}
            totalCards={totalCards}
            onRemoveCard={handleRemoveCard}
            onUpdateQuantity={handleUpdateQuantity}
          />
        </div>

        {/* Right: Stats & Charts */}
        <div className="deck-builder-stats">
          <DeckStats deck={deck} />
        </div>
      </div>

      {/* Export Modal */}
      {exportModalOpen && (
        <DeckExporter
          deck={deck}
          deckName={deckName}
          onExport={handleExport}
          onClose={() => setExportModalOpen(false)}
        />
      )}

      {/* Save Modal */}
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

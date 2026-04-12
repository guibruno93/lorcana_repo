// DeckSaver.jsx - Modal para salvar/carregar decks
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './DeckSaver.css';

const DeckSaver = ({ deckName, deck, onSave, onLoad, onClose }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState('save'); // 'save' or 'load'
  const [name, setName] = useState(deckName || '');
  const [description, setDescription] = useState('');
  const [savedDecks, setSavedDecks] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load saved decks quando em modo "load"
  useEffect(() => {
    if (mode === 'load') {
      loadSavedDecks();
    }
  }, [mode]);

  const loadSavedDecks = async () => {
    try {
      setLoading(true);
      // TODO: Fetch from Supabase
      // const decks = await supabase.from('decks').select('*');
      // setSavedDecks(decks);
      
      // Mock data for now
      setSavedDecks([
        { id: '1', name: 'Ruby/Amethyst Aggro', created_at: '2024-01-15', archetype: 'Aggro' },
        { id: '2', name: 'Sapphire/Steel Control', created_at: '2024-01-10', archetype: 'Control' },
      ]);
    } catch (error) {
      console.error('Error loading decks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert(t('deckBuilder.pleaseEnterName'));
      return;
    }

    try {
      setLoading(true);
      await onSave(name, description);
    } catch (error) {
      console.error('Error saving deck:', error);
      alert(t('deckBuilder.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async (deckId) => {
    try {
      setLoading(true);
      await onLoad(deckId);
      onClose();
    } catch (error) {
      console.error('Error loading deck:', error);
      alert(t('deckBuilder.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (deckId) => {
    if (!window.confirm(t('deckBuilder.confirmDelete'))) {
      return;
    }

    try {
      setLoading(true);
      // TODO: Delete from Supabase
      // await supabase.from('decks').delete().eq('id', deckId);
      loadSavedDecks();
    } catch (error) {
      console.error('Error deleting deck:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content deck-saver-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'save' ? t('deckBuilder.saveDeck') : t('deckBuilder.loadDeck')}</h2>
          <button type="button" onClick={onClose} className="btn-close" aria-label={t('common.close')}>×</button>
        </div>

        <div className="modal-body">
          <div className="mode-selector">
            <button
              onClick={() => setMode('save')}
              className={`btn-mode ${mode === 'save' ? 'active' : ''}`}
            >
              Save Deck
            </button>
            <button
              onClick={() => setMode('load')}
              className={`btn-mode ${mode === 'load' ? 'active' : ''}`}
            >
              Load Deck
            </button>
          </div>

          {mode === 'save' && (
            <div className="save-form">
              <div className="form-group">
                <label>{t('deckBuilder.deckName')}:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter deck name..."
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>{t('deckBuilder.description')} (optional):</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Deck description, strategy, notes..."
                  className="form-textarea"
                  rows={4}
                />
              </div>

              <div className="deck-summary">
                <div className="summary-item">
                  <span className="summary-label">Cards:</span>
                  <span className="summary-value">{deck.reduce((sum, e) => sum + e.quantity, 0)}</span>
                </div>
              </div>
            </div>
          )}

          {mode === 'load' && (
            <div className="load-list">
              {loading && <div className="loading">Loading decks...</div>}
              
              {!loading && savedDecks.length === 0 && (
                <div className="no-decks">
                  <p>{t('deckBuilder.noSavedDecks')}</p>
                </div>
              )}

              {!loading && savedDecks.map(savedDeck => (
                <div key={savedDeck.id} className="saved-deck-item">
                  <div className="deck-info">
                    <div className="deck-item-name">{savedDeck.name}</div>
                    {savedDeck.archetype && (
                      <div className="deck-item-archetype">{savedDeck.archetype}</div>
                    )}
                    <div className="deck-item-date">
                      {new Date(savedDeck.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="deck-actions">
                    <button
                      onClick={() => handleLoad(savedDeck.id)}
                      className="btn-load-deck"
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(savedDeck.id)}
                      className="btn-delete-deck"
                      aria-label={t('common.delete')}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {mode === 'save' && (
            <button 
              onClick={handleSave} 
              className="btn-save-confirm"
              disabled={loading || !name.trim()}
            >
              {loading ? 'Saving...' : 'Save Deck'}
            </button>
          )}
          <button onClick={onClose} className="btn-cancel">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeckSaver;

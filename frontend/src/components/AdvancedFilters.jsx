import React, { useState, useEffect, useRef, useCallback } from 'react';
import { InkBadge } from './InkIcons';
import './AdvancedFilters.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

const SET_NAMES = [
  'The First Chapter',
  'Rise of the Floodborn',
  'Into the Inklands',
  "Ursula's Return",
  'Shimmering Skies',
  'Azurite Sea',
  "Archazia's Island",
  'Reign of Jafar',
  'Fabled',
  'Whispers in the Well',
  'Winterspell',
];

const RARITIES = [
  'Common',
  'Uncommon',
  'Rare',
  'Super Rare',
  'Legendary',
  'Enchanted',
];

export default function AdvancedFilters({
  filters,
  onFilterChange,
  allCards = [],
}) {
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [savedPresets, setSavedPresets] = useState([]);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const searchInputRef = useRef(null);

  useEffect(() => {
    try {
      setSavedPresets(JSON.parse(localStorage.getItem('filter-presets') || '[]'));
      setRecentSearches(JSON.parse(localStorage.getItem('recent-searches') || '[]'));
    } catch {
      setSavedPresets([]);
      setRecentSearches([]);
    }
  }, []);

  const fetchRemoteSuggestions = useCallback(async (q) => {
    try {
      const response = await fetch(
        `${API_URL}/api/cards/search?q=${encodeURIComponent(q)}&limit=10`
      );
      if (!response.ok) return [];
      return response.json();
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    const q = (filters.search || '').trim();
    if (q.length < 2) {
      setSearchSuggestions([]);
      return;
    }

    const run = async () => {
      if (allCards.length > 0) {
        const ql = q.toLowerCase();
        const local = allCards
          .filter(
            (c) =>
              c.name?.toLowerCase().includes(ql) ||
              c.body_text?.toLowerCase().includes(ql)
          )
          .slice(0, 10);
        setSearchSuggestions(
          local.map((c) => ({
            id: c.id,
            name: c.name,
            image_url: c.image_uris?.digital?.normal || null,
            color: c.ink_type,
            cost: c.ink_cost,
            type: c.type,
          }))
        );
        return;
      }
      const data = await fetchRemoteSuggestions(q);
      setSearchSuggestions(Array.isArray(data) ? data : []);
    };

    const t = setTimeout(run, 280);
    return () => clearTimeout(t);
  }, [filters.search, allCards, fetchRemoteSuggestions]);

  const toggleFilter = (category, value) => {
    const key =
      category === 'colors'
        ? 'inkMulti'
        : category === 'manaCosts'
          ? 'manaCostMulti'
          : category === 'types'
            ? 'typeMulti'
            : category === 'sets'
              ? 'setMulti'
              : category === 'rarity'
                ? 'rarityMulti'
                : category;
    const current = Array.isArray(filters[key]) ? filters[key] : [];
    const isActive = current.includes(value);
    const next = isActive ? current.filter((v) => v !== value) : [...current, value];
    onFilterChange({ ...filters, [key]: next });
  };

  const selectSuggestion = (cardName) => {
    onFilterChange({ ...filters, search: cardName });
    setShowSuggestions(false);
    const updated = [cardName, ...recentSearches.filter((s) => s !== cardName)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('recent-searches', JSON.stringify(updated));
  };

  const savePreset = () => {
    if (!presetName.trim()) {
      window.alert('Digite um nome para o preset');
      return;
    }
    const preset = {
      id: Date.now(),
      name: presetName.trim(),
      filters: { ...filters },
    };
    const updated = [...savedPresets, preset];
    setSavedPresets(updated);
    localStorage.setItem('filter-presets', JSON.stringify(updated));
    setPresetName('');
    setShowSavePreset(false);
    window.alert('Preset salvo.');
  };

  const loadPreset = (preset) => {
    onFilterChange({ ...preset.filters });
  };

  const deletePreset = (presetId) => {
    const updated = savedPresets.filter((p) => p.id !== presetId);
    setSavedPresets(updated);
    localStorage.setItem('filter-presets', JSON.stringify(updated));
  };

  const clearAdvanced = () => {
    onFilterChange({
      ...filters,
      search: filters.search,
      inkMulti: [],
      manaCostMulti: [],
      typeMulti: [],
      setMulti: [],
      rarityMulti: [],
    });
  };

  const activeCount =
    (filters.inkMulti?.length || 0) +
    (filters.manaCostMulti?.length || 0) +
    (filters.typeMulti?.length || 0) +
    (filters.setMulti?.length || 0) +
    (filters.rarityMulti?.length || 0);

  return (
    <div className="advanced-filters">
      <div className="advanced-filters__search-row">
        <div className="advanced-filters__search-wrap">
          <input
            ref={searchInputRef}
            type="text"
            className="advanced-filters__search-input"
            placeholder="Buscar por nome ou texto da carta…"
            value={filters.search || ''}
            onChange={(e) => {
              onFilterChange({ ...filters, search: e.target.value });
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            aria-autocomplete="list"
          />
          {showSuggestions &&
            (searchSuggestions.length > 0 ||
              (filters.search === '' && recentSearches.length > 0)) && (
              <div className="advanced-filters__suggestions" role="listbox">
                {filters.search === '' && recentSearches.length > 0 && (
                  <div className="advanced-filters__sugg-section">
                    <div className="advanced-filters__sugg-label">Recentes</div>
                    {recentSearches.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        className="advanced-filters__sugg-item advanced-filters__sugg-item--recent"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSuggestion(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {searchSuggestions.length > 0 && (
                  <div className="advanced-filters__sugg-section">
                    <div className="advanced-filters__sugg-label">Sugestões</div>
                    {searchSuggestions.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        className="advanced-filters__sugg-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSuggestion(card.name)}
                      >
                        {card.image_url && (
                          <img
                            src={card.image_url}
                            alt=""
                            className="advanced-filters__sugg-thumb"
                          />
                        )}
                        <span className="advanced-filters__sugg-text">
                          <span className="advanced-filters__sugg-name">{card.name}</span>
                          <span className="advanced-filters__sugg-meta">
                            <InkBadge ink={card.color} size="sm" />
                            {card.cost != null ? ` ${card.cost} 💧` : ''}{' '}
                            {card.type}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
        </div>

        <div className="advanced-filters__presets">
          <select
            className="advanced-filters__preset-select"
            aria-label="Filtros salvos"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              const preset = savedPresets.find((p) => String(p.id) === id);
              if (preset) loadPreset(preset);
              e.target.value = '';
            }}
          >
            <option value="">Filtros salvos</option>
            {savedPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="advanced-filters__btn-save"
            onClick={() => setShowSavePreset(true)}
          >
            Salvar filtros
          </button>
        </div>
      </div>

      <div className="advanced-filters__groups">
        <div className="advanced-filters__group">
          <span className="advanced-filters__group-label">Tinta</span>
          <div className="advanced-filters__chips">
            {['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'].map((color) => (
              <button
                key={color}
                type="button"
                className={`advanced-filters__chip advanced-filters__chip--ink ${
                  filters.inkMulti?.includes(color) ? 'is-active' : ''
                }`}
                onClick={() => toggleFilter('colors', color)}
                title={color}
              >
                <InkBadge ink={color} size="sm" />
              </button>
            ))}
          </div>
        </div>

        <div className="advanced-filters__group">
          <span className="advanced-filters__group-label">Custo</span>
          <div className="advanced-filters__chips">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, '9+'].map((cost) => (
              <button
                key={cost}
                type="button"
                className={`advanced-filters__chip ${
                  filters.manaCostMulti?.includes(cost) ? 'is-active' : ''
                }`}
                onClick={() => toggleFilter('manaCosts', cost)}
              >
                {cost}
              </button>
            ))}
          </div>
        </div>

        <div className="advanced-filters__group">
          <span className="advanced-filters__group-label">Tipo</span>
          <div className="advanced-filters__chips">
            {['Character', 'Action', 'Item', 'Location'].map((type) => (
              <button
                key={type}
                type="button"
                className={`advanced-filters__chip ${
                  filters.typeMulti?.includes(type) ? 'is-active' : ''
                }`}
                onClick={() => toggleFilter('types', type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="advanced-filters__group advanced-filters__group--sets">
          <span className="advanced-filters__group-label">Expansão</span>
          <div className="advanced-filters__set-list">
            {SET_NAMES.map((set) => (
              <label key={set} className="advanced-filters__check">
                <input
                  type="checkbox"
                  checked={filters.setMulti?.includes(set) || false}
                  onChange={() => toggleFilter('sets', set)}
                />
                {set}
              </label>
            ))}
          </div>
        </div>

        <div className="advanced-filters__group">
          <span className="advanced-filters__group-label">Raridade</span>
          <div className="advanced-filters__chips advanced-filters__chips--wrap">
            {RARITIES.map((r) => (
              <button
                key={r}
                type="button"
                className={`advanced-filters__chip ${
                  filters.rarityMulti?.includes(r) ? 'is-active' : ''
                }`}
                onClick={() => toggleFilter('rarity', r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="advanced-filters__footer">
        <button type="button" className="advanced-filters__btn-clear" onClick={clearAdvanced}>
          Limpar filtros avançados
        </button>
        <span className="advanced-filters__count">{activeCount} filtros avançados ativos</span>
      </div>

      {savedPresets.length > 0 && (
        <div className="advanced-filters__saved">
          <span className="advanced-filters__saved-title">Presets</span>
          <div className="advanced-filters__saved-list">
            {savedPresets.map((preset) => (
              <span key={preset.id} className="advanced-filters__saved-pill">
                <button type="button" onClick={() => loadPreset(preset)}>
                  {preset.name}
                </button>
                <button
                  type="button"
                  className="advanced-filters__saved-remove"
                  aria-label="Remover preset"
                  onClick={() => deletePreset(preset.id)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {showSavePreset && (
        <div
          className="advanced-filters__modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preset-dialog-title"
        >
          <div className="advanced-filters__modal">
            <h3 id="preset-dialog-title">Salvar preset</h3>
            <input
              type="text"
              className="advanced-filters__modal-input"
              placeholder="Nome (ex.: Aggro Ruby)"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
            <div className="advanced-filters__modal-actions">
              <button type="button" className="advanced-filters__btn-primary" onClick={savePreset}>
                Salvar
              </button>
              <button
                type="button"
                className="advanced-filters__btn-muted"
                onClick={() => setShowSavePreset(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

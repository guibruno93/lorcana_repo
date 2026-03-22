// CardSearch.jsx - Busca de cartas com autocomplete
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '../../hooks/useDebounce';
import { searchCards, getAvailableInks, getAvailableRarities } from '../../services/cardService';
import './CardSearch.css';

const CardSearch = ({ onAddCard }) => {
  const { t } = useTranslation();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    ink: 'all',
    cost: '',
    rarity: 'all'
  });
  const [hoveredCard, setHoveredCard] = useState(null);
  
  const debouncedQuery = useDebounce(query, 300);

  // Search cards quando query mudar
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery) {
        setResults([]);
        return;
      }

      try {
        setLoading(true);
        const cards = await searchCards(debouncedQuery);
        
        // Apply filters
        let filtered = cards;
        
        if (filters.ink !== 'all') {
          filtered = filtered.filter(c => c.ink_type?.toLowerCase() === filters.ink.toLowerCase());
        }
        
        if (filters.cost !== '') {
          const cost = parseInt(filters.cost);
          filtered = filtered.filter(c => c.ink_cost === cost);
        }
        
        if (filters.rarity !== 'all') {
          filtered = filtered.filter(c => c.rarity?.toLowerCase() === filters.rarity.toLowerCase());
        }
        
        setResults(filtered.slice(0, 50)); // Limit to 50 results
      } catch (error) {
        console.error('Error searching cards:', error);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery, filters]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  return (
    <div className="card-search">
      <div className="search-header">
        <h2>🔍 {t('deckBuilder.searchCards')}</h2>
      </div>

      {/* Search Input */}
      <div className="search-input-container">
        <input
          type="text"
          className="search-input"
          placeholder={t('deckBuilder.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading && (
          <div className="search-loading">⏳</div>
        )}
      </div>

      {/* Quick Filters */}
      <div className="search-filters">
        <select
          value={filters.ink}
          onChange={(e) => handleFilterChange('ink', e.target.value)}
          className="filter-select"
        >
          <option value="all">{t('deckBuilder.allInks')}</option>
          <option value="Amber">Amber</option>
          <option value="Amethyst">Amethyst</option>
          <option value="Emerald">Emerald</option>
          <option value="Ruby">Ruby</option>
          <option value="Sapphire">Sapphire</option>
          <option value="Steel">Steel</option>
        </select>

        <select
          value={filters.cost}
          onChange={(e) => handleFilterChange('cost', e.target.value)}
          className="filter-select"
        >
          <option value="">{t('deckBuilder.allCosts')}</option>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(cost => (
            <option key={cost} value={cost}>{cost}</option>
          ))}
        </select>

        <select
          value={filters.rarity}
          onChange={(e) => handleFilterChange('rarity', e.target.value)}
          className="filter-select"
        >
          <option value="all">{t('deckBuilder.allRarities')}</option>
          <option value="common">Common</option>
          <option value="uncommon">Uncommon</option>
          <option value="rare">Rare</option>
          <option value="superrare">Super Rare</option>
          <option value="legendary">Legendary</option>
          <option value="enchanted">Enchanted</option>
        </select>
      </div>

      {/* Search Results */}
      <div className="search-results">
        {results.length === 0 && debouncedQuery && !loading && (
          <div className="no-results">
            {t('deckBuilder.noResults')}
          </div>
        )}

        {results.map((card) => (
          <div
            key={card.id}
            className="search-result-item"
            onMouseEnter={() => setHoveredCard(card)}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={() => onAddCard(card)}
          >
            <div className="result-info">
              <div className="result-name">{card.name}</div>
              {card.subtitle && (
                <div className="result-subtitle">{card.subtitle}</div>
              )}
              <div className="result-meta">
                {card.ink_cost !== null && (
                  <span className="result-cost">💧 {card.ink_cost}</span>
                )}
                {card.ink_type && (
                  <span className={`result-ink ink-${card.ink_type.toLowerCase()}`}>
                    {card.ink_type}
                  </span>
                )}
              </div>
            </div>
            <button className="btn-add-card">+</button>
          </div>
        ))}
      </div>

      {/* Card Preview (on hover) */}
      {hoveredCard && hoveredCard.image_uris?.digital?.normal && (
        <div className="card-preview">
          <img
            src={hoveredCard.image_uris.digital.normal}
            alt={hoveredCard.name}
          />
        </div>
      )}
    </div>
  );
};

export default CardSearch;

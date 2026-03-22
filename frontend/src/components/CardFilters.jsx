import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './CardFilters.css';
import { useDebounce } from '../hooks/useDebounce';

export default function CardFilters({ 
  filters, 
  onFilterChange, 
  onClearFilters,
  availableInks = [],
  availableRarities = [],
  availableSets = [],
  availableTypes = [],
  totalResults = 0
}) {
  const { t } = useTranslation();

  // 🚀 OTIMIZAÇÃO: Debounce na busca
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const debouncedSearch = useDebounce(searchInput, 300);

  // Atualizar filtro quando debouncedSearch mudar
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFilterChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch]);

  // Atualizar input se filters.search mudar externamente
  useEffect(() => {
    if (filters.search !== searchInput) {
      setSearchInput(filters.search || '');
    }
  }, [filters.search]);

  const handleChange = (field, value) => {
    onFilterChange({ ...filters, [field]: value });
  };

  const inkColors = {
    'Amber': '#FFB84D',
    'Amethyst': '#9B59B6',
    'Emerald': '#2ECC71',
    'Ruby': '#E74C3C',
    'Sapphire': '#3498DB',
    'Steel': '#95A5A6'
  };

  // Garantir que availableSets seja um array
  const setsArray = Array.isArray(availableSets) ? availableSets : [];

  return (
    <div className="card-filters">
      <div className="filters-header">
        <h3 className="filters-title">
          🔍 {t('cardDatabase.filters.title')}
        </h3>
        <button 
          onClick={onClearFilters}
          className="btn-clear-filters"
          disabled={!Object.values(filters).some(v => v && v !== 'all')}
        >
          ✕ {t('cardDatabase.filters.clear')}
        </button>
      </div>

      <div className="filters-grid">
        {/* Text Search - COM DEBOUNCE */}
        <div className="filter-group filter-search">
          <label className="filter-label">
            {t('cardDatabase.filters.search')}
          </label>
          <input
            type="text"
            className="filter-input"
            placeholder={t('cardDatabase.filters.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput !== debouncedSearch && (
            <small className="filter-hint">Digitando...</small>
          )}
        </div>

        {/* Ink Filter */}
        <div className="filter-group">
          <label className="filter-label">
            {t('cardDatabase.filters.ink')}
          </label>
          <select
            className="filter-select"
            value={filters.ink || 'all'}
            onChange={(e) => handleChange('ink', e.target.value)}
          >
            <option value="all">{t('cardDatabase.filters.allInks')}</option>
            {Array.isArray(availableInks) && availableInks.map(ink => (
              <option key={ink} value={ink}>
                {ink}
              </option>
            ))}
          </select>
          {filters.ink && filters.ink !== 'all' && (
            <div 
              className="ink-indicator"
              style={{ backgroundColor: inkColors[filters.ink] || '#666' }}
            />
          )}
        </div>

        {/* Cost Filter */}
        <div className="filter-group">
          <label className="filter-label">
            {t('cardDatabase.filters.cost')}
          </label>
          <select
            className="filter-select"
            value={filters.cost ?? ''}
            onChange={(e) => handleChange('cost', e.target.value === '' ? null : parseInt(e.target.value))}
          >
            <option value="">{t('cardDatabase.filters.allCosts')}</option>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(cost => (
              <option key={cost} value={cost}>{cost}</option>
            ))}
          </select>
        </div>

        {/* Rarity Filter */}
        <div className="filter-group">
          <label className="filter-label">
            {t('cardDatabase.filters.rarity')}
          </label>
          <select
            className="filter-select"
            value={filters.rarity || 'all'}
            onChange={(e) => handleChange('rarity', e.target.value)}
          >
            <option value="all">{t('cardDatabase.filters.allRarities')}</option>
            <option value="common">{t('cardDatabase.rarities.common')}</option>
            <option value="uncommon">{t('cardDatabase.rarities.uncommon')}</option>
            <option value="rare">{t('cardDatabase.rarities.rare')}</option>
            <option value="super_rare">{t('cardDatabase.rarities.superRare')}</option>
            <option value="legendary">{t('cardDatabase.rarities.legendary')}</option>
            <option value="enchanted">{t('cardDatabase.rarities.enchanted')}</option>
          </select>
        </div>

        {/* Type Filter */}
        <div className="filter-group">
          <label className="filter-label">
            {t('cardDatabase.filters.type')}
          </label>
          <select
            className="filter-select"
            value={filters.type || 'all'}
            onChange={(e) => handleChange('type', e.target.value)}
          >
            <option value="all">{t('cardDatabase.filters.allTypes')}</option>
            {Array.isArray(availableTypes) && availableTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Set Filter */}
        <div className="filter-group">
          <label className="filter-label">
            {t('cardDatabase.filters.set')}
          </label>
          <select
            className="filter-select"
            value={filters.set || 'all'}
            onChange={(e) => handleChange('set', e.target.value)}
          >
            <option value="all">{t('cardDatabase.filters.allSets')}</option>
            {setsArray.map(set => (
              <option key={set.code || set.id} value={set.code || set.id}>
                {set.name || set.code || set.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="filters-footer">
        <span className="results-count">
          {t('cardDatabase.filters.showing')} <strong>{totalResults}</strong> {t('cardDatabase.filters.cards')}
        </span>
      </div>
    </div>
  );
}

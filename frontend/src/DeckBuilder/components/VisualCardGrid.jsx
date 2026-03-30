import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { InkBadge } from '../../components/InkIcons';
import { getCardImageUrl } from '../../services/cardService';
import './VisualCardGrid.css';

const INK_COLORS = [
  'Amber',
  'Amethyst',
  'Emerald',
  'Ruby',
  'Sapphire',
  'Steel',
];

const CARD_TYPES = ['Character', 'Action', 'Item', 'Location'];

const RARITY_OPTIONS = [
  { key: 'common', label: 'Common' },
  { key: 'uncommon', label: 'Uncommon' },
  { key: 'rare', label: 'Rare' },
  { key: 'superrare', label: 'Super Rare' },
  { key: 'legendary', label: 'Legendary' },
  { key: 'enchanted', label: 'Enchanted' },
];

const MANA_KEYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, '9+'];

const GRID_PAGE = 48;

function matchesManaCost(card, selected) {
  if (!selected.length) return true;
  const cost = Number.isFinite(card.ink_cost) ? card.ink_cost : 0;
  return selected.some((m) => {
    if (m === '9+') return cost >= 9;
    return cost === m;
  });
}

function normalizeRarity(r) {
  return String(r || '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function VisualCardGrid({
  allCards,
  loading,
  getCount,
  totalDeckCards,
  uniqueInDeck,
  onAdjust,
}) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({
    search: '',
    colors: [],
    mana: [],
    types: [],
    rarity: [],
  });
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [visibleCount, setVisibleCount] = useState(GRID_PAGE);

  const toggleFilter = useCallback((category, value) => {
    setFilters((prev) => {
      const cur = prev[category];
      const on = cur.includes(value);
      return {
        ...prev,
        [category]: on ? cur.filter((v) => v !== value) : [...cur, value],
      };
    });
  }, []);

  const filteredCards = useMemo(() => {
    if (!Array.isArray(allCards)) return [];
    let list = allCards;

    const q = filters.search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.subtitle?.toLowerCase().includes(q)
      );
    }

    if (filters.colors.length) {
      const set = new Set(filters.colors.map((x) => x.toLowerCase()));
      list = list.filter((c) =>
        set.has(String(c.ink_type || '').toLowerCase())
      );
    }

    if (filters.mana.length) {
      list = list.filter((c) => matchesManaCost(c, filters.mana));
    }

    if (filters.types.length) {
      const set = new Set(filters.types.map((x) => x.toLowerCase()));
      list = list.filter((c) =>
        set.has(String(c.type || '').toLowerCase())
      );
    }

    if (filters.rarity.length) {
      const set = new Set(filters.rarity.map(normalizeRarity));
      list = list.filter((c) => set.has(normalizeRarity(c.rarity)));
    }

    return list;
  }, [allCards, filters]);

  React.useEffect(() => {
    setVisibleCount(GRID_PAGE);
  }, [filters]);

  const slice = filteredCards.slice(0, visibleCount);
  const hasMore = filteredCards.length > visibleCount;

  const imgFallback =
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280" viewBox="0 0 200 280"><rect fill="#1e293b" width="200" height="280"/><text x="100" y="140" text-anchor="middle" fill="#64748b" font-family="system-ui" font-size="12">Lorcana</text></svg>`
    );

  if (loading) {
    return (
      <div className="visual-grid-loading">
        {t('deckBuilder.loadingCards', 'Carregando cartas…')}
      </div>
    );
  }

  return (
    <div className="visual-card-grid">
      <div className="visual-grid-toolbar">
        <div className="visual-grid-search">
          <input
            type="search"
            className="visual-grid-search-input"
            placeholder={t('deckBuilder.searchPlaceholder')}
            value={filters.search}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value }))
            }
            aria-label={t('deckBuilder.searchCards')}
          />
        </div>
        <div className="visual-grid-toolbar-meta">
          <span className="visual-grid-stat-pill">
            {totalDeckCards}/60 {t('deckBuilder.cardsShort', 'cartas')}
          </span>
          <span className="visual-grid-stat-pill subtle">
            {uniqueInDeck} {t('deckBuilder.uniqueShort', 'únicas')}
          </span>
          <button
            type="button"
            className="visual-grid-toggle-filters"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            {filtersOpen
              ? t('deckBuilder.hideFilters', 'Ocultar filtros')
              : t('deckBuilder.showFilters', 'Filtros')}
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="visual-grid-filters glass-panel">
          <div className="visual-filter-row">
            <span className="visual-filter-label">
              {t('deckBuilder.manaCost', 'Custo de tinta')}
            </span>
            <div className="visual-filter-chips">
              {MANA_KEYS.map((cost) => (
                <button
                  key={String(cost)}
                  type="button"
                  className={`visual-mana-chip ${
                    filters.mana.includes(cost) ? 'active' : ''
                  }`}
                  onClick={() => toggleFilter('mana', cost)}
                >
                  <span className="visual-mana-hex">{cost}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="visual-filter-row">
            <span className="visual-filter-label">
              {t('deckBuilder.inkColors', 'Cores')}
            </span>
            <div className="visual-filter-chips visual-ink-row">
              {INK_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`visual-ink-chip ${
                    filters.colors.includes(color) ? 'active' : ''
                  }`}
                  onClick={() => toggleFilter('colors', color)}
                  title={color}
                >
                  <InkBadge ink={color} size="lg" />
                </button>
              ))}
            </div>
          </div>

          <div className="visual-filter-row">
            <span className="visual-filter-label">
              {t('deckBuilder.cardType', 'Tipo')}
            </span>
            <div className="visual-filter-chips wrap">
              {CARD_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`visual-type-chip ${
                    filters.types.includes(type) ? 'active' : ''
                  }`}
                  onClick={() => toggleFilter('types', type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="visual-filter-row">
            <span className="visual-filter-label">
              {t('deckBuilder.rarity', 'Raridade')}
            </span>
            <div className="visual-filter-chips wrap">
              {RARITY_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`visual-type-chip ${
                    filters.rarity.includes(key) ? 'active' : ''
                  }`}
                  onClick={() => toggleFilter('rarity', key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="visual-grid-count">
        {t('deckBuilder.showingCards', {
          visible: slice.length,
          total: filteredCards.length,
        })}
      </p>

      <div className="visual-cards-grid">
        {slice.map((card) => {
          const count = getCount(card.id);
          const url = getCardImageUrl(card, 'normal') || imgFallback;
          const subtitle = card.subtitle ? ` — ${card.subtitle}` : '';

          return (
            <article key={card.id} className="visual-card-tile">
              <div className="visual-card-image-wrap">
                <img
                  src={url}
                  alt=""
                  className="visual-card-image"
                  loading="lazy"
                  onError={(e) => {
                    e.target.src = imgFallback;
                  }}
                />
              </div>
              <div className="visual-card-body">
                <h3 className="visual-card-title" title={card.name + subtitle}>
                  {card.name}
                  {card.subtitle && (
                    <span className="visual-card-sub">{card.subtitle}</span>
                  )}
                </h3>
                <div className="visual-card-counter">
                  <button
                    type="button"
                    className="visual-counter-btn"
                    aria-label={t('deckBuilder.decrease', 'Remover uma cópia')}
                    disabled={count <= 0}
                    onClick={() => onAdjust(card, -1)}
                  >
                    −
                  </button>
                  <span className="visual-counter-val">
                    {count}
                    <span className="visual-counter-max">/4</span>
                  </span>
                  <button
                    type="button"
                    className="visual-counter-btn"
                    aria-label={t('deckBuilder.increase', 'Adicionar uma cópia')}
                    disabled={count >= 4 || totalDeckCards >= 60}
                    onClick={() => onAdjust(card, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {hasMore && (
        <div className="visual-grid-more-wrap">
          <button
            type="button"
            className="visual-grid-more-btn"
            onClick={() => setVisibleCount((c) => c + GRID_PAGE)}
          >
            {t('deckBuilder.moreCards', 'Mais cartas…')}
          </button>
        </div>
      )}

      {filteredCards.length === 0 && (
        <p className="visual-grid-empty">{t('deckBuilder.noResults')}</p>
      )}
    </div>
  );
}

export default VisualCardGrid;

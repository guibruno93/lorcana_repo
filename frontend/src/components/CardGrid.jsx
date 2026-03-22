import React from 'react';
import { useTranslation } from 'react-i18next';
import { getCardImageUrl } from '../services/cardService';
import './CardGrid.css';
import CardItem from './components/CardItem';

export default function CardGrid({ 
  cards, 
  onCardClick,
  loading = false,
  pagination,
  onPageChange,
  sortBy,
  onSortChange
}) {
  const { t } = useTranslation();

  const renderCard = (card) => {
    const imageUrl = getCardImageUrl(card, 'normal');
    const rarityClass = card.rarity?.toLowerCase().replace('_', '-') || 'common';

    return (
      <div 
        key={card.id || card.card_id}
        className={`card-item rarity-${rarityClass}`}
        onClick={() => onCardClick(card)}
      >
        <div className="card-image-wrapper">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={card.name}
              className="card-image"
              loading="lazy"
              onError={(e) => {
                e.target.src = '/placeholder-card.png';
                e.target.onerror = null;
              }}
            />
          ) : (
            <div className="card-image-placeholder">
              <span>🃏</span>
              <span>{card.name}</span>
            </div>
          )}
          
          {card.ink_cost !== undefined && (
            <div className="card-cost-badge">
              {card.ink_cost}
            </div>
          )}
        </div>

        <div className="card-info">
          <div className="card-name">{card.name}</div>
          <div className="card-meta">
            {card.type && <span className="card-type">{card.type}</span>}
            {card.rarity && (
              <span className={`card-rarity rarity-${rarityClass}`}>
                {t(`cardDatabase.rarities.${card.rarity.toLowerCase()}`)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="card-grid-loading">
        <div className="loading-spinner"></div>
        <p>{t('common.loading')}...</p>
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="card-grid-empty">
        <div className="empty-icon">🔍</div>
        <h3>{t('cardDatabase.noResults')}</h3>
        <p>{t('cardDatabase.tryDifferentFilters')}</p>
      </div>
    );
  }

  return (
    <div className="card-grid-container">
      {/* Sort Controls */}
      <div className="grid-controls">
        <div className="sort-controls">
          <label>{t('cardDatabase.sortBy')}:</label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="sort-select"
          >
            <option value="name">{t('cardDatabase.sort.name')}</option>
            <option value="cost">{t('cardDatabase.sort.cost')}</option>
            <option value="rarity">{t('cardDatabase.sort.rarity')}</option>
            <option value="set">{t('cardDatabase.sort.set')}</option>
            <option value="number">{t('cardDatabase.sort.number')}</option>
          </select>
        </div>

        {pagination && (
          <div className="pagination-info">
            {t('cardDatabase.showing')} {((pagination.currentPage - 1) * pagination.pageSize) + 1}-
            {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCards)} {t('cardDatabase.of')} {pagination.totalCards}
          </div>
        )}
      </div>

      {/* Card Grid */}
      <div className="card-grid">
        {cards.map(card => renderCard(card))}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => onPageChange(1)}
            disabled={pagination.currentPage === 1}
          >
            ⏮ {t('cardDatabase.pagination.first')}
          </button>

          <button
            className="pagination-btn"
            onClick={() => onPageChange(pagination.currentPage - 1)}
            disabled={!pagination.hasPrevPage}
          >
            ◀ {t('cardDatabase.pagination.prev')}
          </button>

          <div className="pagination-pages">
            {renderPageNumbers(pagination.currentPage, pagination.totalPages).map(page => (
              <button
                key={page}
                className={`pagination-page ${page === pagination.currentPage ? 'active' : ''}`}
                onClick={() => typeof page === 'number' && onPageChange(page)}
                disabled={typeof page !== 'number'}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            className="pagination-btn"
            onClick={() => onPageChange(pagination.currentPage + 1)}
            disabled={!pagination.hasNextPage}
          >
            {t('cardDatabase.pagination.next')} ▶
          </button>

          <button
            className="pagination-btn"
            onClick={() => onPageChange(pagination.totalPages)}
            disabled={pagination.currentPage === pagination.totalPages}
          >
            {t('cardDatabase.pagination.last')} ⏭
          </button>
        </div>
      )}
    </div>
  );
}

// Helper para renderizar números de página
function renderPageNumbers(current, total) {
  const pages = [];
  const maxVisible = 7;

  if (total <= maxVisible) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);

    if (current > 3) {
      pages.push('...');
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (current < total - 2) {
      pages.push('...');
    }

    pages.push(total);
  }

  return pages;
}

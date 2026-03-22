import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getCardImageUrl } from '../services/cardService';
import './CardDetailModal.css';

export default function CardDetailModal({ card, onClose }) {
  const { t } = useTranslation();

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!card) return null;

  const imageUrl = getCardImageUrl(card, 'normal');
  const rarityClass = card.rarity?.toLowerCase().replace('_', '-') || 'common';

  const inkColors = {
    'Amber': '#FFB84D',
    'Amethyst': '#9B59B6',
    'Emerald': '#2ECC71',
    'Ruby': '#E74C3C',
    'Sapphire': '#3498DB',
    'Steel': '#95A5A6'
  };

  return (
    <div className="card-modal-overlay" onClick={onClose}>
      <div className="card-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

        <div className="modal-content">
          {/* Left: Image */}
          <div className="modal-image-section">
            {imageUrl ? (
              <img 
                src={imageUrl} 
                alt={card.name}
                className="modal-card-image"
              />
            ) : (
              <div className="modal-image-placeholder">
                <span>🃏</span>
                <span>{card.name}</span>
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="modal-details-section">
            <div className="modal-header">
              <h2 className="modal-card-name">{card.name}</h2>
              {card.subtitle && (
                <p className="modal-card-subtitle">{card.subtitle}</p>
              )}
            </div>

            {/* Ink and Cost */}
            <div className="modal-stats">
              {card.ink_cost !== undefined && (
                <div className="stat-item">
                  <span className="stat-label">{t('cardDatabase.details.cost')}:</span>
                  <span className="stat-value cost-value">{card.ink_cost}</span>
                </div>
              )}

              {card.ink_type && (
                <div className="stat-item">
                  <span className="stat-label">{t('cardDatabase.details.ink')}:</span>
                  <div className="ink-badges">
                    {(Array.isArray(card.ink_type) ? card.ink_type : [card.ink_type]).map((ink, i) => (
                      <span 
                        key={i}
                        className="ink-badge"
                        style={{ backgroundColor: inkColors[ink] || '#666' }}
                      >
                        {ink}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {card.type && (
                <div className="stat-item">
                  <span className="stat-label">{t('cardDatabase.details.type')}:</span>
                  <span className="stat-value">{card.type}</span>
                </div>
              )}

              {card.rarity && (
                <div className="stat-item">
                  <span className="stat-label">{t('cardDatabase.details.rarity')}:</span>
                  <span className={`stat-value rarity-${rarityClass}`}>
                    {t(`cardDatabase.rarities.${card.rarity.toLowerCase()}`)}
                  </span>
                </div>
              )}
            </div>

            {/* Character Stats */}
            {(card.strength !== undefined || card.willpower !== undefined || card.lore !== undefined) && (
              <div className="modal-character-stats">
                <h3 className="section-title">{t('cardDatabase.details.stats')}</h3>
                <div className="character-stats-grid">
                  {card.strength !== undefined && (
                    <div className="character-stat">
                      <span className="stat-icon">⚔️</span>
                      <span className="stat-label">{t('cardDatabase.details.strength')}</span>
                      <span className="stat-value">{card.strength}</span>
                    </div>
                  )}
                  {card.willpower !== undefined && (
                    <div className="character-stat">
                      <span className="stat-icon">🛡️</span>
                      <span className="stat-label">{t('cardDatabase.details.willpower')}</span>
                      <span className="stat-value">{card.willpower}</span>
                    </div>
                  )}
                  {card.lore !== undefined && (
                    <div className="character-stat">
                      <span className="stat-icon">📖</span>
                      <span className="stat-label">{t('cardDatabase.details.lore')}</span>
                      <span className="stat-value">{card.lore}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Card Text */}
            {card.body_text && (
              <div className="modal-text-section">
                <h3 className="section-title">{t('cardDatabase.details.cardText')}</h3>
                <div className="card-text">{card.body_text}</div>
              </div>
            )}

            {/* Flavor Text */}
            {card.flavor_text && (
              <div className="modal-flavor-section">
                <div className="flavor-text">
                  <em>"{card.flavor_text}"</em>
                </div>
              </div>
            )}

            {/* Set Info */}
            <div className="modal-set-info">
              {card.set_name && (
                <div className="set-info-item">
                  <span className="set-label">{t('cardDatabase.details.set')}:</span>
                  <span className="set-value">{card.set_name}</span>
                </div>
              )}
              {card.card_number && (
                <div className="set-info-item">
                  <span className="set-label">{t('cardDatabase.details.cardNumber')}:</span>
                  <span className="set-value">#{card.card_number}</span>
                </div>
              )}
              {card.artist && (
                <div className="set-info-item">
                  <span className="set-label">{t('cardDatabase.details.artist')}:</span>
                  <span className="set-value">{card.artist}</span>
                </div>
              )}
            </div>

            {/* Classifications */}
            {(card.classifications || card.traits) && (
              <div className="modal-classifications">
                <h3 className="section-title">{t('cardDatabase.details.traits')}</h3>
                <div className="traits-list">
                  {(card.classifications || card.traits || []).map((trait, i) => (
                    <span key={i} className="trait-badge">{trait}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Abilities */}
            {card.abilities && card.abilities.length > 0 && (
              <div className="modal-abilities">
                <h3 className="section-title">{t('cardDatabase.details.abilities')}</h3>
                <div className="abilities-list">
                  {card.abilities.map((ability, i) => (
                    <div key={i} className="ability-item">
                      {ability.name && <strong>{ability.name}:</strong>} {ability.text}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

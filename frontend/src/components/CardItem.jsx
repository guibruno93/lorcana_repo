// CardItem.jsx - Componente otimizado com React.memo
import React from 'react';
import './CardItem.css';
import LazyImage from './LazyImage';

/**
 * Componente de carta individual - OTIMIZADO
 * 
 * Otimizações:
 * - React.memo para evitar re-renders desnecessários
 * - Comparação personalizada (só re-renderiza se card.id mudar)
 * - Lazy loading nativo nas imagens
 * - Event handlers estáveis
 */
const CardItem = React.memo(({ card, onClick }) => {
  const imageUrl = card.image_uris?.digital?.normal || 
                   card.image_uris?.digital?.small;
  
  const handleClick = () => {
    if (onClick) {
      onClick(card);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  };

  return (
    <div 
      className="card-item"
      onClick={handleClick}
      onKeyPress={handleKeyPress}
      role="button"
      tabIndex={0}
      aria-label={`${card.name} - ${card.subtitle || ''}`}
    >
      {/* Imagem com lazy loading nativo */}
      <div className="card-item-image-container">
        {imageUrl ? (
          <LazyImage
  src={imageUrl}
  alt={card.name}
  placeholder="/placeholder-card.svg"
  rootMargin="100px"
/>
        ) : (
          <div className="card-item-placeholder">
            <span className="card-item-placeholder-icon" aria-hidden="true">—</span>
          </div>
        )}
      </div>

      {/* Informações da carta */}
      <div className="card-item-info">
        <h3 className="card-item-name">{card.name}</h3>
        {card.subtitle && (
          <p className="card-item-subtitle">{card.subtitle}</p>
        )}
        
        <div className="card-item-stats">
          {card.ink_cost !== null && card.ink_cost !== undefined && (
            <span className="card-item-cost">
              {card.ink_cost}
            </span>
          )}
          
          {card.ink_type && (
            <span className={`card-item-ink ink-${card.ink_type.toLowerCase()}`}>
              {card.ink_type}
            </span>
          )}
        </div>

        {card.rarity && (
          <span className={`card-item-rarity rarity-${card.rarity.toLowerCase()}`}>
            {card.rarity}
          </span>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Comparação personalizada - só re-renderiza se o ID mudar
  // Isso evita re-renders quando outros props do parent mudam
  return prevProps.card.id === nextProps.card.id &&
         prevProps.onClick === nextProps.onClick;
});

CardItem.displayName = 'CardItem';

export default CardItem;

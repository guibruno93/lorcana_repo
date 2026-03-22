/**
 * frontend/src/components/DecklistVisual.jsx
 * Visualização de deck com imagens organizadas por custo
 */

import React, { useState, useEffect } from 'react';
import CardImage from './CardImage';

export const DecklistVisual = ({ deckText, title = 'Deck' }) => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (deckText) {
      parseDeck(deckText);
    }
  }, [deckText]);
  
  const parseDeck = (text) => {
    setLoading(true);
    
    const lines = text.split('\n').filter(l => l.trim());
    const parsed = [];
    
    for (const line of lines) {
      const match = line.match(/^(\d+)[\sx]+(.+)$/i);
      if (match) {
        const quantity = parseInt(match[1]);
        const name = match[2].trim();
        
        parsed.push({
          quantity,
          name,
          cost: estimateCost(name)
        });
      }
    }
    
    setCards(parsed);
    setLoading(false);
  };
  
  const estimateCost = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes('lore') || lower.includes('pawpsicle')) return 1;
    if (lower.includes('beast') || lower.includes('steal')) return 2;
    if (lower.includes('fishbone') || lower.includes('fork')) return 3;
    if (lower.includes('ursula') && lower.includes('trickster')) return 4;
    if (lower.includes('mickey') && !lower.includes('detective')) return 5;
    if (lower.includes('aurora') || lower.includes('fire')) return 6;
    if (lower.includes('cinderella') && lower.includes('ballroom')) return 7;
    if (lower.includes('elsa') || lower.includes('sisu')) return 8;
    return 4;
  };
  
  const groupCards = () => {
    const groups = {};
    cards.forEach(card => {
      const cost = card.cost || 0;
      if (!groups[cost]) groups[cost] = [];
      groups[cost].push(card);
    });
    return Object.entries(groups).sort(([a], [b]) => parseInt(a) - parseInt(b));
  };
  
  const grouped = groupCards();
  const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0);
  
  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
        <div>Carregando deck...</div>
      </div>
    );
  }
  
  return (
    <div style={{
      background: 'rgba(30, 30, 40, 0.6)',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid rgba(103, 126, 234, 0.3)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '2px solid rgba(103, 126, 234, 0.3)'
      }}>
        <div>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            color: '#fff',
            margin: 0,
            marginBottom: '4px'
          }}>
            {title}
          </h2>
          <div style={{ fontSize: '14px', color: '#aaa' }}>
            {totalCards} cards • {cards.length} unique
          </div>
        </div>
      </div>
      
      {grouped.map(([cost, costCards]) => {
        const totalInGroup = costCards.reduce((sum, card) => sum + card.quantity, 0);
        
        return (
          <div key={cost} style={{ marginBottom: '32px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              paddingBottom: '8px',
              borderBottom: '1px solid rgba(103, 126, 234, 0.2)'
            }}>
              <span style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#667eea',
                minWidth: '40px'
              }}>
                💎 {cost}
              </span>
              <span style={{ fontSize: '14px', color: '#aaa' }}>
                {totalInGroup} cards
              </span>
            </div>
            
           <div style={{
  display: 'grid',
  gridTemplateColumns: window.innerWidth < 768 
    ? 'repeat(2, 1fr)'  // Mobile: 2 colunas
    : window.innerWidth < 1024
    ? 'repeat(3, 1fr)'  // Tablet: 3 colunas
    : 'repeat(auto-fill, minmax(160px, 1fr))',  // Desktop: auto
  gap: window.innerWidth < 768 ? '12px' : '16px'
}}>
              {costCards.map((card, idx) => (
                <div key={idx} style={{
                  background: 'rgba(0,0,0,0.4)',
                  borderRadius: '12px',
                  padding: '12px',
                  border: '1px solid rgba(103, 126, 234, 0.2)',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'rgba(103, 126, 234, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(103, 126, 234, 0.2)';
                }}>
                  <div style={{ position: 'relative', marginBottom: '8px' }}>
                    <div style={{
                      position: 'absolute',
                      top: '-4px',
                      left: '-4px',
                      background: '#667eea',
                      color: '#fff',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      border: '2px solid #1a1a2e',
                      zIndex: 10
                    }}>
                      {card.quantity}
                    </div>
                    
                    <CardImage cardName={card.name} size="small" />
                  </div>
                  
                  <div style={{
                    fontSize: '12px',
                    color: '#fff',
                    textAlign: 'center',
                    lineHeight: '1.3',
                    marginTop: '8px',
                    minHeight: '32px'
                  }}>
                    {card.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DecklistVisual;

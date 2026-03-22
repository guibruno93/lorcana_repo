import React, { useState, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════
// CACHE GLOBAL - Evita requisições duplicadas
// ═══════════════════════════════════════════════════════════════════
const cardCache = new Map();
const pendingRequests = new Map();

export const CardImage = ({ cardName, size = 'normal' }) => {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchCard = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // ✅ CACHE: Verificar se já temos essa carta
        const cacheKey = `${cardName}-${size}`;
        if (cardCache.has(cacheKey)) {
          console.log(`💾 Cache HIT: "${cardName}"`);
          setCard(cardCache.get(cacheKey));
          setLoading(false);
          return;
        }
        
        // ✅ DEDUPLICAÇÃO: Verificar se já tem requisição em andamento
        if (pendingRequests.has(cardName)) {
          console.log(`⏳ Aguardando requisição existente: "${cardName}"`);
          const existingRequest = await pendingRequests.get(cardName);
          setCard(existingRequest);
          setLoading(false);
          return;
        }
        
        console.log(`🔍 Fetching card: "${cardName}"`);
        
        // Criar promise e adicionar ao pending
        const requestPromise = (async () => {
          // Token JWT se existir
          const token = localStorage.getItem('token');
          const headers = {
            'Content-Type': 'application/json'
          };
          
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          
          const response = await fetch(
            `http://localhost:3002/api/deck/search-card?q=${encodeURIComponent(cardName)}`,
            { headers }
          );
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (data.results && data.results.length > 0) {
            const foundCard = data.results[0];
            
            // Verificar se tem imagem
            if (foundCard.image_uris?.digital) {
              return foundCard;
            } else {
              throw new Error('No image available');
            }
          } else {
            throw new Error('Card not found in Lorcast database');
          }
        })();
        
        // Adicionar ao pending
        pendingRequests.set(cardName, requestPromise);
        
        // Aguardar resultado
        const foundCard = await requestPromise;
        
        console.log(`✅ Card found:`, foundCard.name, '-', foundCard.version);
        console.log(`🖼️ Image URL:`, foundCard.image_uris.digital[size]);
        
        // ✅ SALVAR NO CACHE
        cardCache.set(cacheKey, foundCard);
        setCard(foundCard);
        
      } catch (err) {
        console.error(`❌ Error fetching "${cardName}":`, err);
        setError(err.message);
      } finally {
        setLoading(false);
        // Remover do pending
        pendingRequests.delete(cardName);
      }
    };
    
    if (cardName) {
      // ✅ DEBOUNCE: Aguardar 100ms antes de fazer requisição
      const timer = setTimeout(() => {
        fetchCard();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [cardName, size]);
  
  if (loading) {
    return (
      <div style={{ 
        padding: '30px',
        textAlign: 'center',
        color: '#999',
        minWidth: '200px',
        border: '2px dashed #444',
        borderRadius: '12px',
        background: 'rgba(0,0,0,0.3)'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
        <div style={{ fontSize: '14px' }}>Loading...</div>
        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          {cardName}
        </div>
      </div>
    );
  }
  
  if (error || !card?.image_uris?.digital) {
    return (
      <div style={{ 
        padding: '30px',
        textAlign: 'center',
        color: '#e74c3c',
        minWidth: '200px',
        border: '2px solid #e74c3c',
        borderRadius: '12px',
        background: 'rgba(231, 76, 60, 0.1)'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>❌</div>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
          Card not found
        </div>
        <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>
          {cardName}
        </div>
        {error && (
          <div style={{ 
            fontSize: '11px', 
            color: '#e74c3c',
            marginTop: '8px',
            padding: '8px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '4px'
          }}>
            Error: {error}
          </div>
        )}
      </div>
    );
  }
  
  const imageUrl = card.image_uris.digital[size];
  const displaySize = size === 'small' ? '146px' : size === 'normal' ? '280px' : '488px';
  
  return (
    <div style={{ 
      margin: '15px',
      textAlign: 'center'
    }}>
      <div style={{
        position: 'relative',
        display: 'inline-block'
      }}>
        <img
          src={imageUrl}
          alt={`${card.name} - ${card.version}`}
          style={{ 
            maxWidth: displaySize,
            width: '100%',
            height: 'auto',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            cursor: 'pointer',
            border: '2px solid rgba(103, 126, 234, 0.5)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05) translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 15px 40px rgba(103, 126, 234, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
            e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
          }}
          onError={(e) => {
            console.error(`❌ Image failed to load: ${imageUrl}`);
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
      
      {/* Card info */}
      <div style={{
        marginTop: '12px',
        padding: '8px',
        background: 'rgba(103, 126, 234, 0.1)',
        borderRadius: '8px',
        maxWidth: displaySize,
        margin: '12px auto 0'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#fff',
          marginBottom: '4px'
        }}>
          {card.name}
        </div>
        <div style={{
          fontSize: '12px',
          color: '#aaa',
          marginBottom: '6px'
        }}>
          {card.version}
        </div>
        <div style={{
          fontSize: '11px',
          color: '#667eea',
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          {card.cost && <span>💎 {card.cost}</span>}
          {card.ink && <span>{card.ink}</span>}
          {card.rarity && <span>⭐ {card.rarity}</span>}
        </div>
      </div>
    </div>
  );
};

export default CardImage;

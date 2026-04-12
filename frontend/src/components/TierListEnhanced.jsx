import React, { useState, useEffect, useRef } from 'react';
import CardImage from './CardImage';
import { useSwipe } from '../hooks/useGestures';
import { useOfflineCache } from '../hooks/usePWA';
import { CardsGridSkeleton, PulseLoader } from '../components/LoadingStates';
import { CacheIndicator } from '../components/PWAComponents';
import './TierListEnhanced.mobile.css';
import './TierListEnhanced.gestures.css';
import '../components/LoadingStates.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3002';

export const TierListEnhanced = ({ tierList: tierListProp }) => {
  const [expandedArchetype, setExpandedArchetype] = useState(null);
  const [topCardsCache, setTopCardsCache] = useState({});
  const [loadingCards, setLoadingCards] = useState({});
  const [touchFeedback, setTouchFeedback] = useState({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const expandedRef = useRef(null);
  
  // Cache offline para tier list
  const {
    data: cachedTierList,
    loading: tierListLoading,
    fromCache: tierListFromCache
  } = useOfflineCache(
    'tier-list-data',
    async () => {
      if (tierListProp) {
        return tierListProp;
      }
      const response = await fetch(`${API}/api/meta-analysis/tier-list`);
      if (!response.ok) throw new Error('Failed to fetch tier list');
      return response.json();
    },
    {
      cacheTime: 5 * 60 * 1000, // 5 minutos
      staleWhileRevalidate: true
    }
  );

  // Usar tier list do cache ou prop
  const tierList = tierListProp || cachedTierList;
  
  const tierColors = {
    S: { bg: '#ff4757', glow: 'rgba(255, 71, 87, 0.3)' },
    A: { bg: '#ffa502', glow: 'rgba(255, 165, 2, 0.3)' },
    B: { bg: '#eccc68', glow: 'rgba(236, 204, 104, 0.3)' },
    C: { bg: '#70a1ff', glow: 'rgba(112, 161, 255, 0.3)' },
    D: { bg: '#a4b0be', glow: 'rgba(164, 176, 190, 0.3)' }
  };

  // Monitorar status online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const fetchTopCards = async (archetypeName) => {
    // Verificar cache primeiro (localStorage)
    const cacheKey = `top-cards-${archetypeName}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      
      // Se cache < 10 minutos, usar
      if (age < 10 * 60 * 1000) {
        setTopCardsCache(prev => ({
          ...prev,
          [archetypeName]: data
        }));
        
        // Se online, buscar em background para atualizar
        if (isOnline) {
          fetchTopCardsFromAPI(archetypeName, cacheKey);
        }
        return;
      }
    }
    
    // Cache miss ou expirado
    if (isOnline) {
      await fetchTopCardsFromAPI(archetypeName, cacheKey);
    } else {
      // Offline e sem cache válido
      console.log('[Offline] No cached cards for', archetypeName);
    }
  };

  const fetchTopCardsFromAPI = async (archetypeName, cacheKey) => {
    setLoadingCards(prev => ({ ...prev, [archetypeName]: true }));
    
    try {
      const response = await fetch(
        `${API}/api/meta-analysis/archetype/${encodeURIComponent(archetypeName)}/top-cards?limit=8`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const cards = data.topCards || [];
      
      // Atualizar estado
      setTopCardsCache(prev => ({
        ...prev,
        [archetypeName]: cards
      }));

      // Salvar no cache
      localStorage.setItem(cacheKey, JSON.stringify({
        data: cards,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error(`Error fetching top cards for ${archetypeName}:`, error);
      
      // Se falhou, tentar usar cache expirado como fallback
      const cachedFallback = localStorage.getItem(cacheKey);
      if (cachedFallback) {
        try {
          const { data } = JSON.parse(cachedFallback);
          setTopCardsCache(prev => ({
            ...prev,
            [archetypeName]: data
          }));
        } catch (parseError) {
          console.error('Failed to parse cached data:', parseError);
        }
      }
    } finally {
      setLoadingCards(prev => ({ ...prev, [archetypeName]: false }));
    }
  };
  
  const toggleArchetype = (archetypeName) => {
    if (expandedArchetype === archetypeName) {
      setExpandedArchetype(null);
    } else {
      setExpandedArchetype(archetypeName);
      
      // Só buscar se não tiver em cache
      if (!topCardsCache[archetypeName]) {
        fetchTopCards(archetypeName);
      }
    }
  };

  // Scroll suave para arquétipo expandido
  useEffect(() => {
    if (expandedArchetype && expandedRef.current) {
      setTimeout(() => {
        expandedRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }, 100);
    }
  }, [expandedArchetype]);

  // Touch feedback temporário
  const showTouchFeedback = (archetypeName) => {
    setTouchFeedback(prev => ({ ...prev, [archetypeName]: true }));
    setTimeout(() => {
      setTouchFeedback(prev => ({ ...prev, [archetypeName]: false }));
    }, 300);
  };
  
  if (tierListLoading || !tierList) {
    return (
      <div className="tier-loading">
        <PulseLoader />
        <p style={{ marginTop: '16px', color: '#999' }}>
          {isOnline ? 'Loading tier list...' : 'Loading cached tier list...'}
        </p>
      </div>
    );
  }
  
  return (
    <div className="tier-list-container">
      {/* Indicador de cache no topo */}
      {tierListFromCache && (
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
          <CacheIndicator fromCache={true} />
        </div>
      )}

      {['S', 'A', 'B', 'C', 'D'].map(tier => {
        const archetypes = tierList[tier] || [];
        if (archetypes.length === 0) return null;
        
        const colors = tierColors[tier];
        
        return (
          <div key={tier} className="tier-section fade-in">
            <div 
              className="tier-header"
              style={{
                background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.bg}dd 100%)`,
                boxShadow: `0 4px 20px ${colors.glow}`
              }}
            >
              <div className="tier-title">
                TIER {tier}
              </div>
              <div className="tier-count">
                {archetypes.length} archetype{archetypes.length !== 1 ? 's' : ''}
              </div>
            </div>
            
            <div className="tier-content">
              {archetypes.map((archetype, idx) => (
                <ArchetypeRow
                  key={archetype.archetype}
                  archetype={archetype}
                  idx={idx}
                  totalCount={archetypes.length}
                  isExpanded={expandedArchetype === archetype.archetype}
                  isLoading={loadingCards[archetype.archetype]}
                  topCards={topCardsCache[archetype.archetype] || []}
                  colors={colors}
                  isOnline={isOnline}
                  onToggle={toggleArchetype}
                  onTouchFeedback={showTouchFeedback}
                  touchFeedback={touchFeedback[archetype.archetype]}
                  expandedRef={expandedArchetype === archetype.archetype ? expandedRef : null}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Componente separado para cada linha de arquétipo
const ArchetypeRow = ({ 
  archetype, 
  idx, 
  totalCount,
  isExpanded, 
  isLoading, 
  topCards, 
  colors,
  isOnline,
  onToggle,
  onTouchFeedback,
  touchFeedback,
  expandedRef
}) => {
  const rowRef = useRef(null);
  
  // Normalizar inks para array
  const inksArray = Array.isArray(archetype.inks) 
    ? archetype.inks 
    : (archetype.inks || '').split(' ').filter(Boolean);

  // Swipe gesture: direita = expandir, esquerda = colapsar
  const swipeHandlers = useSwipe(
    () => {
      if (isExpanded) {
        onToggle(archetype.archetype);
      }
    },
    () => {
      if (!isExpanded) {
        onToggle(archetype.archetype);
        onTouchFeedback(archetype.archetype);
      }
    },
    null,
    null,
    30
  );

  const handleClick = () => {
    onToggle(archetype.archetype);
    onTouchFeedback(archetype.archetype);
  };

  return (
    <div 
      ref={isExpanded ? expandedRef : rowRef}
      className={`archetype-row ${idx < totalCount - 1 ? 'bordered' : ''} ${isExpanded ? 'expanded-row' : ''}`}
    >
      <div
        onClick={handleClick}
        {...swipeHandlers}
        className={`archetype-header ${isExpanded ? 'expanded' : ''} ${touchFeedback ? 'touch-active' : ''}`}
      >
        <div className="archetype-main">
          <div className="archetype-info">
            <div className="archetype-title-row">
              <span className="archetype-name">
                {archetype.archetype}
              </span>
              
              <span 
                className="power-level-badge"
                style={{ color: colors.bg }}
              >
                {archetype.power_level}/100
              </span>
              
              <span className={`expand-icon ${isExpanded ? 'rotated' : ''}`}>
                ▼
              </span>
            </div>
            
            {inksArray.length > 0 && (
              <div className="inks-container">
                {inksArray.map((ink, j) => (
                  <span 
                    key={j} 
                    className="ink-badge"
                    style={{ background: getInkColor(ink) }}
                  >
                    {ink}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          <div className="archetype-stats">
            <div className="stat-item">
              <div className="stat-value">
                {archetype.win_rate != null ? archetype.win_rate.toFixed(1) : '0.0'}%
              </div>
              <div className="stat-label">Win Rate</div>
            </div>
            
            <div className="stat-item meta-share">
              <div className="stat-value">
                {archetype.meta_share != null ? archetype.meta_share.toFixed(1) : '0.0'}%
              </div>
              <div className="stat-label">Meta Share</div>
            </div>
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="cards-expanded-section slide-in-up">
          <div className="cards-section-header">
            <span aria-hidden="true" />
            <span>Top 8 Cards</span>
            {isLoading && (
              <span className="loading-indicator">
                <PulseLoader />
              </span>
            )}
            {!isOnline && !isLoading && (
              <span style={{ fontSize: '12px', color: '#ffa502', marginLeft: 'auto' }}>
                Offline
              </span>
            )}
          </div>
          
          {isLoading ? (
            <CardsGridSkeleton count={8} />
          ) : topCards.length > 0 ? (
            <div className="cards-grid">
              {topCards.map((card, cardIdx) => (
                <CardItem 
                  key={cardIdx} 
                  card={card} 
                  index={cardIdx}
                />
              ))}
            </div>
          ) : (
            <div className="no-cards-message fade-in">
              {isOnline 
                ? 'No card data available' 
                : 'Sem dados em cache — ligue-se à internet para ver as cartas'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Componente separado para cada card
const CardItem = ({ card, index }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [touchActive, setTouchActive] = useState(false);

  const handleTouchStart = () => {
    setTouchActive(true);
  };

  const handleTouchEnd = () => {
    setTimeout(() => setTouchActive(false), 150);
  };

  return (
    <div 
      className={`card-item stagger-item ${touchActive ? 'touch-active' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className={`card-image-wrapper ${!imageLoaded ? 'loading' : ''}`}>
        <CardImage 
          cardName={card.name} 
          size="small"
          onLoad={() => setImageLoaded(true)}
        />
      </div>
      
      <div className="card-info">
        <div className="card-name">
          {card.name.length > 25 ? card.name.substring(0, 22) + '...' : card.name}
        </div>
        
        <div className="card-stats">
          <div className="card-stat">
            <div className="card-stat-value inclusion">
              {card.inclusionRate.toFixed(0)}%
            </div>
            <div className="card-stat-label">Inclusion</div>
          </div>
          
          <div className="card-stat">
            <div className="card-stat-value avg">
              {card.avgCopies}
            </div>
            <div className="card-stat-label">Avg</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const getInkColor = (ink) => {
  const colors = {
    'Amber': 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
    'Amethyst': 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
    'Emerald': 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
    'Ruby': 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
    'Sapphire': 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
    'Steel': 'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)'
  };
  
  return colors[ink] || 'rgba(103, 126, 234, 0.5)';
};

export default TierListEnhanced;

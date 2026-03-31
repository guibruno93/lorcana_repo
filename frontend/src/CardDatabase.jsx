import React, { useState, useEffect, useMemo, useCallback } from 'react';
import CardFilters from './components/CardFilters';
import AdvancedFilters from './components/AdvancedFilters';
import CardDetailModal from './components/CardDetailModal';
import {
  fetchAllCards,
  fetchSets,
  filterAndSortCards,
  paginateCards,
  getCardStats,
  getAvailableInks,
  getAvailableTypes,
} from './services/cardService';
import './CardDatabase.css';

export default function CardDatabase() {
  // State
  const [allCards, setAllCards] = useState([]);
  const [availableSets, setAvailableSets] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    ink: 'all',
    cost: '',
    rarity: 'all',
    type: 'all',
    set: 'all',
    inkMulti: [],
    manaCostMulti: [],
    typeMulti: [],
    setMulti: [],
    rarityMulti: [],
  });
  const [sortBy, setSortBy] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [selectedCard, setSelectedCard] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load data
  useEffect(() => {
    loadCards();
    loadSets();
  }, []);

  const loadCards = async () => {
    try {
      setLoading(true);
      const cards = await fetchAllCards();
      console.log('📦 Cards loaded:', cards.length);
      setAllCards(cards);
    } catch (error) {
      console.error('Error loading cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSets = async () => {
    try {
      const sets = await fetchSets();
      console.log('📦 Sets loaded:', sets.length);
      setAvailableSets(sets);
    } catch (error) {
      console.error('Error loading sets:', error);
    }
  };

  // Memoized calculations
  const filteredCards = useMemo(() => {
    console.log('🔄 Filtering cards...');
    return filterAndSortCards(allCards, filters, sortBy);
  }, [allCards, filters, sortBy]);

  const paginatedData = useMemo(() => {
    console.log('📄 Paginating cards...');
    return paginateCards(filteredCards, currentPage, pageSize);
  }, [filteredCards, currentPage, pageSize]);

  const stats = useMemo(() => {
    return getCardStats(allCards);
  }, [allCards]);

  const availableInks = useMemo(() => {
    return getAvailableInks(allCards);
  }, [allCards]);

  const availableTypes = useMemo(() => {
    return getAvailableTypes(allCards);
  }, [allCards]);

  // Event handlers
  const handleFilterChange = useCallback((newFilters) => {
    console.log('🔍 Filters changed:', newFilters);
    setFilters(newFilters);
    setCurrentPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      ink: 'all',
      cost: '',
      rarity: 'all',
      type: 'all',
      set: 'all',
      inkMulti: [],
      manaCostMulti: [],
      typeMulti: [],
      setMulti: [],
      rarityMulti: [],
    });
    setCurrentPage(1);
  }, []);

  const handleSortChange = useCallback((newSort) => {
    console.log('🔄 Sort changed:', newSort);
    setSortBy(newSort);
  }, []);

  const handlePageChange = useCallback((newPage) => {
    console.log('📄 Page changed:', newPage);
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleCardClick = useCallback((card) => {
    console.log('🃏 Card clicked:', card.name);
    setSelectedCard(card);
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setSelectedCard(null);
  }, []);

  if (loading) {
    return (
      <div className="card-database-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
        <p>Carregando cartas...</p>
      </div>
    );
  }

  return (
    <div className="card-database">
      {/* Header com estatísticas */}
      <div className="card-database-header">
        <h1>Database de Cartas</h1>
        
        <div className="card-database-stats">
          <div className="stat-item">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total de Cartas</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{availableInks.length}</span>
            <span className="stat-label">Tintas</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{availableSets.length}</span>
            <span className="stat-label">Coleções</span>
          </div>
        </div>
      </div>

      <AdvancedFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        allCards={allCards}
      />

      {/* Filtros */}
      <CardFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        availableInks={availableInks}
        availableRarities={['common', 'uncommon', 'rare', 'super_rare', 'legendary', 'enchanted']}
        availableSets={availableSets}
        availableTypes={availableTypes}
        totalResults={filteredCards.length}
      />

      {/* Resultados */}
      <div className="card-database-results">
        <div className="results-header">
          <p className="results-count">
            Mostrando <strong>{paginatedData.cards.length}</strong> de <strong>{filteredCards.length}</strong> cartas
          </p>

          <div className="results-sort">
            <label>Ordenar por:</label>
            <select 
              value={sortBy} 
              onChange={(e) => handleSortChange(e.target.value)}
            >
              <option value="name">Nome</option>
              <option value="cost">Custo</option>
              <option value="rarity">Raridade</option>
              <option value="set">Coleção</option>
            </select>
          </div>
        </div>

        {/* Grid de cartas */}
        {paginatedData.cards.length > 0 ? (
          <div className="card-grid">
            {paginatedData.cards.map((card) => (
              <div 
                key={card.id}
                className="card-item"
                onClick={() => handleCardClick(card)}
              >
                {/* Imagem */}
                <div className="card-item-image-container">
                  {card.image_uris?.digital?.normal ? (
                    <img 
                      src={card.image_uris.digital.normal}
                      alt={card.name}
                      className="card-item-image"
                      loading="lazy"
                    />
                  ) : (
                    <div className="card-item-placeholder">
                      <span>🃏</span>
                    </div>
                  )}
                </div>

                {/* Informações */}
                <div className="card-item-info">
                  <h3 className="card-item-name">{card.name}</h3>
                  {card.subtitle && (
                    <p className="card-item-subtitle">{card.subtitle}</p>
                  )}
                  
                  <div className="card-item-stats">
                    {card.ink_cost !== null && card.ink_cost !== undefined && (
                      <span className="card-item-cost">
                        💧 {card.ink_cost}
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
            ))}
          </div>
        ) : (
          <div className="no-results">
            <p>Nenhuma carta encontrada</p>
          </div>
        )}

        {/* Paginação */}
        {paginatedData.totalPages > 1 && (
          <div className="pagination">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!paginatedData.hasPrevPage}
              className="pagination-button"
            >
              ← Anterior
            </button>

            <span className="pagination-info">
              Página {currentPage} de {paginatedData.totalPages}
            </span>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!paginatedData.hasNextPage}
              className="pagination-button"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>

      {/* Modal de detalhes */}
      {modalOpen && selectedCard && (
        <CardDetailModal
          card={selectedCard}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}

// Baseado na documentação oficial: https://lorcast.com/docs/api/cards

const LORCAST_API = 'https://api.lorcast.com/v0';
const USE_MOCK_DATA = false; // ← API REAL ATIVADA

// Cache
const cache = {
  cards: null,
  sets: null,
  timestamp: null,
  TTL: 5 * 60 * 1000
};

function getFallbackSets() {
  return [
    { id: 'set_7ecb0e0c71af496a9e0110e23824e0a5', code: '1', name: 'The First Chapter' },
    { id: 'set_142d2dfb5d4b4b739a1017dc4bb0fcd2', code: '2', name: 'Rise of the Floodborn' },
    { id: 'set_10a1db03fe66417c9912494b94463e8e', code: '3', name: 'Into the Inklands' },
    { id: 'set_8f4cbf5aef324eb295c4add5673e684f', code: '4', name: 'Ursula\'s Return' },
    { id: 'set_c64f092e725a4f66966f43af3aa161b6', code: '5', name: 'Shimmering Skies' },
    { id: 'set_0df34ab314e04a479ef3538fd6c3e4e1', code: '6', name: 'Azurite Sea' },
    { id: 'set_ceb34c63638a4ce6b80e518393964c8f', code: '7', name: 'Archazia\'s Island' },
    { id: 'set_e4fe64374c144642a035ee7b8451f990', code: '8', name: 'Reign of Jafar' },
    { id: 'set_42a2e9232c43494dab2c72945ea6879e', code: '9', name: 'Fabled' },
    { id: 'set_8b7f731a52bf4478a0c41f09c7f74a2a', code: '10', name: 'Whispers in the Well' },
    { id: 'set_c794231df3e14fce9f63c19c59241ee3', code: '11', name: 'Winterspell' },
    { id: 'set_c254adfcbf6d4e3482a675ecece86dcc', code: 'P1', name: 'Promo Set 1' },
    { id: 'set_1fd69818f6e44dd79e922f403aa4f6d9', code: 'P2', name: 'Promo Set 2' }
  ];
}

function normalizeCard(apiCard) {
  return {
    id: apiCard.id,
    name: apiCard.name,
    subtitle: apiCard.version || null,
    type: Array.isArray(apiCard.type) ? apiCard.type[0] : apiCard.type,
    layout: apiCard.layout,
    ink_cost: apiCard.cost,
    ink_type: apiCard.ink,
    inkwell: apiCard.inkwell,
    strength: apiCard.strength,
    willpower: apiCard.willpower,
    lore: apiCard.lore,
    move_cost: apiCard.move_cost,
    body_text: apiCard.text,
    flavor_text: apiCard.flavor_text,
    rarity: apiCard.rarity?.toLowerCase().replace('_', ''),
    set_id: apiCard.set?.id,
    set_code: apiCard.set?.code,
    set_name: apiCard.set?.name,
    card_number: apiCard.collector_number,
    collector_number: apiCard.collector_number,
    artist: Array.isArray(apiCard.illustrators) ? apiCard.illustrators[0] : apiCard.illustrators,
    illustrators: apiCard.illustrators,
    classifications: apiCard.classifications || [],
    image_uris: apiCard.image_uris,
    released_at: apiCard.released_at,
    lang: apiCard.lang,
    tcgplayer_id: apiCard.tcgplayer_id,
    prices: apiCard.prices,
    legalities: apiCard.legalities
  };
}

function getMockCards() {
  return [
    {
      id: 'mock-1', name: 'Elsa - Spirit of Winter', type: 'Character',
      ink_cost: 8, ink_type: 'Amethyst', rarity: 'legendary',
      set_code: '1', set_name: 'The First Chapter', card_number: '001',
      strength: 4, willpower: 6, lore: 3
    },
    {
      id: 'mock-2', name: 'Mickey Mouse - Brave Little Tailor', type: 'Character',
      ink_cost: 6, ink_type: 'Steel', rarity: 'superrare',
      set_code: '1', set_name: 'The First Chapter', card_number: '002',
      strength: 5, willpower: 4, lore: 2
    }
  ];
}

/**
 * CORREÇÃO CRÍTICA: Buscar por sets
 * API não aceita ?q= vazio (retorna 400)
 */
export async function fetchAllCards() {
  if (USE_MOCK_DATA) {
    console.log('🔧 Using MOCK data');
    return getMockCards();
  }

  const now = Date.now();
  
  if (cache.cards && cache.timestamp && (now - cache.timestamp) < cache.TTL) {
    console.log('📦 Using cached cards');
    return cache.cards;
  }

  try {
    console.log('🌐 Fetching cards from Lorcast API...');
    
    // Buscar por cada set (API rejeita query vazia)
    const SET_CODES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'P1', 'P2'];
    const allCards = [];
    const seenIds = new Set();
    
    for (const setCode of SET_CODES) {
      try {
        const response = await fetch(`${LORCAST_API}/cards/search?q=set:${setCode}`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.results && Array.isArray(data.results)) {
            data.results.forEach(card => {
              if (!seenIds.has(card.id)) {
                seenIds.add(card.id);
                allCards.push(card);
              }
            });
            
            console.log(`  ✅ Set ${setCode}: ${data.results.length} cards`);
          }
        }
      } catch (error) {
        console.warn(`  ⚠️ Set ${setCode}:`, error.message);
      }
    }
    
    if (allCards.length === 0) {
      throw new Error('No cards found');
    }
    
    const normalizedCards = allCards.map(normalizeCard);
    
    console.log(`✅ Loaded ${normalizedCards.length} total cards from API`);
    
    cache.cards = normalizedCards;
    cache.timestamp = now;
    
    return normalizedCards;
  } catch (error) {
    console.error('❌ Error fetching cards:', error);
    
    if (cache.cards) {
      console.warn('⚠️ Using cached data');
      return cache.cards;
    }
    
    console.warn('⚠️ Using MOCK data as fallback');
    return getMockCards();
  }
}

export async function fetchCardBySetAndNumber(setCode, number) {
  if (USE_MOCK_DATA) {
    return getMockCards().find(c => c.set_code === setCode && c.card_number === number) || null;
  }

  try {
    const response = await fetch(`${LORCAST_API}/cards/${setCode}/${number}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return normalizeCard(await response.json());
  } catch (error) {
    console.error(`Error fetching card ${setCode}/${number}:`, error);
    throw error;
  }
}

export async function searchCards(query, unique = 'cards') {
  if (USE_MOCK_DATA) {
    const q = query.toLowerCase();
    return getMockCards().filter(c => 
      c.name?.toLowerCase().includes(q) ||
      c.body_text?.toLowerCase().includes(q)
    );
  }

  try {
    const url = `${LORCAST_API}/cards/search?q=${encodeURIComponent(query)}&unique=${unique}`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    return data.results ? data.results.map(normalizeCard) : [];
  } catch (error) {
    console.error(`Error searching "${query}":`, error);
    throw error;
  }
}

export async function fetchSets() {
  if (USE_MOCK_DATA) {
    return getFallbackSets();
  }

  if (cache.sets?.length > 0) {
    return cache.sets;
  }

  try {
    const SET_IDS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'P1', 'P2'];
    const sets = [];
    
    for (const id of SET_IDS) {
      try {
        const response = await fetch(`${LORCAST_API}/sets/${id}`);
        if (response.ok) {
          const data = await response.json();
          sets.push({ id: data.id, code: data.code, name: data.name });
        }
      } catch (e) {}
    }
    
    if (sets.length > 0) {
      console.log(`✅ Loaded ${sets.length} sets`);
      cache.sets = sets;
      return sets;
    }
    
    return getFallbackSets();
  } catch (error) {
    return getFallbackSets();
  }
}

export function extractSetsFromCards(cards) {
  if (!Array.isArray(cards)) return [];
  
  const setsMap = new Map();
  cards.forEach(card => {
    if (card.set_code && !setsMap.has(card.set_code)) {
      setsMap.set(card.set_code, {
        code: card.set_code,
        name: card.set_name,
        id: card.set_id
      });
    }
  });
  
  return Array.from(setsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function filterAndSortCards(cards, filters, sortBy = 'name') {
  if (!Array.isArray(cards)) return [];
  
  let filtered = [...cards];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(c => 
      c.name?.toLowerCase().includes(q) ||
      c.body_text?.toLowerCase().includes(q) ||
      c.flavor_text?.toLowerCase().includes(q)
    );
  }

  if (filters.ink && filters.ink !== 'all') {
    filtered = filtered.filter(c => 
      c.ink_type?.toLowerCase() === filters.ink.toLowerCase()
    );
  }

  if (filters.cost !== null && filters.cost !== undefined && filters.cost !== '') {
    const cost = parseInt(filters.cost);
    filtered = filtered.filter(c => c.ink_cost === cost);
  }

  if (filters.rarity && filters.rarity !== 'all') {
    filtered = filtered.filter(c => 
      c.rarity?.toLowerCase() === filters.rarity.toLowerCase()
    );
  }

  if (filters.set && filters.set !== 'all') {
    filtered = filtered.filter(c => 
      c.set_id === filters.set || c.set_code === filters.set
    );
  }

  if (filters.type && filters.type !== 'all') {
    filtered = filtered.filter(c => 
      c.type?.toLowerCase() === filters.type.toLowerCase()
    );
  }

  const rarityOrder = { 'common': 1, 'uncommon': 2, 'rare': 3, 'superrare': 4, 'legendary': 5, 'enchanted': 6 };
  
  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'name': return (a.name || '').localeCompare(b.name || '');
      case 'cost': return (a.ink_cost || 0) - (b.ink_cost || 0);
      case 'rarity': return (rarityOrder[a.rarity?.toLowerCase()] || 0) - (rarityOrder[b.rarity?.toLowerCase()] || 0);
      case 'set': return (a.set_code || '').localeCompare(b.set_code || '');
      case 'number': return parseInt(a.card_number || 0) - parseInt(b.card_number || 0);
      default: return 0;
    }
  });

  return filtered;
}

export function paginateCards(cards, page = 1, pageSize = 20) {
  if (!Array.isArray(cards)) {
    return { cards: [], totalCards: 0, totalPages: 0, currentPage: page, pageSize, hasNextPage: false, hasPrevPage: false };
  }
  
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  
  return {
    cards: cards.slice(start, end),
    totalCards: cards.length,
    totalPages: Math.ceil(cards.length / pageSize),
    currentPage: page,
    pageSize,
    hasNextPage: end < cards.length,
    hasPrevPage: page > 1
  };
}

export function getCardImageUrl(card, size = 'normal') {
  if (card.image_uris?.digital) {
    return card.image_uris.digital[size] || card.image_uris.digital.normal;
  }
  return null;
}

export function getAvailableInks(cards) {
  if (!Array.isArray(cards)) return [];
  const inks = new Set();
  cards.forEach(c => { if (c.ink_type) inks.add(c.ink_type); });
  return Array.from(inks).sort();
}

export function getAvailableRarities(cards) {
  if (!Array.isArray(cards)) return [];
  const rarities = new Set();
  cards.forEach(c => { if (c.rarity) rarities.add(c.rarity); });
  return Array.from(rarities).sort();
}

export function getAvailableTypes(cards) {
  if (!Array.isArray(cards)) return [];
  const types = new Set();
  cards.forEach(c => { if (c.type) types.add(c.type); });
  return Array.from(types).sort();
}

export function getCardStats(cards) {
  if (!Array.isArray(cards)) {
    return { total: 0, byInk: {}, byRarity: {}, byType: {}, avgCost: 0 };
  }
  
  return {
    total: cards.length,
    byInk: cards.reduce((acc, c) => {
      const ink = c.ink_type || 'None';
      acc[ink] = (acc[ink] || 0) + 1;
      return acc;
    }, {}),
    byRarity: cards.reduce((acc, c) => {
      const rarity = c.rarity || 'Unknown';
      acc[rarity] = (acc[rarity] || 0) + 1;
      return acc;
    }, {}),
    byType: cards.reduce((acc, c) => {
      const type = c.type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {}),
    avgCost: cards.length > 0 
      ? cards.reduce((sum, c) => sum + (c.ink_cost || 0), 0) / cards.length 
      : 0
  };
}

export default {
  fetchAllCards,
  fetchCardBySetAndNumber,
  searchCards,
  fetchSets,
  extractSetsFromCards,
  getFallbackSets,
  filterAndSortCards,
  paginateCards,
  getCardImageUrl,
  getAvailableInks,
  getAvailableRarities,
  getAvailableTypes,
  getCardStats
};

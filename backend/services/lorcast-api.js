/**
 * backend/services/lorcast-api.js
 * VERSÃO CORRIGIDA - Busca otimizada
 */

// Suporte Node < 18
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  try {
    fetch = require('node-fetch');
  } catch (err) {
    console.error('❌ Install node-fetch: npm install node-fetch');
  }
}

const LORCAST_API = 'https://api.lorcast.com/v0';
const DELAY = 100;

class LorcastAPI {
  constructor() {
    this.lastRequest = 0;
  }

  async rateLimit() {
    const now = Date.now();
    const diff = now - this.lastRequest;
    
    if (diff < DELAY) {
      await new Promise(r => setTimeout(r, DELAY - diff));
    }
    
    this.lastRequest = Date.now();
  }

  /**
   * Extrai o primeiro nome da carta
   * "Elsa - Spirit of Winter" → "Elsa"
   * "Mickey Mouse - Brave Little Tailor" → "Mickey Mouse"
   */
  extractFirstName(fullName) {
  if (fullName.includes(' - ')) {
    return fullName.split(' - ')[0].trim();
  }
  return fullName.trim();
}

async searchCard(query) {
  await this.rateLimit();
  
  // ✅ CORREÇÃO: Extrair primeiro nome
  const searchTerm = this.extractFirstName(query);
  
  const url = `${LORCAST_API}/cards/search?q=${encodeURIComponent(searchTerm)}`;
  
  try {
    console.log(`🔍 Original: "${query}" → Search: "${searchTerm}"`);
    console.log(`🔍 URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Lorcast API error: ${response.status}`);
    }
    
    const data = await response.json();
    const results = data.results || [];
    
    console.log(`✅ Found ${results.length} cards for "${searchTerm}"`);
    
    // Se query tinha versão, filtrar resultados
    if (query.includes(' - ') && results.length > 0) {
      const version = query.split(' - ')[1]?.trim();
      if (version) {
        console.log(`🔍 Filtering by version: "${version}"`);
        const filtered = results.filter(card => 
          card.version?.toLowerCase().includes(version.toLowerCase())
        );
        
        if (filtered.length > 0) {
          console.log(`✅ Filtered to ${filtered.length} cards`);
          return filtered;
        }
      }
    }
    
    return results;
    
  } catch (error) {
    console.error(`❌ Error searching "${query}":`, error.message);
    throw error;
  }
}

  async getSets() {
    await this.rateLimit();
    
    try {
      const response = await fetch(`${LORCAST_API}/sets`);
      
      if (!response.ok) {
        throw new Error(`Error fetching sets: ${response.status}`);
      }
      
      const data = await response.json();
      return data.results || [];
      
    } catch (error) {
      console.error('❌ Error fetching sets:', error.message);
      throw error;
    }
  }

  async getSetCards(setCode) {
    await this.rateLimit();
    
    try {
      const response = await fetch(`${LORCAST_API}/sets/${setCode}/cards`);
      
      if (!response.ok) {
        throw new Error(`Error fetching set ${setCode} cards: ${response.status}`);
      }
      
      return response.json();
      
    } catch (error) {
      console.error(`❌ Error fetching set ${setCode} cards:`, error.message);
      throw error;
    }
  }
}

module.exports = new LorcastAPI();

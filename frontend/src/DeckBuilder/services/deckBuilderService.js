// deckBuilderService.js - Lógica principal do Deck Builder

export class DeckBuilderService {
  constructor() {
    this.deck = [];
  }

  /**
   * Add card to deck
   */
  addCard(card, quantity = 1) {
    const existing = this.deck.find(e => e.card.id === card.id);
    
    if (existing) {
      existing.quantity = Math.min(4, existing.quantity + quantity);
    } else {
      this.deck.push({ 
        card, 
        quantity: Math.min(4, quantity)
      });
    }
    
    return this.validate();
  }

  /**
   * Remove card from deck
   */
  removeCard(cardId) {
    this.deck = this.deck.filter(e => e.card.id !== cardId);
    return this.validate();
  }

  /**
   * Update card quantity
   */
  updateQuantity(cardId, quantity) {
    const entry = this.deck.find(e => e.card.id === cardId);
    
    if (entry) {
      entry.quantity = Math.max(1, Math.min(4, quantity));
    }
    
    return this.validate();
  }

  /**
   * Clear entire deck
   */
  clearDeck() {
    this.deck = [];
    return this.validate();
  }

  /**
   * Get total cards in deck
   */
  getTotalCards() {
    return this.deck.reduce((sum, e) => sum + e.quantity, 0);
  }

  /**
   * Validate deck
   * Returns: { valid: boolean, errors: string[], warnings: string[] }
   */
  validate() {
    const errors = [];
    const warnings = [];
    
    const total = this.getTotalCards();
    
    // Validation: Exactly 60 cards
    if (total < 60) {
      errors.push(`Need ${60 - total} more card${60 - total !== 1 ? 's' : ''}`);
    } else if (total > 60) {
      errors.push(`Remove ${total - 60} card${total - 60 !== 1 ? 's' : ''}`);
    }
    
    // Validation: Max 4 copies per card
    this.deck.forEach(entry => {
      if (entry.quantity > 4) {
        errors.push(`${entry.card.name} has ${entry.quantity} copies (max 4)`);
      }
    });
    
    // Warning: Curve too high
    const curve = this.calculateCurve();
    if (curve.avgCost > 4.5) {
      warnings.push('Deck is very top-heavy (high average cost)');
    } else if (curve.avgCost < 2) {
      warnings.push('Deck is very low to the ground (low average cost)');
    }
    
    // Warning: Low creature count
    const creatures = this.deck.filter(e => e.card.type === 'Character')
      .reduce((sum, e) => sum + e.quantity, 0);
    
    if (creatures < 20) {
      warnings.push('Low creature count (less than 20)');
    }
    
    // Warning: Inkwell percentage
    const inkwellCards = this.deck.filter(e => e.card.inkwell)
      .reduce((sum, e) => sum + e.quantity, 0);
    const inkwellPercentage = (inkwellCards / total) * 100;
    
    if (inkwellPercentage < 30) {
      warnings.push('Low inkwell percentage (less than 30%)');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calculate mana curve
   */
  calculateCurve() {
    const distribution = Array(11).fill(0);
    let totalCost = 0;
    const totalCards = this.getTotalCards();
    
    this.deck.forEach(entry => {
      const cost = Math.min(10, entry.card.ink_cost || 0);
      distribution[cost] += entry.quantity;
      totalCost += (entry.card.ink_cost || 0) * entry.quantity;
    });
    
    return {
      distribution,
      avgCost: totalCards > 0 ? totalCost / totalCards : 0
    };
  }

  /**
   * Calculate ink distribution
   */
  calculateInkDistribution() {
    const inks = {};
    
    this.deck.forEach(entry => {
      const ink = entry.card.ink_type || 'None';
      inks[ink] = (inks[ink] || 0) + entry.quantity;
    });
    
    return inks;
  }

  /**
   * Export deck in specified format
   */
  export(format = 'text') {
    switch (format) {
      case 'text':
        return this.exportText();
      case 'pixelborn':
        return this.exportPixelborn();
      case 'dreamborn':
        return this.exportDreamborn();
      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }

  /**
   * Export as plain text
   */
  exportText() {
    return this.deck
      .sort((a, b) => (a.card.ink_cost || 0) - (b.card.ink_cost || 0))
      .map(e => `${e.quantity} ${e.card.name}${e.card.subtitle ? ' - ' + e.card.subtitle : ''}`)
      .join('\n');
  }

  /**
   * Export for Pixelborn
   */
  exportPixelborn() {
    return JSON.stringify({
      name: 'My Deck',
      cards: this.deck.map(e => ({
        id: `${e.card.set_code}-${e.card.card_number}`,
        qty: e.quantity
      }))
    }, null, 2);
  }

  /**
   * Export for Dreamborn
   */
  exportDreamborn() {
    return this.deck
      .map(e => `set=${e.card.set_code} number=${e.card.card_number} quantity=${e.quantity}`)
      .join('\n');
  }

  /**
   * Import deck from text
   */
  importFromText(text, allCards) {
    this.deck = [];
    
    const lines = text.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      const match = line.match(/^(\d+)\s+(.+?)(?:\s+-\s+(.+))?$/);
      if (match) {
        const [, qtyStr, name, subtitle] = match;
        const quantity = parseInt(qtyStr);
        
        const card = allCards.find(c => {
          const nameMatch = c.name.toLowerCase() === name.toLowerCase();
          if (subtitle) {
            return nameMatch && c.subtitle?.toLowerCase() === subtitle.toLowerCase();
          }
          return nameMatch;
        });
        
        if (card) {
          this.addCard(card, quantity);
        }
      }
    });
    
    return this.validate();
  }

  /**
   * Get deck as JSON for saving
   */
  toJSON() {
    return {
      cards: this.deck.map(e => ({
        card_id: e.card.id,
        quantity: e.quantity
      }))
    };
  }

  /**
   * Load deck from JSON
   */
  fromJSON(data, allCards) {
    this.deck = [];
    
    if (data.cards && Array.isArray(data.cards)) {
      data.cards.forEach(entry => {
        const card = allCards.find(c => c.id === entry.card_id);
        if (card) {
          this.addCard(card, entry.quantity);
        }
      });
    }
    
    return this.validate();
  }
}

export default DeckBuilderService;

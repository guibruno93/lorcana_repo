// archetypeDetector.js - Auto-detecção de archetype

/**
 * Detect deck archetype using heuristics
 * 
 * Returns: "Ink1/Ink2 Archetype" (e.g., "Ruby/Amethyst Aggro")
 */
export function detectArchetype(deck) {
  if (!deck || deck.length === 0) {
    return '';
  }

  const totalCards = deck.reduce((sum, e) => sum + e.quantity, 0);
  
  // Calculate average cost
  const totalCost = deck.reduce((sum, e) => sum + (e.card.ink_cost || 0) * e.quantity, 0);
  const avgCost = totalCost / totalCards;
  
  // Calculate creature/action/item counts
  const creatures = deck.filter(e => e.card.type === 'Character').reduce((sum, e) => sum + e.quantity, 0);
  const actions = deck.filter(e => e.card.type === 'Action').reduce((sum, e) => sum + e.quantity, 0);
  const items = deck.filter(e => e.card.type === 'Item').reduce((sum, e) => sum + e.quantity, 0);
  
  // Calculate ink distribution
  const inks = {};
  deck.forEach(e => {
    const ink = e.card.ink_type;
    if (ink) {
      inks[ink] = (inks[ink] || 0) + e.quantity;
    }
  });
  
  // Get top 2 inks
  const topInks = Object.entries(inks)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([ink]) => ink);
  
  // Detect archetype style
  let archetype = detectArchetypeStyle(avgCost, creatures, actions, items, totalCards);
  
  // Build full name
  const inkPart = topInks.length > 0 ? topInks.join('/') : 'Mixed';
  
  return `${inkPart} ${archetype}`;
}

/**
 * Detect archetype style (Aggro, Control, Midrange, etc.)
 */
function detectArchetypeStyle(avgCost, creatures, actions, items, totalCards) {
  const creaturePercentage = (creatures / totalCards) * 100;
  const actionPercentage = (actions / totalCards) * 100;
  
  // Aggro: Low cost, high creature count
  if (avgCost < 3 && creaturePercentage > 60) {
    return 'Aggro';
  }
  
  // Control: High cost, many actions
  if (avgCost > 4.5 && actionPercentage > 40) {
    return 'Control';
  }
  
  // Midrange: Balanced cost and types
  if (avgCost >= 3 && avgCost <= 4.5 && creaturePercentage >= 40 && creaturePercentage <= 70) {
    return 'Midrange';
  }
  
  // Ramp: High average cost, moderate creatures
  if (avgCost > 4 && creaturePercentage < 50) {
    return 'Ramp';
  }
  
  // Tempo: Low-medium cost, balanced types
  if (avgCost >= 2.5 && avgCost < 3.5 && actionPercentage > 25) {
    return 'Tempo';
  }
  
  // Default
  return 'Mixed';
}

/**
 * Suggest cards based on archetype
 * 
 * Returns array of suggested cards with reasons
 */
export function suggestCards(deck, archetype, allCards) {
  const suggestions = [];
  
  if (!archetype) {
    return suggestions;
  }
  
  const style = archetype.split(' ').pop(); // e.g., "Aggro"
  const inks = archetype.split(' ')[0].split('/'); // e.g., ["Ruby", "Amethyst"]
  
  const deckCardIds = new Set(deck.map(e => e.card.id));
  
  // Filter cards by inks
  const relevantCards = allCards.filter(card => 
    inks.includes(card.ink_type)
  );
  
  // Suggest based on archetype
  switch (style) {
    case 'Aggro':
      suggestAggroCards(relevantCards, deckCardIds, suggestions);
      break;
    case 'Control':
      suggestControlCards(relevantCards, deckCardIds, suggestions);
      break;
    case 'Midrange':
      suggestMidrangeCards(relevantCards, deckCardIds, suggestions);
      break;
    case 'Ramp':
      suggestRampCards(relevantCards, deckCardIds, suggestions);
      break;
    default:
      suggestGenericCards(relevantCards, deckCardIds, suggestions);
  }
  
  return suggestions.slice(0, 10); // Top 10 suggestions
}

function suggestAggroCards(cards, deckCardIds, suggestions) {
  // Low-cost creatures with high stats
  cards
    .filter(c => 
      !deckCardIds.has(c.id) &&
      c.type === 'Character' &&
      c.ink_cost <= 3 &&
      (c.strength || 0) + (c.willpower || 0) >= 4
    )
    .forEach(card => {
      suggestions.push({
        card,
        reason: 'Strong early game creature'
      });
    });
  
  // Direct damage actions
  cards
    .filter(c => 
      !deckCardIds.has(c.id) &&
      c.type === 'Action' &&
      c.ink_cost <= 3 &&
      c.body_text?.toLowerCase().includes('damage')
    )
    .forEach(card => {
      suggestions.push({
        card,
        reason: 'Aggressive removal'
      });
    });
}

function suggestControlCards(cards, deckCardIds, suggestions) {
  // Board wipes
  cards
    .filter(c => 
      !deckCardIds.has(c.id) &&
      c.type === 'Action' &&
      (c.body_text?.toLowerCase().includes('all') || 
       c.body_text?.toLowerCase().includes('each'))
    )
    .forEach(card => {
      suggestions.push({
        card,
        reason: 'Board control'
      });
    });
  
  // Card draw
  cards
    .filter(c => 
      !deckCardIds.has(c.id) &&
      (c.body_text?.toLowerCase().includes('draw') ||
       c.body_text?.toLowerCase().includes('look at'))
    )
    .forEach(card => {
      suggestions.push({
        card,
        reason: 'Card advantage'
      });
    });
}

function suggestMidrangeCards(cards, deckCardIds, suggestions) {
  // Efficient creatures (good stats for cost)
  cards
    .filter(c => 
      !deckCardIds.has(c.id) &&
      c.type === 'Character' &&
      c.ink_cost >= 3 && c.ink_cost <= 5 &&
      (c.strength || 0) + (c.willpower || 0) >= c.ink_cost * 2
    )
    .forEach(card => {
      suggestions.push({
        card,
        reason: 'Efficient creature'
      });
    });
}

function suggestRampCards(cards, deckCardIds, suggestions) {
  // Inkwell-able cards
  cards
    .filter(c => 
      !deckCardIds.has(c.id) &&
      c.inkwell
    )
    .forEach(card => {
      suggestions.push({
        card,
        reason: 'Ramp enabler'
      });
    });
  
  // High-cost bombs
  cards
    .filter(c => 
      !deckCardIds.has(c.id) &&
      c.type === 'Character' &&
      c.ink_cost >= 6 &&
      (c.strength || 0) + (c.willpower || 0) >= 10
    )
    .forEach(card => {
      suggestions.push({
        card,
        reason: 'Late game threat'
      });
    });
}

function suggestGenericCards(cards, deckCardIds, suggestions) {
  // Just suggest popular/powerful cards
  cards
    .filter(c => 
      !deckCardIds.has(c.id) &&
      (c.rarity === 'legendary' || c.rarity === 'superrare')
    )
    .forEach(card => {
      suggestions.push({
        card,
        reason: 'High rarity card'
      });
    });
}

/**
 * Analyze deck strengths and weaknesses
 */
export function analyzeDeck(deck) {
  const analysis = {
    strengths: [],
    weaknesses: [],
    recommendations: []
  };
  
  if (!deck || deck.length === 0) {
    return analysis;
  }
  
  const totalCards = deck.reduce((sum, e) => sum + e.quantity, 0);
  const totalCost = deck.reduce((sum, e) => sum + (e.card.ink_cost || 0) * e.quantity, 0);
  const avgCost = totalCost / totalCards;
  
  // Analyze curve
  if (avgCost < 3) {
    analysis.strengths.push('Fast deck - can apply early pressure');
  } else if (avgCost > 4.5) {
    analysis.strengths.push('Powerful late game');
  }
  
  // Analyze inkwell percentage
  const inkwellCards = deck.filter(e => e.card.inkwell).reduce((sum, e) => sum + e.quantity, 0);
  const inkwellPercentage = (inkwellCards / totalCards) * 100;
  
  if (inkwellPercentage > 50) {
    analysis.strengths.push('High inkwell percentage - consistent ramp');
  } else if (inkwellPercentage < 30) {
    analysis.weaknesses.push('Low inkwell percentage - may struggle with ink');
    analysis.recommendations.push('Add more inkwell-able cards');
  }
  
  // Analyze creature count
  const creatures = deck.filter(e => e.card.type === 'Character').reduce((sum, e) => sum + e.quantity, 0);
  const creaturePercentage = (creatures / totalCards) * 100;
  
  if (creaturePercentage > 60) {
    analysis.strengths.push('High creature density');
  } else if (creaturePercentage < 30) {
    analysis.weaknesses.push('Low creature count');
    analysis.recommendations.push('Add more creatures for board presence');
  }
  
  return analysis;
}

export default {
  detectArchetype,
  suggestCards,
  analyzeDeck
};

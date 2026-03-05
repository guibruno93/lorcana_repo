/**
 * backend/services/record-parser.js
 * Parse record strings like "5-2", "4-1-1", etc.
 */

/**
 * Parse record string into wins/losses/draws
 * 
 * Examples:
 *   "5-2"     → { wins: 5, losses: 2, draws: 0, record: "5-2" }
 *   "4-1-1"   → { wins: 4, losses: 1, draws: 1, record: "4-1-1" }
 *   "3-0"     → { wins: 3, losses: 0, draws: 0, record: "3-0" }
 *   "X-Drop"  → { wins: 0, losses: 0, draws: 0, record: null }
 *   null      → { wins: 0, losses: 0, draws: 0, record: null }
 */
function parseRecord(recordString) {
  if (!recordString || typeof recordString !== 'string') {
    return { wins: 0, losses: 0, draws: 0, record: null };
  }

  // Pattern 1: "5-2" (wins-losses)
  // Pattern 2: "4-1-1" (wins-losses-draws)
  const match = recordString.match(/(\d+)-(\d+)(?:-(\d+))?/);

  if (!match) {
    // Casos especiais
    if (recordString.toLowerCase().includes('drop')) {
      return { wins: 0, losses: 0, draws: 0, record: null };
    }
    
    return { wins: 0, losses: 0, draws: 0, record: null };
  }

  const wins = parseInt(match[1], 10);
  const losses = parseInt(match[2], 10);
  const draws = match[3] ? parseInt(match[3], 10) : 0;

  return {
    wins,
    losses,
    draws,
    record: recordString.trim()
  };
}

/**
 * Calculate win rate percentage
 * 
 * @param {number} wins 
 * @param {number} losses 
 * @returns {number|null} Win rate (0-100) or null if no matches
 */
function calculateWinRate(wins, losses) {
  const totalMatches = wins + losses;
  
  if (totalMatches === 0) return null;
  
  return parseFloat(((wins / totalMatches) * 100).toFixed(2));
}

/**
 * Extract record from deck text or metadata
 * 
 * Tries to find record in:
 * 1. deck.record field
 * 2. deck.name (e.g., "My Deck (5-2)")
 * 3. deck.description
 * 4. deck.notes
 */
function extractRecordFromDeck(deck) {
  // 1. Check explicit record field
  if (deck.record) {
    return parseRecord(deck.record);
  }

  // 2. Check deck name for pattern like "Deck Name (5-2)"
  if (deck.name) {
    const nameMatch = deck.name.match(/\((\d+-\d+(?:-\d+)?)\)/);
    if (nameMatch) {
      return parseRecord(nameMatch[1]);
    }
  }

  // 3. Check description
  if (deck.description) {
    const descMatch = deck.description.match(/\b(\d+-\d+(?:-\d+)?)\b/);
    if (descMatch) {
      return parseRecord(descMatch[1]);
    }
  }

  // 4. Check notes
  if (deck.notes) {
    const notesMatch = deck.notes.match(/\b(\d+-\d+(?:-\d+)?)\b/);
    if (notesMatch) {
      return parseRecord(notesMatch[1]);
    }
  }

  // Not found
  return { wins: 0, losses: 0, draws: 0, record: null };
}

/**
 * Parse placement to estimated record
 * 
 * If no explicit record, estimate based on placement:
 * - 1st place (32 players) → ~5-0 or 5-1
 * - 2nd place → ~4-1 or 4-2
 * etc.
 * 
 * This is a rough estimate and should only be used as fallback
 */
function estimateRecordFromPlacement(placement, totalPlayers = 32) {
  if (!placement || placement <= 0) {
    return { wins: 0, losses: 0, draws: 0, record: null };
  }

  // Swiss rounds estimation
  const rounds = Math.ceil(Math.log2(totalPlayers));
  
  if (placement === 1) {
    return { wins: rounds, losses: 0, draws: 0, record: `${rounds}-0` };
  }
  
  if (placement <= 4) {
    return { wins: rounds - 1, losses: 1, draws: 0, record: `${rounds - 1}-1` };
  }
  
  if (placement <= 8) {
    return { wins: rounds - 2, losses: 2, draws: 0, record: `${rounds - 2}-2` };
  }

  // For lower placements, don't estimate
  return { wins: 0, losses: 0, draws: 0, record: null };
}

module.exports = {
  parseRecord,
  calculateWinRate,
  extractRecordFromDeck,
  estimateRecordFromPlacement
};

'use strict';

/**
 * Card Effects Parser - Analisa abilities, keywords e efeitos das cartas
 * Extrai informações úteis para mulligan e synergy analysis
 * @module services/ai/cardEffectsParser
 */

const fs = require('fs');
const path = require('path');

/**
 * Categorias de efeitos
 */
const EFFECT_CATEGORIES = {
  RAMP: 'ramp',
  DRAW: 'draw',
  REMOVAL: 'removal',
  PROTECTION: 'protection',
  TUTOR: 'tutor',
  BOUNCE: 'bounce',
  CHALLENGE: 'challenge',
  QUEST: 'quest',
  EVASION: 'evasion',
  BUFF: 'buff',
  DEBUFF: 'debuff',
  RECURSION: 'recursion',
};

/**
 * Keywords importantes
 */
const KEYWORDS = {
  CHALLENGER: 'Challenger',
  EVASIVE: 'Evasive',
  BODYGUARD: 'Bodyguard',
  RUSH: 'Rush',
  RESIST: 'Resist',
  SUPPORT: 'Support',
  WARD: 'Ward',
  RECKLESS: 'Reckless',
  SINGER: 'Singer',
};

/**
 * Carrega e indexa todas as cartas com seus efeitos
 */
function loadCardEffects() {
  try {
    const possiblePaths = [
      path.join(__dirname, '../../db/cards.json'),
      path.join(__dirname, '../db/cards.json'),
      path.join(process.cwd(), 'backend/db/cards.json'),
      path.join(process.cwd(), 'db/cards.json'),
    ];

    let cardsData = null;

    for (const cardPath of possiblePaths) {
      if (fs.existsSync(cardPath)) {
        const rawData = fs.readFileSync(cardPath, 'utf8');
        cardsData = JSON.parse(rawData);
        break;
      }
    }

    if (!cardsData) {
      throw new Error('cards.json not found');
    }

    let cardsArray;
    
    if (Array.isArray(cardsData)) {
      cardsArray = cardsData;
    } else if (cardsData.cards && Array.isArray(cardsData.cards)) {
      cardsArray = cardsData.cards;
    } else if (typeof cardsData === 'object') {
      cardsArray = Object.values(cardsData);
    } else {
      throw new Error('cards.json has invalid format');
    }

    // Indexar por nome
    const index = new Map();
    
    for (const card of cardsArray) {
      if (!card || typeof card !== 'object') continue;
      
      const name = (card.name || card.Name || '').toLowerCase().trim();
      const fullName = (card.fullName || card.full_name || '').toLowerCase().trim();
      
      if (!name && !fullName) continue;
      
      const analyzed = analyzeCard(card);
      
      // Indexar por ambos os nomes
      if (name) index.set(name, analyzed);
      if (fullName && fullName !== name) index.set(fullName, analyzed);
    }

    return index;
    
  } catch (err) {
    console.error('Error loading card effects:', err.message);
    return new Map();
  }
}

/**
 * Analisa uma carta e extrai todos os efeitos
 */
function analyzeCard(card) {
  const abilities = card.abilities || card.ability || card.text || '';
  const flavor = card.flavor || card.flavorText || '';
  const keywords = extractKeywords(abilities, card);
  const effects = extractEffects(abilities);
  const synergies = detectSynergies(card, abilities, keywords, effects);
  
  return {
    // Dados básicos
    name: card.name || card.Name || '',
    fullName: card.fullName || card.full_name || '',
    cost: card.cost || card.inkCost || 0,
    inkable: card.inkable || card.isInkable || false,
    type: card.type || card.cardType || 'Character',
    lore: card.lore || 0,
    strength: card.strength || card.attack || null,
    willpower: card.willpower || card.defense || null,
    
    // Análise de efeitos
    abilities,
    keywords,
    effects,
    synergies,
    
    // Classificação
    role: classifyRole(card, effects, keywords),
    timing: classifyTiming(card, effects),
    value: evaluateValue(card, effects, keywords),
  };
}

/**
 * Extrai keywords da carta
 */
function extractKeywords(text, card) {
  const keywords = [];
  const textLower = text.toLowerCase();
  
  // Keywords conhecidos
  Object.entries(KEYWORDS).forEach(([key, keyword]) => {
    if (textLower.includes(keyword.toLowerCase())) {
      keywords.push(keyword);
    }
  });
  
  // Classificações especiais do cards.json
  if (card.classifications) {
    const classifications = Array.isArray(card.classifications) 
      ? card.classifications 
      : [card.classifications];
    keywords.push(...classifications);
  }
  
  return keywords;
}

/**
 * Extrai efeitos do texto da carta
 */
function extractEffects(text) {
  const effects = [];
  const textLower = text.toLowerCase();
  
  // Ramp / Ink generation
  if (textLower.includes('put') && textLower.includes('into your inkwell')) {
    effects.push({ type: EFFECT_CATEGORIES.RAMP, description: 'Adds to inkwell' });
  }
  if (textLower.includes('gain') && textLower.includes('ink')) {
    effects.push({ type: EFFECT_CATEGORIES.RAMP, description: 'Generates ink' });
  }
  
  // Draw
  if (textLower.includes('draw')) {
    const match = text.match(/draw (\d+)/i);
    const amount = match ? parseInt(match[1]) : 1;
    effects.push({ type: EFFECT_CATEGORIES.DRAW, description: `Draw ${amount} card(s)`, value: amount });
  }
  
  // Removal
  if (textLower.includes('banish') || textLower.includes('return') && textLower.includes('hand')) {
    effects.push({ type: EFFECT_CATEGORIES.REMOVAL, description: 'Removes threats' });
  }
  if (textLower.includes('deal') && textLower.includes('damage')) {
    const match = text.match(/deal (\d+) damage/i);
    const damage = match ? parseInt(match[1]) : 0;
    effects.push({ type: EFFECT_CATEGORIES.REMOVAL, description: `Deals ${damage} damage`, value: damage });
  }
  
  // Protection
  if (textLower.includes('prevent') || textLower.includes('can\'t be')) {
    effects.push({ type: EFFECT_CATEGORIES.PROTECTION, description: 'Protection effect' });
  }
  
  // Tutor (search deck)
  if (textLower.includes('search') || textLower.includes('look at the top')) {
    effects.push({ type: EFFECT_CATEGORIES.TUTOR, description: 'Searches/filters deck' });
  }
  
  // Bounce
  if (textLower.includes('return') && textLower.includes('to') && textLower.includes('hand')) {
    effects.push({ type: EFFECT_CATEGORIES.BOUNCE, description: 'Bounces to hand' });
  }
  
  // Challenge bonus
  if (textLower.includes('challenge') && (textLower.includes('get') || textLower.includes('gain'))) {
    effects.push({ type: EFFECT_CATEGORIES.CHALLENGE, description: 'Challenge bonus' });
  }
  
  // Quest bonus
  if (textLower.includes('quest') && textLower.includes('exert')) {
    effects.push({ type: EFFECT_CATEGORIES.QUEST, description: 'Quest synergy' });
  }
  
  // Evasion
  if (textLower.includes('evasive') || textLower.includes('can\'t be challenged')) {
    effects.push({ type: EFFECT_CATEGORIES.EVASION, description: 'Hard to remove' });
  }
  
  // Buff
  if (textLower.includes('get +') || textLower.includes('gain +')) {
    effects.push({ type: EFFECT_CATEGORIES.BUFF, description: 'Buffs characters' });
  }
  
  // Debuff
  if (textLower.includes('get -') || textLower.includes('lose')) {
    effects.push({ type: EFFECT_CATEGORIES.DEBUFF, description: 'Weakens opponents' });
  }
  
  // Recursion
  if (textLower.includes('from your discard')) {
    effects.push({ type: EFFECT_CATEGORIES.RECURSION, description: 'Recursion from discard' });
  }
  
  return effects;
}

/**
 * Detecta sinergias da carta
 */
function detectSynergies(card, abilities, keywords, effects) {
  const synergies = [];
  const textLower = abilities.toLowerCase();
  
  // Item synergy
  if (card.type === 'Item') {
    synergies.push({ with: 'Characters', reason: 'Items support characters' });
  }
  
  // Song synergy
  if (card.type === 'Song') {
    if (keywords.includes('Singer') || textLower.includes('singer')) {
      synergies.push({ with: 'Singers', reason: 'Free to play with Singer' });
    }
  }
  
  // Ramp synergy
  if (effects.some(e => e.type === EFFECT_CATEGORIES.RAMP)) {
    synergies.push({ with: 'Expensive cards', reason: 'Enables early big plays' });
  }
  
  // Draw synergy
  if (effects.some(e => e.type === EFFECT_CATEGORIES.DRAW)) {
    synergies.push({ with: 'Any deck', reason: 'Card advantage engine' });
  }
  
  // Removal synergy
  if (effects.some(e => e.type === EFFECT_CATEGORIES.REMOVAL)) {
    synergies.push({ with: 'Control decks', reason: 'Answers threats' });
  }
  
  // Evasion synergy
  if (effects.some(e => e.type === EFFECT_CATEGORIES.EVASION) || keywords.includes('Evasive')) {
    synergies.push({ with: 'Aggro decks', reason: 'Unblockable damage' });
  }
  
  // Challenge synergy
  if (keywords.includes('Challenger') || effects.some(e => e.type === EFFECT_CATEGORIES.CHALLENGE)) {
    synergies.push({ with: 'Removal suite', reason: 'Fights efficiently' });
  }
  
  // Specific card synergies
  const name = card.name || '';
  
  if (name.includes('Hades')) {
    synergies.push({ with: 'Villains', reason: 'Hades tutors villains' });
  }
  
  if (name.includes('Tinker Bell')) {
    synergies.push({ with: 'Items', reason: 'Tinker Bell draws with items' });
  }
  
  return synergies;
}

/**
 * Classifica o papel da carta
 */
function classifyRole(card, effects, keywords) {
  const hasRamp = effects.some(e => e.type === EFFECT_CATEGORIES.RAMP);
  const hasDraw = effects.some(e => e.type === EFFECT_CATEGORIES.DRAW);
  const hasRemoval = effects.some(e => e.type === EFFECT_CATEGORIES.REMOVAL);
  const hasTutor = effects.some(e => e.type === EFFECT_CATEGORIES.TUTOR);
  const hasEvasion = effects.some(e => e.type === EFFECT_CATEGORIES.EVASION) || keywords.includes('Evasive');
  const hasChallenge = keywords.includes('Challenger');
  
  const cost = card.cost || 0;
  const lore = card.lore || 0;
  
  // Classify
  if (hasRamp) return 'Ramp';
  if (hasDraw) return 'Draw Engine';
  if (hasRemoval) return 'Removal';
  if (hasTutor) return 'Tutor';
  if (hasEvasion && lore >= 2) return 'Evasive Threat';
  if (hasChallenge) return 'Fighter';
  if (cost <= 2 && lore >= 1) return 'Early Lore';
  if (cost >= 6 && lore >= 3) return 'Finisher';
  if (lore >= 2) return 'Lore Generator';
  if (card.type === 'Action') return 'Action';
  if (card.type === 'Item') return 'Item';
  if (card.type === 'Song') return 'Song';
  
  return 'Utility';
}

/**
 * Classifica quando a carta é boa
 */
function classifyTiming(card, effects) {
  const cost = card.cost || 0;
  const hasRamp = effects.some(e => e.type === EFFECT_CATEGORIES.RAMP);
  const hasDraw = effects.some(e => e.type === EFFECT_CATEGORIES.DRAW);
  const lore = card.lore || 0;
  
  if (cost <= 2) return 'Early';
  if (cost === 3) return 'Early-Mid';
  if (cost <= 5) return 'Mid';
  if (hasRamp || hasDraw) return 'Early'; // Ramp/draw sempre bom cedo
  if (cost >= 6) return 'Late';
  
  return 'Mid';
}

/**
 * Avalia o valor geral da carta
 */
function evaluateValue(card, effects, keywords) {
  let value = 50; // Base
  
  const cost = card.cost || 0;
  const lore = card.lore || 0;
  
  // Lore efficiency
  if (lore > 0 && cost > 0) {
    const efficiency = lore / cost;
    if (efficiency >= 0.66) value += 15; // Very efficient
    else if (efficiency >= 0.5) value += 10;
    else if (efficiency < 0.33) value -= 10;
  }
  
  // Effects value
  if (effects.some(e => e.type === EFFECT_CATEGORIES.RAMP)) value += 15;
  if (effects.some(e => e.type === EFFECT_CATEGORIES.DRAW)) value += 15;
  if (effects.some(e => e.type === EFFECT_CATEGORIES.REMOVAL)) value += 10;
  if (effects.some(e => e.type === EFFECT_CATEGORIES.TUTOR)) value += 12;
  
  // Keywords value
  if (keywords.includes('Evasive')) value += 10;
  if (keywords.includes('Challenger')) value += 8;
  if (keywords.includes('Bodyguard')) value += 5;
  if (keywords.includes('Ward')) value += 7;
  
  // Inkable bonus
  if (card.inkable) value += 5;
  
  return Math.max(0, Math.min(100, value));
}

/**
 * Get card analysis by name
 */
function getCardAnalysis(cardName, cardEffectsIndex) {
  if (!cardEffectsIndex) {
    cardEffectsIndex = loadCardEffects();
  }
  
  const normalized = cardName.toLowerCase().trim();
  return cardEffectsIndex.get(normalized) || null;
}

module.exports = {
  loadCardEffects,
  analyzeCard,
  getCardAnalysis,
  EFFECT_CATEGORIES,
  KEYWORDS,
};

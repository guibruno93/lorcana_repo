'use strict';

/**
 * Meta Analyzer v4.3 - FIXED
 * Corrige: _total nos archetypes, detecção melhorada, card popularity
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../db/tournamentMeta.json');

// ── Data Loading ─────────────────────────────────────────────────────────────

function loadTournamentData() {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    
    const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const decks = Array.isArray(raw) ? raw : (raw.decks || []);
    
    console.log(`   Raw data type: ${Array.isArray(raw) ? 'array' : 'object'}`);
    console.log(`   Decks loaded: ${decks.length}`);
    
    return decks;
  } catch (e) {
    console.error(`   Error loading data: ${e.message}`);
    return [];
  }
}

// ── Time Windows ─────────────────────────────────────────────────────────────

function getTimeWindows(decks) {
  const now = Date.now();
  
  const week = [];
  const month = [];
  const all = [];
  
  let hasValidDates = false;

  for (const deck of decks) {
    const dateStr = deck.date || deck.fetchedAt || deck.lastScrapedAt;
    
    if (dateStr) {
      const timestamp = new Date(dateStr).getTime();
      
      if (!isNaN(timestamp)) {
        hasValidDates = true;
        const age = now - timestamp;
        const days = age / (24 * 60 * 60 * 1000);
        
        if (days <= 7) week.push(deck);
        if (days <= 30) month.push(deck);
      }
    }
    
    all.push(deck);
  }

  if (!hasValidDates || week.length === 0) {
    return {
      week: all,
      month: all,
      hasValidDates: false,
    };
  }

  return {
    week,
    month,
    hasValidDates: true,
  };
}

// ── Archetype Inference ──────────────────────────────────────────────────────

function inferArchetype(deck) {
  // 1. Usar archetype explícito se existir
  if (deck.archetype && deck.archetype !== 'Unknown') {
    return deck.archetype;
  }
  
  // 2. Usar title se disponível
  if (deck.title && deck.title.trim()) {
    return deck.title;
  }
  
  // 3. Tentar usar inks
  if (deck.inks && Array.isArray(deck.inks)) {
    const validInks = deck.inks.filter(ink => 
      ink && typeof ink === 'string' && ink.trim()
    );
    
    if (validInks.length >= 2) {
      return validInks.slice(0, 2).join('/');
    } else if (validInks.length === 1) {
      return validInks[0];
    }
  }
  
  // 4. Tentar detectar inks das cartas
  if (deck.cards && Array.isArray(deck.cards)) {
    const detectedInks = new Set();
    
    for (const card of deck.cards) {
      const name = (card.name || '').toLowerCase();
      
      // Detectar por cartas conhecidas
      if (name.includes('hades') || name.includes('amethyst')) {
        detectedInks.add('Amethyst');
      }
      if (name.includes('steel') || name.includes('tipo')) {
        detectedInks.add('Steel');
      }
      if (name.includes('sapphire') || name.includes('sail')) {
        detectedInks.add('Sapphire');
      }
      if (name.includes('ruby') || name.includes('goliath')) {
        detectedInks.add('Ruby');
      }
      if (name.includes('amber') || name.includes('be prepared')) {
        detectedInks.add('Amber');
      }
      if (name.includes('emerald') || name.includes('simba')) {
        detectedInks.add('Emerald');
      }
    }
    
    const inks = Array.from(detectedInks);
    if (inks.length >= 2) {
      return inks.slice(0, 2).join('/');
    } else if (inks.length === 1) {
      return inks[0];
    }
  }
  
  return 'Unknown';
}

// ── Archetype Analysis ───────────────────────────────────────────────────────

function analyzeArchetypes(decks, hasValidDates) {
  const windows = getTimeWindows(decks);
  
  console.log(`   Analyzing ${windows.week.length} decks for archetypes...`);
  
  const week = countArchetypes(windows.week);
  const month = countArchetypes(windows.month);

  const trends = {};
  
  const weekTotal = week._total || 1;
  const monthTotal = hasValidDates ? (month._total || 1) : weekTotal;

  // IMPORTANTE: Filtrar _total aqui
  for (const [archetype, weekData] of Object.entries(week)) {
    if (archetype === '_total') continue; // SKIP _total
    
    const monthData = month[archetype] || { count: 0, placements: [] };
    
    const weekPct = (weekData.count / weekTotal) * 100;
    const monthPct = (monthData.count / monthTotal) * 100;
    
    const change = hasValidDates ? (weekPct - monthPct) : 0;
    
    trends[archetype] = {
      archetype,
      weekCount: weekData.count,
      weekShare: Math.round(weekPct * 10) / 10,
      monthCount: monthData.count,
      monthShare: Math.round(monthPct * 10) / 10,
      change: Math.round(change * 10) / 10,
      trend: hasValidDates 
        ? (change > 5 ? 'rising' : change < -5 ? 'falling' : 'stable')
        : 'stable',
      avgPlacement: weekData.avgPlacement,
      topPlacements: weekData.topPlacements,
    };
  }

  const sorted = Object.values(trends).sort((a, b) => b.weekShare - a.weekShare);
  
  console.log(`   Found ${sorted.length} unique archetypes`);
  console.log(`   Top 3: ${sorted.slice(0, 3).map(a => `${a.archetype} (${a.weekShare}%)`).join(', ')}`);
  
  return sorted;
}

function countArchetypes(decks) {
  const counts = { _total: 0 };

  for (const deck of decks) {
    counts._total++;
    
    const arch = inferArchetype(deck);
    
    if (!counts[arch]) {
      counts[arch] = {
        count: 0,
        placements: [],
      };
    }
    
    counts[arch].count++;
    
    const placement = standingToNumber(deck.standing || deck.rankLabel);
    if (placement) {
      counts[arch].placements.push(placement);
    }
  }

  // Calcular avg placement
  for (const [arch, data] of Object.entries(counts)) {
    if (arch === '_total') continue;
    
    if (data.placements.length > 0) {
      const avg = data.placements.reduce((a, b) => a + b, 0) / data.placements.length;
      data.avgPlacement = Math.round(avg);
      data.topPlacements = data.placements.filter(p => p <= 8).length;
    } else {
      data.avgPlacement = null;
      data.topPlacements = 0;
    }
  }

  return counts;
}

function standingToNumber(standing) {
  if (!standing) return null;
  const m = String(standing).match(/(\d+)/);
  if (m) return parseInt(m[1]);
  if (/1ST|FIRST|WINNER/i.test(standing)) return 1;
  if (/2ND/i.test(standing)) return 2;
  if (/3RD/i.test(standing)) return 3;
  if (/TOP\s*8/i.test(standing)) return 8;
  return null;
}

// ── Card Popularity ──────────────────────────────────────────────────────────

function analyzeCardPopularity(decks, hasValidDates, topN = 20) {
  const windows = getTimeWindows(decks);
  
  console.log(`   Analyzing card popularity from ${windows.week.length} decks...`);
  
  const week = countCards(windows.week);
  const month = countCards(windows.month);

  const trends = [];

  const weekTotal = windows.week.length || 1;
  const monthTotal = hasValidDates ? (windows.month.length || 1) : weekTotal;

  for (const [card, weekData] of Object.entries(week)) {
    const monthData = month[card];
    
    const weekPct = (weekData.decks / weekTotal) * 100;
    const monthPct = monthData ? (monthData.decks / monthTotal) * 100 : 0;
    
    const change = hasValidDates ? (weekPct - monthPct) : 0;

    trends.push({
      card,
      weekDecks: weekData.decks,
      weekShare: Math.round(weekPct * 10) / 10,
      weekAvgQty: Math.round(weekData.avgQty * 10) / 10,
      monthDecks: monthData?.decks || 0,
      monthShare: Math.round(monthPct * 10) / 10,
      change: Math.round(change * 10) / 10,
      trend: hasValidDates
        ? (change > 10 ? 'rising' : change < -10 ? 'falling' : 'stable')
        : 'stable',
    });
  }

  trends.sort((a, b) => b.weekShare - a.weekShare);
  
  const topCards = trends.slice(0, topN);
  console.log(`   Top 5 cards: ${topCards.slice(0, 5).map(c => `${c.card} (${c.weekShare}%)`).join(', ')}`);
  
  return topCards;
}

function countCards(decks) {
  const counts = {};

  for (const deck of decks) {
    const cards = deck.cards || [];
    
    for (const card of cards) {
      const name = (card.name || '').trim();
      if (!name) continue;

      if (!counts[name]) {
        counts[name] = {
          decks: 0,
          totalQty: 0,
        };
      }

      counts[name].decks++;
      counts[name].totalQty += parseInt(card.quantity) || 1;
    }
  }

  for (const data of Object.values(counts)) {
    data.avgQty = data.totalQty / data.decks;
  }

  return counts;
}

// ── Meta Health ──────────────────────────────────────────────────────────────

function analyzeMetaHealth(archetypes) {
  if (!archetypes.length) {
    return { 
      diversity: 0, 
      concentration: 0, 
      viableArchetypes: 0,
      health: 'Unknown' 
    };
  }

  const topShare = archetypes[0]?.weekShare || 0;
  const viable = archetypes.filter(a => a.weekShare >= 5).length;

  let entropy = 0;
  for (const arch of archetypes) {
    if (arch.weekShare > 0) {
      const p = arch.weekShare / 100;
      entropy -= p * Math.log2(p);
    }
  }

  const maxEntropy = archetypes.length > 1 ? Math.log2(archetypes.length) : 1;
  const diversity = maxEntropy > 0 ? (entropy / maxEntropy) * 100 : 0;

  let health = 'Healthy';
  if (topShare > 40) health = 'Concentrated';
  else if (viable <= 3) health = 'Limited';
  else if (diversity < 50) health = 'Developing';

  return {
    diversity: Math.round(diversity),
    concentration: Math.round(topShare),
    viableArchetypes: viable,
    health,
  };
}

// ── Main Analysis ────────────────────────────────────────────────────────────

function analyzeMetaState() {
  console.log('\n📊 Meta Analyzer v4.3 (FIXED)\n');

  const decks = loadTournamentData();
  console.log(`📦 Loaded ${decks.length} tournament decks`);

  if (decks.length < 10) {
    return {
      available: false,
      note: 'Insufficient tournament data (need at least 10 decks)',
    };
  }

  const windows = getTimeWindows(decks);
  const hasValidDates = windows.hasValidDates;
  
  if (!hasValidDates) {
    console.log(`   ⚠️  No date information - analyzing all ${decks.length} decks as current meta`);
  } else {
    console.log(`   Last 7 days: ${windows.week.length} decks`);
    console.log(`   Last 30 days: ${windows.month.length} decks`);
  }

  console.log('\n🔍 Analyzing archetypes...');
  const archetypes = analyzeArchetypes(decks, hasValidDates);
  
  console.log('🔍 Analyzing card popularity...');
  const cards = analyzeCardPopularity(decks, hasValidDates, 30);
  
  console.log('🔍 Calculating meta health...');
  const health = analyzeMetaHealth(archetypes);

  console.log('\n✅ Analysis complete');
  console.log(`   Archetypes: ${archetypes.length}`);
  console.log(`   Cards: ${cards.length}`);
  console.log(`   Health: ${health.health} (${health.diversity}% diversity)\n`);

  const lastUpdate = decks[0]?.fetchedAt || decks[0]?.date || new Date().toISOString();

  return {
    available: true,
    dataSource: hasValidDates ? 'Tournament results (time-based)' : 'Tournament results (snapshot)',
    hasValidDates,
    lastUpdate,
    totalDecks: decks.length,
    
    archetypes: archetypes.slice(0, 10),
    cards: cards.slice(0, 20),
    health,
    
    windows: {
      week: windows.week.length,
      month: windows.month.length,
    },
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const result = analyzeMetaState();

  if (!result.available) {
    console.log(`⚠️  ${result.note}`);
    process.exit(0);
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  console.log('═'.repeat(60));
  console.log('  META STATE REPORT');
  console.log('═'.repeat(60));
  console.log(`  Data: ${result.totalDecks} decks`);
  if (!result.hasValidDates) {
    console.log('  Note: Snapshot analysis (no date information)');
  }
  console.log(`  Health: ${result.health.health} (${result.health.diversity}% diversity)`);
  console.log('');

  console.log('TOP ARCHETYPES:');
  console.log('─'.repeat(60));
  for (const arch of result.archetypes.slice(0, 5)) {
    const arrow = arch.trend === 'rising' ? '↑' : arch.trend === 'falling' ? '↓' : '→';
    console.log(`  ${arch.weekShare}% ${arch.archetype} ${arrow}`);
    if (arch.avgPlacement) {
      console.log(`     Avg placement: #${arch.avgPlacement}, Top 8: ${arch.topPlacements}`);
    }
  }

  console.log('');
  console.log('TOP CARDS:');
  console.log('─'.repeat(60));
  for (const card of result.cards.slice(0, 10)) {
    const arrow = card.trend === 'rising' ? '↑' : card.trend === 'falling' ? '↓' : '→';
    console.log(`  ${card.weekShare}% ${card.card} ${arrow}`);
  }

  console.log('');
}

module.exports = { analyzeMetaState };

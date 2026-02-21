'use strict';

/**
 * Meta Analyzer v4.0
 * Analisa tendências do meta baseado em dados de torneio
 * Features: Trend detection, archetype rise/fall, card popularity
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../db/tournamentMeta.json');

// ── Data Loading ─────────────────────────────────────────────────────────────

function loadTournamentData() {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    
    const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return Array.isArray(raw) ? raw : (raw.decks || []);
  } catch {
    return [];
  }
}

// ── Time Windows ─────────────────────────────────────────────────────────────

function getTimeWindows(decks, windows = [7, 14, 30]) {
  const now = Date.now();
  const buckets = {};

  for (const days of windows) {
    const cutoff = now - (days * 24 * 60 * 60 * 1000);
    buckets[days] = decks.filter(d => {
      if (!d.date && !d.fetchedAt) return false;
      const timestamp = new Date(d.date || d.fetchedAt).getTime();
      return timestamp >= cutoff;
    });
  }

  return buckets;
}

// ── Archetype Analysis ───────────────────────────────────────────────────────

/**
 * Detecta arquétipos predominantes em cada janela de tempo
 */
function analyzeArchetypes(decks) {
  const windows = getTimeWindows(decks, [7, 30]);
  
  const week = countArchetypes(windows[7]);
  const month = countArchetypes(windows[30]);

  // Calcular variação
  const trends = {};
  
  for (const [archetype, weekCount] of Object.entries(week)) {
    const monthCount = month[archetype] || 0;
    
    const weekPct = (weekCount.count / week._total) * 100;
    const monthPct = monthCount > 0 ? (monthCount.count / month._total) * 100 : 0;
    
    const change = weekPct - monthPct;
    
    trends[archetype] = {
      archetype,
      weekCount: weekCount.count,
      weekShare: Math.round(weekPct * 10) / 10,
      monthCount: monthCount.count || 0,
      monthShare: Math.round(monthPct * 10) / 10,
      change: Math.round(change * 10) / 10,
      trend: change > 5 ? 'rising' : change < -5 ? 'falling' : 'stable',
      avgPlacement: weekCount.avgPlacement,
      topPlacements: weekCount.topPlacements,
    };
  }

  // Ordenar por share atual
  const sorted = Object.values(trends).sort((a, b) => b.weekShare - a.weekShare);

  return sorted;
}

function countArchetypes(decks) {
  const counts = { _total: 0 };

  for (const deck of decks) {
    counts._total++;
    
    const arch = deck.archetype || inferArchetype(deck) || 'Unknown';
    
    if (!counts[arch]) {
      counts[arch] = {
        count: 0,
        placements: [],
      };
    }
    
    counts[arch].count++;
    
    const placement = standingToNumber(deck.standing);
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
  return m ? parseInt(m[1]) : null;
}

function inferArchetype(deck) {
  // Simplificado - usa inks ou nome do deck
  if (deck.inks && deck.inks.length >= 2) {
    return deck.inks.slice(0, 2).join('/');
  }
  return null;
}

// ── Card Popularity ──────────────────────────────────────────────────────────

/**
 * Analisa popularidade de cartas
 */
function analyzeCardPopularity(decks, topN = 20) {
  const windows = getTimeWindows(decks, [7, 30]);
  
  const week = countCards(windows[7]);
  const month = countCards(windows[30]);

  const trends = [];

  for (const [card, weekData] of Object.entries(week)) {
    const monthData = month[card];
    
    const weekPct = (weekData.decks / windows[7].length) * 100;
    const monthPct = monthData ? (monthData.decks / windows[30].length) * 100 : 0;
    
    const change = weekPct - monthPct;

    trends.push({
      card,
      weekDecks: weekData.decks,
      weekShare: Math.round(weekPct * 10) / 10,
      weekAvgQty: Math.round(weekData.avgQty * 10) / 10,
      monthDecks: monthData?.decks || 0,
      monthShare: Math.round(monthPct * 10) / 10,
      change: Math.round(change * 10) / 10,
      trend: change > 10 ? 'rising' : change < -10 ? 'falling' : 'stable',
    });
  }

  trends.sort((a, b) => b.weekShare - a.weekShare);

  return trends.slice(0, topN);
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

  // Calcular avg qty
  for (const data of Object.values(counts)) {
    data.avgQty = data.totalQty / data.decks;
  }

  return counts;
}

// ── Meta Health ──────────────────────────────────────────────────────────────

/**
 * Calcula "saúde" do meta (diversidade)
 */
function analyzeMetaHealth(archetypes) {
  if (!archetypes.length) {
    return { diversity: 0, concentration: 100, health: 'Unknown' };
  }

  // Concentração: % do top archetype
  const topShare = archetypes[0]?.weekShare || 0;
  
  // Diversidade: número de archetypes com >5% share
  const viable = archetypes.filter(a => a.weekShare >= 5).length;

  // Shannon diversity index (simplificado)
  let entropy = 0;
  for (const arch of archetypes) {
    if (arch.weekShare > 0) {
      const p = arch.weekShare / 100;
      entropy -= p * Math.log2(p);
    }
  }

  const maxEntropy = Math.log2(archetypes.length);
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

/**
 * Análise completa do meta
 */
function analyzeMetaState() {
  console.log('\n📊 Meta Analyzer v4.0\n');

  const decks = loadTournamentData();
  console.log(`📦 Loaded ${decks.length} tournament decks`);

  if (decks.length < 10) {
    return {
      available: false,
      note: 'Insufficient tournament data (need at least 10 decks)',
    };
  }

  // Time windows
  const windows = getTimeWindows(decks, [7, 30]);
  console.log(`   Last 7 days: ${windows[7].length} decks`);
  console.log(`   Last 30 days: ${windows[30].length} decks`);

  // Análises
  console.log('\n🔍 Analyzing archetypes...');
  const archetypes = analyzeArchetypes(decks);
  
  console.log('🔍 Analyzing card popularity...');
  const cards = analyzeCardPopularity(decks, 30);
  
  console.log('🔍 Calculating meta health...');
  const health = analyzeMetaHealth(archetypes);

  console.log('\n✅ Analysis complete\n');

  return {
    available: true,
    dataSource: 'Tournament results (multi-source)',
    lastUpdate: decks[0]?.fetchedAt || new Date().toISOString(),
    totalDecks: decks.length,
    
    archetypes: archetypes.slice(0, 10),
    cards: cards.slice(0, 20),
    health,
    
    windows: {
      week: windows[7].length,
      month: windows[30].length,
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

  console.log('═'.repeat(60));
  console.log('  META STATE REPORT');
  console.log('═'.repeat(60));
  console.log(`  Data: ${result.totalDecks} decks (last ${result.windows.month} days)`);
  console.log(`  Health: ${result.health.health} (${result.health.diversity}% diversity)`);
  console.log('');

  console.log('TOP ARCHETYPES (Last 7 days):');
  console.log('─'.repeat(60));
  for (const arch of result.archetypes.slice(0, 5)) {
    const arrow = arch.trend === 'rising' ? '↑' : arch.trend === 'falling' ? '↓' : '→';
    console.log(`  ${arch.weekShare}% ${arch.archetype} ${arrow} (${arch.change > 0 ? '+' : ''}${arch.change}%)`);
  }

  console.log('');
  console.log('TOP CARDS (Last 7 days):');
  console.log('─'.repeat(60));
  for (const card of result.cards.slice(0, 10)) {
    const arrow = card.trend === 'rising' ? '↑' : card.trend === 'falling' ? '↓' : '→';
    console.log(`  ${card.weekShare}% ${card.card} ${arrow}`);
  }

  console.log('');
}

module.exports = { analyzeMetaState };

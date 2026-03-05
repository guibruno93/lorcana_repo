/**
 * SISTEMA DE MATCHUPS E MULLIGAN
 * 
 * Features:
 * 1. Extrair dados da matriz de matchups do InkDecks
 * 2. Analisar deck do usuário vs meta
 * 3. Calcular win rates esperados
 * 4. Sugestões de mulligan por matchup
 * 
 * Fluxo:
 * User envia decklist → Sistema identifica arquétipo → 
 * Busca matchups na matriz → Retorna win rates + sugestões de mulligan
 */

// ═══════════════════════════════════════════════════════════════════
// PARTE 1: EXTRAIR DADOS DA MATRIZ INKDECKS
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const cheerio = require('cheerio');

/**
 * Extrair matriz completa de matchups do HTML InkDecks
 */
function extractMatchupMatrix(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const $ = cheerio.load(html);
  
  // Extrair headers (oponentes)
  const opponents = [];
  $('thead th').each((i, th) => {
    if (i === 0 || i === 1) return; // Skip primeiras colunas
    
    const $th = $(th);
    const name = $th.find('.heading-text div').text().trim();
    
    if (name) {
      // Extrair inks
      const inks = [];
      $th.find('img[src*="/symbols/lorcana/"]').each((j, img) => {
        const src = $(img).attr('src');
        const match = src.match(/\/([^/]+)\.svg$/);
        if (match) {
          const ink = match[1].charAt(0).toUpperCase() + match[1].slice(1);
          inks.push(ink);
        }
      });
      
      opponents.push({
        name,
        inks: inks.sort()
      });
    }
  });
  
  console.log(`✅ Found ${opponents.length} opponents in matrix`);
  
  // Extrair matchups de cada arquétipo
  const matrix = [];
  
  $('tr.item').each((i, row) => {
    const $row = $(row);
    const archetype = $row.attr('data-name');
    
    if (!archetype) return;
    
    // Extrair inks do arquétipo
    const archetypeInks = [];
    $row.find('td.header img[src*="/symbols/lorcana/"]').each((j, img) => {
      const src = $(img).attr('src');
      const match = src.match(/\/([^/]+)\.svg$/);
      if (match) {
        const ink = match[1].charAt(0).toUpperCase() + match[1].slice(1);
        archetypeInks.push(ink);
      }
    });
    
    // Extrair matchup contra cada oponente
    const matchups = {};
    
    $row.find('td.winrate-cell').each((cellIdx, cell) => {
      const $cell = $(cell);
      const winrate = parseInt($cell.attr('data-winrate')) || null;
      const matchesText = $cell.find('.matches-number').text();
      const matchesMatch = matchesText.match(/(\d+[\d,]*)\s*matches/);
      const matches = matchesMatch ? parseInt(matchesMatch[1].replace(/,/g, '')) : 0;
      
      if (cellIdx === 0) {
        // Overall (primeira célula)
        matchups['overall'] = { winrate, matches };
      } else if (opponents[cellIdx - 1]) {
        // Matchup específico
        const opponent = opponents[cellIdx - 1];
        matchups[opponent.name] = { winrate, matches };
      }
    });
    
    matrix.push({
      archetype: archetype.trim(),
      inks: archetypeInks.sort(),
      matchups
    });
  });
  
  console.log(`✅ Extracted ${matrix.length} archetypes with matchups`);
  
  return {
    opponents,
    matrix
  };
}

// ═══════════════════════════════════════════════════════════════════
// PARTE 2: IDENTIFICAR ARQUÉTIPO DO DECK DO USUÁRIO
// ═══════════════════════════════════════════════════════════════════

/**
 * Identificar arquétipo baseado nas cartas do deck
 */
function identifyArchetype(cards, inks) {
  // Normalizar inks (ordenar alfabeticamente)
  const normalizedInks = [...inks].sort();
  
  // Cards-chave que identificam arquétipos
  const archetypeSignatures = {
    'evasive': [
      'Cheshire Cat',
      'Genie - Wish Fulfilled',
      'Elsa - The Fifth Spirit'
    ],
    'aggro': [
      'Mowgli - Man Cub',
      'Strength of a Raging Fire'
    ],
    'midrange': [
      'Demona - Scourge of the Wyvern Clan',
      'Hades - Infernal Schemer'
    ],
    'control': [
      'Basil - Practiced Detective',
      'Under the Sea'
    ],
    'songs': [
      'Let It Go',
      'Sail the Azurite Sea'
    ],
    'challengers': [
      'Doc - Bold Knight'
    ]
  };
  
  // Contar matches com cada signature
  const scores = {};
  
  for (const [archetype, signatures] of Object.entries(archetypeSignatures)) {
    let score = 0;
    for (const signature of signatures) {
      for (const card of cards) {
        if (card.name.includes(signature)) {
          score++;
        }
      }
    }
    scores[archetype] = score;
  }
  
  // Pegar arquétipo com maior score
  let bestArchetype = 'unknown';
  let bestScore = 0;
  
  for (const [archetype, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestArchetype = archetype;
    }
  }
  
  // Construir nome completo (Inks + Archetype)
  const inksPrefix = normalizedInks.map(i => i.charAt(0)).join('/');
  const fullName = bestScore > 0 
    ? `${inksPrefix} ${bestArchetype.charAt(0).toUpperCase() + bestArchetype.slice(1)}`
    : 'Unknown';
  
  return {
    archetype: bestArchetype,
    fullName,
    confidence: bestScore,
    inks: normalizedInks
  };
}

// ═══════════════════════════════════════════════════════════════════
// PARTE 3: BUSCAR MATCHUPS DO DECK
// ═══════════════════════════════════════════════════════════════════

/**
 * Buscar matchups do deck na matriz
 */
function findMatchups(archetype, inks, matrix) {
  // Normalizar inks
  const normalizedInks = [...inks].sort();
  
  // Buscar match exato (mesmo arquétipo + mesmas inks)
  let exactMatch = matrix.find(m => 
    m.archetype.toLowerCase() === archetype.toLowerCase() &&
    JSON.stringify(m.inks) === JSON.stringify(normalizedInks)
  );
  
  // Se não encontrar, buscar só por arquétipo
  if (!exactMatch) {
    exactMatch = matrix.find(m => 
      m.archetype.toLowerCase() === archetype.toLowerCase()
    );
  }
  
  // Se ainda não encontrar, buscar só por inks
  if (!exactMatch) {
    exactMatch = matrix.find(m => 
      JSON.stringify(m.inks) === JSON.stringify(normalizedInks)
    );
  }
  
  if (!exactMatch) {
    return {
      found: false,
      archetype,
      inks: normalizedInks,
      matchups: {}
    };
  }
  
  // Converter matchups para formato mais útil
  const matchupData = [];
  
  for (const [opponent, data] of Object.entries(exactMatch.matchups)) {
    if (opponent === 'overall') continue;
    
    if (data.winrate !== null) {
      matchupData.push({
        opponent,
        winrate: data.winrate,
        matches: data.matches,
        expectedWins: data.winrate / 100,
        difficulty: 
          data.winrate >= 60 ? 'favorable' :
          data.winrate >= 50 ? 'even' :
          data.winrate >= 40 ? 'unfavorable' : 'very unfavorable'
      });
    }
  }
  
  // Ordenar por dificuldade (piores matchups primeiro)
  matchupData.sort((a, b) => a.winrate - b.winrate);
  
  return {
    found: true,
    archetype: exactMatch.archetype,
    inks: exactMatch.inks,
    overall: exactMatch.matchups.overall,
    matchups: matchupData,
    favorableMatchups: matchupData.filter(m => m.winrate >= 60),
    evenMatchups: matchupData.filter(m => m.winrate >= 50 && m.winrate < 60),
    unfavorableMatchups: matchupData.filter(m => m.winrate < 50)
  };
}

// ═══════════════════════════════════════════════════════════════════
// PARTE 4: SUGESTÕES DE MULLIGAN
// ═══════════════════════════════════════════════════════════════════

/**
 * Gerar sugestões de mulligan baseado no matchup
 */
function generateMulliganSuggestions(deck, opponent, matchupWinRate) {
  const suggestions = {
    opponent,
    matchupWinRate,
    strategy: '',
    keepAlways: [],
    keepIf: [],
    mulligan: [],
    gameplan: ''
  };
  
  // Determinar estratégia baseado no matchup
  if (matchupWinRate >= 60) {
    suggestions.strategy = 'aggressive';
    suggestions.gameplan = 'You are favored in this matchup. Play aggressively and pressure early.';
  } else if (matchupWinRate >= 50) {
    suggestions.strategy = 'balanced';
    suggestions.gameplan = 'Even matchup. Adapt to the game state and look for incremental advantages.';
  } else if (matchupWinRate >= 40) {
    suggestions.strategy = 'defensive';
    suggestions.gameplan = 'Unfavorable matchup. Play defensively, look for value trades and late game.';
  } else {
    suggestions.strategy = 'survival';
    suggestions.gameplan = 'Very unfavorable. Focus on survival, disruption, and finding key cards.';
  }
  
  // Analisar cartas do deck e categorizar
  for (const card of deck.cards) {
    const cardName = card.name.toLowerCase();
    const cost = card.cost || 0;
    
    // Cards de ramp/draw sempre bons
    if (cardName.includes('lore') || cardName.includes('draw') || cost <= 2) {
      suggestions.keepAlways.push({
        name: card.name,
        reason: 'Early game presence / card advantage'
      });
    }
    
    // Cards específicos contra aggro
    if (opponent.toLowerCase().includes('aggro')) {
      if (cardName.includes('heal') || cardName.includes('remove') || cardName.includes('challenge')) {
        suggestions.keepIf.push({
          name: card.name,
          condition: 'vs Aggro',
          reason: 'Defensive tool against early pressure'
        });
      }
    }
    
    // Cards específicos contra control
    if (opponent.toLowerCase().includes('control')) {
      if (cardName.includes('draw') || cost >= 5) {
        suggestions.keepIf.push({
          name: card.name,
          condition: 'vs Control',
          reason: 'Value generator for long game'
        });
      }
    }
    
    // Cards caros em matchups rápidos
    if (opponent.toLowerCase().includes('aggro') && cost >= 6) {
      suggestions.mulligan.push({
        name: card.name,
        reason: 'Too slow against aggro'
      });
    }
  }
  
  // Limitar sugestões (top 5 de cada categoria)
  suggestions.keepAlways = suggestions.keepAlways.slice(0, 5);
  suggestions.keepIf = suggestions.keepIf.slice(0, 5);
  suggestions.mulligan = suggestions.mulligan.slice(0, 5);
  
  return suggestions;
}

// ═══════════════════════════════════════════════════════════════════
// PARTE 5: ENDPOINT DA API
// ═══════════════════════════════════════════════════════════════════

/**
 * Adicionar ao routes/meta-analysis.js ou routes/deck.js
 */
async function analyzeMatchupsEndpoint(req, res) {
  try {
    const { cards, inks, decklist } = req.body;
    
    if (!cards || !inks) {
      return res.status(400).json({
        success: false,
        error: 'Missing cards or inks'
      });
    }
    
    // 1. Carregar matriz de matchups
    // (Em produção, isso deveria estar em cache ou banco)
    const matrixPath = './data/inkdecks-matrix.json';
    let matrixData;
    
    if (fs.existsSync(matrixPath)) {
      matrixData = JSON.parse(fs.readFileSync(matrixPath, 'utf-8'));
    } else {
      // Primeira vez, extrair do HTML
      const htmlPath = './data/tietlist.html';
      matrixData = extractMatchupMatrix(htmlPath);
      fs.writeFileSync(matrixPath, JSON.stringify(matrixData, null, 2));
    }
    
    // 2. Identificar arquétipo do deck
    const identified = identifyArchetype(cards, inks);
    
    // 3. Buscar matchups
    const matchups = findMatchups(
      identified.archetype,
      identified.inks,
      matrixData.matrix
    );
    
    // 4. Gerar sugestões de mulligan para cada matchup
    const mulliganSuggestions = {};
    
    for (const matchup of matchups.matchups || []) {
      mulliganSuggestions[matchup.opponent] = generateMulliganSuggestions(
        { cards },
        matchup.opponent,
        matchup.winrate
      );
    }
    
    // 5. Calcular meta share esperado
    // (buscar da tabela archetype_meta)
    const metaArchetypes = await getMetaArchetypes();
    
    // Combinar matchups com meta share
    const weightedMatchups = matchups.matchups.map(m => {
      const metaData = metaArchetypes.find(a => 
        a.archetype.toLowerCase().includes(m.opponent.toLowerCase())
      );
      
      return {
        ...m,
        metaShare: metaData?.meta_share || 0,
        weightedImpact: (m.winrate / 100) * (metaData?.meta_share || 0)
      };
    });
    
    // Calcular win rate esperado vs meta
    const totalMetaShare = weightedMatchups.reduce((sum, m) => sum + m.metaShare, 0);
    const expectedWinRate = totalMetaShare > 0
      ? weightedMatchups.reduce((sum, m) => sum + m.weightedImpact, 0) / totalMetaShare * 100
      : null;
    
    res.json({
      success: true,
      deck: {
        archetype: identified.fullName,
        confidence: identified.confidence,
        inks: identified.inks
      },
      matchups: {
        found: matchups.found,
        overall: matchups.overall,
        favorable: matchups.favorableMatchups,
        even: matchups.evenMatchups,
        unfavorable: matchups.unfavorableMatchups,
        all: weightedMatchups,
        expectedWinRateVsMeta: expectedWinRate
      },
      mulligan: mulliganSuggestions,
      meta: {
        totalArchetypes: metaArchetypes.length,
        coverage: (totalMetaShare).toFixed(1) + '%'
      }
    });
    
  } catch (err) {
    console.error('❌ Matchup analysis error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

// Helper para buscar meta do banco
async function getMetaArchetypes() {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  const { data, error } = await supabase
    .from('archetype_meta')
    .select('archetype, meta_share, win_rate')
    .eq('format', 'core')
    .eq('days', 30)
    .order('meta_share', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  extractMatchupMatrix,
  identifyArchetype,
  findMatchups,
  generateMulliganSuggestions,
  analyzeMatchupsEndpoint
};

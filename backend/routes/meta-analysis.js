/**
 * backend/routes/meta-analysis.js
 * ✅ VERSÃO CORRIGIDA - Com rota de teste e tratamento de erros melhorado
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ═══════════════════════════════════════════════════════════════════
// ROTA DE TESTE - Confirmar que router funciona
// ═══════════════════════════════════════════════════════════════════

router.get('/test', (req, res) => {
  res.json({ 
    ok: true, 
    message: 'Meta-analysis routes are working!',
    timestamp: new Date().toISOString(),
    supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY),
    routes: [
      'GET /api/meta-analysis/test',
      'GET /api/meta-analysis/dashboard',
      'GET /api/meta-analysis/trends',
      'GET /api/meta-analysis/tier-list'
    ]
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /api/meta-analysis/dashboard
// Dashboard completo com estatísticas do meta
// ═══════════════════════════════════════════════════════════════════

router.get('/dashboard', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    console.log(`📊 Fetching dashboard data (last ${days} days)...`);
    
    // Calcular data de corte
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    // Buscar dados do meta
    const { data: metaData, error: metaError } = await supabase
      .from('meta_analysis')
      .select('*')
      .gte('analyzed_at', cutoffDate.toISOString())
      .order('play_rate', { ascending: false });
    
    if (metaError) {
      console.error('❌ Dashboard fetch error:', metaError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard data',
        details: metaError.message,
        hint: 'Check Supabase connection and meta_analysis table'
      });
    }
    
    console.log(`✅ Found ${metaData?.length || 0} archetypes`);
    
    // Estatísticas gerais
    const totalDecks = metaData?.reduce((sum, d) => sum + (d.sample_size || 0), 0) || 0;
    const avgWinrate = metaData?.length > 0 
      ? metaData.reduce((sum, d) => sum + (d.expected_winrate || 50), 0) / metaData.length 
      : 50;
    
    // Top archetypes
    const topArchetypes = (metaData || []).slice(0, 5).map(d => ({
      archetype: d.archetype,
      playRate: parseFloat(d.play_rate || 0).toFixed(1),
      winrate: parseFloat(d.expected_winrate || 50).toFixed(1),
      sampleSize: d.sample_size || 0,
      topCards: d.top_cards || []
    }));
    
    // Distribuição por tier
    const tierDistribution = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    
    for (const deck of metaData || []) {
      const playRate = parseFloat(deck.play_rate) || 0;
      const winrate = parseFloat(deck.expected_winrate) || 50;
      
      let tier = 'C';
      if (playRate >= 10 && winrate >= 55) tier = 'S';
      else if (playRate >= 7 && winrate >= 52) tier = 'A';
      else if (playRate >= 4 && winrate >= 50) tier = 'B';
      else if (playRate >= 2 && winrate >= 48) tier = 'C';
      else tier = 'D';
      
      tierDistribution[tier]++;
    }
    
    const response = {
      success: true,
      stats: {
        totalDecks,
        avgWinrate: avgWinrate.toFixed(1),
        totalArchetypes: metaData?.length || 0,
        days: parseInt(days)
      },
      topArchetypes,
      tierDistribution,
      allArchetypes: metaData || [],
      timestamp: new Date().toISOString()
    };
    
    console.log(`📊 Dashboard response ready:`, {
      archetypes: response.stats.totalArchetypes,
      decks: response.stats.totalDecks
    });
    
    res.json(response);
    
  } catch (err) {
    console.error('❌ /dashboard error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /api/meta-analysis/trends
// Tendências do meta ao longo do tempo
// ═══════════════════════════════════════════════════════════════════

router.get('/trends', async (req, res) => {
  try {
    console.log('📈 Fetching meta trends...');
    
    // Buscar dados históricos
    const { data: historicalData, error } = await supabase
      .from('meta_analysis')
      .select('*')
      .order('analyzed_at', { ascending: true });
    
    if (error) {
      console.error('❌ Trends fetch error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch trends',
        details: error.message
      });
    }
    
    // Agrupar por archetype
    const trendsByArchetype = {};
    
    for (const entry of historicalData || []) {
      const arch = entry.archetype;
      
      if (!trendsByArchetype[arch]) {
        trendsByArchetype[arch] = [];
      }
      
      trendsByArchetype[arch].push({
        date: entry.analyzed_at,
        playRate: parseFloat(entry.play_rate || 0),
        winrate: parseFloat(entry.expected_winrate || 50),
        sampleSize: entry.sample_size || 0
      });
    }
    
    // Calcular mudanças (últimos 7 dias vs anteriores)
    const recentChanges = [];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    for (const [archetype, data] of Object.entries(trendsByArchetype)) {
      const recent = data.filter(d => new Date(d.date) >= sevenDaysAgo);
      const older = data.filter(d => new Date(d.date) < sevenDaysAgo);
      
      if (recent.length > 0 && older.length > 0) {
        const recentAvg = recent.reduce((sum, d) => sum + d.playRate, 0) / recent.length;
        const olderAvg = older.reduce((sum, d) => sum + d.playRate, 0) / older.length;
        const change = recentAvg - olderAvg;
        
        recentChanges.push({
          archetype,
          change: change.toFixed(1),
          trend: change > 0 ? 'rising' : change < 0 ? 'falling' : 'stable',
          currentRate: recentAvg.toFixed(1)
        });
      }
    }
    
    // Ordenar por maior mudança absoluta
    recentChanges.sort((a, b) => Math.abs(parseFloat(b.change)) - Math.abs(parseFloat(a.change)));
    
    res.json({
      success: true,
      trends: trendsByArchetype,
      recentChanges: recentChanges.slice(0, 10),
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('❌ /trends error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /api/meta-analysis/tier-list
// Retorna tier list atual
// ═══════════════════════════════════════════════════════════════════

router.get('/tier-list', async (req, res) => {
  try {
    console.log('🏆 Generating tier list...');
    
    const { data: metaData, error } = await supabase
      .from('meta_analysis')
      .select('*')
      .order('play_rate', { ascending: false });
    
    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch tier list data',
        details: error.message
      });
    }
    
    // Agrupar por tier baseado em play_rate e expected_winrate
    const tierList = {
      S: [],
      A: [],
      B: [],
      C: [],
      D: []
    };
    
    for (const deck of metaData || []) {
      const playRate = parseFloat(deck.play_rate) || 0;
      const winrate = parseFloat(deck.expected_winrate) || 50;
      
      let tier = 'C';
      
      if (playRate >= 10 && winrate >= 55) tier = 'S';
      else if (playRate >= 7 && winrate >= 52) tier = 'A';
      else if (playRate >= 4 && winrate >= 50) tier = 'B';
      else if (playRate >= 2 && winrate >= 48) tier = 'C';
      else tier = 'D';
      
      tierList[tier].push({
        archetype: deck.archetype,
        playRate: playRate.toFixed(1),
        winrate: winrate.toFixed(1),
        sampleSize: deck.sample_size || 0,
        topCards: deck.top_cards || []
      });
    }
    
    res.json({
      success: true,
      tierList,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('❌ /tier-list error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;

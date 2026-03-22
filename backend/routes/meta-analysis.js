/**
 * backend/routes/meta-analysis.js
 * ✅ VERSÃO COMPLETA - Preparada para scraper real (SEM MOCK DATA)
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
      throw new Error('Failed to fetch dashboard data');
    }
    
    // Estatísticas gerais
    const totalDecks = metaData?.reduce((sum, d) => sum + (d.sample_size || 0), 0) || 0;
    const avgWinrate = metaData?.reduce((sum, d) => sum + (d.expected_winrate || 50), 0) / (metaData?.length || 1) || 50;
    
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
      const playRate = deck.play_rate || 0;
      const winrate = deck.expected_winrate || 50;
      
      let tier = 'C';
      if (playRate >= 10 && winrate >= 55) tier = 'S';
      else if (playRate >= 7 && winrate >= 52) tier = 'A';
      else if (playRate >= 4 && winrate >= 50) tier = 'B';
      else if (playRate >= 2 && winrate >= 48) tier = 'C';
      else tier = 'D';
      
      tierDistribution[tier]++;
    }
    
    res.json({
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
    });
    
  } catch (err) {
    console.error('❌ /dashboard error:', err);
    res.status(500).json({
      success: false,
      error: err.message
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
      throw new Error('Failed to fetch trends');
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
// GET /api/meta-analysis/current
// Retorna análise atual do meta
// ═══════════════════════════════════════════════════════════════════

router.get('/current', async (req, res) => {
  try {
    console.log('📊 Fetching current meta analysis...');
    
    // Buscar análise mais recente
    const { data: metaData, error: metaError } = await supabase
      .from('meta_analysis')
      .select('*')
      .order('analyzed_at', { ascending: false })
      .limit(10);
    
    if (metaError) {
      console.error('❌ Meta fetch error:', metaError);
      throw new Error('Failed to fetch meta data');
    }
    
    // Buscar matchups
    const { data: matchupData, error: matchupError } = await supabase
      .from('archetype_matchups')
      .select('*');
    
    if (matchupError) {
      console.error('❌ Matchup fetch error:', matchupError);
    }
    
    res.json({
      success: true,
      meta: metaData || [],
      matchups: matchupData || [],
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('❌ /current error:', err);
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
      throw new Error('Failed to fetch tier list data');
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
      const playRate = deck.play_rate || 0;
      const winrate = deck.expected_winrate || 50;
      
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
        sampleSize: deck.sample_size || 0
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

// ═══════════════════════════════════════════════════════════════════
// POST /api/meta-analysis/scrape
// ✅ ESTRUTURA PRONTA - Adicione seu scraper real aqui
// ═══════════════════════════════════════════════════════════════════

router.post('/scrape', async (req, res) => {
  try {
    console.log('🕷️ Starting meta scrape...');
    
    const startTime = Date.now();
    
    // ═══════════════════════════════════════════════════════════════
    // 🔧 ADICIONE SEU SCRAPER REAL AQUI
    // ═══════════════════════════════════════════════════════════════
    
    let scrapedData = [];
    
    // EXEMPLO - Descomente e adapte para sua fonte de dados:
    
    // OPÇÃO A: Scraping de website (Lorcana.gg, etc)
    // const axios = require('axios');
    // const cheerio = require('cheerio');
    // const response = await axios.get('https://lorcana.gg/meta');
    // const $ = cheerio.load(response.data);
    // scrapedData = parseMetaFromHTML($);
    
    // OPÇÃO B: API externa
    // const axios = require('axios');
    // const response = await axios.get('https://api.exemplo.com/meta');
    // scrapedData = response.data;
    
    // OPÇÃO C: Arquivo CSV/JSON local
    // const fs = require('fs');
    // const metaFile = fs.readFileSync('./data/meta-snapshot.json', 'utf8');
    // scrapedData = JSON.parse(metaFile);
    
    // OPÇÃO D: Service dedicado
    // const metaScraper = require('../services/meta-scraper');
    // scrapedData = await metaScraper.fetchLatestMeta();
    
    // ═══════════════════════════════════════════════════════════════
    // VALIDAÇÃO - Se não houver dados, retornar erro
    // ═══════════════════════════════════════════════════════════════
    
    if (!scrapedData || scrapedData.length === 0) {
      console.warn('⚠️ No data scraped - scraper not implemented yet');
      return res.status(501).json({
        success: false,
        error: 'Scraper not implemented',
        message: 'Please implement a real data source in the scrape endpoint',
        hint: 'Edit backend/routes/meta-analysis.js and add your scraping logic',
        examples: {
          structure: [
            {
              archetype: 'Sapphire/Steel',
              play_rate: 18.5,
              expected_winrate: 54.2,
              sample_size: 342,
              top_cards: ['Elsa - Spirit of Winter', 'Mickey Mouse - Brave Little Tailor']
            }
          ],
          sources: [
            'Lorcana.gg - HTML scraping',
            'Dreamborn.ink - API (if available)',
            'Tournament results - CSV/JSON files',
            'Manual data entry - JSON file'
          ]
        },
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`📦 Scraped ${scrapedData.length} archetypes`);
    
    // ═══════════════════════════════════════════════════════════════
    // SALVAR NO SUPABASE
    // ═══════════════════════════════════════════════════════════════
    
    let insertedCount = 0;
    let updatedCount = 0;
    const errors = [];
    
    for (const metaDeck of scrapedData) {
      try {
        // Validar estrutura esperada
        if (!metaDeck.archetype || metaDeck.play_rate === undefined) {
          throw new Error('Invalid data structure - missing required fields (archetype, play_rate)');
        }
        
        // Verificar se já existe
        const { data: existing, error: fetchError } = await supabase
          .from('meta_analysis')
          .select('id')
          .eq('archetype', metaDeck.archetype)
          .order('analyzed_at', { ascending: false })
          .limit(1)
          .single();
        
        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }
        
        if (existing) {
          // Atualizar existente
          const { error: updateError } = await supabase
            .from('meta_analysis')
            .update({
              play_rate: metaDeck.play_rate,
              expected_winrate: metaDeck.expected_winrate || 50,
              sample_size: metaDeck.sample_size || 0,
              top_cards: metaDeck.top_cards || [],
              analyzed_at: new Date().toISOString()
            })
            .eq('id', existing.id);
          
          if (updateError) throw updateError;
          updatedCount++;
          
        } else {
          // Inserir novo
          const { error: insertError } = await supabase
            .from('meta_analysis')
            .insert({
              archetype: metaDeck.archetype,
              play_rate: metaDeck.play_rate,
              expected_winrate: metaDeck.expected_winrate || 50,
              sample_size: metaDeck.sample_size || 0,
              top_cards: metaDeck.top_cards || [],
              analyzed_at: new Date().toISOString()
            });
          
          if (insertError) throw insertError;
          insertedCount++;
        }
        
      } catch (err) {
        console.error(`❌ Error processing ${metaDeck.archetype}:`, err.message);
        errors.push({
          archetype: metaDeck.archetype,
          error: err.message
        });
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Scrape complete in ${duration}ms`);
    console.log(`   - Inserted: ${insertedCount}`);
    console.log(`   - Updated: ${updatedCount}`);
    console.log(`   - Errors: ${errors.length}`);
    
    res.json({
      success: true,
      message: 'Meta scrape completed',
      stats: {
        inserted: insertedCount,
        updated: updatedCount,
        errors: errors.length,
        duration: `${duration}ms`
      },
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('❌ /scrape error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ESTRUTURA ESPERADA PARA scrapedData:
// ═══════════════════════════════════════════════════════════════════
//
// scrapedData = [
//   {
//     archetype: 'Sapphire/Steel',              // Nome do archetype (obrigatório)
//     play_rate: 18.5,                          // % de uso no meta (obrigatório)
//     expected_winrate: 54.2,                   // % de winrate esperado (opcional, default 50)
//     sample_size: 342,                         // número de decks analisados (opcional, default 0)
//     top_cards: [                              // cartas mais usadas (opcional, default [])
//       'Elsa - Spirit of Winter',
//       'Mickey Mouse - Brave Little Tailor',
//       'Sisu - Divine Water Dragon'
//     ]
//   },
//   // ... mais archetypes
// ]
//
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// POST /api/meta-analysis/analyze
// Força análise do meta atual
// ═══════════════════════════════════════════════════════════════════

router.post('/analyze', async (req, res) => {
  try {
    console.log('📊 Analyzing current meta...');
    
    // Buscar todos os decks
    const { data: decks, error: deckError } = await supabase
      .from('decks')
      .select('archetype')
      .order('created_at', { ascending: false });
    
    if (deckError) {
      throw new Error('Failed to fetch decks');
    }
    
    // Contar frequência de archetypes
    const archetypeCounts = {};
    const totalDecks = decks?.length || 0;
    
    for (const deck of decks || []) {
      const arch = deck.archetype || 'Unknown';
      archetypeCounts[arch] = (archetypeCounts[arch] || 0) + 1;
    }
    
    // Calcular play rates
    const analysis = Object.entries(archetypeCounts).map(([archetype, count]) => ({
      archetype,
      count,
      playRate: ((count / totalDecks) * 100).toFixed(1),
      percentage: ((count / totalDecks) * 100).toFixed(1)
    }));
    
    // Ordenar por count
    analysis.sort((a, b) => b.count - a.count);
    
    res.json({
      success: true,
      totalDecks,
      analysis,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('❌ /analyze error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /api/meta-analysis/clear
// Limpa dados antigos do meta
// ═══════════════════════════════════════════════════════════════════

router.delete('/clear', async (req, res) => {
  try {
    const { daysOld = 30 } = req.body;
    
    console.log(`🗑️ Clearing meta data older than ${daysOld} days...`);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const { data, error } = await supabase
      .from('meta_analysis')
      .delete()
      .lt('analyzed_at', cutoffDate.toISOString());
    
    if (error) {
      throw new Error('Failed to clear old data');
    }
    
    res.json({
      success: true,
      message: `Cleared data older than ${daysOld} days`,
      cutoffDate: cutoffDate.toISOString()
    });
    
  } catch (err) {
    console.error('❌ /clear error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;

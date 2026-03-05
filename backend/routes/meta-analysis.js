/**
 * backend/routes/meta-analysis.js
 * VERSÃO CORRIGIDA COMPLETA - Com todos os fixes
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const metaAnalyzer = require('../services/meta-analyzer');
const TournamentScraper = require('../services/tournament-scraper');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ANALYSIS_FORMAT = process.env.LORCANA_FORMAT || 'core';

/**
 * Validar days parameter
 */
function validateDays(input) {
  let days = input;
  
  if (typeof days === 'object' && days !== null && days.days) {
    days = days.days;
  }
  
  const num = Number(days);
  
  if (isNaN(num) || num <= 0 || num > 365) {
    console.warn(`⚠️  Invalid days parameter: ${days}, using default 30`);
    return 30;
  }
  
  return Math.floor(num);
}

//═══════════════════════════════════════════════════════════
// SCRAPING ENDPOINTS
//═══════════════════════════════════════════════════════════

router.post('/scrape', async (req, res) => {
  try {
    const { limit = 10 } = req.body;
    
    console.log(`🔍 Starting scrape with limit: ${limit}`);
    
    // ✅ FIX 1: Usar método correto e criar instância
    const scraper = new TournamentScraper();
    const decks = await scraper.scrapeTournaments(limit);
    
    console.log(`✅ Found ${decks.length} decks`);
    
    // ✅ FIX 2: SALVAR decks no banco!
    let savedCount = 0;
    let errorCount = 0;
    
    for (const deck of decks) {
      try {
        // Preparar dados para inserção
        const deckData = {
          url: deck.url,
          name: deck.name,
          archetype: deck.archetype,
          inks: deck.inks,
          placement: deck.placement,
          wins: deck.wins,
          losses: deck.losses,
          format: deck.format,  // ✅ FORMATO DO SCRAPER!
          scraped_at: new Date().toISOString()
        };
        
        // Upsert (insert ou update se já existe)
        const { error } = await supabase
          .from('decks')
          .upsert(deckData, {
            onConflict: 'url'  // Não duplicar mesmo deck
          });
        
        if (error) {
          console.error(`❌ Error saving deck ${deck.url}:`, error.message);
          errorCount++;
        } else {
          savedCount++;
        }
      } catch (err) {
        console.error(`❌ Error processing deck:`, err.message);
        errorCount++;
      }
    }
    
    console.log(`✅ Saved ${savedCount} decks, ${errorCount} errors`);
    
    res.json({
      success: true,
      decks_scraped: decks.length,
      decks_saved: savedCount,
      errors: errorCount
    });
  } catch (err) {
    console.error('❌ Scrape error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

router.get('/scraping-jobs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('scraping_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    
    res.json({ 
      success: true,
      jobs: data || [] 
    });
  } catch (err) {
    console.error('❌ Get jobs error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

//═══════════════════════════════════════════════════════════
// ANALYSIS ENDPOINTS
//═══════════════════════════════════════════════════════════

router.post('/analyze', async (req, res) => {
  try {
    const rawDays = req.body.days || 30;
    const days = validateDays(rawDays);
    
    console.log(`📊 Starting meta analysis (${days} days)`);
    
    let results;
    if (metaAnalyzer.analyzeAll) {
      results = await metaAnalyzer.analyzeAll(days);
    } else if (metaAnalyzer.analyzeCompleteMeta) {
      results = await metaAnalyzer.analyzeCompleteMeta(days);
    } else {
      throw new Error('No analyze method found in metaAnalyzer');
    }
    
    res.json({
      success: true,
      message: 'Analysis completed',
      ...results
    });
  } catch (err) {
    console.error('❌ Meta analysis error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

//═══════════════════════════════════════════════════════════
// DASHBOARD - ✅ TOTALMENTE CORRIGIDO
//═══════════════════════════════════════════════════════════

router.post('/dashboard', async (req, res) => {
  try {
    const rawDays = req.body.days || 30;
    const days = validateDays(rawDays);
    
    console.log(`📊 Fetching dashboard data (${days} days, format: ${ANALYSIS_FORMAT})`);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = cutoffDate.toISOString();

    // ✅ FIX 3: Count total decks COM FILTRO DE FORMATO
    const { count: totalDecks, error: cErr } = await supabase
      .from('decks')
      .select('id', { count: 'exact', head: true })
      .eq('format', ANALYSIS_FORMAT)  // ✅ FILTRO ADICIONADO!
      .gte('scraped_at', cutoff);

    if (cErr) throw cErr;

    // ✅ FIX 4: Buscar archetypes COM FILTROS
    const { data: archetypes, error: archError } = await supabase
      .from('archetype_meta')
      .select('*')
      .eq('days', days)  // ✅ FILTRO ADICIONADO!
      .eq('format', ANALYSIS_FORMAT)  // ✅ FILTRO ADICIONADO!
      .order('meta_share', { ascending: false })
      .limit(20);

    if (archError) console.warn('⚠️  Archetype fetch warning:', archError.message);

    // Buscar top cards
    const { data: topCards, error: cardsError } = await supabase
      .from('cards_meta')
      .select('*')
      .order('meta_share', { ascending: false })
      .limit(20);

    if (cardsError) console.warn('⚠️  Cards fetch warning:', cardsError.message);

    // Construir tier list
    const tierList = { S: [], A: [], B: [], C: [], D: [] };
    
    if (archetypes && archetypes.length > 0) {
      for (const arch of archetypes) {
        const tier = arch.tier || 'D';
        
        if (tierList[tier]) {
          tierList[tier].push({
            archetype: arch.archetype,
            inks: arch.inks || [],
            power_level: arch.power_level,
            meta_share: arch.meta_share,
            win_rate: arch.win_rate,
            total_decks: arch.total_decks,
            trend: arch.trend,
            trend_delta: arch.trend_delta
          });
        }
      }
    }

    // Calcular stats
    const avgWinRate = (archetypes || [])
      .filter(a => a.win_rate != null)
      .reduce((sum, a, _, arr) => sum + a.win_rate / arr.length, 0) || null;

    const topDeckShare = archetypes && archetypes[0] 
      ? archetypes[0].meta_share 
      : null;

    // ✅ FIX 5: CAMPO CORRETO uniqueArchetypes
    res.json({
      success: true,
      stats: {
        totalDecks: totalDecks || 0,
        uniqueArchetypes: (archetypes || []).length,  // ✅ NOME CORRETO!
        avgWinRate: avgWinRate ? Number(avgWinRate.toFixed(1)) : null,
        topDeckShare: topDeckShare ? Number(topDeckShare.toFixed(1)) : null,
        format: ANALYSIS_FORMAT  // ✅ ADICIONAR FORMATO!
      },
      archetypes: archetypes || [],
      topCards: topCards || [],
      tierList: tierList,
      trends: {
        rising: [],
        falling: []
      },
      lastUpdated: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('❌ Dashboard error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

//═══════════════════════════════════════════════════════════
// TIER LIST
//═══════════════════════════════════════════════════════════

router.get('/tier-list', async (req, res) => {
  try {
    const rawDays = req.query.days || 30;
    const days = validateDays(rawDays);
    
    console.log(`🏆 Fetching tier list (${days} days, format: ${ANALYSIS_FORMAT})`);
    
    const { data, error } = await supabase
      .from('archetype_meta')
      .select('*')
      .eq('days', days)
      .eq('format', ANALYSIS_FORMAT)
      .order('power_level', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Construir tier list
    const tierList = { S: [], A: [], B: [], C: [], D: [] };
    
    for (const arch of (data || [])) {
      const tier = arch.tier || 'D';
      if (tierList[tier]) {
        tierList[tier].push({
          archetype: arch.archetype,
          inks: arch.inks || [],
          power_level: arch.power_level,
          meta_share: arch.meta_share,
          win_rate: arch.win_rate,
          total_decks: arch.total_decks,
          trend: arch.trend,
          trend_delta: arch.trend_delta
        });
      }
    }
    
    const lastUpdated = (data && data[0]) 
      ? (data[0].last_calculated || data[0].updated_at)
      : null;
    
    res.json({
      success: true,
      tierList,
      lastUpdated
    });
    
  } catch (err) {
    console.error('❌ Tier list error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

//═══════════════════════════════════════════════════════════
// TRENDS
//═══════════════════════════════════════════════════════════

router.get('/trends', async (req, res) => {
  try {
    const rawDays = req.query.days || 30;
    const days = validateDays(rawDays);
    
    console.log(`📈 Fetching trends (${days} days)`);
    
    const { data, error } = await supabase
      .from('archetype_meta')
      .select('archetype, trend, trend_delta, meta_share, tier')
      .eq('days', days)
      .eq('format', ANALYSIS_FORMAT)
      .not('trend', 'is', null)
      .order('trend_delta', { ascending: false });

    if (error) throw error;

    const rising = [];
    const falling = [];
    
    for (const item of (data || [])) {
      const trendItem = {
        archetype: item.archetype,
        trend_delta: item.trend_delta || 0,
        meta_share: item.meta_share || 0,
        tier: item.tier || 'C'
      };
      
      if (item.trend === 'Rising' || item.trend_delta > 0) {
        rising.push(trendItem);
      } else if (item.trend === 'Falling' || item.trend_delta < 0) {
        falling.push(trendItem);
      }
    }
    
    res.json({
      success: true,
      trends: {
        rising: rising.slice(0, 10),
        falling: falling.slice(0, 10)
      }
    });
    
  } catch (err) {
    console.error('❌ Trends error:', err);
    
    res.json({
      success: true,
      trends: {
        rising: [],
        falling: []
      }
    });
  }
});

//═══════════════════════════════════════════════════════════
// CARDS
//═══════════════════════════════════════════════════════════

router.get('/cards/top', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    console.log(`🃏 Fetching top cards (limit: ${limit})`);
    
    const { data, error } = await supabase
      .from('cards_meta')
      .select('*')
      .order('meta_share', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;
    
    res.json({ 
      success: true,
      cards: data || [] 
    });
    
  } catch (err) {
    console.error('❌ Top cards error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

//═══════════════════════════════════════════════════════════
// OTHER ENDPOINTS
//═══════════════════════════════════════════════════════════

router.get('/archetype/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    const { data: archetype, error: archError } = await supabase
      .from('archetype_meta')
      .select('*')
      .eq('archetype', name)
      .eq('format', ANALYSIS_FORMAT)
      .single();

    if (archError) throw archError;

    const { data: recentDecks, error: decksError } = await supabase
      .from('decks')
      .select('*')
      .eq('archetype', name)
      .eq('format', ANALYSIS_FORMAT)
      .order('scraped_at', { ascending: false })
      .limit(20);

    if (decksError) console.warn('⚠️  Recent decks warning:', decksError.message);

    const { data: history, error: histError } = await supabase
      .from('tier_list_history')
      .select('*')
      .eq('archetype', name)
      .order('snapshot_date', { ascending: false })
      .limit(30);

    if (histError) console.warn('⚠️  Tier history warning:', histError.message);

    res.json({
      success: true,
      archetype,
      recentDecks: recentDecks || [],
      tierHistory: history || []
    });
    
  } catch (err) {
    console.error('❌ Archetype details error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

router.get('/win-rates', async (req, res) => {
  try {
    const { minDecks = 5 } = req.query;
    
    const { data, error } = await supabase
      .from('archetype_meta')
      .select('archetype, win_rate, total_decks, meta_share')
      .eq('format', ANALYSIS_FORMAT)
      .gte('total_decks', parseInt(minDecks))
      .order('win_rate', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      winRates: data || []
    });
    
  } catch (err) {
    console.error('❌ Win rates error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

router.get('/tournaments/recent', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('scraped_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    res.json({
      success: true,
      tournaments: data || []
    });
    
  } catch (err) {
    console.error('❌ Recent tournaments error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

module.exports = router;
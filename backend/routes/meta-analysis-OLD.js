/**
 * backend/routes/meta-analysis.js
 * VERSÃO CORRIGIDA - Tier list funcionando
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const metaAnalyzer = require('../services/meta-analyzer');
const tournamentScraper = require('../services/tournament-scraper');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
    const { limit = 20 } = req.body;
    
    console.log(`🔍 Starting scrape with limit: ${limit}`);
    
    const results = await tournamentScraper.scrapeRecentTournaments(limit);
    
    res.json({
      success: true,
      ...results
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
// DASHBOARD - ✅ COM TIER LIST FUNCIONANDO
//═══════════════════════════════════════════════════════════

router.post('/dashboard', async (req, res) => {
  try {
    const rawDays = req.body.days || 30;
    const days = validateDays(rawDays);
    
    console.log(`📊 Fetching dashboard data (${days} days)`);
    
    // Buscar stats manualmente do banco
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = cutoffDate.toISOString();

    // Count total decks
    const { count: totalDecks, error: cErr } = await supabase
      .from('decks')
      .select('id', { count: 'exact', head: true })
      .gte('scraped_at', cutoff);

    if (cErr) throw cErr;

    // Count unique archetypes
    const { data: deckRows, error: dErr } = await supabase
      .from('decks')
      .select('archetype, fingerprint, name')
      .gte('scraped_at', cutoff)
      .limit(5000);

    if (dErr) throw dErr;

    const archetypeSet = new Set(
      (deckRows || []).map(d => d.archetype || d.fingerprint || d.name || 'Unknown')
    );

    // Buscar archetypes meta
    const { data: archetypes, error: archError } = await supabase
      .from('archetype_meta')
      .select('*')
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

    // ✅ CONSTRUIR TIER LIST A PARTIR DOS ARCHETYPES
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

    // Montar resposta
    res.json({
      success: true,
      stats: {
        totalDecks: totalDecks || 0,
        totalArchetypes: archetypeSet.size,
        avgWinRate: avgWinRate ? Number(avgWinRate.toFixed(1)) : null,
        topDeckShare: topDeckShare ? Number(topDeckShare.toFixed(1)) : null
      },
      archetypes: archetypes || [],
      topCards: topCards || [],
      tierList: tierList, // ✅ AGORA PREENCHIDO!
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

async _analyzeArchetypes({ decks, now }) {
  const supabase = getSupabase();
  if (!decks.length) return [];

  const groups = new Map();
  for (const d of decks) {
    const archetype = d.archetype || d.name || "Unknown";
    const inks = safeArray(d.inks);
    const key = `${archetype}||${inks.join(",")}`;
    if (!groups.has(key)) groups.set(key, { archetype, inks, decks: [] });
    groups.get(key).decks.push(d);
  }

  const totalDecks = decks.length;
  const rows = [];
  
   for (const g of groups.values()) {
    const ds = g.decks;
	
	const totalWins = ds.reduce((sum, d) => sum + (d.wins || 0), 0);
    const totalLosses = ds.reduce((sum, d) => sum + (d.losses || 0), 0);
    const totalMatches = totalWins + totalLosses;
    const winRate = totalMatches > 0 ? (totalWins / totalMatches) * 100 : null;
    
    const placements = ds.map((d) => (Number.isFinite(d.placement) ? d.placement : null)).filter((x) => x !== null);
    const avgPlacement = placements.length ? placements.reduce((a, b) => a + b, 0) / placements.length : null;

    const top8 = ds.filter((d) => (d.placement ?? 9999) <= 8).length;
    const top16 = ds.filter((d) => (d.placement ?? 9999) <= 16).length;
    const top32 = ds.filter((d) => (d.placement ?? 9999) <= 32).length;

    const top8Rate = ds.length ? (top8 / ds.length) * 100 : 0;
    const top16Rate = ds.length ? (top16 / ds.length) * 100 : 0;
    const top32Rate = ds.length ? (top32 / ds.length) * 100 : 0;

    const metaShare = (ds.length / totalDecks) * 100;
    const placementScore = avgPlacement ? clamp(100 - avgPlacement, 0, 100) : 0;
	
	const winRateFactor = winRate ? winRate * 0.2 : 0;  // 20% do cálculo
    const power = clamp(
      metaShare * 0.25 + 
      top8Rate * 0.25 + 
      top16Rate * 0.15 + 
      placementScore * 0.15 +
      winRateFactor,  // ← NOVO: Incluir win rate
      0,
      100
    );

    rows.push({
      archetype: g.archetype,
      inks: g.inks,
      total_decks: ds.length,
	  
	  total_wins: totalWins,           // ← NOVO
      total_losses: totalLosses,       // ← NOVO
      win_rate: winRate ? Number(winRate.toFixed(2)) : null,  // ← NOVO
      
      top4_count: ds.filter((d) => (d.placement ?? 9999) <= 4).length,
      top8_count: top8,
      top16_count: top16,
      top32_count: top32,
      top8_rate: Number(top8Rate.toFixed(2)),
      top16_rate: Number(top16Rate.toFixed(2)),
      top32_rate: Number(top32Rate.toFixed(2)),
      avg_placement: avgPlacement ? Number(avgPlacement.toFixed(2)) : null,
      meta_share: Number(metaShare.toFixed(2)),
      power_level: Number(power.toFixed(2)),
      tier: power >= 80 ? "S" : power >= 60 ? "A" : power >= 40 ? "B" : power >= 20 ? "C" : "D",
      trend: "Stable",
      trend_delta: 0,
      matchups: null,
      last_calculated: now,
      updated_at: now,
//═══════════════════════════════════════════════════════════
// TIER LIST
//═══════════════════════════════════════════════════════════

router.get('/tier-list', async (req, res) => {
  try {
    const rawDays = req.query.days || 30;
    const days = validateDays(rawDays);
    
    console.log(`🏆 Fetching tier list (${days} days)`);
    
    const { data, error } = await supabase
      .from('archetype_meta')
      .select('*')
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
      .single();

    if (archError) throw archError;

    const { data: recentDecks, error: decksError } = await supabase
      .from('decks')
      .select('*')
      .eq('archetype', name)
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

//═══════════════════════════════════════════════════════════

module.exports = router;

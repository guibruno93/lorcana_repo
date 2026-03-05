/**
 * backend/routes/meta-analysis.js
 * API routes for tournament scraping, win rate tracking, and tier lists
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const tournamentScraper = require('../services/tournament-scraper');
const metaAnalyzer = require('../services/meta-analyzer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ═══════════════════════════════════════════════════════════
// SCRAPING ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/meta-analysis/scrape
 * Trigger tournament scraping
 */
router.post('/scrape', async (req, res) => {
  try {
    const { limit = 20 } = req.body;

    const result = await tournamentScraper.scrapeRecentTournaments(limit);

    res.json({
      success: true,
      message: 'Scraping completed',
      ...result
    });

  } catch (err) {
    console.error('Scraping endpoint error:', err);
    res.status(500).json({
      error: 'Failed to scrape tournaments',
      details: err.message
    });
  }
});

/**
 * GET /api/meta-analysis/scraping-jobs
 * Get recent scraping jobs status
 */
router.get('/scraping-jobs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('scraping_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    res.json({ jobs: data });

  } catch (err) {
    console.error('Get jobs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// ANALYSIS ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/meta-analysis/analyze
 * Run complete meta analysis
 */
router.post('/analyze', async (req, res) => {
  try {
    const results = await metaAnalyzer.analyzeCompleteMeta();

    res.json({
      success: true,
      message: 'Analysis completed',
      results
    });

  } catch (err) {
    console.error('Analysis endpoint error:', err);
    res.status(500).json({
      error: 'Failed to analyze meta',
      details: err.message
    });
  }
});

/**
 * GET /api/meta-analysis/tier-list
 * Get current tier list
 */
router.get('/tier-list', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('archetype_meta')
      .select('*')
      .order('power_level', { ascending: false });

    if (error) throw error;

    // Group by tier
    const tierList = {
      S: data.filter(a => a.tier === 'S'),
      A: data.filter(a => a.tier === 'A'),
      B: data.filter(a => a.tier === 'B'),
      C: data.filter(a => a.tier === 'C'),
      D: data.filter(a => a.tier === 'D')
    };

    res.json({
      tierList,
      lastUpdated: data[0]?.last_calculated || null
    });

  } catch (err) {
    console.error('Tier list error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/meta-analysis/archetype/:name
 * Get detailed stats for specific archetype
 */
router.get('/archetype/:name', async (req, res) => {
  try {
    const { name } = req.params;

    const { data, error } = await supabase
      .from('archetype_meta')
      .select('*')
      .eq('archetype', name)
      .single();

    if (error) throw error;

    // Get recent decks
    const { data: decks } = await supabase
      .from('decks')
      .select('*, tournaments(*)')
      .eq('archetype', name)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get tier history
    const { data: history } = await supabase
      .from('tier_list_history')
      .select('*')
      .eq('archetype', name)
      .order('snapshot_date', { ascending: false })
      .limit(30);

    res.json({
      archetype: data,
      recentDecks: decks || [],
      tierHistory: history || []
    });

  } catch (err) {
    console.error('Archetype details error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/meta-analysis/cards/top
 * Get top cards by meta share
 */
router.get('/cards/top', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const { data, error } = await supabase
      .from('cards_meta')
      .select('*')
      .order('meta_share', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    res.json({ cards: data });

  } catch (err) {
    console.error('Top cards error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/meta-analysis/trends
 * Get current meta trends
 */
router.get('/trends', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('archetype_meta')
      .select('archetype, trend, trend_delta, meta_share, tier')
      .not('trend', 'is', null)
      .order('trend_delta', { ascending: false });

    if (error) throw error;

    const trends = {
      rising: data.filter(a => a.trend === 'rising'),
      falling: data.filter(a => a.trend === 'falling'),
      stable: data.filter(a => a.trend === 'stable')
    };

    res.json({ trends });

  } catch (err) {
    console.error('Trends error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/meta-analysis/win-rates
 * Get archetype win rates
 */
router.get('/win-rates', async (req, res) => {
  try {
    const { minDecks = 5 } = req.query;

    const { data, error } = await supabase
      .from('archetype_meta')
      .select('archetype, win_rate, total_decks, top8_count, meta_share')
      .gte('total_decks', parseInt(minDecks))
      .order('win_rate', { ascending: false });

    if (error) throw error;

    res.json({ winRates: data });

  } catch (err) {
    console.error('Win rates error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/meta-analysis/tournaments/recent
 * Get recent tournaments
 */
router.get('/tournaments/recent', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const { data, error } = await supabase
      .from('tournaments')
      .select('*, decks(count)')
      .order('date', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    res.json({ tournaments: data });

  } catch (err) {
    console.error('Recent tournaments error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// DASHBOARD ENDPOINT (Enhanced)
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/meta-analysis/dashboard
 * Get complete dashboard data
 */
router.post('/dashboard', async (req, res) => {
  try {
    const { filter = 'all', days = 30 } = req.body;

    // Calculate date filter
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get archetypes
    const { data: archetypes } = await supabase
      .from('archetype_meta')
      .select('*')
      .order('meta_share', { ascending: false });

    // Get top cards
    const { data: topCards } = await supabase
      .from('cards_meta')
      .select('*')
      .order('meta_share', { ascending: false })
      .limit(20);

    // Get tier list
    const { data: tierData } = await supabase
      .from('archetype_meta')
      .select('archetype, tier, power_level, win_rate, meta_share')
      .not('tier', 'is', null)
      .order('power_level', { ascending: false });

    const tierList = {
      S: tierData?.filter(a => a.tier === 'S') || [],
      A: tierData?.filter(a => a.tier === 'A') || [],
      B: tierData?.filter(a => a.tier === 'B') || [],
      C: tierData?.filter(a => a.tier === 'C') || [],
      D: tierData?.filter(a => a.tier === 'D') || []
    };

    // Get trends
    const { data: trendsData } = await supabase
      .from('archetype_meta')
      .select('archetype, trend, trend_delta, meta_share')
      .not('trend', 'is', null)
      .order('trend_delta', { ascending: false })
      .limit(10);

    // Calculate stats
    const totalDecks = archetypes?.reduce((sum, a) => sum + (a.total_decks || 0), 0) || 0;
    const uniqueArchetypes = archetypes?.length || 0;
    const topArchetype = archetypes?.[0];

    res.json({
      stats: {
        totalDecks,
        uniqueArchetypes,
        topDeckShare: topArchetype?.meta_share || 0,
        avgWinRate: archetypes?.reduce((sum, a) => sum + (a.win_rate || 0), 0) / (archetypes?.length || 1) || 50
      },
      archetypes: archetypes || [],
      topCards: topCards || [],
      tierList,
      trends: {
        rising: trendsData?.filter(t => t.trend === 'rising') || [],
        falling: trendsData?.filter(t => t.trend === 'falling') || []
      }
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

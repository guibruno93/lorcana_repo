const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { authenticateToken } = require('./auth');
const { InkdecksScraper, deckToScrapedDeckRow } = require('../services/scrapers/inkdecks-puppeteer-scraper');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/** Se META_SCRAPE_ADMIN_EMAILS estiver definido (emails separados por vírgula), só eles podem usar scrape/status. */
function requireMetaScrapeAccess(req, res, next) {
  const raw = (process.env.META_SCRAPE_ADMIN_EMAILS || '').trim();
  if (!raw) return next();
  const allowed = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const email = (req.user && req.user.email && String(req.user.email).toLowerCase()) || '';
  if (!allowed.includes(email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
}

// TEST ROUTE
router.get('/test', (req, res) => {
  res.json({ 
    ok: true, 
    message: 'Meta-analysis routes working!',
    timestamp: new Date().toISOString()
  });
});

// DASHBOARD ROUTE
router.get('/dashboard', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    console.log(`📊 Fetching dashboard data (last ${days} days)...`);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    const { data: metaData, error } = await supabase
      .from('meta_analysis')
      .select('*')
      .gte('analyzed_at', cutoffDate.toISOString())
      .order('play_rate', { ascending: false });
    
    if (error) {
      console.error('❌ Dashboard error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    
    console.log(`✅ Found ${metaData?.length || 0} archetypes`);
    
    const totalDecks = metaData?.reduce((sum, d) => sum + (d.sample_size || 0), 0) || 0;
    const avgWinrate = metaData?.length > 0 
      ? metaData.reduce((sum, d) => sum + (d.expected_winrate || 50), 0) / metaData.length 
      : 50;
    
    const topArchetypes = (metaData || []).slice(0, 8).map(d => ({
      archetype: d.archetype,
      playRate: parseFloat(d.play_rate || 0).toFixed(1),
      winrate: parseFloat(d.expected_winrate || 50).toFixed(1),
      sampleSize: d.sample_size || 0,
      topCards: d.top_cards || []
    }));
    
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

// TIER LIST ROUTE
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
        error: error.message
      });
    }
    
    const tierList = { S: [], A: [], B: [], C: [], D: [] };
    
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

// TRENDS ROUTE
router.get('/trends', async (req, res) => {
  try {
    console.log('📈 Fetching trends...');
    
    // Para calcular trends, precisaríamos de dados históricos
    // Por enquanto, vamos usar winrate vs 50% como proxy de "trend"
    // Arquétipos com winrate > 52% = rising
    // Arquétipos com winrate < 48% = falling
    
    const { data: metaData, error } = await supabase
      .from('meta_analysis')
      .select('*')
      .order('play_rate', { ascending: false });
    
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    
    const rising = [];
    const falling = [];
    
    for (const deck of metaData || []) {
      const playRate = parseFloat(deck.play_rate) || 0;
      const winrate = parseFloat(deck.expected_winrate) || 50;
      
      // Calcular "trend_delta" baseado em quão longe está de 50%
      const trendDelta = (winrate - 50).toFixed(1);
      
      const trendItem = {
        archetype: deck.archetype,
        trend_delta: parseFloat(trendDelta),
        meta_share: playRate,
        winrate: winrate.toFixed(1)
      };
      
      if (winrate > 52) {
        rising.push(trendItem);
      } else if (winrate < 48) {
        falling.push(trendItem);
      }
    }
    
    // Ordenar rising por trend_delta (decrescente)
    rising.sort((a, b) => b.trend_delta - a.trend_delta);
    
    // Ordenar falling por trend_delta (crescente - mais negativo primeiro)
    falling.sort((a, b) => a.trend_delta - b.trend_delta);
    
    console.log(`✅ Trends: ${rising.length} rising, ${falling.length} falling`);
    
    res.json({
      success: true,
      trends: {
        rising: rising.slice(0, 10),
        falling: falling.slice(0, 10)
      },
      timestamp: new Date().toISOString(),
      note: 'Trend calculation based on winrate vs 50% baseline. Historical tracking coming soon.'
    });
    
  } catch (err) {
    console.error('❌ /trends error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// TOP CARDS - QUERY PARAM (SEMPRE FUNCIONA)
router.get('/archetype/top-cards', async (req, res) => {
  try {
    const { name, limit = 8 } = req.query;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Archetype name is required',
        hint: 'Use ?name=Sapphire/Steel&limit=8'
      });
    }
    
    console.log(`🔍 Fetching top cards for: ${name}`);
    
    const { data: metaData, error } = await supabase
      .from('meta_analysis')
      .select('top_cards, archetype')
      .eq('archetype', name)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.json({
          success: true,
          archetype: name,
          topCards: [],
          message: 'No data for this archetype'
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    
    const topCards = (metaData?.top_cards || []).slice(0, parseInt(limit));
    
    console.log(`✅ Found ${topCards.length} cards for ${name}`);
    
    res.json({
      success: true,
      archetype: name,
      topCards,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error(`❌ /archetype/top-cards error:`, err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// TOP CARDS - WILDCARD PATH (ACEITA SAPPHIRE/STEEL SEM ENCODING)
// IMPORTANTE: Deve vir DEPOIS de outras rotas /archetype/* para não conflitar
router.get('/archetype/*/top-cards', async (req, res) => {
  try {
    // Extrair archetype do path
    // URL: /archetype/Sapphire/Steel/top-cards
    // req.path: /archetype/Sapphire/Steel/top-cards
    const pathParts = req.path.split('/');
    const archetypeStartIndex = pathParts.indexOf('archetype') + 1;
    const topCardsIndex = pathParts.indexOf('top-cards');
    
    // Juntar tudo entre 'archetype' e 'top-cards'
    const archetypeParts = pathParts.slice(archetypeStartIndex, topCardsIndex);
    const archetype = archetypeParts.join('/');
    
    console.log(`🔍 Wildcard route - Fetching top cards for: ${archetype}`);
    
    const { limit = 8 } = req.query;
    
    const { data: metaData, error } = await supabase
      .from('meta_analysis')
      .select('top_cards, archetype')
      .eq('archetype', archetype)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.json({
          success: true,
          archetype,
          topCards: [],
          message: 'No data for this archetype'
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    
    const topCards = (metaData?.top_cards || []).slice(0, parseInt(limit));
    
    console.log(`✅ Found ${topCards.length} cards for ${archetype}`);
    
    res.json({
      success: true,
      archetype,
      topCards,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error(`❌ Wildcard archetype route error:`, err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /api/meta-analysis/scrape — Inkdecks (streaming NDJSON)
// ═══════════════════════════════════════════════════════════════════

router.post(
  '/scrape',
  authenticateToken,
  requireMetaScrapeAccess,
  async (req, res) => {
    const { limit = 50 } = req.body || {};

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendEvent = (data) => {
      res.write(`${JSON.stringify(data)}\n`);
    };

    try {
      sendEvent({
        type: 'log',
        level: 'info',
        message: 'Inicializando scraper Inkdecks…',
      });

      const scraper = new InkdecksScraper();
      const decks = await scraper.scrapeDecks(limit, (event) => {
        sendEvent(event);
      });

      sendEvent({
        type: 'log',
        level: 'success',
        message: `Scraped ${decks.length} decks`,
      });

      if (decks.length > 0) {
        const rows = decks.map(deckToScrapedDeckRow);
        const { error } = await supabase.from('scraped_decks').insert(rows);

        if (error) {
          sendEvent({
            type: 'log',
            level: 'error',
            message: `Erro no banco: ${error.message}`,
          });
        } else {
          sendEvent({
            type: 'log',
            level: 'success',
            message: 'Salvo em scraped_decks',
          });
        }
      }

      sendEvent({
        type: 'complete',
        total: decks.length,
      });
    } catch (err) {
      console.error('Scraper error:', err);
      sendEvent({
        type: 'log',
        level: 'error',
        message: err.message || String(err),
      });
    } finally {
      res.end();
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// GET /api/meta-analysis/scraper-status
// ═══════════════════════════════════════════════════════════════════

router.get(
  '/scraper-status',
  authenticateToken,
  requireMetaScrapeAccess,
  async (req, res) => {
    try {
      const { data: lastRows, error: lastErr } = await supabase
        .from('scraped_decks')
        .select('scraped_at')
        .order('scraped_at', { ascending: false })
        .limit(1);

      if (lastErr) {
        console.error('scraper-status last scrape:', lastErr);
        return res.status(500).json({ error: 'Failed to fetch status' });
      }

      const { count: totalDecks, error: countErr } = await supabase
        .from('scraped_decks')
        .select('*', { count: 'exact', head: true });

      if (countErr) {
        console.error('scraper-status count:', countErr);
        return res.status(500).json({ error: 'Failed to fetch status' });
      }

      const { data: archetypes, error: archErr } = await supabase
        .from('scraped_decks')
        .select('archetype')
        .not('archetype', 'is', null);

      if (archErr) {
        console.error('scraper-status archetypes:', archErr);
        return res.status(500).json({ error: 'Failed to fetch status' });
      }

      const uniqueArchetypes = [
        ...new Set(
          (archetypes || []).map((d) => d.archetype).filter(Boolean)
        ),
      ];

      res.json({
        last_scrape: lastRows?.[0]?.scraped_at || null,
        total_decks: totalDecks ?? 0,
        archetypes: uniqueArchetypes.length,
        archetype_list: uniqueArchetypes,
      });
    } catch (err) {
      console.error('Status error:', err);
      res.status(500).json({ error: 'Failed to fetch status' });
    }
  }
);

module.exports = router;

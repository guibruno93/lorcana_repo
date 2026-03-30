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

// ═══════════════════════════════════════════════════════════════════
// GET /api/meta-analysis/meta-share — agregado por scraped_decks (público)
// ═══════════════════════════════════════════════════════════════════

router.get('/meta-share', async (req, res) => {
  try {
    console.log('📊 Calculating meta share from scraped_decks...');

    const { data: decks, error } = await supabase
      .from('scraped_decks')
      .select('archetype, wins, losses, deck_name, scraped_at')
      .order('scraped_at', { ascending: false });

    if (error) throw error;

    const rows = decks || [];
    const archetypeStats = {};

    rows.forEach((deck) => {
      const arch = deck.archetype || 'Unknown';
      if (!archetypeStats[arch]) {
        archetypeStats[arch] = {
          archetype: arch,
          deck_count: 0,
          total_games: 0,
          total_wins: 0,
          total_losses: 0,
          decks_with_record: 0,
        };
      }
      const stats = archetypeStats[arch];
      stats.deck_count += 1;
      if (deck.wins != null && deck.losses != null) {
        stats.total_wins += deck.wins;
        stats.total_losses += deck.losses;
        stats.total_games += deck.wins + deck.losses;
        stats.decks_with_record += 1;
      }
    });

    const totalDecks = rows.length;
    const metaShare = Object.values(archetypeStats).map((stats) => {
      const winRate =
        stats.total_games > 0
          ? (stats.total_wins / stats.total_games) * 100
          : null;
      return {
        archetype: stats.archetype,
        deck_count: stats.deck_count,
        meta_share: totalDecks
          ? ((stats.deck_count / totalDecks) * 100).toFixed(1)
          : '0.0',
        win_rate: winRate != null ? winRate.toFixed(1) : null,
        total_games: stats.total_games,
        total_wins: stats.total_wins,
        total_losses: stats.total_losses,
        avg_games_per_deck:
          stats.decks_with_record > 0
            ? (stats.total_games / stats.decks_with_record).toFixed(1)
            : null,
      };
    });

    metaShare.sort((a, b) => b.deck_count - a.deck_count);

    console.log(`✅ Meta share: ${metaShare.length} archetypes`);

    res.json({
      success: true,
      total_decks: totalDecks,
      archetypes: metaShare,
      meta: {
        last_update: rows[0]?.scraped_at || null,
        total_archetypes: metaShare.length,
        source: 'scraped_decks',
      },
    });
  } catch (err) {
    console.error('❌ /meta-share error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /api/meta-analysis/scraped-tier-list — tiers por performance em scraped_decks
// (não confundir com GET /tier-list que usa meta_analysis)
// ═══════════════════════════════════════════════════════════════════

router.get('/scraped-tier-list', async (req, res) => {
  try {
    const minGames = Math.max(
      1,
      parseInt(req.query.min_games || '10', 10) || 10
    );
    console.log(
      `🏆 Generating scraped-decks tier list (min_games=${minGames})...`
    );

    const { data: decks, error } = await supabase
      .from('scraped_decks')
      .select('archetype, wins, losses, deck_name')
      .order('scraped_at', { ascending: false });

    if (error) throw error;

    const rows = decks || [];
    const archetypeStats = {};

    rows.forEach((deck) => {
      const arch = deck.archetype || 'Unknown';
      if (!archetypeStats[arch]) {
        archetypeStats[arch] = {
          archetype: arch,
          deck_count: 0,
          total_wins: 0,
          total_losses: 0,
          total_games: 0,
        };
      }
      const stats = archetypeStats[arch];
      stats.deck_count += 1;
      if (deck.wins != null && deck.losses != null) {
        stats.total_wins += deck.wins;
        stats.total_losses += deck.losses;
        stats.total_games += deck.wins + deck.losses;
      }
    });

    let tierData = Object.values(archetypeStats)
      .filter((stats) => stats.total_games >= minGames)
      .map((stats) => {
        const winRate = stats.total_wins / stats.total_games;
        const metaShare = rows.length ? stats.deck_count / rows.length : 0;
        const tierScore = winRate * 0.7 + metaShare * 0.3;
        return {
          archetype: stats.archetype,
          win_rate: (winRate * 100).toFixed(1),
          meta_share: (metaShare * 100).toFixed(1),
          deck_count: stats.deck_count,
          total_games: stats.total_games,
          tier_score: tierScore,
          tier: null,
        };
      })
      .sort((a, b) => b.tier_score - a.tier_score);

    let effectiveMin = minGames;
    if (tierData.length === 0 && minGames > 1) {
      effectiveMin = 1;
      tierData = Object.values(archetypeStats)
        .filter((stats) => stats.total_games >= 1)
        .map((stats) => {
          const winRate = stats.total_wins / stats.total_games;
          const metaShare = rows.length ? stats.deck_count / rows.length : 0;
          const tierScore = winRate * 0.7 + metaShare * 0.3;
          return {
            archetype: stats.archetype,
            win_rate: (winRate * 100).toFixed(1),
            meta_share: (metaShare * 100).toFixed(1),
            deck_count: stats.deck_count,
            total_games: stats.total_games,
            tier_score: tierScore,
            tier: null,
          };
        })
        .sort((a, b) => b.tier_score - a.tier_score);
    }

    const tierCount = tierData.length;
    tierData.forEach((item, index) => {
      if (tierCount === 0) return;
      const percentile = index / tierCount;
      if (percentile < 0.15) item.tier = 'S';
      else if (percentile < 0.35) item.tier = 'A';
      else if (percentile < 0.6) item.tier = 'B';
      else if (percentile < 0.85) item.tier = 'C';
      else item.tier = 'D';
    });

    const tierList = {
      S: tierData.filter((d) => d.tier === 'S'),
      A: tierData.filter((d) => d.tier === 'A'),
      B: tierData.filter((d) => d.tier === 'B'),
      C: tierData.filter((d) => d.tier === 'C'),
      D: tierData.filter((d) => d.tier === 'D'),
    };

    console.log(
      `✅ Scraped tier list: S=${tierList.S.length}, A=${tierList.A.length}, B=${tierList.B.length}`
    );

    res.json({
      success: true,
      tier_list: tierList,
      all_archetypes: tierData,
      meta: {
        total_archetypes: tierData.length,
        total_decks: rows.length,
        minimum_games_requested: minGames,
        minimum_games_effective: effectiveMin,
        source: 'scraped_decks',
      },
    });
  } catch (err) {
    console.error('❌ /scraped-tier-list error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
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
// GET /api/meta-analysis/decks — cache-first (Supabase, público)
// ═══════════════════════════════════════════════════════════════════

router.get('/decks', async (req, res) => {
  try {
    console.log('📊 Fetching cached decks from Supabase...');

    const { data, error, count } = await supabase
      .from('scraped_decks')
      .select('*', { count: 'exact' })
      .order('scraped_at', { ascending: false });

    if (error) {
      console.error('❌ Supabase error:', error);
      throw error;
    }

    const rows = data || [];
    const lastUpdate = rows[0]?.scraped_at || null;
    const ageMs = lastUpdate
      ? Date.now() - new Date(lastUpdate).getTime()
      : null;
    const ageHours = ageMs != null ? (ageMs / 3600000).toFixed(1) : null;

    const archetypes = {};
    rows.forEach((deck) => {
      const arch = deck.archetype || 'Unknown';
      archetypes[arch] = (archetypes[arch] || 0) + 1;
    });

    console.log(
      `✅ Returned ${count ?? rows.length} decks (cache age: ${ageHours ?? 'n/a'}h)`
    );

    res.json({
      success: true,
      decks: rows,
      meta: {
        total: count ?? rows.length,
        archetypes: Object.keys(archetypes).length,
        last_update: lastUpdate,
        cache_age_hours: ageHours != null ? parseFloat(ageHours) : null,
        next_scheduled_update: 'Every 12 hours (00:00 & 12:00 UTC)',
        archetype_distribution: archetypes,
      },
    });
  } catch (err) {
    console.error('❌ Error fetching decks:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /api/meta-analysis/cache-status — estado do cache (público)
// ═══════════════════════════════════════════════════════════════════

router.get('/cache-status', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('scraped_decks')
      .select('scraped_at')
      .order('scraped_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    const lastUpdate = data?.[0]?.scraped_at || null;
    const ageMs = lastUpdate
      ? Date.now() - new Date(lastUpdate).getTime()
      : null;
    const ageHours = ageMs != null ? (ageMs / 3600000).toFixed(1) : null;
    const ageNum = ageHours != null ? parseFloat(ageHours) : null;

    const now = new Date();
    const currentHour = now.getUTCHours();
    const nextRun =
      currentHour < 12 ? '12:00 UTC' : '00:00 UTC (next day)';

    res.json({
      success: true,
      cache: {
        last_update: lastUpdate,
        age_hours: ageNum,
        is_fresh: ageNum != null && ageNum < 12,
        next_scheduled_run: nextRun,
        scraper_location: 'GitHub Actions (automated)',
        update_frequency: 'Every 12 hours',
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
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
      let savedPages = 0;
      const decks = await scraper.scrapeDecks(limit, async (event) => {
        if (event.type === 'pageComplete') {
          const { decks: pageDecks, ...meta } = event;
          if (pageDecks && pageDecks.length > 0) {
            const rows = pageDecks.map(deckToScrapedDeckRow);
            const { error } = await supabase.from('scraped_decks').insert(rows);
            if (error) {
              sendEvent({
                type: 'log',
                level: 'error',
                message: `Erro no banco (página ${meta.page}): ${error.message}`,
              });
            } else {
              savedPages += 1;
              sendEvent({
                type: 'log',
                level: 'success',
                message: `Página ${meta.page}: ${rows.length} deck(s) guardados em scraped_decks`,
              });
            }
          }
          sendEvent(meta);
          return;
        }
        sendEvent(event);
      });

      sendEvent({
        type: 'log',
        level: 'success',
        message: `Scraped ${decks.length} decks`,
      });

      if (decks.length > 0 && savedPages === 0) {
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

/**
 * backend/services/meta-analyzer.js
 * Win rate tracking, tier list generation, and meta analysis
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ═══════════════════════════════════════════════════════════
// META ANALYZER
// ═══════════════════════════════════════════════════════════

class MetaAnalyzer {
  constructor() {
    this.daysToAnalyze = 30; // Default: last 30 days
  }

  /**
   * Run complete meta analysis
   */
  async analyzeCompleteMeta() {
    try {
      console.log('📊 Starting complete meta analysis...');

      const results = {
        archetypes: await this.analyzeArchetypes(),
        cards: await this.analyzeCards(),
        tierList: await this.generateTierList(),
        trends: await this.analyzeTrends()
      };

      console.log('✅ Meta analysis completed');
      return results;

    } catch (err) {
      console.error('Meta analysis error:', err);
      throw err;
    }
  }

  /**
   * Analyze archetype performance
   */
  async analyzeArchetypes() {
    try {
      console.log('🔍 Analyzing archetypes...');

      // Get decks from last N days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.daysToAnalyze);

      const { data: decks, error } = await supabase
        .from('decks')
        .select(`
          archetype,
          inks,
          placement,
          wins,
          losses,
          draws,
          win_rate,
          tournament_id
        `)
        .gte('created_at', cutoffDate.toISOString());

      if (error) throw error;

      // Group by archetype
      const archetypeMap = new Map();

      for (const deck of decks) {
        const archetype = deck.archetype || 'Unknown';

        if (!archetypeMap.has(archetype)) {
          archetypeMap.set(archetype, {
            archetype,
            inks: deck.inks || [],
            decks: [],
            total_wins: 0,
            total_losses: 0,
            total_draws: 0,
            placements: []
          });
        }

        const stats = archetypeMap.get(archetype);
        stats.decks.push(deck);
        stats.total_wins += deck.wins || 0;
        stats.total_losses += deck.losses || 0;
        stats.total_draws += deck.draws || 0;
        if (deck.placement) stats.placements.push(deck.placement);
      }

      // Calculate metrics for each archetype
      const archetypes = [];

      for (const [archetype, stats] of archetypeMap) {
        const totalGames = stats.total_wins + stats.total_losses + stats.total_draws;
        const winRate = totalGames > 0
          ? ((stats.total_wins + stats.total_draws * 0.5) / totalGames * 100).toFixed(2)
          : 0;

        const top4Count = stats.placements.filter(p => p <= 4).length;
        const top8Count = stats.placements.filter(p => p <= 8).length;
        const top16Count = stats.placements.filter(p => p <= 16).length;

        const avgPlacement = stats.placements.length > 0
          ? (stats.placements.reduce((a, b) => a + b, 0) / stats.placements.length).toFixed(2)
          : 0;

        const metaShare = (stats.decks.length / decks.length * 100).toFixed(2);

        archetypes.push({
          archetype,
          inks: stats.inks,
          total_decks: stats.decks.length,
          total_wins: stats.total_wins,
          total_losses: stats.total_losses,
          win_rate: parseFloat(winRate),
          top4_count: top4Count,
          top8_count: top8Count,
          top16_count: top16Count,
          avg_placement: parseFloat(avgPlacement),
          meta_share: parseFloat(metaShare),
          last_calculated: new Date().toISOString()
        });
      }

      // Upsert to database
      if (archetypes.length > 0) {
        await this.upsertArchetypeMeta(archetypes);
      }

      console.log(`✅ Analyzed ${archetypes.length} archetypes`);
      return archetypes;

    } catch (err) {
      console.error('Archetype analysis error:', err);
      throw err;
    }
  }

  /**
   * Analyze card performance
   */
  async analyzeCards() {
    try {
      console.log('🃏 Analyzing cards...');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.daysToAnalyze);

      const { data: decks, error } = await supabase
        .from('decks')
        .select('decklist, wins, losses')
        .gte('created_at', cutoffDate.toISOString())
        .not('decklist', 'is', null);

      if (error) throw error;

      // Aggregate card stats
      const cardMap = new Map();

      for (const deck of decks) {
        if (!deck.decklist || !Array.isArray(deck.decklist)) continue;

        const deckWon = (deck.wins || 0) > (deck.losses || 0);

        for (const card of deck.decklist) {
          const cardName = card.name;
          const quantity = card.quantity || 1;

          if (!cardMap.has(cardName)) {
            cardMap.set(cardName, {
              card_name: cardName,
              total_decks: 0,
              total_copies: 0,
              decks_with_wins: 0,
              decks_with_losses: 0
            });
          }

          const stats = cardMap.get(cardName);
          stats.total_decks++;
          stats.total_copies += quantity;
          
          if (deckWon) stats.decks_with_wins++;
          else stats.decks_with_losses++;
        }
      }

      // Calculate metrics
      const cards = [];
      const totalDecks = decks.length;

      for (const [cardName, stats] of cardMap) {
        const avgCopies = (stats.total_copies / stats.total_decks).toFixed(1);
        const metaShare = (stats.total_decks / totalDecks * 100).toFixed(2);
        
        const totalMatches = stats.decks_with_wins + stats.decks_with_losses;
        const winRate = totalMatches > 0
          ? (stats.decks_with_wins / totalMatches * 100).toFixed(2)
          : 0;

        cards.push({
          card_name: cardName,
          total_decks: stats.total_decks,
          total_copies: stats.total_copies,
          avg_copies: parseFloat(avgCopies),
          meta_share: parseFloat(metaShare),
          win_rate: parseFloat(winRate),
          last_calculated: new Date().toISOString()
        });
      }

      // Sort by meta share
      cards.sort((a, b) => b.meta_share - a.meta_share);

      // Upsert top 1000 cards
      if (cards.length > 0) {
        await this.upsertCardsMeta(cards.slice(0, 1000));
      }

      console.log(`✅ Analyzed ${cards.length} cards`);
      return cards;

    } catch (err) {
      console.error('Card analysis error:', err);
      throw err;
    }
  }

  /**
   * Generate tier list automatically
   */
  async generateTierList() {
    try {
      console.log('🏆 Generating tier list...');

      // Get archetype meta
      const { data: archetypes, error } = await supabase
        .from('archetype_meta')
        .select('*')
        .order('meta_share', { ascending: false });

      if (error) throw error;

      // Calculate power level for each archetype
      const tierList = archetypes.map(archetype => {
        const powerLevel = this.calculatePowerLevel(archetype);
        const tier = this.assignTier(powerLevel);

        return {
          ...archetype,
          power_level: powerLevel,
          tier
        };
      });

      // Update database
      for (const archetype of tierList) {
        await supabase
          .from('archetype_meta')
          .update({
            power_level: archetype.power_level,
            tier: archetype.tier
          })
          .eq('archetype', archetype.archetype);

        // Save to history
        await supabase
          .from('tier_list_history')
          .insert([{
            archetype: archetype.archetype,
            tier: archetype.tier,
            power_level: archetype.power_level,
            meta_share: archetype.meta_share,
            win_rate: archetype.win_rate,
            snapshot_date: new Date().toISOString().split('T')[0]
          }]);
      }

      console.log('✅ Tier list generated');
      return tierList;

    } catch (err) {
      console.error('Tier list generation error:', err);
      throw err;
    }
  }

  /**
   * Calculate power level (0-100)
   */
  calculatePowerLevel(archetype) {
    const {
      meta_share = 0,
      win_rate = 50,
      top8_count = 0,
      total_decks = 1,
      avg_placement = 50
    } = archetype;

    // Weighted scoring
    const shareScore = Math.min(meta_share * 2, 30); // Max 30 points
    const winRateScore = Math.min((win_rate - 40) * 0.8, 30); // Max 30 points
    const top8Rate = (top8_count / total_decks) * 100;
    const top8Score = Math.min(top8Rate, 20); // Max 20 points
    const placementScore = Math.max(20 - avg_placement / 2, 0); // Max 20 points

    const powerLevel = Math.round(
      shareScore + winRateScore + top8Score + placementScore
    );

    return Math.max(0, Math.min(100, powerLevel));
  }

  /**
   * Assign tier based on power level
   */
  assignTier(powerLevel) {
    if (powerLevel >= 80) return 'S';
    if (powerLevel >= 65) return 'A';
    if (powerLevel >= 50) return 'B';
    if (powerLevel >= 35) return 'C';
    return 'D';
  }

  /**
   * Analyze trends
   */
  async analyzeTrends() {
    try {
      console.log('📈 Analyzing trends...');

      // Compare last 7 days vs previous 7 days
      const now = new Date();
      const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const prev7Days = new Date(now - 14 * 24 * 60 * 60 * 1000);

      // Get current period data
      const { data: currentDecks } = await supabase
        .from('decks')
        .select('archetype')
        .gte('created_at', last7Days.toISOString());

      // Get previous period data
      const { data: previousDecks } = await supabase
        .from('decks')
        .select('archetype')
        .gte('created_at', prev7Days.toISOString())
        .lt('created_at', last7Days.toISOString());

      // Calculate trends
      const currentMap = this.groupByArchetype(currentDecks || []);
      const previousMap = this.groupByArchetype(previousDecks || []);

      const trends = [];

      for (const [archetype, currentCount] of currentMap) {
        const previousCount = previousMap.get(archetype) || 0;
        
        const delta = previousCount > 0
          ? ((currentCount - previousCount) / previousCount * 100).toFixed(2)
          : 100;

        const trend = this.determineTrend(parseFloat(delta));

        trends.push({
          archetype,
          trend,
          trend_delta: parseFloat(delta)
        });

        // Update archetype_meta
        await supabase
          .from('archetype_meta')
          .update({ trend, trend_delta: parseFloat(delta) })
          .eq('archetype', archetype);
      }

      console.log('✅ Trends analyzed');
      return trends;

    } catch (err) {
      console.error('Trend analysis error:', err);
      throw err;
    }
  }

  /**
   * Helper: Group decks by archetype
   */
  groupByArchetype(decks) {
    const map = new Map();
    for (const deck of decks) {
      const archetype = deck.archetype || 'Unknown';
      map.set(archetype, (map.get(archetype) || 0) + 1);
    }
    return map;
  }

  /**
   * Determine trend based on delta
   */
  determineTrend(delta) {
    if (delta > 10) return 'rising';
    if (delta < -10) return 'falling';
    return 'stable';
  }

  /**
   * Upsert archetype meta
   */
  async upsertArchetypeMeta(archetypes) {
    for (const archetype of archetypes) {
      await supabase
        .from('archetype_meta')
        .upsert(archetype, { onConflict: 'archetype' });
    }
  }

  /**
   * Upsert cards meta
   */
  async upsertCardsMeta(cards) {
    for (const card of cards) {
      await supabase
        .from('cards_meta')
        .upsert(card, { onConflict: 'card_name' });
    }
  }
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = new MetaAnalyzer();

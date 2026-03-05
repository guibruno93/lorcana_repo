/**
 * backend/services/tournament-scraper.js
 * Real-time tournament scraping from inkDecks.com
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ═══════════════════════════════════════════════════════════
// INKDECKS SCRAPER
// ═══════════════════════════════════════════════════════════

class TournamentScraper {
  constructor() {
    this.baseUrl = 'https://inkdecks.com';
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  }

  /**
   * Scrape recent tournaments from inkDecks
   */
  async scrapeRecentTournaments(limit = 20) {
    try {
      console.log('🔍 Scraping recent tournaments...');

      // Create scraping job
      const { data: job } = await supabase
        .from('scraping_jobs')
        .insert([{
          source: 'inkdecks',
          status: 'running',
          started_at: new Date().toISOString()
        }])
        .select()
        .single();

      let tournamentsScraped = 0;
      let decksScraped = 0;

      try {
        // Fetch tournaments page
        const response = await axios.get(`${this.baseUrl}/tournaments`, {
          headers: { 'User-Agent': this.userAgent }
        });

        const $ = cheerio.load(response.data);
        const tournaments = [];

        // Parse tournament list
        $('.tournament-item').each((i, elem) => {
          if (i >= limit) return false;

          const tournament = this.parseTournamentItem($, elem);
          if (tournament) {
            tournaments.push(tournament);
          }
        });

        // Scrape each tournament
        for (const tournament of tournaments) {
          try {
            await this.scrapeTournament(tournament);
            tournamentsScraped++;
          } catch (err) {
            console.error(`Error scraping tournament ${tournament.name}:`, err.message);
          }
        }

        // Count total decks
        const { count } = await supabase
          .from('decks')
          .select('*', { count: 'exact', head: true })
          .gte('scraped_at', job.started_at);

        decksScraped = count || 0;

        // Update job as completed
        await supabase
          .from('scraping_jobs')
          .update({
            status: 'completed',
            tournaments_found: tournamentsScraped,
            decks_scraped: decksScraped,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);

        console.log(`✅ Scraping completed: ${tournamentsScraped} tournaments, ${decksScraped} decks`);

        return {
          success: true,
          tournaments: tournamentsScraped,
          decks: decksScraped
        };

      } catch (err) {
        // Update job as failed
        await supabase
          .from('scraping_jobs')
          .update({
            status: 'failed',
            error_message: err.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);

        throw err;
      }

    } catch (err) {
      console.error('Scraping error:', err);
      throw err;
    }
  }

  /**
   * Parse tournament item from list
   */
  parseTournamentItem($, elem) {
    try {
      const name = $(elem).find('.tournament-name').text().trim();
      const dateStr = $(elem).find('.tournament-date').text().trim();
      const url = $(elem).find('a').attr('href');
      const playerCount = parseInt($(elem).find('.player-count').text()) || null;
      const location = $(elem).find('.location').text().trim() || null;

      if (!name || !url) return null;

      return {
        name,
        date: this.parseDate(dateStr),
        source_url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
        player_count: playerCount,
        location,
        format: this.detectFormat(name)
      };
    } catch (err) {
      console.error('Error parsing tournament item:', err);
      return null;
    }
  }

  /**
   * Scrape individual tournament
   */
  async scrapeTournament(tournamentData) {
    try {
      console.log(`📥 Scraping: ${tournamentData.name}`);

      // Check if already scraped
      const { data: existing } = await supabase
        .from('tournaments')
        .select('id')
        .eq('source_url', tournamentData.source_url)
        .single();

      if (existing) {
        console.log(`⏭️  Already scraped: ${tournamentData.name}`);
        return existing;
      }

      // Insert tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert([tournamentData])
        .select()
        .single();

      if (tournamentError) throw tournamentError;

      // Scrape decks
      const decks = await this.scrapeTournamentDecks(tournamentData.source_url);

      // Insert decks
      if (decks.length > 0) {
        const decksWithTournament = decks.map(deck => ({
          ...deck,
          tournament_id: tournament.id
        }));

        const { error: decksError } = await supabase
          .from('decks')
          .insert(decksWithTournament);

        if (decksError) throw decksError;
      }

      console.log(`✅ ${tournamentData.name}: ${decks.length} decks`);

      return tournament;

    } catch (err) {
      console.error(`Error scraping tournament:`, err);
      throw err;
    }
  }

  /**
   * Scrape decks from tournament page
   */
  async scrapeTournamentDecks(url) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent }
      });

      const $ = cheerio.load(response.data);
      const decks = [];

      // Parse standings
      $('.standings-row').each((i, elem) => {
        const deck = this.parseDeckRow($, elem);
        if (deck) {
          decks.push(deck);
        }
      });

      return decks;

    } catch (err) {
      console.error('Error scraping tournament decks:', err);
      return [];
    }
  }

  /**
   * Parse deck row from standings
   */
  parseDeckRow($, elem) {
    try {
      const placement = parseInt($(elem).find('.placement').text()) || 999;
      const player = $(elem).find('.player-name').text().trim();
      const archetype = $(elem).find('.archetype').text().trim() || 'Unknown';
      const record = $(elem).find('.record').text().trim(); // "7-2-0"
      const inks = this.parseInks($(elem));
      const decklistUrl = $(elem).find('.decklist-link').attr('href');

      // Parse record (wins-losses-draws)
      const [wins, losses, draws] = this.parseRecord(record);

      return {
        placement,
        player_name: player || null,
        archetype,
        inks,
        wins,
        losses,
        draws,
        win_rate: this.calculateWinRate(wins, losses, draws),
        source_url: decklistUrl || null,
        scraped_at: new Date().toISOString()
      };

    } catch (err) {
      console.error('Error parsing deck row:', err);
      return null;
    }
  }

  /**
   * Parse inks from deck element
   */
  parseInks($, elem) {
    const inks = [];
    $(elem).find('.ink-icon').each((i, icon) => {
      const ink = $(icon).attr('data-ink') || $(icon).attr('class').match(/ink-(\w+)/)?.[1];
      if (ink) {
        inks.push(ink.charAt(0).toUpperCase() + ink.slice(1));
      }
    });
    return inks.length > 0 ? inks : null;
  }

  /**
   * Parse record string (e.g., "7-2-0")
   */
  parseRecord(recordStr) {
    if (!recordStr) return [0, 0, 0];

    const match = recordStr.match(/(\d+)-(\d+)(?:-(\d+))?/);
    if (!match) return [0, 0, 0];

    return [
      parseInt(match[1]) || 0, // wins
      parseInt(match[2]) || 0, // losses
      parseInt(match[3]) || 0  // draws
    ];
  }

  /**
   * Calculate win rate
   */
  calculateWinRate(wins, losses, draws) {
    const total = wins + losses + draws;
    if (total === 0) return 0;

    return parseFloat(
      ((wins + draws * 0.5) / total * 100).toFixed(2)
    );
  }

  /**
   * Detect format from tournament name
   */
  detectFormat(name) {
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('premier')) return 'premier';
    if (nameLower.includes('core')) return 'core';
    if (nameLower.includes('challenge')) return 'challenge';
    
    return 'unknown';
  }

  /**
   * Parse date string
   */
  parseDate(dateStr) {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return new Date().toISOString().split('T')[0];
      }
      return date.toISOString().split('T')[0];
    } catch (err) {
      return new Date().toISOString().split('T')[0];
    }
  }
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = new TournamentScraper();

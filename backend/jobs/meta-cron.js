/**
 * backend/jobs/meta-cron.js
 * Automated scraping and analysis jobs
 * VERSÃO CORRIGIDA COMPLETA
 */

const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const TournamentScraper = require('../services/tournament-scraper');
const metaAnalyzer = require('../services/meta-analyzer');

// Supabase client para salvar decks
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ═══════════════════════════════════════════════════════════
// CRON JOBS
// ═══════════════════════════════════════════════════════════

class MetaCronJobs {
  constructor() {
    this.jobs = [];
  }

  /**
   * Initialize all cron jobs
   */
  init() {
    console.log('⏰ Initializing meta cron jobs...');

    // Job 1: Scrape tournaments daily at 2 AM
    this.jobs.push(
      cron.schedule('0 2 * * *', async () => {
        console.log('🔍 Running daily tournament scraping...');
        try {
          const scraper = new TournamentScraper();
          const decks = await scraper.scrapeTournaments(30);
          
          // Salvar decks no banco
          let savedCount = 0;
          for (const deck of decks) {
            const { error } = await supabase.from('decks').upsert({
              url: deck.url,
              name: deck.name,
              archetype: deck.archetype,
              inks: deck.inks,
              placement: deck.placement,
              wins: deck.wins,
              losses: deck.losses,
              format: deck.format,
              scraped_at: new Date().toISOString()
            }, { onConflict: 'url' });
            
            if (!error) savedCount++;
          }
          
          console.log(`✅ Daily scraping completed: ${savedCount} decks saved`);
        } catch (err) {
          console.error('❌ Daily scraping failed:', err.message);
        }
      })
    );

    // Job 2: Analyze meta every 6 hours
    this.jobs.push(
      cron.schedule('0 */6 * * *', async () => {
        console.log('📊 Running meta analysis...');
        try {
          await metaAnalyzer.analyzeCompleteMeta();
          console.log('✅ Meta analysis completed');
        } catch (err) {
          console.error('❌ Meta analysis failed:', err.message);
        }
      })
    );

    // Job 3: Quick scrape every 3 hours (for recent tournaments)
    this.jobs.push(
      cron.schedule('0 */3 * * *', async () => {
        console.log('🔄 Running quick scraping...');
        try {
          const scraper = new TournamentScraper();
          const decks = await scraper.scrapeTournaments(5);  // 5 torneios
          
          console.log(`✅ Scraped ${decks.length} decks`);
          
          // Salvar no banco
          let savedCount = 0;
          for (const deck of decks) {
            const { error } = await supabase.from('decks').upsert({
              url: deck.url,
              name: deck.name,
              archetype: deck.archetype,
              inks: deck.inks,
              placement: deck.placement,
              wins: deck.wins,
              losses: deck.losses,
              format: deck.format,
              scraped_at: new Date().toISOString()
            }, { onConflict: 'url' });
            
            if (!error) savedCount++;
          }
          
          console.log(`✅ Quick scraping completed: ${savedCount} decks saved`);
        } catch (err) {
          console.error('❌ Quick scraping failed:', err.message);
        }
      })
    );

    console.log(`✅ ${this.jobs.length} cron jobs initialized`);
    console.log('📅 Schedule:');
    console.log('  - Full scraping: Daily at 2 AM');
    console.log('  - Meta analysis: Every 6 hours');
    console.log('  - Quick scraping: Every 3 hours');
  }

  /**
   * Run scraping manually
   */
  async runScrapingNow() {
    console.log('🔍 Manual scraping triggered...');
    try {
      const scraper = new TournamentScraper();
      const decks = await scraper.scrapeTournaments(20);
      
      // Salvar decks
      let savedCount = 0;
      for (const deck of decks) {
        const { error } = await supabase.from('decks').upsert({
          url: deck.url,
          name: deck.name,
          archetype: deck.archetype,
          inks: deck.inks,
          placement: deck.placement,
          wins: deck.wins,
          losses: deck.losses,
          format: deck.format,
          scraped_at: new Date().toISOString()
        }, { onConflict: 'url' });
        
        if (!error) savedCount++;
      }
      
      console.log(`✅ Manual scraping completed: ${savedCount} decks saved`);
      return { 
        success: true, 
        decks_scraped: decks.length,
        decks_saved: savedCount 
      };
    } catch (err) {
      console.error('❌ Manual scraping failed:', err);
      throw err;
    }
  }

  /**
   * Run analysis manually
   */
  async runAnalysisNow() {
    console.log('📊 Manual analysis triggered...');
    try {
      const result = await metaAnalyzer.analyzeCompleteMeta();
      console.log('✅ Manual analysis completed');
      return result;
    } catch (err) {
      console.error('❌ Manual analysis failed:', err);
      throw err;
    }
  }

  /**
   * Stop all cron jobs
   */
  stopAll() {
    console.log('🛑 Stopping all cron jobs...');
    this.jobs.forEach(job => job.stop());
    console.log('✅ All cron jobs stopped');
  }
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = new MetaCronJobs();
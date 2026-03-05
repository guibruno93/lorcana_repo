/**
 * backend/jobs/meta-cron.js
 * Automated scraping and analysis jobs
 */

const cron = require('node-cron');
const tournamentScraper = require('../services/tournament-scraper');
const metaAnalyzer = require('../services/meta-analyzer');

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
          await tournamentScraper.scrapeRecentTournaments(30);
          console.log('✅ Daily scraping completed');
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
          await tournamentScraper.scrapeRecentTournaments(5);
          console.log('✅ Quick scraping completed');
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
      const result = await tournamentScraper.scrapeRecentTournaments(20);
      console.log('✅ Manual scraping completed:', result);
      return result;
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

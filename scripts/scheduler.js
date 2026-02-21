#!/usr/bin/env node
'use strict';

/**
 * Auto-Scheduler v4.0
 * Executa updates automáticos em horários programados
 * - Cards: diário às 3am
 * - Tournaments: semanal domingo às 4am
 */

const cron = require('node-cron');
const { updateCards } = require('../services/cards/cardUpdater');
const { aggregateTournaments } = require('../services/tournaments/tournamentAggregator');

// ── Configuration ────────────────────────────────────────────────────────────

const SCHEDULES = {
  cards: {
    cron: '0 3 * * *',        // Diário às 3am
    description: 'Daily cards update',
    enabled: true,
  },
  tournaments: {
    cron: '0 4 * * 0',        // Domingo às 4am
    description: 'Weekly tournaments sync',
    enabled: true,
  },
};

// ── Tasks ────────────────────────────────────────────────────────────────────

async function runCardsUpdate() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 Scheduled task: Cards Update`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  try {
    const stats = await updateCards();
    console.log(`✅ Cards update completed`);
    console.log(`   New cards: ${stats.newCards}`);
    console.log(`   Total cards: ${stats.finalCount}`);
    return stats;
  } catch (err) {
    console.error(`❌ Cards update failed: ${err.message}`);
    return null;
  }
}

async function runTournamentsSync() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 Scheduled task: Tournaments Sync`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  try {
    const stats = await aggregateTournaments();
    console.log(`✅ Tournaments sync completed`);
    console.log(`   Fetched: ${stats.totalFetched} decks`);
    console.log(`   Total in DB: ${stats.totalAfterMerge} decks`);
    return stats;
  } catch (err) {
    console.error(`❌ Tournaments sync failed: ${err.message}`);
    return null;
  }
}

// ── Scheduler ────────────────────────────────────────────────────────────────

function startScheduler() {
  console.log('\n🤖 Auto-Scheduler v4.0 started\n');
  console.log('Scheduled tasks:');

  if (SCHEDULES.cards.enabled) {
    console.log(`  ✅ ${SCHEDULES.cards.description}`);
    console.log(`     Cron: ${SCHEDULES.cards.cron} (daily 3am)`);
    
    cron.schedule(SCHEDULES.cards.cron, runCardsUpdate, {
      timezone: 'America/Sao_Paulo',
    });
  }

  if (SCHEDULES.tournaments.enabled) {
    console.log(`  ✅ ${SCHEDULES.tournaments.description}`);
    console.log(`     Cron: ${SCHEDULES.tournaments.cron} (sunday 4am)`);
    
    cron.schedule(SCHEDULES.tournaments.cron, runTournamentsSync, {
      timezone: 'America/Sao_Paulo',
    });
  }

  console.log('\n✅ Scheduler running. Press Ctrl+C to stop.\n');
}

// ── Manual Execution ─────────────────────────────────────────────────────────

async function runManual(task) {
  if (task === 'cards') {
    await runCardsUpdate();
  } else if (task === 'tournaments') {
    await runTournamentsSync();
  } else if (task === 'all') {
    await runCardsUpdate();
    await runTournamentsSync();
  } else {
    console.error(`Unknown task: ${task}`);
    console.log('Available: cards, tournaments, all');
    process.exit(1);
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Auto-Scheduler v4.0 - Automated updates for Lorcana AI

Usage:
  node scheduler.js              Start scheduled tasks (daemon)
  node scheduler.js cards        Run cards update now
  node scheduler.js tournaments  Run tournaments sync now
  node scheduler.js all          Run both updates now

Schedules:
  Cards:       Daily at 3am (America/Sao_Paulo)
  Tournaments: Weekly Sunday at 4am

Options:
  -h, --help   Show this help
    `);
    process.exit(0);
  }

  const task = args[0];

  if (!task) {
    // Daemon mode
    startScheduler();
  } else {
    // Manual execution
    runManual(task)
      .then(() => process.exit(0))
      .catch(err => {
        console.error('💥 Error:', err);
        process.exit(1);
      });
  }
}

module.exports = { startScheduler, runCardsUpdate, runTournamentsSync };

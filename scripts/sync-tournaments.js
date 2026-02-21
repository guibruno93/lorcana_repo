#!/usr/bin/env node
'use strict';
const { aggregateTournaments } = require('../services/tournaments/tournamentAggregator');
aggregateTournaments()
  .then(() => process.exit(0))
  .catch(err => { console.error('Error:', err.message); process.exit(1); });

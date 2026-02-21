#!/usr/bin/env node
'use strict';
const { updateCards } = require('../services/cards/cardUpdater');
updateCards({ force: process.argv.includes('--force') })
  .then(() => process.exit(0))
  .catch(err => { console.error('Error:', err.message); process.exit(1); });

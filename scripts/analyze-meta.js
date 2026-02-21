#!/usr/bin/env node
'use strict';
const { analyzeMetaState } = require('../services/tournaments/metaAnalyzer');
const r = analyzeMetaState();
if (!r.available) { console.log(r.note); process.exit(0); }
console.log(JSON.stringify(r, null, 2));

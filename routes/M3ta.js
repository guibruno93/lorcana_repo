const express = require('express');
const router = express.Router();
const { analyzeMetaState } = require('../services/tournaments/metaAnalyzer');

router.get('/state', (req, res) => {
  const result = analyzeMetaState();
  res.json(result);
});

module.exports = router;
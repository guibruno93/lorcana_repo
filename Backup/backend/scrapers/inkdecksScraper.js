// backend/scrapers/inkdecksScraper.js
"use strict";

const { getDeckRefs, getDeckUrls } = require("./inkdecksIndexScraper");
const { scrapeDeck } = require("./inkdecksDeckScraper");

module.exports = {
  getDeckRefs,
  getDeckUrls,
  scrapeDeck,
};

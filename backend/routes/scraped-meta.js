'use strict';

/**
 * scraped-meta.js
 * Endpoints públicos de análise de meta a partir de scraped_decks (Supabase).
 *
 * Montado em: /api/meta
 * - GET /share      — distribuição de meta share por arquétipo
 * - GET /tier-list  — tiers por meta share + resultados (Top 8 / 16 / …)
 * - GET /stats      — estatísticas gerais
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    const err = new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
    err.statusCode = 503;
    throw err;
  }
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * GET /api/meta/share
 */
router.get('/share', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: decks, error } = await supabase
      .from('scraped_decks')
      .select('archetype');

    if (error) throw error;

    const rows = decks || [];
    const archetypeCounts = {};
    rows.forEach((deck) => {
      const arch = deck.archetype || 'Unknown';
      archetypeCounts[arch] = (archetypeCounts[arch] || 0) + 1;
    });

    const total = rows.length;
    const archetypes = Object.entries(archetypeCounts)
      .map(([archetype, count]) => ({
        archetype,
        count,
        percentage:
          total > 0
            ? parseFloat(((count / total) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    res.json({
      total_decks: total,
      archetypes,
    });
  } catch (error) {
    console.error('Error fetching meta share:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      error:
        status === 503
          ? 'Supabase not configured'
          : 'Failed to fetch meta share data',
    });
  }
});

/** Extrai um “rank” numérico aproximado para média (ex.: "31st" -> 31, "Top 8" -> 8). */
function standingToRank(standingRaw) {
  if (standingRaw == null || String(standingRaw).trim() === '') return null;
  const s = String(standingRaw).trim().toLowerCase();

  const top = s.match(/top\s*(\d+)/i);
  if (top) return parseInt(top[1], 10);

  const ord = s.match(/^(\d+)(?:st|nd|rd|th)\b/i);
  if (ord) return parseInt(ord[1], 10);

  return null;
}

/**
 * GET /api/meta/tier-list
 */
router.get('/tier-list', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: decks, error } = await supabase
      .from('scraped_decks')
      .select('archetype, standing, event_name');

    if (error) throw error;

    const rows = decks || [];
    const archetypeData = {};

    rows.forEach((deck) => {
      const arch = deck.archetype || 'Unknown';

      if (!archetypeData[arch]) {
        archetypeData[arch] = {
          archetype: arch,
          decks: [],
          top8_count: 0,
          top16_count: 0,
          top32_count: 0,
          standing_ranks: [],
        };
      }

      archetypeData[arch].decks.push(deck);

      const standing = (deck.standing && String(deck.standing).toLowerCase()) || '';
      const rank = standingToRank(deck.standing);

      if (rank != null) archetypeData[arch].standing_ranks.push(rank);

      if (
        standing.includes('top 8') ||
        standing.includes('top8') ||
        /^[1-8](?:st|nd|rd|th)\b/.test(standing)
      ) {
        archetypeData[arch].top8_count++;
      } else if (
        standing.includes('top 16') ||
        standing.includes('top16') ||
        /^(?:9|1[0-6])(?:st|nd|rd|th)\b/.test(standing)
      ) {
        archetypeData[arch].top16_count++;
      } else if (
        standing.includes('top 32') ||
        standing.includes('top32') ||
        /^(?:1[7-9]|2[0-9]|3[0-2])(?:st|nd|rd|th)\b/.test(standing)
      ) {
        archetypeData[arch].top32_count++;
      }
    });

    const total = rows.length;
    const tiers = { S: [], A: [], B: [], C: [] };

    Object.values(archetypeData).forEach((data) => {
      const deck_count = data.decks.length;
      const meta_share =
        total > 0
          ? parseFloat(((deck_count / total) * 100).toFixed(1))
          : 0;

      const ranks = data.standing_ranks;
      const avg_standing =
        ranks.length > 0
          ? parseFloat(
              (
                ranks.reduce((a, b) => a + b, 0) / ranks.length
              ).toFixed(1)
            )
          : null;

      const archetype_entry = {
        archetype: data.archetype,
        meta_share,
        avg_standing,
        deck_count,
        top8_finishes: data.top8_count,
        top16_finishes: data.top16_count,
        top32_finishes: data.top32_count,
        total_top_finishes:
          data.top8_count + data.top16_count + data.top32_count,
      };

      if (meta_share >= 15 || data.top8_count >= 3) {
        tiers.S.push(archetype_entry);
      } else if (
        meta_share >= 10 ||
        (data.top8_count >= 1 && data.top16_count >= 2)
      ) {
        tiers.A.push(archetype_entry);
      } else if (meta_share >= 5 || data.top16_count >= 2) {
        tiers.B.push(archetype_entry);
      } else {
        tiers.C.push(archetype_entry);
      }
    });

    ['S', 'A', 'B', 'C'].forEach((tier) => {
      tiers[tier].sort((a, b) => b.meta_share - a.meta_share);
    });

    res.json({
      total_decks: total,
      tiers,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating tier list:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      error:
        status === 503
          ? 'Supabase not configured'
          : 'Failed to generate tier list',
    });
  }
});

/**
 * GET /api/meta/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: decks, error } = await supabase
      .from('scraped_decks')
      .select('archetype, standing, event_name, scraped_at')
      .order('scraped_at', { ascending: false });

    if (error) throw error;

    const rows = decks || [];
    const uniqueArchetypes = new Set(
      rows.map((d) => d.archetype).filter((a) => a != null && a !== '')
    ).size;
    const withStanding = rows.filter((d) => d.standing).length;
    const withEvent = rows.filter((d) => d.event_name).length;

    const archetypeCounts = {};
    rows.forEach((deck) => {
      const arch = deck.archetype || 'Unknown';
      archetypeCounts[arch] = (archetypeCounts[arch] || 0) + 1;
    });

    const sorted = Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1]);
    const top = sorted[0];

    const n = rows.length;
    res.json({
      total_decks: n,
      unique_archetypes: uniqueArchetypes,
      most_popular: top ? top[0] : null,
      most_popular_count: top ? top[1] : 0,
      with_standing: withStanding,
      with_standing_pct:
        n > 0 ? parseFloat(((withStanding / n) * 100).toFixed(1)) : 0,
      with_event: withEvent,
      with_event_pct:
        n > 0 ? parseFloat(((withEvent / n) * 100).toFixed(1)) : 0,
      latest_scrape: rows[0]?.scraped_at || null,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      error:
        status === 503
          ? 'Supabase not configured'
          : 'Failed to fetch meta stats',
    });
  }
});

module.exports = router;

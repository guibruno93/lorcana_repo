/**
 * backend/services/meta-analyzer.js
 * v1.2 - CORRIGIDO - Core vs Infinity + Win/Loss Tracking
 * 
 * CORREÇÕES APLICADAS:
 * ✅ getDashboardStats - .from("decks") adicionado
 * ✅ getDashboardStats - .order() corrigido
 * ✅ analyzeArchetypes - upsert com sintaxe correta
 */

const { createClient } = require("@supabase/supabase-js");
const { calculateWinRate } = require("./record-parser");
const scraper = require ("./tournament-scraper");

const ANALYSIS_FORMAT = process.env.LORCANA_FORMAT || 'core';
console.log(`🎯 Meta Analyzer configured for: ${ANALYSIS_FORMAT.toUpperCase()}`);

function calculateConfidence(total_decks) {
  if (total_decks >= 1000) return 1.0;
  if (total_decks >= 300) return 0.95;
  if (total_decks >= 100) return 0.85;
  if (total_decks >= 50) return 0.70;
  if (total_decks >= 20) return 0.50;
  return 0.30;
}

function calculatePowerLevel(archData) {
  const { total_decks, win_rate, meta_share, top8_rate, top4_rate, avg_placement } = archData;

  // 1. WIN RATE (60%)
  let winRateScore = 0;
  if (win_rate !== null && win_rate !== undefined) {
    const wrNormalized = (win_rate - 50) * 2;
    const wrExponential = Math.pow(Math.max(0, wrNormalized), 1.3);
    winRateScore = 25 + wrExponential;
    winRateScore = Math.max(0, Math.min(100, winRateScore));
  }

  // 2. META SHARE (20%)
  const metaScore = meta_share > 0 ? Math.min(100, 10 * Math.log10(meta_share + 1) * 10) : 0;

  // 3. TOURNAMENT (15%)
  const top8Score = (top8_rate || 0) * 100;
  const top4Score = (top4_rate || 0) * 100;
  const tournamentScore = (top8Score * 0.6) + (top4Score * 0.4);

  // 4. PLACEMENT (5%)
  let placementScore = 0;
  if (avg_placement && avg_placement > 0) {
    placementScore = Math.min(100, 100 / avg_placement * 8);
  }

  // 5. CONFIDENCE
  const confidence = calculateConfidence(total_decks);

  // 6. FINAL
  const rawPower = (
    (winRateScore * 0.60) +
    (metaScore * 0.20) +
    (tournamentScore * 0.15) +
    (placementScore * 0.05)
  );

  return Math.max(0, Math.min(100, Math.round(rawPower * confidence)));
}

function calculateTierFromPower(power_level) {
  if (power_level >= 85) return 'S';
  if (power_level >= 70) return 'A';
  if (power_level >= 55) return 'B';
  if (power_level >= 40) return 'C';
  return 'D';
}

class MetaAnalyzer {
  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      console.warn("⚠️  SUPABASE_URL / SUPABASE_SERVICE_KEY não definidos no .env");
    }

    this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });
  }

  // ---------------------------
  // Public API
  // ---------------------------

  async analyzeAll(days = 30) {
    const archetypes = await this.analyzeArchetypes(days);
    const cards = await this.analyzeCards(days);
    await this.snapshotTierList(archetypes);

    return {
      success: true,
      days,
      format: ANALYSIS_FORMAT,
      archetypes_updated: archetypes.length,
      cards_updated: cards.length,
      generated_at: new Date().toISOString(),
    };
  }

  async analyzeCompleteMeta(days = 30) {
    return this.analyzeAll(days);
  }

  async calculateTierList(limit = 50) {
    const { data, error } = await this.supabase
      .from("archetype_meta")
      .select("*")
      .eq("format", ANALYSIS_FORMAT)
      .order("power_level", { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    return {
      tierList: data || [],
      metadata: {
        format: ANALYSIS_FORMAT,
        generatedAt: new Date().toISOString(),
        totalArchetypes: data?.length || 0
      }
    };
  }

  async getTierList(limit = 50) {
    return this.calculateTierList(limit);
  }

  async calculateTrends(days = 30) {
    const since = this.#sinceDate(days);
    
    const { data, error } = await this.supabase
      .from("tier_list_history")
      .select("archetype,snapshot_date,power_level,tier,meta_share,win_rate")
      .gte("snapshot_date", since)
      .order("snapshot_date", { ascending: true });

    if (error) throw error;

    const historyByArch = new Map();
    for (const row of data || []) {
      if (!historyByArch.has(row.archetype)) historyByArch.set(row.archetype, []);
      historyByArch.get(row.archetype).push(row);
    }

    const trends = [];
    for (const [archetype, hist] of historyByArch.entries()) {
      if (hist.length < 2) continue;
      const first = hist[0];
      const last = hist[hist.length - 1];

      const delta = (last.power_level ?? 0) - (first.power_level ?? 0);
      const trend =
        delta > 3 ? "Rising" :
        delta < -3 ? "Falling" :
        "Stable";

      trends.push({
        archetype,
        trend,
        trend_delta: Number(delta.toFixed(2)),
        from: first.snapshot_date,
        to: last.snapshot_date,
      });
    }

    trends.sort((a, b) => Math.abs(b.trend_delta) - Math.abs(a.trend_delta));

    return {
      trends,
      history: Object.fromEntries(historyByArch),
      since,
    };
  }

  async getDashboardStats(days = 30) {
    const sinceISO = this.#sinceISO(days);

    // ✅ CORRIGIDO: Adicionado .from("decks")
    const { count: totalDecks, error: c1 } = await this.supabase
      .from("decks")  // ← CORRIGIDO: estava faltando
      .select("id", { count: "exact" })
      .eq("format", ANALYSIS_FORMAT)
      .gte("scraped_at", sinceISO);

    if (c1) throw c1;

    // ✅ CORRIGIDO: .order() completo
    const { data: archetypes, error: a1 } = await this.supabase
      .from("archetype_meta")
      .select("*")
      .eq("days", days)
      .eq("format", ANALYSIS_FORMAT)
      .order("total_decks", { ascending: false });  // ← CORRIGIDO: estava incompleto

    if (a1) throw a1;

    const uniqueArchetypes = archetypes?.length ?? 0;

    const winRates = (archetypes || [])
      .map((x) => (typeof x.win_rate === "number" ? x.win_rate : null))
      .filter((x) => x !== null);

    const avgWinRate =
      winRates.length > 0
        ? Number((winRates.reduce((s, v) => s + v, 0) / winRates.length).toFixed(1))
        : null;

    const topDeckShare =
      archetypes?.[0]?.meta_share != null ? Number(archetypes[0].meta_share) : 0;

    return {
      stats: {
        totalDecks: totalDecks || 0,
        uniqueArchetypes: archetypes?.length ?? 0,
        avgWinRate,
        topDeckShare,
        format: ANALYSIS_FORMAT
      },
      archetypes: archetypes || [],
      lastUpdated: new Date().toISOString(),
    };
  }

  async getMetaStats(days = 30) {
    const dash = await this.getDashboardStats(days);
    return dash.stats;
  }

  async getCardStats(limit = 100) {
    const { data, error } = await this.supabase
      .from("cards_meta")
      .select("*")
      .order("meta_share", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // ---------------------------
  // Core analysis
  // ---------------------------

  async analyzeArchetypes(days = 30) {
    const sinceISO = this.#sinceISO(days);
    
    console.log(`📊 Analyzing ${ANALYSIS_FORMAT.toUpperCase()} format (last ${days} days)`);

    const decks = await this.#fetchAllDecksSince(sinceISO, [
      "archetype",
      "inks",
      "placement",
      "wins",
      "losses",
      "scraped_at",
    ]);

    if (!decks.length) {
      console.log(`⚠️  No ${ANALYSIS_FORMAT} decks found`);
      return [];
    }
    
    console.log(`✅ Found ${decks.length} ${ANALYSIS_FORMAT} decks`);

    const { data: prevRows, error: prevErr } = await this.supabase
      .from("archetype_meta")
      .select("archetype,power_level,meta_share");

    if (prevErr) throw prevErr;

    const prev = new Map((prevRows || []).map((r) => [r.archetype, r]));

    const totalDecks = decks.length;
    const agg = new Map();

    for (const d of decks) {
      const archetype = (d.archetype || "Unknown").trim();
      if (!agg.has(archetype)) {
        agg.set(archetype, {
          archetype,
          total_decks: 0,
          top4_count: 0,
          top8_count: 0,
          top16_count: 0,
          placement_sum: 0,
          placement_n: 0,
          inks_mode: new Map(),
          total_wins: 0,
          total_losses: 0,
        });
      }

      const a = agg.get(archetype);
      a.total_decks += 1;
      a.total_wins += (typeof d.wins === "number" ? d.wins : 0);
      a.total_losses += (typeof d.losses === "number" ? d.losses : 0);

      const p = typeof d.placement === "number" ? d.placement : null;
      if (p != null) {
        if (p <= 4) a.top4_count += 1;
        if (p <= 8) a.top8_count += 1;
        if (p <= 16) a.top16_count += 1;
        a.placement_sum += p;
        a.placement_n += 1;
      }

      if (Array.isArray(d.inks) && d.inks.length) {
        const key = d.inks.slice().sort().join("/");
        a.inks_mode.set(key, (a.inks_mode.get(key) || 0) + 1);
      }
    }

    const now = new Date().toISOString();
    const rows = [];

    for (const a of agg.values()) {
      const meta_share = (a.total_decks / totalDecks) * 100;
      const avg_placement = a.placement_n > 0 ? a.placement_sum / a.placement_n : null;
      const top8_rate = a.total_decks > 0 ? a.top8_count / a.total_decks : 0;
      const top4_rate = a.total_decks > 0 ? a.top4_count / a.total_decks : 0;

     const win_rate = calculateWinRate(a.total_wins, a.total_losses);

// ✅ NOVA FÓRMULA - FOCADA EM WIN RATE!
const power_level = calculatePowerLevel({
  total_decks: a.total_decks,
  win_rate: win_rate,
  meta_share: meta_share,
  top8_rate: top8_rate,
  top4_rate: top4_rate,
  avg_placement: avg_placement
});

const tier = calculateTierFromPower(power_level);

      const prevRow = prev.get(a.archetype);
      const delta = prevRow?.power_level != null ? (power_level - prevRow.power_level) : 0;

      const trend =
        delta > 3 ? "Rising" :
        delta < -3 ? "Falling" :
        "Stable";

      let inks = null;
      if (a.inks_mode.size) {
        let bestK = null, bestV = -1;
        for (const [k, v] of a.inks_mode.entries()) {
          if (v > bestV) { bestV = v; bestK = k; }
        }
        inks = bestK ? bestK.split("/") : null;
      }

      rows.push({
        archetype: a.archetype,
        inks,
        days,  // ← ADICIONAR: necessário para constraint unique
        format: ANALYSIS_FORMAT,  // ← ADICIONAR: necessário para constraint unique
        total_decks: a.total_decks,
        total_wins: a.total_wins,
        total_losses: a.total_losses,
        win_rate: win_rate,
        top4_count: a.top4_count,
        top8_count: a.top8_count,
        top16_count: a.top16_count,
        avg_placement,
        meta_share,
        power_level: Math.round(power_level),
        tier,
        trend,
        trend_delta: Number(delta.toFixed(2)),
        last_calculated: now,
        updated_at: now,
      });
    }

    // ✅ CORRIGIDO: upsert com sintaxe correta
    const { error: upErr } = await this.supabase
      .from("archetype_meta")
      .upsert(rows, {
        onConflict: "archetype,days,format"  // ← CORRIGIDO: agora está dentro do objeto
      });

    if (upErr) throw upErr;

    console.log(`✅ Updated ${rows.length} archetypes with win/loss data`);

    return rows;
  }

  async analyzeCards(days = 30) {
    const sinceISO = this.#sinceISO(days);

    const decks = await this.#fetchAllDecksSince(sinceISO, [
      "cards",
      "total_cards",
      "scraped_at",
    ]);

    if (!decks.length) return [];

    const { data: prevRows, error: prevErr } = await this.supabase
      .from("cards_meta")
      .select("card_name,meta_share");

    if (prevErr) throw prevErr;
    const prev = new Map((prevRows || []).map((r) => [r.card_name, r]));

    const totalDecks = decks.length;
    const cardAgg = new Map();

    for (const d of decks) {
      if (!Array.isArray(d.cards) || d.cards.length === 0) continue;

      const seenInDeck = new Set();
      for (const c of d.cards) {
        const name = (c?.name || "").trim();
        const qty = Number(c?.quantity || 0);

        if (!name || !qty) continue;

        if (!cardAgg.has(name)) {
          cardAgg.set(name, { card_name: name, total_decks: 0, total_copies: 0 });
        }
        const a = cardAgg.get(name);
        a.total_copies += qty;

        if (!seenInDeck.has(name)) {
          a.total_decks += 1;
          seenInDeck.add(name);
        }
      }
    }

    const now = new Date().toISOString();
    const rows = [];

    for (const a of cardAgg.values()) {
      const meta_share = (a.total_decks / totalDecks) * 100;
      const avg_copies = a.total_decks > 0 ? (a.total_copies / a.total_decks) : null;

      const prevRow = prev.get(a.card_name);
      const delta = prevRow?.meta_share != null ? (meta_share - prevRow.meta_share) : 0;

      const trend =
        delta > 0.5 ? "Rising" :
        delta < -0.5 ? "Falling" :
        "Stable";

      rows.push({
        card_name: a.card_name,
        total_decks: a.total_decks,
        total_copies: a.total_copies,
        avg_copies,
        decks_with_wins: 0,
        decks_with_losses: 0,
        win_rate: null,
        meta_share,
        trend,
        trend_delta: Number(delta.toFixed(2)),
        last_calculated: now,
        created_at: now,
        updated_at: now,
      });
    }

    if (!rows.length) return [];

    const { error: upErr } = await this.supabase
      .from("cards_meta")
      .upsert(rows, { onConflict: "card_name" });

    if (upErr) throw upErr;

    return rows;
  }

async snapshotTierList(archetypeRows) {
  if (!Array.isArray(archetypeRows) || archetypeRows.length === 0) return;

  const snapshot_date = this.#todayDate();
  const rows = archetypeRows.map((a) => ({
    snapshot_date,
    archetype: a.archetype,
    tier: a.tier,
    power_level: a.power_level,
    meta_share: a.meta_share,
    win_rate: a.win_rate ?? null,
  }));

  // ✅ UPSERT - atualiza se já existe, insere se não existe
  const { error } = await this.supabase
    .from("tier_list_history")
    .upsert(rows, {
      onConflict: "snapshot_date,archetype"  // ← Constraint unique
    });

  if (error) {
    console.error("❌ snapshotTierList error:", error.message);
  }
}

  // ---------------------------
  // Helpers
  // ---------------------------

  async #fetchAllDecksSince(sinceISO, cols) {
    const select = cols.join(",");
    const pageSize = 1000;

    let all = [];
    let from = 0;

    while (true) {
      const to = from + pageSize - 1;

      const { data, error } = await this.supabase
        .from("decks")
        .select(select)
        .eq("format", ANALYSIS_FORMAT)
        .gte("scraped_at", sinceISO)
        .range(from, to);

      if (error) throw error;
      if (!data || data.length === 0) break;

      all = all.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    return all;
  }

  #sinceISO(days) {
    const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return d.toISOString();
  }

  #sinceDate(days) {
    return this.#sinceISO(days).slice(0, 10);
  }

  #todayDate() {
    return new Date().toISOString().slice(0, 10);
  }
}

module.exports = new MetaAnalyzer();

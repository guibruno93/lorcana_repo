/**
 * backend/services/meta-analyzer.js
 * Ajustado para o schema atual (CSV):
 * - decks: cards (jsonb), decklist_text, total_cards, url, placement, inks, archetype, scraped_at/created_at/updated_at
 * - tournaments: id (text), url (unique), etc
 * - archetype_meta, cards_meta, tier_list_history existem
 *
 * Observação: como não há wins/losses/draws no schema, win_rate fica null (ou 0 quando necessário).
 */

const { createClient } = require("@supabase/supabase-js");

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
  // Public API (rotas / cron)
  // ---------------------------

  async analyzeAll(days = 30) {
    // roda tudo e salva snapshot
    const archetypes = await this.analyzeArchetypes(days);
    const cards = await this.analyzeCards(days);

    // snapshot do tier list (1 linha por archetype)
    await this.snapshotTierList(archetypes);

    return {
      success: true,
      days,
      archetypes_updated: archetypes.length,
      cards_updated: cards.length,
      generated_at: new Date().toISOString(),
    };
  }

  // compat com meta-cron.js
  async analyzeCompleteMeta(days = 30) {
    return this.analyzeAll(days);
  }

  async calculateTierList(limit = 50) {
    const { data, error } = await this.supabase
      .from("archetype_meta")
      .select("*")
      .order("power_level", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // compat com meta-analysis-routes.js
  async getTierList(limit = 50) {
    return this.calculateTierList(limit);
  }

  async calculateTrends(days = 30) {
    const since = this.#sinceDate(days); // YYYY-MM-DD
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

    // ordena por maior variação
    trends.sort((a, b) => Math.abs(b.trend_delta) - Math.abs(a.trend_delta));

    // formato compatível com sua rota /trends
    return {
      trends,
      history: Object.fromEntries(historyByArch),
      since,
    };
  }

  async getDashboardStats(days = 30) {
    const sinceISO = this.#sinceISO(days);

    // total decks no período
    const { count: totalDecks, error: c1 } = await this.supabase
      .from("decks")
      .select("*", { count: "exact", head: true })
      .gte("scraped_at", sinceISO);

    if (c1) throw c1;

    // archetypes atuais
    const { data: archetypes, error: a1 } = await this.supabase
      .from("archetype_meta")
      .select("archetype,tier,power_level,meta_share,win_rate,trend,trend_delta")
      .order("power_level", { ascending: false })
      .limit(20);

    if (a1) throw a1;

    const uniqueArchetypes = archetypes?.length ?? 0;

    // avgWinRate: como não temos wins/losses no schema, calcula média só se tiver win_rate preenchido
    const winRates = (archetypes || [])
      .map((x) => (typeof x.win_rate === "number" ? x.win_rate : null))
      .filter((x) => x !== null);

    const avgWinRate =
      winRates.length > 0
        ? Number((winRates.reduce((s, v) => s + v, 0) / winRates.length).toFixed(1))
        : 0;

    const topDeckShare =
      archetypes?.[0]?.meta_share != null ? Number(archetypes[0].meta_share) : 0;

    return {
      stats: {
        totalDecks: totalDecks || 0,
        uniqueArchetypes,
        avgWinRate,
        topDeckShare,
      },
      archetypes: archetypes || [],
      lastUpdated: new Date().toISOString(),
    };
  }

  // compat com meta-analysis-routes.js
  async getMetaStats(days = 30) {
    const dash = await this.getDashboardStats(days);
    return dash.stats;
  }

  // compat com meta-analysis-routes.js
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
  // Core analysis (schema-safe)
  // ---------------------------

  async analyzeArchetypes(days = 30) {
    const sinceISO = this.#sinceISO(days);

    // pega decks (paginado)
    const decks = await this.#fetchAllDecksSince(sinceISO, [
      "archetype",
      "inks",
      "placement",
      "scraped_at",
    ]);

    if (!decks.length) return [];

    // pega estado anterior (pra trend_delta)
    const { data: prevRows, error: prevErr } = await this.supabase
      .from("archetype_meta")
      .select("archetype,power_level,meta_share");

    if (prevErr) throw prevErr;

    const prev = new Map((prevRows || []).map((r) => [r.archetype, r]));

    // agrega
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
          inks_mode: new Map(), // "Ruby/Steel" -> count
        });
      }

      const a = agg.get(archetype);
      a.total_decks += 1;

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

    // monta rows para upsert
    const now = new Date().toISOString();
    const rows = [];

    for (const a of agg.values()) {
      const meta_share = (a.total_decks / totalDecks) * 100;

      const avg_placement =
        a.placement_n > 0 ? a.placement_sum / a.placement_n : null;

      const top8_rate = a.total_decks > 0 ? a.top8_count / a.total_decks : 0;
      const top4_rate = a.total_decks > 0 ? a.top4_count / a.total_decks : 0;

      // power_level baseado em: meta_share + topcut + placement
      const placementScore =
        avg_placement && avg_placement > 0 ? Math.min(1, 8 / avg_placement) : 0; // 0..1

      const sampleFactor = Math.min(1, Math.log10(a.total_decks + 1) / 2); // 0..1

      const powerRaw =
        (meta_share * 0.45) +
        (top8_rate * 100 * 0.35) +
        (top4_rate * 100 * 0.10) +
        (placementScore * 100 * 0.10);

      const power_level = Math.max(
        0,
        Math.min(100, powerRaw * (0.75 + 0.25 * sampleFactor))
      );

      const tier =
        power_level >= 80 ? "S" :
        power_level >= 65 ? "A" :
        power_level >= 50 ? "B" :
        power_level >= 35 ? "C" : "D";

      const prevRow = prev.get(a.archetype);
      const delta = prevRow?.power_level != null ? (power_level - prevRow.power_level) : 0;

      const trend =
        delta > 3 ? "Rising" :
        delta < -3 ? "Falling" :
        "Stable";

      // inks mais comum
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
        total_decks: a.total_decks,
        total_wins: 0,
        total_losses: 0,
        win_rate: null, // sem wins/losses no schema
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

    // upsert no archetype_meta (unique por archetype)
    const { error: upErr } = await this.supabase
      .from("archetype_meta")
      .upsert(rows, { onConflict: "archetype" });

    if (upErr) throw upErr;

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

    // prev pra trend
    const { data: prevRows, error: prevErr } = await this.supabase
      .from("cards_meta")
      .select("card_name,meta_share");

    if (prevErr) throw prevErr;
    const prev = new Map((prevRows || []).map((r) => [r.card_name, r]));

    const totalDecks = decks.length;
    const cardAgg = new Map(); // name -> { total_decks, total_copies }

    for (const d of decks) {
      if (!Array.isArray(d.cards) || d.cards.length === 0) continue;

      // d.cards esperado: [{ name, quantity }, ...]
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

    const snapshot_date = this.#todayDate(); // YYYY-MM-DD
    const rows = archetypeRows.map((a) => ({
      snapshot_date,
      archetype: a.archetype,
      tier: a.tier,
      power_level: a.power_level,
      meta_share: a.meta_share,
      win_rate: a.win_rate ?? null,
    }));

    // tier_list_history não tem unique por dia, então inserimos (histórico)
    const { error } = await this.supabase.from("tier_list_history").insert(rows);
    if (error) {
      // se quiser evitar duplicar no mesmo dia, dá pra trocar por "upsert" com unique (snapshot_date, archetype)
      console.warn("⚠️  snapshotTierList insert warning:", error.message);
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
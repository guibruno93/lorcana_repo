/**
 * backend/services/meta-analyzer-winrate-patch.js
 * 
 * PATCH para adicionar cálculo de win rate no meta-analyzer
 * 
 * INSTRUÇÕES:
 * 1. Abrir meta-analyzer-FIXED.js
 * 2. Procurar função _analyzeArchetypes (linha ~238)
 * 3. Adicionar cálculo de win rate conforme abaixo
 */

// ════════════════════════════════════════════════════════════════════
// LOCALIZAR ESTA PARTE NO meta-analyzer-FIXED.js (~linha 250-275):
// ════════════════════════════════════════════════════════════════════

/*
async _analyzeArchetypes({ decks, now }) {
  const supabase = getSupabase();
  if (!decks.length) return [];

  const groups = new Map();
  for (const d of decks) {
    const archetype = d.archetype || d.name || "Unknown";
    const inks = safeArray(d.inks);
    const key = `${archetype}||${inks.join(",")}`;
    if (!groups.has(key)) groups.set(key, { archetype, inks, decks: [] });
    groups.get(key).decks.push(d);
  }

  const totalDecks = decks.length;
  const rows = [];

  for (const g of groups.values()) {
    const ds = g.decks;
    
    // ✨ ADICIONAR AQUI - LINHA 1: Calcular wins/losses
    const totalWins = ds.reduce((sum, d) => sum + (d.wins || 0), 0);
    const totalLosses = ds.reduce((sum, d) => sum + (d.losses || 0), 0);
    const totalMatches = totalWins + totalLosses;
    const winRate = totalMatches > 0 ? (totalWins / totalMatches) * 100 : null;
    
    const placements = ds.map((d) => (Number.isFinite(d.placement) ? d.placement : null)).filter((x) => x !== null);
    const avgPlacement = placements.length ? placements.reduce((a, b) => a + b, 0) / placements.length : null;

    const top8 = ds.filter((d) => (d.placement ?? 9999) <= 8).length;
    const top16 = ds.filter((d) => (d.placement ?? 9999) <= 16).length;
    const top32 = ds.filter((d) => (d.placement ?? 9999) <= 32).length;

    const top8Rate = ds.length ? (top8 / ds.length) * 100 : 0;
    const top16Rate = ds.length ? (top16 / ds.length) * 100 : 0;
    const top32Rate = ds.length ? (top32 / ds.length) * 100 : 0;

    const metaShare = (ds.length / totalDecks) * 100;
    const placementScore = avgPlacement ? clamp(100 - avgPlacement, 0, 100) : 0;
    
    // ✨ ADICIONAR AQUI - LINHA 2: Usar win rate no power level
    const winRateFactor = winRate ? winRate * 0.2 : 0;  // 20% do cálculo
    const power = clamp(
      metaShare * 0.25 + 
      top8Rate * 0.25 + 
      top16Rate * 0.15 + 
      placementScore * 0.15 +
      winRateFactor,  // ← NOVO: Incluir win rate
      0,
      100
    );

    rows.push({
      archetype: g.archetype,
      inks: g.inks,
      total_decks: ds.length,
      
      // ✨ ADICIONAR AQUI - LINHA 3: Salvar wins/losses
      total_wins: totalWins,           // ← NOVO
      total_losses: totalLosses,       // ← NOVO
      win_rate: winRate ? Number(winRate.toFixed(2)) : null,  // ← NOVO
      
      top4_count: ds.filter((d) => (d.placement ?? 9999) <= 4).length,
      top8_count: top8,
      top16_count: top16,
      top32_count: top32,
      top8_rate: Number(top8Rate.toFixed(2)),
      top16_rate: Number(top16Rate.toFixed(2)),
      top32_rate: Number(top32Rate.toFixed(2)),
      avg_placement: avgPlacement ? Number(avgPlacement.toFixed(2)) : null,
      meta_share: Number(metaShare.toFixed(2)),
      power_level: Number(power.toFixed(2)),
      tier: power >= 80 ? "S" : power >= 60 ? "A" : power >= 40 ? "B" : power >= 20 ? "C" : "D",
      trend: "Stable",
      trend_delta: 0,
      matchups: null,
      last_calculated: now,
      updated_at: now,
    });
  }
*/

// ════════════════════════════════════════════════════════════════════
// RESUMO DAS MUDANÇAS:
// ════════════════════════════════════════════════════════════════════
//
// 1. ADICIONAR após "const ds = g.decks;":
//
//    const totalWins = ds.reduce((sum, d) => sum + (d.wins || 0), 0);
//    const totalLosses = ds.reduce((sum, d) => sum + (d.losses || 0), 0);
//    const totalMatches = totalWins + totalLosses;
//    const winRate = totalMatches > 0 ? (totalWins / totalMatches) * 100 : null;
//
// 2. MODIFICAR cálculo de power:
//
//    const winRateFactor = winRate ? winRate * 0.2 : 0;
//    const power = clamp(
//      metaShare * 0.25 + 
//      top8Rate * 0.25 + 
//      top16Rate * 0.15 + 
//      placementScore * 0.15 +
//      winRateFactor,  // ← ADICIONAR ESTA LINHA
//      0,
//      100
//    );
//
// 3. ADICIONAR no rows.push():
//
//    total_wins: totalWins,
//    total_losses: totalLosses,
//    win_rate: winRate ? Number(winRate.toFixed(2)) : null,
//
// ════════════════════════════════════════════════════════════════════

// Exemplo de como deve ficar:

const META_ANALYZER_ARCHETYPE_FUNCTION = `
async _analyzeArchetypes({ decks, now }) {
  const supabase = getSupabase();
  if (!decks.length) return [];

  const groups = new Map();
  for (const d of decks) {
    const archetype = d.archetype || d.name || "Unknown";
    const inks = safeArray(d.inks);
    const key = \`\${archetype}||\${inks.join(",")}\`;
    if (!groups.has(key)) groups.set(key, { archetype, inks, decks: [] });
    groups.get(key).decks.push(d);
  }

  const totalDecks = decks.length;
  const rows = [];

  for (const g of groups.values()) {
    const ds = g.decks;
    
    // ✅ NOVO: Calcular wins/losses
    const totalWins = ds.reduce((sum, d) => sum + (d.wins || 0), 0);
    const totalLosses = ds.reduce((sum, d) => sum + (d.losses || 0), 0);
    const totalMatches = totalWins + totalLosses;
    const winRate = totalMatches > 0 ? (totalWins / totalMatches) * 100 : null;
    
    const placements = ds.map((d) => (Number.isFinite(d.placement) ? d.placement : null)).filter((x) => x !== null);
    const avgPlacement = placements.length ? placements.reduce((a, b) => a + b, 0) / placements.length : null;

    const top8 = ds.filter((d) => (d.placement ?? 9999) <= 8).length;
    const top16 = ds.filter((d) => (d.placement ?? 9999) <= 16).length;
    const top32 = ds.filter((d) => (d.placement ?? 9999) <= 32).length;

    const top8Rate = ds.length ? (top8 / ds.length) * 100 : 0;
    const top16Rate = ds.length ? (top16 / ds.length) * 100 : 0;
    const top32Rate = ds.length ? (top32 / ds.length) * 100 : 0;

    const metaShare = (ds.length / totalDecks) * 100;
    const placementScore = avgPlacement ? clamp(100 - avgPlacement, 0, 100) : 0;
    
    // ✅ NOVO: Incluir win rate no power level
    const winRateFactor = winRate ? winRate * 0.2 : 0;
    const power = clamp(
      metaShare * 0.25 + 
      top8Rate * 0.25 + 
      top16Rate * 0.15 + 
      placementScore * 0.15 +
      winRateFactor,
      0,
      100
    );

    rows.push({
      archetype: g.archetype,
      inks: g.inks,
      total_decks: ds.length,
      
      // ✅ NOVO: Campos de win/loss
      total_wins: totalWins,
      total_losses: totalLosses,
      win_rate: winRate ? Number(winRate.toFixed(2)) : null,
      
      top4_count: ds.filter((d) => (d.placement ?? 9999) <= 4).length,
      top8_count: top8,
      top16_count: top16,
      top32_count: top32,
      top8_rate: Number(top8Rate.toFixed(2)),
      top16_rate: Number(top16Rate.toFixed(2)),
      top32_rate: Number(top32Rate.toFixed(2)),
      avg_placement: avgPlacement ? Number(avgPlacement.toFixed(2)) : null,
      meta_share: Number(metaShare.toFixed(2)),
      power_level: Number(power.toFixed(2)),
      tier: power >= 80 ? "S" : power >= 60 ? "A" : power >= 40 ? "B" : power >= 20 ? "C" : "D",
      trend: "Stable",
      trend_delta: 0,
      matchups: null,
      last_calculated: now,
      updated_at: now,
    });
  }

  const { error } = await supabase.from("archetypes_meta").upsert(rows, { onConflict: "archetype" });
  if (error) throw error;
  return rows;
}
`;

module.exports = { META_ANALYZER_ARCHETYPE_FUNCTION };

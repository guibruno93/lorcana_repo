/**
 * backend/services/tournament-scraper.js
 * v1.1 - COM WIN/LOSS TRACKING
 * 
 * Placeholder scraper que retorna dados do banco + extrai records
 */

const { createClient } = require('@supabase/supabase-js');
const { extractRecordFromDeck, estimateRecordFromPlacement } = require('./record-parser');

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not set');
  return createClient(url, key);
}

class TournamentScraper {
  /**
   * Scrape recent tournaments (placeholder - retorna dados do banco)
   * 
   * v1.1: Adiciona extração de win/loss para decks que não têm
   */
  async scrapeRecentTournaments(limit = 10) {
    console.log(`🔍 Scraping tournaments (limit: ${limit})...`);
    
    const supabase = getSupabase();
    
    // Buscar tournaments existentes
    const { data: tournaments, error } = await supabase
      .from('decks')
      .select('tournament_url')
      .not('tournament_url', 'is', null)
      .order('scraped_at', { ascending: false })
      .limit(1000);
    
    if (error) {
      console.error('❌ Error fetching tournaments:', error);
      return { tournaments: [], decks: [] };
    }
    
    // Agrupar por tournament
    const tournamentUrls = new Set();
    for (const deck of tournaments) {
      if (deck.tournament_url) {
        tournamentUrls.add(deck.tournament_url);
      }
    }
    
    const uniqueTournaments = Array.from(tournamentUrls).slice(0, limit);
    
    console.log(`✅ Found ${uniqueTournaments.length} tournaments`);
    
    // Buscar todos os decks desses tournaments
    const allDecks = [];
    
    for (const tournamentUrl of uniqueTournaments) {
      const { data: decks } = await supabase
        .from('decks')
        .select('*')
        .eq('tournament_url', tournamentUrl);
      
      if (decks) {
        allDecks.push(...decks);
      }
    }
    
    console.log(`✅ Found ${allDecks.length} decks`);
    
    // ✨ NOVO: Extrair/estimar records para decks que não têm
    await this.extractRecordsForDecks(allDecks);
    
    return {
      tournaments: uniqueTournaments.map(url => ({ url })),
      decks: allDecks
    };
  }
  
  /**
   * ✨ NOVO v1.1: Extrair records de decks
   * 
   * Tenta extrair record de:
   * 1. Campo explícito
   * 2. Nome do deck
   * 3. Descrição
   * 4. Estimativa baseada em placement
   */
  async extractRecordsForDecks(decks) {
    const supabase = getSupabase();
    const updates = [];
    
    for (const deck of decks) {
      // Pular se já tem wins/losses
      if (deck.wins > 0 || deck.losses > 0) continue;
      
      // Tentar extrair record
      let record = extractRecordFromDeck(deck);
      
      // Se não encontrou, estimar por placement
      if (record.wins === 0 && record.losses === 0 && deck.placement) {
        record = estimateRecordFromPlacement(deck.placement, 32);
      }
      
      // Se encontrou algo, preparar update
      if (record.wins > 0 || record.losses > 0) {
        updates.push({
          id: deck.id,
          wins: record.wins,
          losses: record.losses,
          draws: record.draws,
          record: record.record
        });
      }
    }
    
    // Fazer update em batch
    if (updates.length > 0) {
      console.log(`📊 Updating ${updates.length} decks with records...`);
      
      const { error } = await supabase
        .from('decks')
        .upsert(updates, { onConflict: 'id' });
      
      if (error) {
        console.error('❌ Error updating records:', error);
      } else {
        console.log(`✅ Updated ${updates.length} deck records`);
      }
    }
    
    return updates.length;
  }
  
  /**
   * Import decks to database
   */
  async importDecks(decks) {
    if (!decks || decks.length === 0) {
      console.log('⚠️  No decks to import');
      return { imported: 0, errors: 0 };
    }
    
    const supabase = getSupabase();
    
    // ✨ Adicionar record extraction para cada deck
    const enrichedDecks = decks.map(deck => {
      const record = extractRecordFromDeck(deck);
      
      return {
        ...deck,
        wins: record.wins,
        losses: record.losses,
        draws: record.draws,
        record: record.record
      };
    });
    
    const { error } = await supabase
      .from('decks')
      .upsert(enrichedDecks, { onConflict: 'url' });
    
    if (error) {
      console.error('❌ Import error:', error);
      return { imported: 0, errors: decks.length };
    }
    
    console.log(`✅ Imported ${decks.length} decks with records`);
    
    return { imported: decks.length, errors: 0 };
  }
}

module.exports = new TournamentScraper();

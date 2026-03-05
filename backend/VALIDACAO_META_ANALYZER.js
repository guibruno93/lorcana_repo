/**
 * VALIDAÇÃO: meta-analyzer.js
 * 
 * Status das mudanças solicitadas:
 * ✅ = Implementado corretamente
 * ⚠️ = Implementado mas com erro de sintaxe
 * ❌ = Não implementado
 */

// ═══════════════════════════════════════════════════════════════════
// ✅ MUDANÇA 1: Constante ANALYSIS_FORMAT - OK!
// ═══════════════════════════════════════════════════════════════════

// Linha 15-16: CORRETO
const ANALYSIS_FORMAT = process.env.LORCANA_FORMAT || 'core';
console.log(`🎯 Meta Analyzer configured for: ${ANALYSIS_FORMAT.toUpperCase()}`);

// ═══════════════════════════════════════════════════════════════════
// ✅ MUDANÇA 2: Filtro em #fetchAllDecksSince - OK!
// ═══════════════════════════════════════════════════════════════════

// Linha 442: CORRETO
const { data, error } = await this.supabase
  .from("decks")
  .select(select)
  .eq("format", ANALYSIS_FORMAT)  // ✅ PRESENTE
  .gte("scraped_at", sinceISO)
  .range(from, to);

// ═══════════════════════════════════════════════════════════════════
// ✅ MUDANÇA 3: Logs em analyzeArchetypes - OK!
// ═══════════════════════════════════════════════════════════════════

// Linhas 189, 197-200: CORRETO
console.log(`📊 Analyzing ${ANALYSIS_FORMAT.toUpperCase()} format (last ${days} days)`);
if (!decks.length){
  console.log(`⚠️  No ${ANALYSIS_FORMAT} decks found`);
  return [];
}
console.log(`✅ Found ${decks.length} ${ANALYSIS_FORMAT} decks`);

// ═══════════════════════════════════════════════════════════════════
// ✅ MUDANÇA 4: Formato em calculateTierList - OK!
// ═══════════════════════════════════════════════════════════════════

// Linhas 68-71: CORRETO
return {
  tierList: data || [],
  metadata: {
    format: ANALYSIS_FORMAT,  // ✅ PRESENTE
    generatedAt: new Date().toISOString(),
    totalArchetypes: data?.length || 0
  }
};

// ═══════════════════════════════════════════════════════════════════
// ❌ ERRO 1: getDashboardStats - LINHA 130 INCOMPLETA!
// ═══════════════════════════════════════════════════════════════════

// CÓDIGO ATUAL (ERRADO):
const { count: totalDecks, error: c1 } = await this.supabase
  .select("id", { count: "exact" })
  .eq("format", ANALYSIS_FORMAT)  // ← Falta .from("decks") ANTES!
  .gte("scraped_at", sinceISO);

// CORREÇÃO:
const { count: totalDecks, error: c1 } = await this.supabase
  .from("decks")  // ← ADICIONAR ESTA LINHA
  .select("id", { count: "exact" })
  .eq("format", ANALYSIS_FORMAT)
  .gte("scraped_at", sinceISO);

// ═══════════════════════════════════════════════════════════════════
// ❌ ERRO 2: getDashboardStats - LINHA 138 INCOMPLETA!
// ═══════════════════════════════════════════════════════════════════

// CÓDIGO ATUAL (ERRADO):
const { data: archetypes, error: a1 } = await this.supabase
  .from("archetype_meta")
  .select("*")
  .eq("days", days)
  .eq("format", ANALYSIS_FORMAT)
  .order(...);  // ← SINTAXE INVÁLIDA! Falta parâmetros

// CORREÇÃO:
const { data: archetypes, error: a1 } = await this.supabase
  .from("archetype_meta")
  .select("*")
  .eq("days", days)
  .eq("format", ANALYSIS_FORMAT)
  .order("total_decks", { ascending: false });  // ← CORRIGIR

// ═══════════════════════════════════════════════════════════════════
// ❌ ERRO 3: analyzeArchetypes - UPSERT COM SINTAXE ERRADA!
// ═══════════════════════════════════════════════════════════════════

// CÓDIGO ATUAL (TOTALMENTE ERRADO):
const { error: upErr } = await this.supabase
  .from("archetype_meta")
  .upsert(rows, {
    archetype,        // ← ERRO! Estes campos não são parâmetros do upsert
    days,             // ← ERRO!
    format: ANALYSIS_FORMAT,  // ← ERRO!
    total_decks,      // ← ERRO!
  },
  onConflict: "archetype,days,format"  // ← onConflict fora do objeto!
);

// CORREÇÃO:
const { error: upErr } = await this.supabase
  .from("archetype_meta")
  .upsert(rows, {
    onConflict: "archetype,days,format"  // ← Deve estar DENTRO do objeto
  });

// ═══════════════════════════════════════════════════════════════════
// RESUMO DE ERROS ENCONTRADOS
// ═══════════════════════════════════════════════════════════════════

/*
ERRO 1 (Linha 130):
  ❌ Falta .from("decks")
  
ERRO 2 (Linha 138):
  ❌ .order(...) incompleto
  
ERRO 3 (Linhas 357-364):
  ❌ upsert com sintaxe completamente errada
  
IMPACTO:
  - getDashboardStats VAI FALHAR (erro de query)
  - analyzeArchetypes VAI FALHAR (erro de sintaxe)
  - Backend não consegue inserir dados na tabela archetype_meta
  
STATUS GERAL: ⚠️ CÓDIGO NÃO FUNCIONAL
*/

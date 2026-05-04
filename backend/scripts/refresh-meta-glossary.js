#!/usr/bin/env node
'use strict';

/**
 * Gera glossário + “como o deck funciona” por arquétipo (LLM) a partir de scraped_decks.
 * Agendamento: Cron noturno (ver jobs/inkdecks-meta-cron.js) ou manual:
 *   node scripts/refresh-meta-glossary.js
 *
 * Requer: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const { writeGlossary } = require('../services/meta-glossary-store');

const TOP_N = Math.max(
  3,
  Math.min(24, parseInt(process.env.META_GLOSSARY_TOP_N || '15', 10) || 15)
);

async function loadTopArchetypes() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const { data: decks, error } = await supabase
    .from('scraped_decks')
    .select('archetype, wins, losses, deck_name');
  if (error) throw error;
  const counts = {};
  const wl = {};
  for (const d of decks || []) {
    const a = d.archetype || 'Unknown';
    counts[a] = (counts[a] || 0) + 1;
    if (!wl[a]) wl[a] = { w: 0, l: 0 };
    wl[a].w += Number(d.wins) || 0;
    wl[a].l += Number(d.losses) || 0;
  }
  const rows = Object.entries(counts)
    .map(([archetype, deck_count]) => {
      const g = wl[archetype] || { w: 0, l: 0 };
      const games = g.w + g.l;
      const wr = games > 0 ? ((g.w / games) * 100).toFixed(1) : null;
      return { archetype, deck_count, win_rate: wr, games };
    })
    .sort((a, b) => b.deck_count - a.deck_count)
    .slice(0, TOP_N);
  return rows;
}

async function runAnthropic(archetypeRows) {
  let AnthropicCtor;
  try {
    AnthropicCtor = require('@anthropic-ai/sdk').Anthropic;
  } catch {
    throw new Error('@anthropic-ai/sdk não instalado');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY em falta');
  }
  const model =
    process.env.META_GLOSSARY_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    'claude-3-5-haiku-20241022';
  const anthropic = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPayload = JSON.stringify(
    archetypeRows.map((r) => ({
      archetype: r.archetype,
      deck_count: r.deck_count,
      aggregated_win_rate_pct: r.win_rate,
      games_recorded: r.games,
    })),
    null,
    2
  );

  const system = `És especialista em Disney Lorcana (TCG). Respondes APENAS com JSON válido, sem markdown.
O JSON deve ter a forma:
{ "entries": [ { "archetype": "string", "glossary": "2-4 frases em português (definição do arquétipo no meta)", "how_it_plays": "4-8 frases em português (plano de jogo típico, curva, matchups gerais)" } ] }
Inclui um objeto por arquétipo na mesma ordem do input. Usa nomes de tintas e estilos (aggro, midrange, control) quando fizer sentido.`;

  const message = await anthropic.messages.create({
    model,
    max_tokens: 8192,
    system,
    messages: [
      {
        role: 'user',
        content: `Arquétipos e estatísticas agregadas (scraped_decks):\n${userPayload}`,
      },
    ],
  });

  let text = message.content[0].text.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(text);
  if (!parsed.entries || !Array.isArray(parsed.entries)) {
    throw new Error('Resposta LLM sem array entries');
  }
  return parsed.entries;
}

async function main() {
  console.log('📚 refresh-meta-glossary: a carregar arquétipos…');
  const rows = await loadTopArchetypes();
  if (!rows.length) {
    console.warn('Sem arquétipos em scraped_decks; abortar.');
    writeGlossary({
      entries: [],
      generated_at: new Date().toISOString(),
      source: 'empty',
    });
    process.exit(0);
  }
  console.log(`   Top ${rows.length} arquétipos (por contagens de decks).`);
  const entries = await runAnthropic(rows);
  const doc = writeGlossary({
    entries,
    generated_at: new Date().toISOString(),
    source: 'anthropic',
  });
  console.log(`✅ Glossário gravado (${doc.entries.length} entradas).`);
}

main().catch((e) => {
  console.error('❌ refresh-meta-glossary:', e.message);
  process.exit(1);
});

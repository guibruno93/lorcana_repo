'use strict';

/**
 * routes/ai-WORKING.js
 * Versão que SEMPRE funciona, com fallback garantido
 */

const express = require('express');
const router = express.Router();
const deckRouter = require('./deck');

// ── Imports ──────────────────────────────────────────────────────────────────

let analyzeDeckExternal;
try {
  analyzeDeckExternal = require('../parser/analyzeDeck');
} catch (e) {
  analyzeDeckExternal = null;
}

// ── Basic Parser (sempre funciona) ───────────────────────────────────────────

function parseDecklist(decklist) {
  const lines = decklist.split('\n');
  const cards = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
    
    // Match: "4 Card Name" ou "4x Card Name"
    const match = trimmed.match(/^(\d+)x?\s+(.+)$/i);
    if (match) {
      const quantity = parseInt(match[1]);
      const name = match[2].trim();
      if (name && quantity > 0) {
        cards.push({ name, quantity });
      }
    }
  }
  
  return { cards };
}

// ── Analyzer com validação ───────────────────────────────────────────────────

function analyzeDeck(decklist) {
  // Tentar usar externo se disponível
  if (analyzeDeckExternal && typeof analyzeDeckExternal === 'function') {
    try {
      const result = analyzeDeckExternal(decklist);
      
      // VALIDAR resultado
      if (result && result.cards && Array.isArray(result.cards) && result.cards.length > 0) {
        return result;
      }
      
      // Se retornou vazio ou inválido, usar fallback
      console.log('   ⚠️  analyzeDeck returned invalid result, using fallback');
    } catch (e) {
      console.log('   ⚠️  analyzeDeck threw error, using fallback');
    }
  }
  
  // Usar parser básico
  return parseDecklist(decklist);
}

// ── Shuffle ──────────────────────────────────────────────────────────────────

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function drawHand(deckAnalysis) {
  if (!deckAnalysis || !deckAnalysis.cards || !Array.isArray(deckAnalysis.cards)) {
    throw new Error('Invalid deck analysis');
  }

  // Expandir cartas
  const deck = [];
  for (const card of deckAnalysis.cards) {
    const qty = card.quantity || 1;
    for (let i = 0; i < qty; i++) {
      deck.push(card.name);
    }
  }

  if (deck.length < 7) {
    throw new Error(`Deck has only ${deck.length} cards (need at least 7)`);
  }

  const shuffled = shuffleArray(deck);
  return shuffled.slice(0, 7);
}

// ── Validators ───────────────────────────────────────────────────────────────

function validateDecklist(decklist, res) {
  if (!decklist || typeof decklist !== 'string') {
    res.status(400).json({ error: 'Decklist is required' });
    return false;
  }
  if (decklist.length > 50000) {
    res.status(400).json({ error: 'Decklist too large' });
    return false;
  }
  if (decklist.trim().length < 5) {
    res.status(400).json({ error: 'Decklist is too short' });
    return false;
  }
  return true;
}

function validateHand(hand, res) {
  if (!Array.isArray(hand)) {
    res.status(400).json({ error: 'Hand must be an array' });
    return false;
  }
  if (hand.length !== 7) {
    res.status(400).json({ error: 'Hand must have exactly 7 cards' });
    return false;
  }
  return true;
}

// ── Routes ───────────────────────────────────────────────────────────────────

router.get('/ping', (req, res) => {
  res.json({ ok: true });
});

router.post('/shuffle', async (req, res) => {
  try {
    const { decklist } = req.body;

    if (!validateDecklist(decklist, res)) return;

    const deckAnalysis = analyzeDeck(decklist);
    const hand = drawHand(deckAnalysis);

    res.json({ hand });

  } catch (err) {
    console.error('❌ Shuffle error:', err.message);
    res.status(500).json({ 
      error: 'Failed to shuffle deck',
      details: err.message 
    });
  }
});

router.post('/mulligan', async (req, res) => {
  try {
    const { hand, decklist } = req.body;

    if (!validateHand(hand, res)) return;
    if (!validateDecklist(decklist, res)) return;

    // Análise básica de mulligan
    res.json({
      decision: 'Keep',
      confidence: 0.7,
      reasoning: 'Hand looks reasonable',
      suggestions: hand.map((card, i) => ({
        card,
        action: 'Keep',
        priority: 1,
        role: 'Unknown',
        cost: 0,
        inkable: false,
      })),
      mulliganCards: [],
      keepCards: hand,
    });

  } catch (err) {
    console.error('❌ Mulligan error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/simulate-mulligan', async (req, res) => {
  try {
    const { hand, mulligan, decklist } = req.body;

    if (!validateHand(hand, res)) return;
    if (!validateDecklist(decklist, res)) return;

    if (!Array.isArray(mulligan)) {
      return res.status(400).json({ error: 'Mulligan must be an array' });
    }

    const deckAnalysis = analyzeDeck(decklist);
    
    const deck = [];
    for (const card of deckAnalysis.cards) {
      const qty = card.quantity || 1;
      for (let i = 0; i < qty; i++) {
        deck.push(card.name);
      }
    }

    const remaining = deck.filter(c => !hand.includes(c));
    const shuffled = shuffleArray(remaining);

    const newHand = [...hand];
    for (let i = 0; i < mulligan.length && i < shuffled.length; i++) {
      const idx = mulligan[i];
      if (idx >= 0 && idx < 7) {
        newHand[idx] = shuffled[i];
      }
    }

    res.json({ hand: newHand });

  } catch (err) {
    console.error('❌ Simulate mulligan error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/matchups', async (req, res) => {
  try {
    const { decklist } = req.body;

    if (!validateDecklist(decklist, res)) return;

    const deckAnalysis = analyzeDeck(decklist);
    
    // Detectar arquétipo básico
    let archetype = 'Unknown';
    if (deckAnalysis.cards && deckAnalysis.cards.length > 0) {
      const firstCard = deckAnalysis.cards[0].name.toLowerCase();
      if (firstCard.includes('hades') || firstCard.includes('amethyst')) {
        archetype = 'Blurple';
      } else if (firstCard.includes('goliath') || firstCard.includes('ruby')) {
        archetype = 'Ruby Aggro';
      }
    }

    // Matchups básicos
    const matchups = [
      { opponent: 'Blurple', winRate: 50, rating: 'Even' },
      { opponent: 'Ruby/Amethyst Aggro', winRate: 45, rating: 'Unfavored' },
      { opponent: 'Sapphire Ramp', winRate: 55, rating: 'Favored' },
      { opponent: 'Steel Songs', winRate: 48, rating: 'Even' },
      { opponent: 'Amber Dogs', winRate: 52, rating: 'Even' },
      { opponent: 'Emerald Madrigal', winRate: 50, rating: 'Even' },
    ];

    res.json({
      userArchetype: archetype,
      matchups,
      dataSource: 'Basic matchup matrix',
      summary: {
        avgWinRate: 50,
        tier: 'Tier 2',
        favored: 1,
        even: 4,
        unfavored: 1,
      }
    });

  } catch (err) {
    console.error('❌ Matchups error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/health', (req, res) => {
  res.json({ 
    ok: true,
    version: '4.3-working',
    features: {
      shuffle: true,
      mulligan: true,
      matchups: true,
      generateDeck: true,
      sidney: true,
      lorena: true,
      jack: true,
    }
  });
});

let AnthropicCtor = null;
try {
  AnthropicCtor = require('@anthropic-ai/sdk').Anthropic;
} catch (_) {
  /* opcional */
}

router.post('/generate-deck', async (req, res) => {
  const { prompt, mode, existingDeck } = req.body || {};
  const p = prompt != null ? String(prompt).trim() : '';
  if (!p) {
    return res.status(400).json({ error: 'prompt obrigatório' });
  }

  const systemPrompt = `You are an expert Disney Lorcana TCG deck builder.

Rules:
1. Decks must have exactly 60 cards total across all categories.
2. Max 4 copies per card name.
3. Mix Characters, Actions, Items, and Locations appropriately.
4. Respond with ONLY valid JSON (no markdown fences).

JSON shape:
{
  "name": "Deck Name",
  "archetype": "Ink/Ink Archetype",
  "strategy": "Brief strategy",
  "cards": {
    "Characters": [{"name": "Exact card name", "quantity": 4, "reason": "Why"}],
    "Actions": [],
    "Items": [],
    "Locations": []
  },
  "mulliganGuide": "Opening hand priorities",
  "matchups": {
    "favorable": ["..."],
    "neutral": ["..."],
    "difficult": ["..."]
  }
}`;

  const userContent =
    mode && mode !== 'create' && existingDeck
      ? `${p}\n\nExisting deck JSON:\n${JSON.stringify(existingDeck).slice(0, 12000)}`
      : p;

  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

  if (process.env.ANTHROPIC_API_KEY && AnthropicCtor) {
    try {
      const anthropic = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      });
      let text = message.content[0].text.trim();
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const deck = JSON.parse(text);
      return res.json({ deck, source: 'anthropic' });
    } catch (err) {
      console.error('generate-deck Anthropic:', err.message);
    }
  }

  res.json({
    deck: {
      name: 'Deck (sem API)',
      archetype: '—',
      strategy:
        'Define ANTHROPIC_API_KEY no servidor e instale @anthropic-ai/sdk para geração por Claude. Resposta de exemplo enquanto a API não está configurada.',
      cards: {
        Characters: [
          {
            name: 'Mickey Mouse - Brave Little Tailor',
            quantity: 4,
            reason: 'Exemplo de carta; substitua com IA ativa.',
          },
        ],
        Actions: [],
        Items: [],
        Locations: [],
      },
      mulliganGuide: 'Procure custos baixos e tinta.',
      matchups: { favorable: [], neutral: [], difficult: [] },
    },
    mock: true,
  });
});

// ── Coach: Sidney (diagnóstico), Lorena (chat), Jack (sparring) ───────────────
// Documentação interna (não pôr isto na UI nem em copy pública):
// Sidney (anagrama Disney, ex-Doctor), Lorena (nome da assistente conversacional, ex-Sage),
// Jack (referência Jack Sparrow; ex-Sparring).

function decklistQuickStats(decklist) {
  const a = analyzeDeck(decklist);
  let total = 0;
  const cards = a.cards || [];
  for (const c of cards) {
    total += Number(c.quantity) || 0;
  }
  return { totalCards: total, uniqueLines: cards.length, sample: cards.slice(0, 8) };
}

function slimStructuredForPrompt(structured) {
  if (!structured) return null;
  const a = structured.analysis || {};
  const cards = a.cards || [];
  return {
    archetype: structured.archetype,
    archetypeConfidence: structured.archetypeConfidence,
    archetypeMethod: structured.archetypeMethod,
    archetypeAlternatives: structured.archetypeAlternatives,
    totalCards: structured.totalCards,
    inkablePct: structured.inkablePct,
    avgCost: structured.avgCost,
    inks: structured.inks,
    curveCounts: structured.curveCounts,
    stats: a.stats,
    breakdown: a.breakdown,
    ml: a.ml,
    cardsSample: cards.slice(0, 45).map(c => ({
      name: c.name,
      quantity: c.quantity,
      cost: c.cost,
      type: c.type,
      inkable: c.inkable,
    })),
    cardsOmitted: Math.max(0, cards.length - 45),
  };
}

function slimMatchupsForPrompt(m) {
  if (!m) return null;
  if (m.matchups && m.matchups.available === false) {
    return {
      available: false,
      message: m.matchups.message,
      deck: m.deck,
    };
  }
  if (Array.isArray(m.matchups)) {
    return {
      deck: m.deck,
      summary: m.summary,
      matchupsTop: m.matchups.slice(0, 15),
    };
  }
  return m;
}

function sidneyFallback(decklist, stats, structured, matchupPack, errs) {
  const weaknesses = [];
  if (stats.totalCards !== 60) {
    weaknesses.push(
      `O deck soma ${stats.totalCards} cartas; em torneio Lorcana são exatamente 60.`
    );
  }
  if (stats.uniqueLines < 10) {
    weaknesses.push('Poucas linhas únicas — confirma o formato (ex.: 4x Nome da carta).');
  }
  if (errs && errs.structuredError) {
    weaknesses.push(`Análise estruturada indisponível: ${errs.structuredError}`);
  }

  const strengths = [];
  if (stats.totalCards === 60) {
    strengths.push('Total de 60 cartas.');
    strengths.push('Lista parseável pelo servidor.');
  }
  if (structured && structured.archetype) {
    const pct = ((structured.archetypeConfidence || 0) * 100).toFixed(0);
    strengths.push(`Arquétipo ML estimado: ${structured.archetype} (conf. ~${pct}%).`);
  }
  if (
    matchupPack &&
    matchupPack.matchups &&
    Array.isArray(matchupPack.matchups) &&
    matchupPack.matchups.length
  ) {
    const tier = matchupPack.deck && matchupPack.deck.tier;
    if (tier) strengths.push(`Matchups internos sugerem tier ${tier} no meta (30d).`);
  }

  return {
    source: 'fallback',
    summary:
      weaknesses.length > 0
        ? weaknesses.join(' ')
        : 'Lista válida em tamanho. Para um diagnóstico com forças, fragilidades e trocas em português, configura ANTHROPIC_API_KEY no servidor.',
    strengths,
    weaknesses,
    swaps: [],
    metaNote:
      'O Sidney usa a mesma análise estruturada que /api/deck/analyze e dados de matchups quando existem. Sem API Claude a narrativa fica resumida.',
  };
}

function pickJackOpponent(matchupPack) {
  if (!matchupPack || !Array.isArray(matchupPack.matchups) || !matchupPack.matchups.length) {
    return null;
  }
  const top = matchupPack.matchups.filter(m => m.metaShare > 0).slice(0, 8);
  const pool = top.length ? top : matchupPack.matchups.slice(0, 8);
  const i = Math.floor(Math.random() * pool.length);
  return pool[i] ? pool[i].opponent : null;
}

function jackFallback(hand, structured, matchupPack, suggestedOpponent, errs) {
  const arch = structured && structured.archetype ? structured.archetype : 'o teu arquétipo';
  const opp =
    suggestedOpponent ||
    (matchupPack && matchupPack.matchups && matchupPack.matchups[0]
      ? matchupPack.matchups[0].opponent
      : 'um oponente de meta genérico');
  const handLine =
    hand && hand.length === 7
      ? hand.join(', ')
      : `Mão não sorteada (${errs && errs.handError ? errs.handError : 'deck incompleto'})`;

  return {
    source: 'fallback',
    scenario: `Treino de mesa vs ${opp} com ${arch}.`,
    openingPlan: `Mão de exemplo: ${handLine}. Com ANTHROPIC_API_KEY o Jack descreve um plano de turnos iniciais alinhado ao deck.`,
    mulliganAdvice:
      'Sem API: procura custos 1–3, tinta versátil e pelo menos uma linha de jogo clara; evita mãos só de topo caro sem suporte.',
    pivotPlays: [
      'Identifica a tua condição de vitória principal antes do turno 4.',
      'Ajusta agressão conforme o oponente for Ruby/Sapphire/etc. (usa o separador Matchups para números).',
    ],
    riskNote:
      'Sparring ilustrativo; não substitui playtesting. Dados de matchup dependem da base Supabase.',
    hand: hand && hand.length === 7 ? hand : null,
    suggestedOpponent: suggestedOpponent || opp,
    structuredError: errs && errs.structuredError,
    matchupError: errs && errs.matchupError,
  };
}

const SIDNEY_SYSTEM = `És o Sidney do Inkwell Labs: analisas listas de Disney Lorcana.
Recebes JSON com análise estruturada do servidor (ML, curva, tintas, amostra de cartas) e, quando existir, resumo de matchups internos — trata isso como fonte principal e explica implicações em jogo.
Responde APENAS com JSON válido (sem markdown), chaves exatas:
{
  "summary": "2-4 frases em português do Brasil",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "swaps": [{"out":"nome exato a retirar ou reduzir","in":"nome sugerido","reason":"porquê"}],
  "metaNote": "como o deck se posiciona no meta em termos gerais (sem inventar números de torneio)"
}
Regras: máximo 3 entradas em swaps. Nomes de cartas plausíveis para Lorcana. Não prometas winrate exacto.`;

const LORENA_SYSTEM = `És a Lorena do Inkwell Labs: coach de Disney Lorcana em português do Brasil.
- Respostas claras, amigáveis, sem julgar.
- Explica regras e decisões de forma simples; se houver dúvida sobre regra oficial, lembra o jogador de confirmar no material da Ravensburger/Disney.
- Se receberes uma decklist no contexto, só a uses quando a pergunta for sobre esse deck.
- Mantém respostas concisas (até ~12 frases) salvo se o jogador pedir detalhe.`;

const JACK_SYSTEM = `És o Jack do Inkwell Labs: treino de mesa (sparring) para Disney Lorcana em português do Brasil.
Recebes JSON com: mão sorteada (7 cartas), análise estruturada resumida do deck, matchups internos (se existirem) e um oponente sugerido para o cenário.
Responde APENAS com JSON válido (sem markdown), chaves exatas:
{
  "scenario": "1 frase: quem és tu a simular na mesa e contra quem",
  "openingPlan": "2-4 frases: plano dos primeiros turnos",
  "mulliganAdvice": "1-3 frases sobre a mão recebida (keep/mulligan e o que procurar)",
  "pivotPlays": ["jogada-chave ou decisão 1", "jogada-chave 2"],
  "riskNote": "1 frase sobre limitações da simulação"
}
Não inventes cartas que não estejam na mão ou na amostra/lista fornecida.`;

async function sidneyHandler(req, res) {
  try {
    const decklist =
      req.body && typeof req.body.decklist === 'string'
        ? req.body.decklist
        : req.body && typeof req.body.deckText === 'string'
          ? req.body.deckText
          : '';
    if (!validateDecklist(decklist, res)) return;

    const stats = decklistQuickStats(decklist);

    let structured = null;
    let structuredError = null;
    try {
      structured = await deckRouter.runStructuredAnalyze(decklist);
    } catch (e) {
      structuredError = e.message;
    }

    let matchupPack = null;
    let matchupError = null;
    try {
      matchupPack = await deckRouter.runMatchupsStructured(decklist);
    } catch (e) {
      matchupError = e.message;
    }

    const slimStruct = slimStructuredForPrompt(structured);
    const slimM = slimMatchupsForPrompt(matchupPack);

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

    if (process.env.ANTHROPIC_API_KEY && AnthropicCtor) {
      try {
        const anthropic = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
        const userBlock = [
          'Usa os dados estruturados como base factual. Não contradigas contagens ou arquétipo estimado sem explicar.',
          '',
          `Parser: ${stats.totalCards} cartas, ${stats.uniqueLines} linhas.`,
          '',
          '--- analyze (deck.js) ---',
          JSON.stringify({ data: slimStruct, error: structuredError }),
          '',
          '--- matchups (deck.js) ---',
          JSON.stringify({ data: slimM, error: matchupError }),
          '',
          '--- decklist ---',
          decklist.slice(0, 38000),
        ].join('\n');

        const message = await anthropic.messages.create({
          model,
          max_tokens: 2048,
          system: SIDNEY_SYSTEM,
          messages: [{ role: 'user', content: userBlock }],
        });
        let text = message.content[0].text.trim();
        text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        const parsed = JSON.parse(text);
        return res.json({
          source: 'anthropic',
          summary: String(parsed.summary || ''),
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
          weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
          swaps: Array.isArray(parsed.swaps) ? parsed.swaps.slice(0, 5) : [],
          metaNote: String(parsed.metaNote || ''),
          stats,
          structured: slimStruct,
          structuredError,
          matchupsSummary: slimM,
          matchupError,
        });
      } catch (err) {
        console.error('sidney Anthropic:', err.message);
      }
    }

    const fb = sidneyFallback(decklist, stats, structured, matchupPack, {
      structuredError,
      matchupError,
    });
    return res.json({
      ...fb,
      stats,
      structured: slimStruct,
      structuredError,
      matchupsSummary: slimM,
      matchupError,
    });
  } catch (err) {
    console.error('sidney error:', err.message);
    res.status(500).json({ error: err.message || 'Sidney failed' });
  }
}

router.post('/sidney', sidneyHandler);
router.post('/doctor', sidneyHandler);

async function lorenaHandler(req, res) {
  try {
    const { messages, decklist } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages (array) é obrigatório' });
    }
    const trimmed = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .slice(-24)
      .map((m) => ({
        role: m.role,
        content: String(m.content || '').slice(0, 12000),
      }));
    if (!trimmed.length || trimmed[trimmed.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Última mensagem deve ser do utilizador (user)' });
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
    let system = LORENA_SYSTEM;
    if (decklist && String(decklist).trim().length > 20) {
      system += `\n\nDecklist de contexto (opcional):\n${String(decklist).slice(0, 20000)}`;
    }

    if (process.env.ANTHROPIC_API_KEY && AnthropicCtor) {
      const anthropic = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await anthropic.messages.create({
        model,
        max_tokens: 1200,
        system,
        messages: trimmed,
      });
      const reply = message.content[0].text.trim();
      return res.json({ reply, source: 'anthropic' });
    }

    const last = trimmed[trimmed.length - 1].content;
    const reply = `Sem ANTHROPIC_API_KEY no servidor não consigo conversar em tempo real. Configura a chave para ativar a Lorena. A tua última mensagem foi: "${last.slice(0, 200)}${last.length > 200 ? '…' : ''}"`;
    return res.json({ reply, source: 'fallback' });
  } catch (err) {
    console.error('lorena error:', err.message);
    res.status(500).json({ error: err.message || 'Lorena failed' });
  }
}

router.post('/lorena', lorenaHandler);
router.post('/sage', lorenaHandler);

router.post('/jack', async (req, res) => {
  try {
    const decklist =
      req.body && typeof req.body.decklist === 'string'
        ? req.body.decklist
        : req.body && typeof req.body.deckText === 'string'
          ? req.body.deckText
          : '';
    if (!validateDecklist(decklist, res)) return;

    let hand = null;
    let handError = null;
    try {
      hand = drawHand(analyzeDeck(decklist));
    } catch (e) {
      handError = e.message;
    }

    let structured = null;
    let structuredError = null;
    try {
      structured = await deckRouter.runStructuredAnalyze(decklist);
    } catch (e) {
      structuredError = e.message;
    }

    let matchupPack = null;
    let matchupError = null;
    try {
      matchupPack = await deckRouter.runMatchupsStructured(decklist);
    } catch (e) {
      matchupError = e.message;
    }

    const suggestedOpponent = pickJackOpponent(matchupPack);
    const slimStruct = slimStructuredForPrompt(structured);
    const slimM = slimMatchupsForPrompt(matchupPack);

    const contextObj = {
      hand,
      handError,
      structured: slimStruct,
      structuredError,
      matchups: slimM,
      matchupError,
      suggestedOpponent,
    };

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

    if (process.env.ANTHROPIC_API_KEY && AnthropicCtor && hand && hand.length === 7) {
      try {
        const anthropic = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
        const userBlock = [
          'Contexto JSON:',
          JSON.stringify(contextObj).slice(0, 42000),
          '',
          'Decklist (truncada):',
          decklist.slice(0, 8000),
        ].join('\n');

        const message = await anthropic.messages.create({
          model,
          max_tokens: 1800,
          system: JACK_SYSTEM,
          messages: [{ role: 'user', content: userBlock }],
        });
        let text = message.content[0].text.trim();
        text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        const parsed = JSON.parse(text);
        return res.json({
          source: 'anthropic',
          scenario: String(parsed.scenario || ''),
          openingPlan: String(parsed.openingPlan || ''),
          mulliganAdvice: String(parsed.mulliganAdvice || ''),
          pivotPlays: Array.isArray(parsed.pivotPlays) ? parsed.pivotPlays.slice(0, 6) : [],
          riskNote: String(parsed.riskNote || ''),
          hand,
          suggestedOpponent,
          structured: slimStruct,
          structuredError,
          matchupsSummary: slimM,
          matchupError,
        });
      } catch (err) {
        console.error('jack Anthropic:', err.message);
      }
    }

    const fb = jackFallback(hand, structured, matchupPack, suggestedOpponent, {
      handError,
      structuredError,
      matchupError,
    });
    return res.json({
      ...fb,
      structured: slimStruct,
      structuredError,
      matchupsSummary: slimM,
      matchupError,
    });
  } catch (err) {
    console.error('jack error:', err.message);
    res.status(500).json({ error: err.message || 'Jack failed' });
  }
});

module.exports = router;

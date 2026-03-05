'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const indexScraper = require('./inkdecksIndexScraper');
const deckScraper = require('./inkdecksDeckScraper');

/**
 * MELHORIAS ANTI-DETECÇÃO:
 * - User-Agent real do Chrome
 * - Aceitar bloqueio gracefully (não insistir)
 * - Delays maiores entre requests
 * - Persistent context (mantém cookies/sessão)
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function detectBlock(status, title) {
  const t = String(title || '');
  return status === 403 || /Attention Required|Cloudflare/i.test(t);
}

function parseBool(v, def = false) {
  if (v === undefined || v === null) return def;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y';
}

function parseNum(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [k, maybeV] = a.slice(2).split('=');
    if (maybeV !== undefined) out[k] = maybeV;
    else {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[k] = next;
        i++;
      } else {
        out[k] = '1';
      }
    }
  }
  return out;
}

function safeReadJson(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function safeWriteJson(p, obj) {
  const tmp = `${p}.tmp`;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, p);
}

function sumQty(deck) {
  const cards = Array.isArray(deck.cards) ? deck.cards : [];
  return cards.reduce((a, c) => a + (Number(c.quantity || c.qty || 0) || 0), 0);
}

function upsertByUrl(list, deck) {
  const url = String(deck.url || '');
  const idx = list.findIndex((d) => String(d.url || '') === url);
  if (idx >= 0) list[idx] = { ...list[idx], ...deck };
  else list.push(deck);
}

async function makeContext({ headless, userDataDir, storageStatePath, channel, navTimeoutMs }) {
  const launchOpts = { 
    headless: !!headless,
    // ✅ ANTI-DETECÇÃO: Args do Chrome para evitar detecção
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
    ]
  };
  
  if (channel) launchOpts.channel = channel;
  
  if (userDataDir) {
    const ctx = await chromium.launchPersistentContext(userDataDir, {
      ...launchOpts,
      viewport: { width: 1920, height: 1080 }, // ✅ Resolução real
      // ✅ User-Agent real do Chrome
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation'],
      // ✅ Headers realistas
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      }
    });
    ctx.setDefaultNavigationTimeout(navTimeoutMs);
    
    // ✅ ANTI-DETECÇÃO: Remover propriedades de automação
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {} };
    });
    
    return { browser: null, context: ctx, persistent: true };
  }

  const browser = await chromium.launch(launchOpts);
  const ctxOpts = { 
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  };
  
  if (storageStatePath) ctxOpts.storageState = storageStatePath;
  const context = await browser.newContext(ctxOpts);
  context.setDefaultNavigationTimeout(navTimeoutMs);
  
  // Anti-detecção
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.chrome = { runtime: {} };
  });
  
  return { browser, context, persistent: false };
}

/**
 * MAIN entrypoint
 */
async function main(cliArgs = null) {
  const args = cliArgs || parseArgs(process.argv.slice(2));

  const format = args.format || 'core';
  const limit = parseNum(args.limit, 100);
  const maxPages = parseNum(args.maxPages, 1);
  const pageStart = parseNum(args.pageStart, 1);

  const headless = parseBool(args.headless, true);
  const debug = parseBool(args.debug, false);
  const force = parseBool(args.force, false);

  const refreshExisting = parseBool(args.refreshExisting, false);
  const onlyEmpty = parseBool(args.onlyEmpty, false);
  const offset = parseNum(args.offset, 0);

  // ✅ Aumentar delays padrão
  const sleepMs = parseNum(args.sleepMs, 3000); // mínimo 3s
  const dumpDir = args.dumpDir || null;

  const minDeckSize = parseNum(args.minDeckSize, 60);
  const strict60 = parseBool(args.strict60, false);

  const navTimeoutMs = parseNum(args.challengeTimeoutMs, 90000); // ✅ 90s timeout
  const userDataDir = args.userDataDir || null;
  const storageStatePath = args.storageState || null;
  const channel = args.channel || null;
  
  const stopOnBlocked = parseBool(args.stopOnBlocked, true); // ✅ Parar se bloqueado

  const outPath = args.out || path.join(__dirname, '../db/tournamentMeta.json');
  const meta = safeReadJson(outPath, { format, decks: [] });
  meta.format = format;
  meta.decks = Array.isArray(meta.decks) ? meta.decks : [];

  let added = 0, updated = 0, failed = 0, blocked = 0, pages = 0;

  console.log(`🚀 Iniciando scraper (sleepMs=${sleepMs}, headless=${headless}, stopOnBlocked=${stopOnBlocked})`);

  const { browser, context } = await makeContext({ headless, userDataDir, storageStatePath, channel, navTimeoutMs });
  
  try {
    if (debug) {
      console.log(`🧩 Playwright: context ready (headless=${headless} userDataDir=${userDataDir || '(none)'})`);
    }

    const page = await context.newPage();

    if (!refreshExisting) {
      for (let p = pageStart; p < pageStart + maxPages; p++) {
        pages++;
        console.log(`🌍 Abrindo Inkdecks (index): https://inkdecks.com/lorcana-decks/${format}${p > 1 ? `?page=${p}` : ''}`);

        // ✅ DELAY antes de abrir index (parecer humano)
        if (p > pageStart) {
          const randomDelay = sleepMs + Math.random() * 2000; // +0-2s random
          console.log(`⏳ Aguardando ${Math.round(randomDelay)}ms...`);
          await sleep(randomDelay);
        }

        const idx = await indexScraper.getDeckRefs(page, { format, pageNo: p, debug, dumpDir, navTimeoutMs });

        if (idx.blocked) {
          blocked++;
          console.log(`🚫 Bloqueado no index (status=${idx._debug?.http?.status ?? 'na'}). ${stopOnBlocked ? 'Parando.' : 'Continuando...'}`);
          if (stopOnBlocked) break;
          continue;
        }

        const refs = idx.refs || [];
        console.log(`📦 Página ${p}: refs=${refs.length}`);

        for (const ref of refs) {
          if ((added + updated) >= limit) break;
          const url = ref.url;

          const existing = meta.decks.find((d) => String(d.url || '') === String(url));
          const alreadyHas = existing && sumQty(existing) > 0;

          if (alreadyHas && !force) continue;

          // ✅ DELAY entre decks (parecer humano)
          const randomDelay = sleepMs + Math.random() * 1000;
          console.log(`⏳ Aguardando ${Math.round(randomDelay)}ms...`);
          await sleep(randomDelay);

          console.log(`🔥 Scraping deck: ${url}`);
          const deck = await deckScraper.scrapeDeck(url, context, { debug, dumpDir, navTimeoutMs });

          if (deck.blocked) {
            blocked++;
            console.log(`⛔ Bloqueio detectado ao abrir deck. ${stopOnBlocked ? 'Parando.' : 'Continuando...'}`);
            if (stopOnBlocked) break;
            continue;
          }

          const totalQty = deck.sumQty || 0;
          if (totalQty < minDeckSize || (strict60 && totalQty !== 60)) {
            failed++;
            console.log(`⚠️ Falhou: deck abaixo do mínimo (sumQty=${totalQty}, minDeckSize=${minDeckSize})`);
            continue;
          }

          const now = new Date().toISOString();
          const merged = {
            ...(existing || {}),
            ...ref,
            url,
            cards: deck.cards,
            sumQty: totalQty,
            totalQty,
            lastScrapedAt: now,
          };

          if (existing) updated++;
          else added++;

          upsertByUrl(meta.decks, merged);
          safeWriteJson(outPath, meta);

          if (debug) console.log(`🧩 scrapeDeck: cards=${deck.cards?.length || 0} sumQty=${totalQty}`);
        }

        if ((added + updated) >= limit) break;
        if (blocked && stopOnBlocked) break;
      }
    } else {
      // refreshExisting mode (sem mudanças)
      const candidates = meta.decks
        .map((d) => ({ ...d, url: String(d.url || '') }))
        .filter((d) => d.url);

      let list = candidates;
      if (onlyEmpty) list = list.filter((d) => sumQty(d) === 0 || !Array.isArray(d.cards) || d.cards.length === 0);

      if (offset) list = list.slice(offset);
      list = list.slice(0, limit);

      console.log(`🔍 Re-scraping existing URLs: ${list.length}`);

      for (const d of list) {
        const randomDelay = sleepMs + Math.random() * 1000;
        await sleep(randomDelay);
        
        console.log(`🔥 Scraping deck: ${d.url}`);
        const deck = await deckScraper.scrapeDeck(d.url, context, { debug, dumpDir, navTimeoutMs });

        if (deck.blocked) {
          blocked++;
          console.log(`⛔ Bloqueio detectado. ${stopOnBlocked ? 'Parando.' : 'Continuando...'}`);
          if (stopOnBlocked) break;
          continue;
        }

        const totalQty = deck.sumQty || 0;
        if (totalQty < minDeckSize || (strict60 && totalQty !== 60)) {
          failed++;
          console.log(`⚠️ Falhou: sumQty=${totalQty}`);
          continue;
        }

        const now = new Date().toISOString();
        const merged = {
          ...d,
          cards: deck.cards,
          sumQty: totalQty,
          totalQty,
          lastScrapedAt: now,
        };
        upsertByUrl(meta.decks, merged);
        updated++;
        safeWriteJson(outPath, meta);
      }
    }

    console.log(`🎉 tournamentMeta atualizado (total=${meta.decks.length}, added=${added}, updated=${updated}, failed=${failed}, blocked=${blocked}, pages=${pages})`);
    
    // ✅ IMPORTANTE: Aviso se foi bloqueado
    if (blocked > 0) {
      console.log(`\n⚠️  AVISO: Bloqueio detectado ${blocked}x. Isso é NORMAL.`);
      console.log(`   Sugestões:`);
      console.log(`   1. Use --sleepMs=5000 (delays maiores)`);
      console.log(`   2. Use --headless=0 (browser visível)`);
      console.log(`   3. Use --userDataDir (mantém sessão/cookies)`);
      console.log(`   4. Rode em horários diferentes`);
      console.log(`   5. Você já tem ${meta.decks.length} decks - isso é suficiente! ✅\n`);
    }
    
    return { added, updated, failed, blocked, pages, total: meta.decks.length };
  } finally {
    await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = { main };

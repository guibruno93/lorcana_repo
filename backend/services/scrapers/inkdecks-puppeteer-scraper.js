'use strict';

/**
 * inkdecks-puppeteer-scraper.js
 * Listagem + detalhes via Chromium (puppeteer-extra + stealth) para reduzir bloqueio Cloudflare.
 * Formato de saída alinhado a inkdecks-scraper-v2.js para deckToScrapedDeckRow / Supabase.
 *
 * Nota: no Inkdecks, cada `tr.card-list-item` é um *tipo* de carta (com data-quantity).
 * Um deck de 60 cartas costuma ter ~15–25 linhas e soma(quantity) ≈ 60 — não espere 60 linhas.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const BASE_URL = 'https://inkdecks.com';
const LIST_PATH = '/lorcana-decks/core';
const MAX_DECKS_PER_RUN = 100;
const BETWEEN_DECKS_MS = 2000;

/** Timeouts ajustáveis no Render (rede lenta / Cloudflare / cold start). */
const GOTO_TIMEOUT_MS = parseInt(
  process.env.PUPPETEER_GOTO_TIMEOUT_MS || '180000',
  10
);
const LISTING_SELECTOR_TIMEOUT_MS = parseInt(
  process.env.PUPPETEER_LISTING_SELECTOR_TIMEOUT_MS || '120000',
  10
);
const DECK_CARD_SELECTOR_TIMEOUT_MS = parseInt(
  process.env.PUPPETEER_DECK_SELECTOR_TIMEOUT_MS || '90000',
  10
);
const NAV_MAX_RETRIES = parseInt(process.env.PUPPETEER_NAV_RETRIES || '3', 10);
const NAV_RETRY_DELAY_MS = parseInt(
  process.env.PUPPETEER_NAV_RETRY_DELAY_MS || '5000',
  10
);
/** `domcontentloaded` evita pendurar em `networkidle*` com analytics / long-polling. */
const GOTO_WAIT_UNTIL =
  process.env.PUPPETEER_GOTO_WAIT_UNTIL || 'domcontentloaded';

/** Cache gravável em runtime (Render: /tmp; build em /opt/render não persiste). */
function resolvePuppeteerCacheDir() {
  if (process.env.PUPPETEER_CACHE_DIR) return process.env.PUPPETEER_CACHE_DIR;
  if (process.env.RENDER === 'true') return '/tmp/.cache/puppeteer';
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) return path.join(home, '.cache', 'puppeteer');
  return path.join('/tmp', '.cache', 'puppeteer');
}

/**
 * Garante Chrome gerido pelo Puppeteer (download lazy na 1.ª utilização).
 * @returns {string} caminho do executável
 */
function ensureChromeInstalledAtRuntime() {
  const puppeteerPkg = require('puppeteer');
  const cacheDir = resolvePuppeteerCacheDir();
  process.env.PUPPETEER_CACHE_DIR = cacheDir;
  delete process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD;

  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  let chromePath = null;
  try {
    if (typeof puppeteerPkg.executablePath === 'function') {
      chromePath = puppeteerPkg.executablePath();
    }
  } catch {
    chromePath = null;
  }

  if (chromePath && fs.existsSync(chromePath)) {
    return chromePath;
  }

  console.log(
    '🔧 Puppeteer: Chrome não encontrado; a instalar em',
    cacheDir,
    '(primeira execução pode demorar ~1–2 min)'
  );
  const backendRoot = path.join(__dirname, '..', '..');
  const env = { ...process.env, PUPPETEER_CACHE_DIR: cacheDir };
  delete env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD;
  execSync('npx puppeteer browsers install chrome', {
    stdio: 'inherit',
    cwd: backendRoot,
    env,
    timeout: 600000,
  });

  chromePath = puppeteerPkg.executablePath();
  if (!chromePath || !fs.existsSync(chromePath)) {
    throw new Error(
      'Chrome ainda não disponível após `puppeteer browsers install chrome`'
    );
  }
  console.log('✅ Chrome instalado para Puppeteer');
  return chromePath;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Conta linhas de decklist visíveis no DOM. */
async function countCardRows(page) {
  return page.$$eval('tr.card-list-item', (rows) => rows.length);
}

/** Soma das quantidades (cópias no baralho). */
function totalCardCopies(cards) {
  return (cards || []).reduce((s, c) => s + (c.quantity || 0), 0);
}

/** Extrai linhas `tr.card-list-item` (mesma lógica do v2 / test-html-parse). */
function extractCardRowsInPage() {
  const out = [];
  document.querySelectorAll('tr.card-list-item').forEach((row) => {
    const quantity = parseInt(row.getAttribute('data-quantity') || '0', 10);
    const cardType = row.getAttribute('data-card-type') || 'character';
    const link = row.querySelector('a[href*="/cards/details-"]');
    const cardName = (link?.textContent || '').replace(/\s+/g, ' ').trim();
    let ink = 'Unknown';
    const imgs = row.querySelectorAll('img[src*="/symbols/lorcana/"]');
    for (const img of imgs) {
      const src = img.getAttribute('src') || '';
      const mm = src.match(/\/symbols\/lorcana\/([^./]+)\.svg/i);
      if (!mm) continue;
      const raw = mm[1].toLowerCase();
      if (raw === 'inkpot' || raw === 'ink-cost') continue;
      ink = raw.charAt(0).toUpperCase() + raw.slice(1);
      break;
    }
    let inkCost = 0;
    const costEl = row.querySelector('div[style*="position:absolute"]');
    if (costEl) {
      const t = (costEl.textContent || '').trim();
      const n = parseInt(t, 10);
      if (!Number.isNaN(n)) inkCost = n;
    }
    if (cardName && quantity > 0) {
      out.push({ name: cardName, quantity, type: cardType, ink, cost: inkCost });
    }
  });
  return out;
}

/** Scroll gradual para disparar lazy-load. */
async function scrollPageToBottom(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        let y = 0;
        const step = 120;
        const iv = setInterval(() => {
          const sh = document.body.scrollHeight;
          window.scrollBy(0, step);
          y += step;
          if (y >= sh + step * 3 || y > 25000) {
            clearInterval(iv);
            window.scrollTo(0, sh);
            resolve();
          }
        }, 80);
      })
  );
}

/** Clica botões/links que parecem expandir a lista. */
async function clickExpandControls(page) {
  return page.evaluate(() => {
    const re =
      /show\s*more|show\s*all|ver\s*todas|load\s*more|see\s*all|expand|mostrar\s*tudo|view\s*full/i;
    let clicks = 0;
    const candidates = document.querySelectorAll(
      'button, a.btn, .btn, [role="button"], a[class*="show"]'
    );
    candidates.forEach((el) => {
      if (!el || el.offsetParent === null) return;
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (re.test(t)) {
        try {
          el.click();
          clicks++;
        } catch (_) {}
      }
    });
    return clicks;
  });
}

/** Espera a contagem de linhas estabilizar (lazy load). */
async function waitForCardRowCountStable(page, emit, opts = {}) {
  const maxIter = opts.maxIter ?? 45;
  const stableNeed = opts.stableNeed ?? 3;
  let prev = -1;
  let stable = 0;
  for (let iter = 0; iter < maxIter; iter++) {
    const cnt = await countCardRows(page);
    if (typeof emit === 'function' && (iter === 0 || cnt !== prev)) {
      emit({
        type: 'log',
        level: 'info',
        message: `  · linhas tr.card-list-item: ${cnt} (estável após scroll)`,
      });
    }
    if (cnt === prev) stable++;
    else stable = 0;
    prev = cnt;
    if (stable >= stableNeed) return cnt;
    await page.evaluate(() => window.scrollBy(0, 600));
    await sleep(450);
  }
  return prev;
}

/**
 * Carrega decklist completo: expand, scroll, estabiliza, opcionalmente percorre abas Bootstrap.
 * @returns {Promise<object[]>} cartas { name, quantity, type, ink, cost }
 */
async function loadFullDecklistAndExtractCards(page, emit) {
  const htmlLen = await page.evaluate(
    () => document.documentElement.outerHTML.length
  );
  emit({
    type: 'log',
    level: 'info',
    message: `Tamanho do HTML (deck): ${htmlLen} caracteres`,
  });

  let expandClicks = await clickExpandControls(page);
  if (expandClicks > 0) {
    emit({
      type: 'log',
      level: 'info',
      message: `Cliques em controles "mostrar mais" / expandir: ${expandClicks}`,
    });
    await sleep(2500);
  }

  await scrollPageToBottom(page);
  await sleep(2000);

  let rowsAfterScroll = await countCardRows(page);
  emit({
    type: 'log',
    level: 'info',
    message: `Após scroll inicial: ${rowsAfterScroll} linhas`,
  });

  await waitForCardRowCountStable(page, emit, {
    maxIter: 40,
    stableNeed: 3,
  });

  const tabSelector =
    'a[data-bs-toggle="tab"], a[data-toggle="tab"], button[data-bs-toggle="tab"], .nav-tabs .nav-link, .nav-pills .nav-link';

  const tabCount = await page.$$eval(tabSelector, (els) =>
    els.filter((e) => e && e.offsetParent !== null).length
  );

  const mergeByName = (baseMap, rows) => {
    for (const c of rows) {
      if (!c.name) continue;
      const key = c.name.toLowerCase();
      const prev = baseMap.get(key);
      if (!prev) baseMap.set(key, { ...c });
      else prev.quantity = (prev.quantity || 0) + (c.quantity || 0);
    }
    return baseMap;
  };

  if (tabCount > 1) {
    emit({
      type: 'log',
      level: 'info',
      message: `Abas de decklist detectadas (${tabCount}); coletando cada aba…`,
    });
    const merged = new Map();

    for (let vi = 0; vi < tabCount; vi++) {
      await page.evaluate(
        (sel, visibleIdx) => {
          const els = Array.from(document.querySelectorAll(sel)).filter(
            (e) => e && e.offsetParent !== null
          );
          if (els[visibleIdx]) els[visibleIdx].click();
        },
        tabSelector,
        vi
      );
      await sleep(900);
      await scrollPageToBottom(page);
      await sleep(600);
      await waitForCardRowCountStable(page, null, {
        maxIter: 20,
        stableNeed: 2,
      });
      const chunk = await page.evaluate(extractCardRowsInPage);
      mergeByName(merged, chunk);
    }

    const fromTabs = Array.from(merged.values());
    const copies = totalCardCopies(fromTabs);
    emit({
      type: 'log',
      level: copies >= 55 ? 'success' : 'warning',
      message: `Após abas: ${fromTabs.length} tipos de carta, ${copies} cópias no total`,
    });
    return fromTabs;
  }

  const cards = await page.evaluate(extractCardRowsInPage);
  const copies = totalCardCopies(cards);
  const rowCount = cards.length;
  emit({
    type: 'log',
    level: copies >= 50 ? 'success' : 'warning',
    message: `Decklist: ${rowCount} tipos (linhas), ${copies} cópias no total — alvo Lorcana ~60 cópias`,
  });
  if (copies < 50) {
    emit({
      type: 'log',
      level: 'warning',
      message:
        '⚠️ Poucas cópias no total — lazy-load, abas ou HTML diferente; ver debug-deck-page.js',
    });
  }
  return cards;
}

class InkdecksPuppeteerScraper {
  constructor() {
    this.browser = null;
  }

  async init() {
    if (this.browser) return;
    console.log('🔧 Initializing Puppeteer scraper…');
    const executablePath = ensureChromeInstalledAtRuntime();
    console.log('🚀 Launching browser…');
    this.browser = await puppeteer.launch({
      headless: process.env.PUPPETEER_HEADLESS !== 'false',
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
      ],
    });
    console.log('✅ Browser launched successfully');
  }

  /**
   * Navegação com retentativas (timeouts longos + Cloudflare).
   * @param {*} page — Puppeteer Page
   * @param {string} url
   * @param {(e: object) => void} [emit]
   */
  async navigateWithRetry(page, url, emit) {
    for (let attempt = 1; attempt <= NAV_MAX_RETRIES; attempt++) {
      try {
        const msg = `Navegação (${attempt}/${NAV_MAX_RETRIES}): ${url}`;
        if (typeof emit === 'function') {
          emit({ type: 'log', level: 'info', message: msg });
        } else {
          console.log(msg);
        }
        await page.goto(url, {
          waitUntil: GOTO_WAIT_UNTIL,
          timeout: GOTO_TIMEOUT_MS,
        });
        if (typeof emit === 'function') {
          emit({
            type: 'log',
            level: 'info',
            message: 'Navegação concluída (domcontentloaded)',
          });
        }
        return;
      } catch (err) {
        if (attempt >= NAV_MAX_RETRIES) {
          throw err;
        }
        const warn = `Falha na navegação (${attempt}/${NAV_MAX_RETRIES}): ${err.message} — nova tentativa em ${NAV_RETRY_DELAY_MS / 1000}s`;
        if (typeof emit === 'function') {
          emit({ type: 'log', level: 'warning', message: warn });
        } else {
          console.warn(warn);
        }
        await sleep(NAV_RETRY_DELAY_MS);
      }
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * @param {number} limit
   * @param {(e: object) => void} [onProgress]
   * @returns {Promise<object[]>} mesmo formato interno do v2 (title, cards[], url, deckId, …)
   */
  async scrapeDecks(limit = 50, onProgress) {
    const emit = (p) => {
      if (typeof onProgress === 'function') onProgress(p);
    };

    const cap = Math.min(
      Math.max(1, parseInt(limit, 10) || 50),
      MAX_DECKS_PER_RUN
    );

    await this.init();
    const page = await this.browser.newPage();

    try {
      page.setDefaultNavigationTimeout(GOTO_TIMEOUT_MS);
      page.setDefaultTimeout(
        Math.max(LISTING_SELECTOR_TIMEOUT_MS, DECK_CARD_SELECTOR_TIMEOUT_MS)
      );

      await page.setViewport({ width: 1920, height: 1080 });
      const ua =
        process.env.PUPPETEER_UA ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
      await page.setUserAgent(ua);

      emit({
        type: 'log',
        level: 'info',
        message: 'Abrindo listagem Inkdecks (Puppeteer)…',
      });

      await this.navigateWithRetry(
        page,
        `${BASE_URL}${LIST_PATH}`,
        emit
      );

      emit({
        type: 'log',
        level: 'info',
        message: 'Aguardando possível verificação Cloudflare…',
      });
      await sleep(5000);

      let html = await page.content();
      if (/Just a moment|checking your browser/i.test(html)) {
        emit({
          type: 'log',
          level: 'warning',
          message: 'Challenge Cloudflare detectado; aguardando mais…',
        });
        await sleep(15000);
        html = await page.content();
      }

      if (/Just a moment|checking your browser/i.test(html)) {
        emit({
          type: 'log',
          level: 'error',
          message: 'Ainda na página de challenge (Cloudflare). Tente IP residencial ou aumentar espera.',
        });
        return [];
      }

      try {
        await page.waitForSelector('tr[id^="desktop-deck-"]', {
          timeout: LISTING_SELECTOR_TIMEOUT_MS,
        });
      } catch {
        emit({
          type: 'log',
          level: 'error',
          message:
            'Não encontrou linhas tr[id^=desktop-deck-] (HTML alterado ou bloqueio).',
        });
        return [];
      }

      const deckMetaList = await page.evaluate((maxDecks, base) => {
        const rows = Array.from(
          document.querySelectorAll('tr[id^="desktop-deck-"]')
        );
        const decks = [];
        for (
          let index = 0;
          index < rows.length && decks.length < maxDecks;
          index++
        ) {
          const row = rows[index];
          const deckUrl = row.getAttribute('data-href');
          if (!deckUrl) continue;
          const tds = row.querySelectorAll('td');
          const placement =
            tds[0]?.querySelector('strong')?.textContent?.trim() || '';
          const deckName =
            tds[1]?.querySelector('strong')?.textContent?.trim() || '';
          const authorRaw =
            tds[1]?.querySelector('.small.text-secondary')?.textContent || '';
          const author = authorRaw.replace(/\bby\b/gi, '').trim();
          const strategy =
            tds[3]?.querySelector('.text-muted.small')?.textContent?.trim() ||
            '';
          const eventName =
            tds[4]?.querySelector('.text-truncate')?.textContent?.trim() || '';
          const organizerRaw =
            tds[4]?.querySelector('.text-theme-light')?.textContent || '';
          const organizer = organizerRaw.replace('@', '').trim();
          const playersText =
            tds[4]?.querySelector('.text-muted')?.textContent?.trim() || '';
          const playersMatch = playersText.match(/(\d+)/);
          const players = playersMatch ? parseInt(playersMatch[1], 10) : 0;
          const dateText = tds[7]?.textContent?.trim() || '';
          const inks = [];
          tds[3]?.querySelectorAll('img[alt]').forEach((img) => {
            const alt = img.getAttribute('alt');
            if (alt)
              inks.push(
                alt.charAt(0).toUpperCase() + alt.slice(1).toLowerCase()
              );
          });
          const fullUrl = deckUrl.startsWith('http')
            ? deckUrl
            : base + deckUrl;
          const m = deckUrl.match(/deck-(.+?)$/);
          const deckId = m ? m[1] : '';
          decks.push({
            url: fullUrl,
            deckId,
            name: deckName,
            author,
            placement,
            strategy,
            inks,
            event: {
              name: eventName,
              organizer,
              players,
              date: dateText,
            },
          });
        }
        return decks;
      }, cap, BASE_URL);

      if (!deckMetaList.length) {
        emit({
          type: 'log',
          level: 'warning',
          message: 'Listagem retornou 0 decks.',
        });
        return [];
      }

      emit({
        type: 'log',
        level: 'success',
        message: `Encontrados ${deckMetaList.length} decks na listagem.`,
      });

      const results = [];
      for (let i = 0; i < deckMetaList.length; i++) {
        const meta = deckMetaList[i];
        emit({
          type: 'log',
          level: 'info',
          message: `Deck ${i + 1}/${deckMetaList.length}: ${meta.name}`,
        });

        if (i > 0) await sleep(BETWEEN_DECKS_MS);

        try {
          await this.navigateWithRetry(page, meta.url, emit);
          await sleep(1500);

          try {
            await page.waitForSelector('tr.card-list-item', {
              timeout: DECK_CARD_SELECTOR_TIMEOUT_MS,
            });
          } catch {
            emit({
              type: 'log',
              level: 'warning',
              message: `Sem tr.card-list-item: ${meta.name}`,
            });
            continue;
          }

          const cards = await loadFullDecklistAndExtractCards(page, emit);

          const inksList = meta.inks || [];
          let archetype = meta.strategy || 'Unknown';
          if (inksList.length >= 2) {
            archetype = `${inksList[0]}/${inksList[1]}`;
          }

          const deck = {
            source: 'inkdecks',
            deckId: meta.deckId,
            url: meta.url,
            title: meta.name,
            author: meta.author,
            archetype,
            strategy: meta.strategy,
            inks: inksList,
            cards,
            standing: meta.placement,
            event: meta.event.name,
            organizer: meta.event.organizer,
            players: meta.event.players,
            date: meta.event.date,
            fetchedAt: new Date().toISOString(),
          };

          results.push(deck);
          const copies = totalCardCopies(cards);
          emit({
            type: 'log',
            level: 'success',
            message: `OK: ${deck.title} (${cards.length} linhas, ${copies} cópias)`,
          });
        } catch (err) {
          emit({
            type: 'log',
            level: 'error',
            message: `Falha no deck ${i + 1}: ${err.message}`,
          });
        }
      }

      return results;
    } finally {
      await page.close().catch(() => {});
      await this.close();
    }
  }
}

/** Mesmo contrato que inkdecks-scraper-v2 (cards = array de { name, quantity }) */
function deckToScrapedDeckRow(deck) {
  const cards = {};
  for (const c of deck.cards || []) {
    if (c.name) cards[c.name] = c.quantity;
  }
  return {
    deck_name: deck.title,
    archetype: deck.archetype,
    ink_colors: deck.inks || [],
    cards,
    wins: deck.wins ?? 0,
    losses: deck.losses ?? 0,
    source_url: deck.url,
    source_deck_id: deck.deckId,
    author: deck.author,
    event_name: deck.event,
    organizer: deck.organizer,
    standing: deck.standing,
    scraped_at: new Date().toISOString(),
  };
}

/** Alias para rotas que usavam inkdecks-scraper-v2 */
const InkdecksScraper = InkdecksPuppeteerScraper;

module.exports = {
  InkdecksPuppeteerScraper,
  InkdecksScraper,
  deckToScrapedDeckRow,
};

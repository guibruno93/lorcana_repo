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
/** Decks por página na listagem Inkdecks (ajustável se o site mudar). */
const DECKS_PER_LISTING_PAGE = parseInt(
  process.env.INKDECKS_DECKS_PER_PAGE || '20',
  10
);
const BETWEEN_LISTING_PAGES_MS = parseInt(
  process.env.INKDECKS_BETWEEN_PAGES_MS || '3000',
  10
);
/** Retentativas ao carregar uma página de listagem vazia / instável. */
const LISTING_PAGE_LOAD_RETRIES = parseInt(
  process.env.INKDECKS_LISTING_PAGE_RETRIES || '2',
  10
);

function envInt(name, fallback) {
  const raw = parseInt(process.env[name] || String(fallback), 10);
  return Number.isFinite(raw) ? raw : fallback;
}

/** Timeouts ajustáveis no Render (rede lenta / Cloudflare / cold start). */
const GOTO_TIMEOUT_MS = Math.max(120000, envInt('PUPPETEER_GOTO_TIMEOUT_MS', 180000));
const LISTING_SELECTOR_TIMEOUT_MS = Math.max(
  60000,
  envInt('PUPPETEER_LISTING_SELECTOR_TIMEOUT_MS', 120000)
);
const DECK_CARD_SELECTOR_TIMEOUT_MS = Math.max(
  60000,
  envInt('PUPPETEER_DECK_SELECTOR_TIMEOUT_MS', 90000)
);
const NAV_MAX_RETRIES = Math.max(3, envInt('PUPPETEER_NAV_RETRIES', 3));
const NAV_RETRY_DELAY_MS = Math.max(5000, envInt('PUPPETEER_NAV_RETRY_DELAY_MS', 5000));
const LAUNCH_TIMEOUT_MS = Math.max(90000, envInt('PUPPETEER_LAUNCH_TIMEOUT_MS', 120000));
const PROTOCOL_TIMEOUT_MS = Math.max(
  120000,
  envInt('PUPPETEER_PROTOCOL_TIMEOUT_MS', 240000)
);
/** `domcontentloaded` evita pendurar em `networkidle*` com analytics / long-polling. */
const GOTO_WAIT_UNTIL =
  process.env.PUPPETEER_GOTO_WAIT_UNTIL || 'domcontentloaded';
const LISTING_DECK_SELECTORS = [
  'tr[id^="desktop-deck-"]',
  'tr[data-href*="/deck-"]',
  'a[href*="/deck-"]',
  '[data-href*="/deck-"]',
];

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

/** Windows: localiza chrome.exe em ~/.cache/puppeteer/chrome (subpastas win64-… / chrome-win64). */
function findChromeExeUnderUserPuppeteerCache() {
  const base = path.join(
    process.env.USERPROFILE || '',
    '.cache',
    'puppeteer',
    'chrome'
  );
  if (!fs.existsSync(base)) return null;
  try {
    const dirs = fs.readdirSync(base);
    for (const d of dirs) {
      if (!d.startsWith('win64-')) continue;
      const candidate = path.join(base, d, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** URL da listagem com paginação (?page=N quando N > 1). */
function listingUrlForPage(pageNum) {
  const base = `${BASE_URL}${LIST_PATH}`;
  if (pageNum <= 1) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}page=${pageNum}`;
}

function htmlLooksLikeCloudflareChallenge(html) {
  return /Just a moment|checking your browser|cf[- ]?challenge|cf-turnstile|captcha/i.test(
    html || ''
  );
}

function shouldSaveScraperDebug() {
  return (
    process.env.SCRAPER_SAVE_DEBUG === 'true' ||
    process.env.GITHUB_ACTIONS === 'true'
  );
}

function getScraperDebugDir() {
  if (process.env.SCRAPER_DEBUG_DIR) return process.env.SCRAPER_DEBUG_DIR;
  return path.join(__dirname, '..', '..', 'log', 'scrape-debug');
}

async function savePageDebugArtifacts(page, label, emit) {
  if (!shouldSaveScraperDebug()) return;
  const safe = String(label || 'unknown').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = getScraperDebugDir();
  fs.mkdirSync(dir, { recursive: true });
  const htmlPath = path.join(dir, `${ts}_${safe}.html`);
  const pngPath = path.join(dir, `${ts}_${safe}.png`);
  try {
    const html = await page.content();
    fs.writeFileSync(htmlPath, html, 'utf8');
    await page.screenshot({ path: pngPath, fullPage: true });
    if (typeof emit === 'function') {
      emit({
        type: 'log',
        level: 'warning',
        message: `Debug salvo: ${htmlPath} e ${pngPath}`,
      });
    }
  } catch (e) {
    if (typeof emit === 'function') {
      emit({
        type: 'log',
        level: 'warning',
        message: `Falha ao salvar debug (${label}): ${e.message}`,
      });
    }
  }
}

async function waitForCloudflareToClear(page, emit, label, maxWaitMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const html = await page.content();
    if (!htmlLooksLikeCloudflareChallenge(html)) return true;
    if (typeof emit === 'function') {
      emit({
        type: 'log',
        level: 'warning',
        message: `${label}: Cloudflare challenge detectado; aguardando…`,
      });
    }
    await sleep(5000);
  }
  return false;
}

async function detectListingDeckCount(page) {
  return page.evaluate((selectors) => {
    for (const sel of selectors) {
      const count = document.querySelectorAll(sel).length;
      if (count > 0) return count;
    }
    return 0;
  }, LISTING_DECK_SELECTORS);
}

/**
 * Extrai metadados dos decks na listagem atual (até maxDecks linhas).
 * @param {import('puppeteer').Page} page
 * @param {number} maxDecks
 * @returns {Promise<object[]>}
 */
async function extractListingDeckMetaFromPage(page, maxDecks) {
  return page.evaluate((maxDecksInner, base) => {
    const rows = Array.from(
      document.querySelectorAll('tr[id^="desktop-deck-"]')
    );
    const decks = [];
    for (
      let index = 0;
      index < rows.length && decks.length < maxDecksInner;
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
        tds[3]?.querySelector('.text-muted.small')?.textContent?.trim() || '';
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
          inks.push(alt.charAt(0).toUpperCase() + alt.slice(1).toLowerCase());
      });
      const fullUrl = deckUrl.startsWith('http') ? deckUrl : base + deckUrl;
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
    if (decks.length > 0) return decks;

    // Fallback: grid/cards layout com links diretos para deck.
    const seen = new Set();
    const anchors = Array.from(document.querySelectorAll('a[href*="/deck-"]'));
    for (const a of anchors) {
      if (decks.length >= maxDecksInner) break;
      const href = (a.getAttribute('href') || '').trim();
      if (!href) continue;
      const fullUrl = href.startsWith('http') ? href : base + href;
      if (seen.has(fullUrl)) continue;
      seen.add(fullUrl);
      const title =
        a.getAttribute('title') ||
        a.textContent?.replace(/\s+/g, ' ').trim() ||
        '';
      const deckId = (href.match(/deck-(.+?)$/) || [])[1] || '';
      if (!deckId) continue;
      decks.push({
        url: fullUrl,
        deckId,
        name: title || `Deck ${deckId}`,
        author: '',
        placement: '',
        strategy: '',
        inks: [],
        event: { name: '', organizer: '', players: 0, date: '' },
      });
    }
    return decks;
  }, maxDecks, BASE_URL);
}

/**
 * Espera Cloudflare + linhas da listagem.
 * @param {import('puppeteer').Page} page
 * @param {(e: object) => void} emit
 * @param {string} label
 * @returns {Promise<boolean>}
 */
async function ensureListingReady(page, emit, label) {
  emit({
    type: 'log',
    level: 'info',
    message: `${label}: Aguardando possível verificação Cloudflare…`,
  });
  await sleep(2500);
  const clear = await waitForCloudflareToClear(
    page,
    emit,
    label,
    Math.max(45000, LISTING_SELECTOR_TIMEOUT_MS)
  );
  if (!clear) {
    emit({
      type: 'log',
      level: 'error',
      message: `${label}: Bloqueado pelo Cloudflare.`,
    });
    emit({ type: 'scrapeAbort', reason: 'cloudflare', label });
    await savePageDebugArtifacts(page, `${label}_cloudflare_block`, emit);
    return false;
  }

  const started = Date.now();
  while (Date.now() - started < LISTING_SELECTOR_TIMEOUT_MS) {
    const count = await detectListingDeckCount(page);
    if (count > 0) return true;
    await page.evaluate(() => window.scrollBy(0, 500)).catch(() => {});
    await sleep(1200);
  }
  emit({
    type: 'log',
    level: 'error',
    message: `${label}: Não encontrou linhas de deck na listagem (selectors fallback falharam).`,
  });
  await savePageDebugArtifacts(page, `${label}_no_listing_rows`, emit);
  return false;
}

/** Conta linhas de decklist visíveis no DOM. */
async function countCardRows(page) {
  return page.$$eval('tr.card-list-item', (rows) => rows.length);
}

/** Soma das quantidades (cópias no baralho). */
function totalCardCopies(cards) {
  return (cards || []).reduce((s, c) => s + (c.quantity || 0), 0);
}

function normalizeStandingValue(rawStanding) {
  const value = (rawStanding || '').toString().trim();
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (
    normalized === 'other' ||
    normalized === 'n/a' ||
    normalized === 'na' ||
    normalized === '-' ||
    normalized === 'unknown'
  ) {
    return null;
  }
  return value;
}

/**
 * Heurísticas no texto da página do deck (Inkdecks): W/L, colocação, título do evento.
 * Evita depender de `:contains` (jQuery); `SCRAPER_DEBUG_PERF=true` regista o payload em log.
 */
async function extractDeckPagePerformance(page) {
  const debugPerf = process.env.SCRAPER_DEBUG_PERF === 'true';
  return page.evaluate((debugPerfFlag) => {
    const body = document.body.innerText || '';
    const out = {
      wins: null,
      losses: null,
      standing: null,
      event_name: null,
      debug: {},
    };

    // PATTERN 1: Simple X-Y (ex.: 5-2). Exclui datas (YYYY-MM-DD, MM-DD em contexto de data).
    const allMatches = [...body.matchAll(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b/g)];

    for (const match of allMatches) {
      const w = parseInt(match[1], 10);
      const l = parseInt(match[2], 10);

      if (w > 50 || l > 50) continue;

      const startIdx = Math.max(0, match.index - 100);
      const endIdx = Math.min(
        body.length,
        match.index + match[0].length + 100
      );
      const context = body.slice(startIdx, endIdx).toLowerCase();

      const dateKeywords = ['202', '201', ' on ', 'date', 'year', 'month', 'day'];
      if (dateKeywords.some((kw) => context.includes(kw))) continue;

      const ratio = Math.max(w, l) / Math.max(Math.min(w, l), 1);
      if (ratio > 10) continue;

      const wlKeywords = [
        'record',
        'win',
        'loss',
        'score',
        'result',
        'match',
        'game',
      ];
      const hasWLKeyword = wlKeywords.some((kw) => context.includes(kw));

      if (hasWLKeyword) {
        out.wins = w;
        out.losses = l;
        out.debug.source = 'simple_record_with_context';
        out.debug.match = match[0];
        break;
      }

      if (out.wins == null) {
        out.wins = w;
        out.losses = l;
        out.debug.source = 'simple_record_filtered';
        out.debug.match = match[0];
      }
    }

    if (out.wins == null) {
      const winM = body.match(/\b(?:wins?|w)[:\s]*(\d{1,3})\b/i);
      const lossM = body.match(/\b(?:loss(?:es)?|l)[:\s]*(\d{1,3})\b/i);

      if (winM && lossM) {
        const w = parseInt(winM[1], 10);
        const l = parseInt(lossM[1], 10);
        if (w <= 50 && l <= 50) {
          out.wins = w;
          out.losses = l;
          out.debug.source = 'wins_losses_labels';
        }
      }
    }

    if (out.wins == null) {
      const ctx = body.match(
        /(?:record|w\s*\/\s*l|w-l|result|score)\s*[:\s]*(\d{1,2})\s*[-–]\s*(\d{1,2})/i
      );
      if (ctx) {
        const w = parseInt(ctx[1], 10);
        const l = parseInt(ctx[2], 10);
        if (w <= 50 && l <= 50) {
          out.wins = w;
          out.losses = l;
          out.debug.source = 'record_context';
        }
      }
    }

    // Standing: colocação numérica (31st at …) > Top N > palavras genéricas (Champion).
    let numericStanding = null;
    let genericStanding = null;

    const standingWithContext = body.match(
      /(\d+)(?:st|nd|rd|th)\s+(?:at|place|in)/i
    );
    if (standingWithContext) {
      const ord = standingWithContext[0].match(/(?:st|nd|rd|th)/i);
      if (ord) {
        numericStanding = standingWithContext[1] + ord[0];
        out.debug.standing_pattern = 'numeric_with_context';
      }
    }

    if (!numericStanding) {
      const place = body.match(/(\d+)(?:st|nd|rd|th)\s+place/i);
      if (place) {
        const ordP = place[0].match(/(?:st|nd|rd|th)/i);
        numericStanding = ordP ? place[1] + ordP[0] : place[0];
        out.debug.standing_pattern = 'place';
      }
    }

    if (!numericStanding) {
      const top = body.match(/Top\s*(\d+)/i);
      if (top) {
        numericStanding = top[0];
        out.debug.standing_pattern = 'top';
      }
    }

    const special = body.match(
      /\b(winner|champion|finalist|semi-?finalist)\b/i
    );
    if (special) {
      genericStanding = special[0];
      out.debug.standing_generic = genericStanding;
    }

    if (numericStanding) {
      out.standing = numericStanding;
      out.debug.standing_source = 'numeric';
    } else if (genericStanding) {
      out.standing = genericStanding;
      out.debug.standing_source = 'generic';
    }

    const og = document.querySelector('meta[property="og:title"]');
    if (og?.content?.trim()) {
      out.event_name = og.content.trim();
      out.debug.event_source = 'og:title';
    }

    if (!out.event_name) {
      const h1 = document.querySelector('h1');
      if (h1?.textContent?.trim()) {
        out.event_name = h1.textContent.trim();
        out.debug.event_source = 'h1';
      }
    }

    if (!out.event_name) {
      const h2Ev = document.querySelector('h2');
      if (h2Ev?.textContent?.trim()) {
        out.event_name = h2Ev.textContent.trim();
        out.debug.event_source = 'h2';
      }
    }

    const h2 = document.querySelector('h2');
    if (h2?.textContent?.trim()) {
      out.debug.h2 = h2.textContent.trim().slice(0, 200);
    }

    if (debugPerfFlag) {
      const lines = body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      const keywords = [
        'win',
        'loss',
        'record',
        'standing',
        'place',
        'top',
        'tournament',
        'event',
      ];
      out.debug.relevant_lines = lines
        .filter((line) => {
          const lower = line.toLowerCase();
          return keywords.some((kw) => lower.includes(kw));
        })
        .slice(0, 10);
    }

    return out;
  }, debugPerf);
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

    let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

    if (!executablePath || !fs.existsSync(executablePath)) {
      try {
        executablePath = ensureChromeInstalledAtRuntime();
      } catch (err) {
        console.warn(
          '⚠️  ensureChromeInstalledAtRuntime() failed:',
          err.message
        );
        executablePath = null;
      }
    }

    if (!executablePath || !fs.existsSync(executablePath)) {
      console.log('🔍 Trying Windows fallback paths...');

      const fromCache = findChromeExeUnderUserPuppeteerCache();
      if (fromCache) {
        console.log(`✅ Found Chrome at: ${fromCache}`);
        executablePath = fromCache;
      } else {
        const windowsPaths = [
          path.join(
            process.env.USERPROFILE || '',
            '.cache',
            'puppeteer',
            'chrome',
            'win64-146.0.7680.153',
            'chrome-win64',
            'chrome.exe'
          ),
          path.join(
            process.env.LOCALAPPDATA || '',
            'Puppeteer',
            'chrome',
            'win64-146.0.7680.153',
            'chrome-win64',
            'chrome.exe'
          ),
          'C:\\Users\\guilh\\.cache\\puppeteer\\chrome\\win64-146.0.7680.153\\chrome-win64\\chrome.exe',
        ];

        for (const testPath of windowsPaths) {
          if (testPath && fs.existsSync(testPath)) {
            console.log(`✅ Found Chrome at: ${testPath}`);
            executablePath = testPath;
            break;
          }
        }
      }
    }

    if (!executablePath || !fs.existsSync(executablePath)) {
      throw new Error(
        `Chrome executable not found. Tried:\n` +
          `- PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH || 'not set'}\n` +
          `- ensureChromeInstalledAtRuntime(): failed\n` +
          `- Windows fallback paths: not found\n` +
          `Please run: npx puppeteer browsers install chrome`
      );
    }

    console.log(`🚀 Launching browser with: ${executablePath}`);
    this.browser = await this.launchBrowserWithFallbacks(executablePath);
    console.log('✅ Browser launched successfully');
  }

  async launchBrowserWithFallbacks(executablePath) {
    const proxy = (process.env.PUPPETEER_PROXY_SERVER || '').trim();
    if (proxy) {
      console.log(
        '🌐 PUPPETEER_PROXY_SERVER definido — o Chrome usa proxy (URL não registada no log).'
      );
    }
    const proxyArgs = proxy ? [`--proxy-server=${proxy}`] : [];

    const baseArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      ...proxyArgs,
    ];

    const candidates = [
      // Perfil 1: completo (mais rápido em algumas VMs)
      [...baseArgs, '--single-process'],
      // Perfil 2: sem --single-process (mais estável em cloud Linux)
      [...baseArgs],
      // Perfil 3: mínimo seguro para ambientes mais restritos
      [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        ...proxyArgs,
      ],
    ];

    let lastErr = null;
    for (let i = 0; i < candidates.length; i++) {
      const args = candidates[i];
      try {
        console.log(
          `🧪 Launch attempt ${i + 1}/${candidates.length} (timeout=${LAUNCH_TIMEOUT_MS}ms, args=${args.length})`
        );
        const browser = await puppeteer.launch({
          headless: process.env.PUPPETEER_HEADLESS !== 'false',
          executablePath,
          args,
          timeout: LAUNCH_TIMEOUT_MS,
          protocolTimeout: PROTOCOL_TIMEOUT_MS,
        });
        return browser;
      } catch (err) {
        lastErr = err;
        console.warn(
          `⚠️ Launch attempt ${i + 1} failed: ${err && err.message}`
        );
      }
    }
    throw lastErr || new Error('Failed to launch browser');
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
        try {
          await page.goto(url, {
            waitUntil: GOTO_WAIT_UNTIL,
            timeout: GOTO_TIMEOUT_MS,
          });
        } catch (primaryErr) {
          const primaryMsg = String((primaryErr && primaryErr.message) || '');
          const isNavTimeout =
            /Page\.navigate timed out|Navigation timeout/i.test(primaryMsg);
          if (!isNavTimeout) throw primaryErr;

          const fallbackMsg = `Navegação fallback (${attempt}/${NAV_MAX_RETRIES}): ${url} com waitUntil=commit`;
          if (typeof emit === 'function') {
            emit({ type: 'log', level: 'warning', message: fallbackMsg });
          } else {
            console.warn(fallbackMsg);
          }

          await page.goto(url, {
            waitUntil: 'commit',
            timeout: GOTO_TIMEOUT_MS,
          });
          await sleep(2500);
        }
        if (typeof emit === 'function') {
          emit({
            type: 'log',
            level: 'info',
            message: 'Navegação concluída (domcontentloaded)',
          });
        }
        return;
      } catch (err) {
        const msg = String((err && err.message) || '');
        const timedOutNavigate = /Page\.navigate timed out/i.test(msg);
        if (timedOutNavigate) {
          const detail = `Timeout de navegação detectado (attempt ${attempt}/${NAV_MAX_RETRIES}). timeout=${GOTO_TIMEOUT_MS}ms, protocolTimeout=${PROTOCOL_TIMEOUT_MS}ms`;
          if (typeof emit === 'function') {
            emit({ type: 'log', level: 'warning', message: detail });
          } else {
            console.warn(detail);
          }
        }
        if (attempt >= NAV_MAX_RETRIES) {
          throw err;
        }
        const waitMs = NAV_RETRY_DELAY_MS * attempt;
        const warn = `Falha na navegação (${attempt}/${NAV_MAX_RETRIES}): ${err.message} — nova tentativa em ${Math.round(waitMs / 1000)}s`;
        if (typeof emit === 'function') {
          emit({ type: 'log', level: 'warning', message: warn });
        } else {
          console.warn(warn);
        }
        await sleep(waitMs);
      }
    }
  }

  /**
   * Detecta quantas páginas existem na listagem (texto "Showing … of Z", links ?page=, botões).
   * @param {import('puppeteer').Page} page
   * @returns {Promise<number>}
   */
  async detectTotalPages(page) {
    try {
      const perPage = Math.max(1, DECKS_PER_LISTING_PAGE);
      return await page.evaluate((perPageInner) => {
        const text = document.body.innerText || '';
        const showing = text.match(
          /showing\s+\d+\s*[-–]\s*\d+\s+of\s+(\d+)/i
        );
        if (showing) {
          const total = parseInt(showing[1], 10);
          if (total > 0) return Math.max(1, Math.ceil(total / perPageInner));
        }
        const nums = [];
        const sel =
          'a[href*="page="], .pagination a, .page-link, [class*="pagination"] button, [class*="pagination"] a, nav.pagination a';
        document.querySelectorAll(sel).forEach((el) => {
          const t = (el.textContent || '').trim();
          const n = parseInt(t, 10);
          if (String(n) === t && n >= 1 && n < 5000) nums.push(n);
        });
        if (nums.length) return Math.max(...nums);
        const hrefNums = [];
        document.querySelectorAll('a[href*="page="]').forEach((a) => {
          const u = a.getAttribute('href') || '';
          const m = u.match(/[?&]page=(\d+)/i);
          if (m) hrefNums.push(parseInt(m[1], 10));
        });
        if (hrefNums.length) return Math.max(...hrefNums);
        return 1;
      }, perPage);
    } catch (err) {
      console.warn(
        'Could not detect total pages, assuming 1:',
        err && err.message
      );
      return 1;
    }
  }

  /**
   * Navega para a página `pageNum` da listagem. Tenta clique na paginação se já estiver na listagem;
   * caso contrário (ex.: após abrir um deck) usa URL `?page=N`.
   * @param {import('puppeteer').Page} page
   * @param {number} pageNum — 1-based
   * @param {(e: object) => void} [emit]
   */
  async navigateToListingPage(page, pageNum, emit) {
    if (pageNum <= 1) return;
    const targetUrl = listingUrlForPage(pageNum);
    try {
      const cur = page.url();
      const seemsListing =
        /lorcana-decks/i.test(cur) && !/\/deck-/i.test(cur);

      if (seemsListing) {
        const clicked = await page.evaluate((num) => {
          const candidates = Array.from(
            document.querySelectorAll(
              '[class*="pagination"] button, [class*="pagination"] a, .page-link, a[href*="page="]'
            )
          );
          const target = candidates.find((el) => {
            if (!el || el.offsetParent === null) return false;
            const t = (el.textContent || '').trim();
            return t === String(num);
          });
          if (target) {
            target.click();
            return true;
          }
          return false;
        }, pageNum);

        if (clicked) {
          await sleep(2500);
          const rowCount = await page.$$eval(
            'tr[id^="desktop-deck-"]',
            (els) => els.length
          );
          if (rowCount > 0) {
            if (typeof emit === 'function') {
              emit({
                type: 'log',
                level: 'info',
                message: `Paginação: clique na página ${pageNum} (listagem atualizada).`,
              });
            }
            return;
          }
        }
      }
    } catch {
      /* fallback URL */
    }

    if (typeof emit === 'function') {
      emit({
        type: 'log',
        level: 'info',
        message: `Navegando para listagem página ${pageNum} (URL)…`,
      });
    }
    await this.navigateWithRetry(page, targetUrl, emit);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Listagem paginada: processa ~N decks por página, valida a página antes de avançar.
   * @param {number} limit
   * @param {(e: object) => void} [onProgress]
   * @returns {Promise<object[]>} mesmo formato interno do v2 (title, cards[], url, deckId, …)
   */
  async scrapeDecks(limit = 50, onProgress) {
    const emit = (p) => {
      if (typeof onProgress === 'function') onProgress(p);
    };

    const targetLimit = Math.min(
      Math.max(1, parseInt(limit, 10) || 50),
      MAX_DECKS_PER_RUN
    );

    const perPage = Math.max(1, DECKS_PER_LISTING_PAGE);

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
        message: 'Abrindo listagem Inkdecks (Puppeteer, modo paginado)…',
      });

      await this.navigateWithRetry(page, listingUrlForPage(1), emit);
      const readyFirstPage = await ensureListingReady(page, emit, 'Página 1');
      if (!readyFirstPage) {
        await savePageDebugArtifacts(page, 'page1_not_ready', emit);
        return [];
      }

      const totalPages = await this.detectTotalPages(page);
      emit({
        type: 'log',
        level: 'info',
        message: `Detectada(s) ${totalPages} página(s) na listagem (~${perPage} decks/página).`,
      });

      const allResults = [];
      let totalScraped = 0;
      let currentPage = 1;

      while (totalScraped < targetLimit && currentPage <= totalPages) {
        const remainingLimit = targetLimit - totalScraped;
        const pageLimit = Math.min(remainingLimit, perPage);

        emit({
          type: 'log',
          level: 'info',
          message: `📄 Processando página ${currentPage}/${totalPages} (até ${pageLimit} decks nesta página)`,
        });

        if (currentPage > 1) {
          await this.navigateToListingPage(page, currentPage, emit);
          await sleep(1500);
          const ok = await ensureListingReady(
            page,
            emit,
            `Página ${currentPage}`
          );
          if (!ok) break;
        }

        let deckMetaList = [];
        let loadAttempt = 0;
        while (loadAttempt < LISTING_PAGE_LOAD_RETRIES) {
          loadAttempt++;
          deckMetaList = await extractListingDeckMetaFromPage(page, pageLimit);
          if (deckMetaList.length > 0) break;
          emit({
            type: 'log',
            level: 'warning',
            message: `Página ${currentPage}: 0 decks na listagem (tentativa ${loadAttempt}/${LISTING_PAGE_LOAD_RETRIES}); recarregar…`,
          });
          await this.navigateWithRetry(
            page,
            listingUrlForPage(currentPage),
            emit
          );
          await sleep(2000);
          const ready = await ensureListingReady(
            page,
            emit,
            `Página ${currentPage} (retry)`
          );
          if (!ready) break;
        }

        if (!deckMetaList.length) {
          emit({
            type: 'log',
            level: 'warning',
            message: `Página ${currentPage}: 0 decks encontrados — fim da listagem ou erro.`,
          });
          await savePageDebugArtifacts(
            page,
            `page_${currentPage}_no_decks_after_retry`,
            emit
          );
          break;
        }

        emit({
          type: 'log',
          level: 'success',
          message: `Página ${currentPage}: ${deckMetaList.length} deck(s) na listagem.`,
        });

        const pageResults = [];

        for (let i = 0; i < deckMetaList.length; i++) {
          const meta = deckMetaList[i];
          emit({
            type: 'log',
            level: 'info',
            message: `[P${currentPage}] Deck ${i + 1}/${deckMetaList.length}: ${meta.name}`,
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
                message: `[P${currentPage}] Sem tr.card-list-item: ${meta.name}`,
              });
              continue;
            }

            const cards = await loadFullDecklistAndExtractCards(page, emit);

            const perf = await extractDeckPagePerformance(page);
            if (process.env.SCRAPER_DEBUG_PERF === 'true') {
              emit({
                type: 'log',
                level: 'info',
                message: `[P${currentPage}] [debug] Page perf: ${JSON.stringify(perf, null, 2)}`,
              });
            }

            const inksList = meta.inks || [];
            let archetype = meta.strategy || 'Unknown';
            if (inksList.length >= 2) {
              archetype = `${inksList[0]}/${inksList[1]}`;
            }

            const wins = Number.isFinite(perf.wins) ? perf.wins : null;
            const losses = Number.isFinite(perf.losses) ? perf.losses : null;
            const standing =
              normalizeStandingValue(meta.placement) ||
              normalizeStandingValue(perf.standing) ||
              null;
            const eventName =
              (meta.event.name && meta.event.name.trim()) ||
              perf.event_name ||
              null;

            const hasWinLoss = wins != null && losses != null;
            const hasStanding = standing != null;
            const hasEvent = eventName != null;

            if (hasWinLoss || hasStanding || hasEvent) {
              const parts = [];
              if (hasWinLoss) parts.push(`Record: ${wins}-${losses}`);
              if (hasStanding) parts.push(`Standing: ${standing}`);
              if (hasEvent) parts.push(`Event: ${eventName}`);

              emit({
                type: 'log',
                level: 'info',
                message: `📊 Performance Data: ${parts.join(' | ')}`,
              });
            } else {
              emit({
                type: 'log',
                level: 'info',
                message: `📊 Performance Data: None found (deck may not have tournament data)`,
              });
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
              wins,
              losses,
              standing,
              event: eventName,
              organizer: meta.event.organizer,
              players: meta.event.players,
              date: meta.event.date,
              fetchedAt: new Date().toISOString(),
            };

            pageResults.push(deck);
            const copies = totalCardCopies(cards);
            emit({
              type: 'log',
              level: 'success',
              message: `[P${currentPage}] OK: ${deck.title} (${cards.length} linhas, ${copies} cópias)`,
            });
          } catch (err) {
            emit({
              type: 'log',
              level: 'error',
              message: `[P${currentPage}] Falha no deck ${i + 1}: ${err.message}`,
            });
          }
        }

        const pageSuccessRate =
          deckMetaList.length > 0
            ? pageResults.length / deckMetaList.length
            : 0;

        emit({
          type: 'log',
          level: 'info',
          message: `📊 Página ${currentPage} concluída: ${pageResults.length}/${deckMetaList.length} decks (${Math.round(pageSuccessRate * 100)}% sucesso)`,
        });

        if (typeof onProgress === 'function') {
          await Promise.resolve(
            onProgress({
              type: 'pageComplete',
              page: currentPage,
              listed: deckMetaList.length,
              scraped: pageResults.length,
              successRate: pageSuccessRate,
              decks: pageResults,
            })
          );
        }

        if (pageResults.length === 0 && deckMetaList.length > 0) {
          emit({
            type: 'log',
            level: 'error',
            message: `⛔ Página ${currentPage} falhou completamente (0/${deckMetaList.length}). Parando scrape.`,
          });
          break;
        }

        allResults.push(...pageResults);
        totalScraped += pageResults.length;

        currentPage++;

        if (totalScraped < targetLimit && currentPage <= totalPages) {
          emit({
            type: 'log',
            level: 'info',
            message: `⏸️  Pausa de ${BETWEEN_LISTING_PAGES_MS / 1000}s antes da próxima página…`,
          });
          await sleep(BETWEEN_LISTING_PAGES_MS);
        }
      }

      emit({
        type: 'log',
        level: 'success',
        message: `✅ Scrape finalizado: ${totalScraped} deck(s) (${Math.max(0, currentPage - 1)} página(s) percorridas).`,
      });

      return allResults;
    } finally {
      await page.close().catch(() => {});
      await this.close();
    }
  }
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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
    wins: numOrNull(deck.wins),
    losses: numOrNull(deck.losses),
    source_url: deck.url,
    source_deck_id: deck.deckId,
    author: deck.author,
    event_name: deck.event ?? null,
    organizer: deck.organizer ?? null,
    standing: deck.standing ?? null,
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

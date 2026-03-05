'use strict';

const fs = require('fs');
const path = require('path');

const logger = require('../utils/logger').child('DeckScraper');
const { requireUrl, ValidationError } = require('../utils/validation');
const { ParsingError } = require('../utils/errors');
const { safeText } = require('../utils/parsers');

function safeFileStemFromUrl(url) {
  return String(url || '')
    .replace(/^https?:\/\//i, '')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 180);
}

function ensureDir(dir) {
  if (!dir) return;
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_) {}
}

function dumpHtml(dumpDir, url, kind, status, html) {
  if (!dumpDir) return null;
  try {
    ensureDir(dumpDir);
    const safe = safeFileStemFromUrl(url);
    const file = path.join(dumpDir, `${kind}_${safe}_status${status ?? 'na'}.html`);
    fs.writeFileSync(file, html || '', 'utf8');
    return file;
  } catch (_) {
    return null;
  }
}

async function dumpScreenshot(page, dumpDir, url, kind, status) {
  if (!dumpDir || !page) return null;
  try {
    ensureDir(dumpDir);
    const safe = safeFileStemFromUrl(url);
    const file = path.join(dumpDir, `${kind}_${safe}_status${status ?? 'na'}.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    return file;
  } catch (_) {
    return null;
  }
}

function detectBlock({ status, title, html }) {
  const t = String(title || '');
  const h = String(html || '');
  const reasons = [];

  if (status === 403) reasons.push('status=403');
  if (status === 429) reasons.push('status=429');
  if (status === 503) reasons.push('status=503');

  if (/Attention Required/i.test(t) && /Cloudflare/i.test(t)) reasons.push('title=cloudflare');
  if (/cf-browser-verification|cf-challenge|challenge-platform|turnstile|Checking your browser|captcha/i.test(h)) reasons.push('html=cf_challenge');

  return { blocked: reasons.length > 0, reasons, reason: reasons.join(',') || null };
}

async function scrapeDeck(url, context, options = {}) {
  requireUrl(url, 'url');

  const {
    debug = false,
    dumpDir = null,
    navTimeoutMs = 60000,
    blockAssets = true,
    dumpScreenshotOnBlocked = true
  } = options;

  const result = {
    url,
    blocked: false,
    reason: null,
    cards: [],
    sumQty: 0,
    _debug: {}
  };

  let page = null;

  const assetPatterns = [
    '**/*.{png,jpg,jpeg,webp,gif,svg}',
    '**/*.{woff,woff2,ttf,otf}',
    '**/*.{mp4,webm,avi,mov}',
  ];

  const blockHandler = (route) => {
    route.abort().catch(() => route.continue().catch(() => {}));
  };

  try {
    if (blockAssets && context && typeof context.route === 'function') {
      for (const pattern of assetPatterns) {
        await context.route(pattern, blockHandler);
      }
    }

    page = await context.newPage();
    page.setDefaultNavigationTimeout(navTimeoutMs);

    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: navTimeoutMs }).catch(() => null);
    const status = resp && typeof resp.status === 'function' ? resp.status() : null;
    const title = await page.title().catch(() => null);

    const html = await page.content().catch(() => '');
    const htmlPath = dumpHtml(dumpDir, url, 'deck', status, html);

    const block = detectBlock({ status, title, html });
    if (block.blocked) {
      const screenshotPath = dumpScreenshotOnBlocked ? await dumpScreenshot(page, dumpDir, url, 'deck', status) : null;

      result.blocked = true;
      result.reason = block.reason || 'blocked';
      result._debug = {
        http: { status, title },
        reason: block.reason,
        reasons: block.reasons,
        dump: { html: htmlPath, screenshot: screenshotPath }
      };

      logger.warn('Deck page appears blocked', { url, status, title, reason: result.reason });
      return result;
    }

    const cards = await page.evaluate(() => {
      const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

      const anchors = Array.from(document.querySelectorAll('a[href^="/cards/details-"]'));
      const rows = anchors.map((a) => a.closest('tr')).filter(Boolean);

      const extracted = [];
      if (rows.length > 0) {
        const seen = new Set();
        for (const tr of rows) {
          const tds = Array.from(tr.querySelectorAll('td'));
          if (tds.length < 2) continue;

          const nameTdIdx = tds.findIndex((td) => td.querySelector('a[href^="/cards/details-"]'));
          if (nameTdIdx < 0) continue;

          const nameTd = tds[nameTdIdx];
          const qtyTd = nameTdIdx > 0 ? tds[nameTdIdx - 1] : null;

          const name = clean(nameTd.textContent || '');
          const qtyText = qtyTd ? String(qtyTd.textContent || '').replace(/[^\d]/g, '') : '';
          const qty = parseInt(qtyText, 10);

          if (!name || !Number.isFinite(qty) || qty <= 0) continue;
          if (seen.has(name)) continue;
          seen.add(name);

          extracted.push({ name, quantity: qty });
        }
        return extracted;
      }

      const imageNodes = Array.from(document.querySelectorAll('.decklist-card-image, .decklist-card, .deck-card'));
      for (const node of imageNodes) {
        const qtyText = clean(node.textContent || '').replace(/[^\d]/g, '');
        const qty = parseInt(qtyText, 10);
        const img = node.querySelector('img[alt]');
        const name = img ? clean(img.getAttribute('alt')) : null;

        if (Number.isFinite(qty) && qty > 0 && name) extracted.push({ name, quantity: qty });
      }

      return extracted;
    });

    result.cards = Array.isArray(cards)
      ? cards
          .map((c) => ({ name: safeText(c.name), quantity: Number(c.quantity) || 0 }))
          .filter((c) => c.name && Number.isFinite(c.quantity) && c.quantity > 0)
      : [];

    result.sumQty = result.cards.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
    result._debug = { source: result.cards.length ? 'dom' : 'none', dump: { html: htmlPath }, http: { status, title } };
    if (debug) result._debug.cardsPreview = result.cards.slice(0, 8);

    logger.info('Deck scraped', { url, cards: result.cards.length, sumQty: result.sumQty });
    return result;

  } catch (error) {
    if (error instanceof ValidationError) throw error;
    logger.error('Deck scrape failed', { url, error: error.message, stack: error.stack });
    throw new ParsingError(`Failed to scrape deck: ${error.message}`, { url });

  } finally {
    try {
      if (blockAssets && context && typeof context.unroute === 'function') {
        for (const pattern of assetPatterns) {
          await context.unroute(pattern, blockHandler);
        }
      }
    } catch (_) {}

    if (page) await page.close().catch(() => {});
  }
}

module.exports = { scrapeDeck };

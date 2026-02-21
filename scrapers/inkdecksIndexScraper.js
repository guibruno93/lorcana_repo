'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Minimal, compliant Inkdecks scrapers using Playwright.
 *
 * ✅ Compliant behavior:
 * - Does NOT attempt to bypass bot protections.
 * - Detects Cloudflare/bot blocks (403 / "Attention Required" / challenge HTML).
 * - Returns { blocked: true } to let the caller stop early.
 *
 * Exports:
 * - getDeckRefs(page, { format, pageNo, ... }) : scrapes /lorcana-decks/{format}?page=N
 * - getTournamentPages(page, { format, pageNo, ... }) : scrapes /lorcana-tournaments/{format}?page=N
 * - getDeckRefsFromTournament(page, { tournamentUrl, ... }) : scrapes a specific tournament page and returns deck refs
 */

function safeText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

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
  } catch (_) {
    // best effort
  }
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

  // Status-based blocks (common with Cloudflare/WAFs)
  if (status === 403) reasons.push('status=403');
  if (status === 429) reasons.push('status=429');
  if (status === 503) reasons.push('status=503');

  // Title-based signals
  if (/Attention Required/i.test(t) && /Cloudflare/i.test(t)) reasons.push('title=cloudflare');

  // Common challenge markers (can appear with status 200)
  if (/cf-browser-verification|cf-challenge|challenge-platform|turnstile|Checking your browser|captcha/i.test(h)) {
    reasons.push('html=cf_challenge');
  }

  return { blocked: reasons.length > 0, reasons, reason: reasons.join(',') || null };
}

function parseContainerText(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const out = {};
  if (!lines.length) return out;

  out.title = lines[0];
  if (lines[1] && /^by\s+/i.test(lines[1])) out.author = lines[1].replace(/^by\s+/i, '').trim();

  for (const l of lines) {
    const mPlayers = l.match(/^(\d+)\s+Players?$/i);
    if (mPlayers) out.players = Number(mPlayers[1]);

    const mSet = l.match(/^Set\s+(\d+)/i);
    if (mSet) out.metaSet = `Set ${mSet[1]}`;

    const mPrice = l.match(/^\$([\d.,]+)/);
    if (mPrice) out.priceUsd = Number(mPrice[1].replace(/,/g, ''));

    const mPct = l.match(/^(\d{1,3})%$/);
    if (mPct) out.spicinessPct = Number(mPct[1]);

    if (/^@/.test(l)) out.location = l.replace(/^@\s*/, '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(l)) out.date = l;

    // Standings tend to look like "1st", "2nd", "Top 8", "Top64", etc.
    if (/^(?:\d+(?:st|nd|rd|th)|Top\s*\d+|Winner|Winners|Finalist|Semi-?Finalist|Quarter-?Finalist)$/i.test(l)) {
      out.standing = l;
    }

    if (/^\d+-\d+-\d+$/.test(l)) out.record = l;
  }

  return out;
}

function buildDeckIndexUrl(format, pageNo) {
  const base = `https://inkdecks.com/lorcana-decks/${encodeURIComponent(format || 'core')}`;
  return pageNo > 1 ? `${base}?page=${pageNo}` : base;
}

function buildTournamentIndexUrl(format, pageNo) {
  const f = (format || 'core').toLowerCase();
  const base = f === 'all' ? 'https://inkdecks.com/lorcana-tournaments' : `https://inkdecks.com/lorcana-tournaments/${encodeURIComponent(f)}`;
  return pageNo > 1 ? `${base}?page=${pageNo}` : base;
}

async function gotoAndCheck(page, url, { dumpDir, kind, navTimeoutMs, dumpScreenshotOnBlocked = true }) {
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: navTimeoutMs }).catch(() => null);
  const status = resp && typeof resp.status === 'function' ? resp.status() : null;
  const title = await page.title().catch(() => null);

  const html = await page.content().catch(() => '');
  const htmlPath = dumpHtml(dumpDir, url, kind, status, html);

  const block = detectBlock({ status, title, html });
  const screenshotPath = block.blocked && dumpScreenshotOnBlocked ? await dumpScreenshot(page, dumpDir, url, kind, status) : null;

  return { status, title, html, block, htmlPath, screenshotPath };
}

async function extractDeckRefsFromCurrentPage(page) {
  return page.evaluate(() => {
    const abs = (href) => {
      try { return new URL(href, location.origin).href; } catch { return null; }
    };

    const anchors = Array.from(document.querySelectorAll('a[href*="/lorcana-metagame/deck-"]'));
    const out = [];

    for (const a of anchors) {
      const href = a.getAttribute('href');
      const url = abs(href);
      if (!url) continue;

      // Find a reasonably-sized container around the anchor that includes extra metadata.
      let el = a;
      for (let i = 0; i < 8; i++) {
        if (!el || !el.parentElement) break;
        el = el.parentElement;
        const txt = (el.innerText || '').trim();
        if (txt && txt.length < 700 && (/\bPlayers?\b/i.test(txt) || /\bSet\s+\d+/i.test(txt) || /\bTop\s*\d+\b/i.test(txt))) break;
      }

      out.push({ url, _containerText: (el && el.innerText) ? el.innerText : a.innerText });
    }

    // Preserve order but remove duplicates by URL.
    const seen = new Set();
    return out.filter((x) => {
      const u = x.url;
      if (!u || seen.has(u)) return false;
      seen.add(u);
      return true;
    });
  });
}

async function getDeckRefs(page, opts = {}) {
  const { format = 'core', pageNo = 1, debug = false, dumpDir = null, navTimeoutMs = 60000, dumpScreenshotOnBlocked = true } = opts;

  const url = buildDeckIndexUrl(format, pageNo);
  const nav = await gotoAndCheck(page, url, { dumpDir, kind: 'index', navTimeoutMs, dumpScreenshotOnBlocked });

  if (nav.block.blocked) {
    return {
      url,
      blocked: true,
      refs: [],
      _debug: {
        http: { status: nav.status, url, title: nav.title },
        reason: nav.block.reason,
        reasons: nav.block.reasons,
        dump: { html: nav.htmlPath, screenshot: nav.screenshotPath }
      }
    };
  }

  const refs = await extractDeckRefsFromCurrentPage(page);

  const parsed = refs.map((r) => {
    const meta = parseContainerText(r._containerText);
    delete r._containerText;
    return { url: r.url, ...meta };
  });

  const out = { url, refs: parsed };
  if (debug) {
    out._debug = {
      count: parsed.length,
      sample: parsed.slice(0, 3),
      http: { status: nav.status, title: nav.title },
      dump: { html: nav.htmlPath }
    };
  }
  return out;
}

async function getTournamentPages(page, opts = {}) {
  const { format = 'core', pageNo = 1, debug = false, dumpDir = null, navTimeoutMs = 60000, dumpScreenshotOnBlocked = true } = opts;

  const url = buildTournamentIndexUrl(format, pageNo);
  const nav = await gotoAndCheck(page, url, { dumpDir, kind: 'tournaments', navTimeoutMs, dumpScreenshotOnBlocked });

  if (nav.block.blocked) {
    return {
      url,
      blocked: true,
      tournaments: [],
      _debug: {
        http: { status: nav.status, url, title: nav.title },
        reason: nav.block.reason,
        reasons: nav.block.reasons,
        dump: { html: nav.htmlPath, screenshot: nav.screenshotPath }
      }
    };
  }

  const tournaments = await page.evaluate(() => {
    const abs = (href) => {
      try { return new URL(href, location.origin).href; } catch { return null; }
    };

    const toInt = (s) => {
      const m = String(s || '').match(/(\d+)/);
      return m ? Number(m[1]) : null;
    };

    const table = document.querySelector('table');
    if (table) {
      const headers = Array.from(table.querySelectorAll('thead th')).map((th) => (th.innerText || '').trim().toLowerCase());
      const idx = {
        date: headers.findIndex((h) => h === 'date'),
        meta: headers.findIndex((h) => h === 'meta'),
        format: headers.findIndex((h) => h === 'format'),
        players: headers.findIndex((h) => h.includes('players')),
        country: headers.findIndex((h) => h.includes('country')),
        name: headers.findIndex((h) => h.includes('name')),
      };

      const rows = Array.from(table.querySelectorAll('tbody tr'));
      const out = [];

      for (const tr of rows) {
        const tds = Array.from(tr.querySelectorAll('td'));
        const a = tr.querySelector('a[href*="/lorcana-tournaments/"]') || tr.querySelector('a[href*="/lorcana-tournament"]');
        const tournamentUrl = a ? abs(a.getAttribute('href')) : null;
        if (!tournamentUrl) continue;

        const getTd = (i) => (i >= 0 && i < tds.length ? (tds[i].innerText || '').trim() : '');

        const date = getTd(idx.date);
        const meta = getTd(idx.meta);
        const format = getTd(idx.format);
        const players = toInt(getTd(idx.players));
        const country = getTd(idx.country);
        const name = getTd(idx.name) || (a ? (a.innerText || '').trim() : '');

        out.push({
          tournamentUrl,
          ...(name ? { eventName: name } : {}),
          ...(date ? { date } : {}),
          ...(meta ? { metaSet: meta } : {}),
          ...(format ? { format } : {}),
          ...(players !== null ? { players } : {}),
          ...(country ? { country } : {}),
        });
      }

      const seen = new Set();
      return out.filter((x) => {
        if (seen.has(x.tournamentUrl)) return false;
        seen.add(x.tournamentUrl);
        return true;
      });
    }

    const anchors = Array.from(document.querySelectorAll('a[href*="/lorcana-tournaments/"]'));
    const out = anchors
      .map((a) => abs(a.getAttribute('href')))
      .filter(Boolean)
      .map((tournamentUrl) => ({ tournamentUrl }));

    const seen = new Set();
    return out.filter((x) => {
      if (seen.has(x.tournamentUrl)) return false;
      seen.add(x.tournamentUrl);
      return true;
    });
  });

  const out = { url, tournaments };
  if (debug) {
    out._debug = {
      count: tournaments.length,
      sample: tournaments.slice(0, 3),
      http: { status: nav.status, title: nav.title },
      dump: { html: nav.htmlPath }
    };
  }
  return out;
}

async function getDeckRefsFromTournament(page, opts = {}) {
  const { tournamentUrl, debug = false, dumpDir = null, navTimeoutMs = 60000, dumpScreenshotOnBlocked = true } = opts;
  const url = tournamentUrl;

  const nav = await gotoAndCheck(page, url, { dumpDir, kind: 'tournament', navTimeoutMs, dumpScreenshotOnBlocked });

  if (nav.block.blocked) {
    return {
      url,
      blocked: true,
      refs: [],
      _debug: {
        http: { status: nav.status, url, title: nav.title },
        reason: nav.block.reason,
        reasons: nav.block.reasons,
        dump: { html: nav.htmlPath, screenshot: nav.screenshotPath }
      }
    };
  }

  const refs = await page.evaluate(() => {
    const abs = (href) => {
      try { return new URL(href, location.origin).href; } catch { return null; }
    };

    const anchors = Array.from(document.querySelectorAll('a[href*="/lorcana-metagame/deck-"], a[href*="/lorcana-deck/"], a[href*="/lorcana-decks/deck-"]'));
    const out = [];

    for (const a of anchors) {
      const href = a.getAttribute('href');
      const u = abs(href);
      if (!u) continue;

      let el = a;
      for (let i = 0; i < 8; i++) {
        if (!el || !el.parentElement) break;
        el = el.parentElement;
        const txt = (el.innerText || '').trim();
        if (txt && txt.length < 900 && (/\bPlayers?\b/i.test(txt) || /\bSet\s+\d+/i.test(txt) || /\bTop\s*\d+\b/i.test(txt) || /\bWinner\b/i.test(txt))) break;
      }

      out.push({ url: u, _containerText: (el && el.innerText) ? el.innerText : a.innerText });
    }

    const seen = new Set();
    return out.filter((x) => {
      if (!x.url || seen.has(x.url)) return false;
      seen.add(x.url);
      return true;
    });
  });

  const parsed = refs.map((r) => {
    const meta = parseContainerText(r._containerText);
    delete r._containerText;
    return { url: r.url, ...meta };
  });

  const out = { url, refs: parsed };
  if (debug) {
    out._debug = { count: parsed.length, sample: parsed.slice(0, 5), http: { status: nav.status, title: nav.title }, dump: { html: nav.htmlPath } };
  }
  return out;
}

module.exports = { getDeckRefs, getTournamentPages, getDeckRefsFromTournament };

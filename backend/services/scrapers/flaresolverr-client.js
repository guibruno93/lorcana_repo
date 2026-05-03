'use strict';

/**
 * Cliente HTTP para FlareSolverr (POST /v1).
 * Resolve desafios Cloudflare e devolve cookies + userAgent para reutilizar no Puppeteer.
 *
 * Env:
 * - FLARESOLVERR_ENABLED — true/1/yes para ativar (recomendado com FLARESOLVERR_URL).
 * - FLARESOLVERR_URL — base HTTP, default http://127.0.0.1:8191
 * - FLARESOLVERR_MAX_TIMEOUT_MS — timeout interno do solver (default 120000; em CI costuma 180000)
 * - FLARESOLVERR_WAIT_AFTER — waitInSeconds após resolver (default 2)
 * - FLARESOLVERR_CLIENT_TIMEOUT_MS — timeout do fetch ao FlareSolverr (default 180000; deve ser > maxTimeout; CI 300000)
 */

function flareSolverrBaseUrl() {
  return (process.env.FLARESOLVERR_URL || 'http://127.0.0.1:8191').replace(
    /\/+$/,
    ''
  );
}

function isFlareSolverrEnabled() {
  const dis = String(process.env.FLARESOLVERR_ENABLED || '').toLowerCase();
  if (dis === 'false' || dis === '0' || dis === 'no') return false;
  const en = String(process.env.FLARESOLVERR_ENABLED || '').toLowerCase();
  return en === 'true' || en === '1' || en === 'yes';
}

function toPuppeteerCookie(c) {
  if (!c || !c.name) return null;
  const domainRaw = (c.domain || '').trim();
  const host = domainRaw.replace(/^\./, '') || 'inkdecks.com';
  const baseUrl = host.startsWith('http') ? host : `https://${host}`;

  const param = {
    name: c.name,
    value: String(c.value ?? ''),
    url: baseUrl,
    path: c.path || '/',
  };
  if (c.httpOnly != null) param.httpOnly = !!c.httpOnly;
  if (c.secure != null) param.secure = !!c.secure;
  if (!c.session && c.expires != null && Number.isFinite(Number(c.expires))) {
    param.expires = Math.floor(Number(c.expires));
  }
  if (c.sameSite) {
    const s = String(c.sameSite).toLowerCase();
    if (s === 'strict' || s === 'lax' || s === 'none') {
      param.sameSite = s.charAt(0).toUpperCase() + s.slice(1);
    }
  }
  return param;
}

/**
 * POST request.get ao FlareSolverr.
 * @param {string} url URL alvo (ex. listagem Inkdecks)
 * @param {{ emit?: (e: object) => void }} [opts]
 * @returns {Promise<{ userAgent: string, cookies: object[], response?: string, status: number }>}
 */
async function flareSolverRequestGet(url, opts = {}) {
  const emit = opts.emit;
  const base = flareSolverrBaseUrl();
  const maxTimeout = Math.max(
    30000,
    parseInt(process.env.FLARESOLVERR_MAX_TIMEOUT_MS || '120000', 10) || 120000
  );
  const waitInSeconds = Math.max(
    0,
    parseFloat(process.env.FLARESOLVERR_WAIT_AFTER || '2') || 0
  );
  const clientTimeout = Math.max(
    maxTimeout + 30000,
    parseInt(process.env.FLARESOLVERR_CLIENT_TIMEOUT_MS || '180000', 10) ||
      180000
  );

  const payload = {
    cmd: 'request.get',
    url,
    maxTimeout,
    waitInSeconds,
  };

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), clientTimeout);
  let res;
  try {
    res = await fetch(`${base}/v1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `FlareSolverr: resposta não-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`
    );
  }

  if (data.status !== 'ok' || !data.solution) {
    const msg = data.message || JSON.stringify(data);
    throw new Error(`FlareSolverr: ${msg}`);
  }

  const sol = data.solution;
  const ua = sol.userAgent || '';
  const cookies = Array.isArray(sol.cookies) ? sol.cookies : [];

  if (emit) {
    emit({
      type: 'log',
      level: 'info',
      message: `FlareSolverr: challenge resolvido (HTTP ${sol.status || '—'}, ${cookies.length} cookie(s), UA atribuído).`,
    });
  }

  return {
    userAgent: ua,
    cookies,
    response: sol.response,
    status: sol.status,
  };
}

/**
 * Aplica cookies + UA da solução FlareSolverr a uma página Puppeteer.
 * @param {import('puppeteer').Page} page
 * @param {{ userAgent: string, cookies: object[] }} solution
 * @param {(e: object) => void} [emit]
 */
async function applyFlareSolutionToPage(page, solution, emit) {
  if (solution.userAgent) {
    await page.setUserAgent(solution.userAgent);
  }
  const raw = solution.cookies || [];
  let applied = 0;
  for (const c of raw) {
    const pc = toPuppeteerCookie(c);
    if (!pc) continue;
    try {
      await page.setCookie(pc);
      applied++;
    } catch (e) {
      if (emit) {
        emit({
          type: 'log',
          level: 'warning',
          message: `FlareSolverr: cookie "${c.name}" não aplicado: ${e.message}`,
        });
      }
    }
  }
  if (emit) {
    emit({
      type: 'log',
      level: 'info',
      message: `FlareSolverr: ${applied}/${raw.length} cookie(s) aplicados no Puppeteer.`,
    });
  }
}

module.exports = {
  isFlareSolverrEnabled,
  flareSolverrBaseUrl,
  flareSolverRequestGet,
  applyFlareSolutionToPage,
  toPuppeteerCookie,
};

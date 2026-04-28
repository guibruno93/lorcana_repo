/* eslint-disable no-console */
'use strict';

require('dotenv').config();

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const BASE_URL = (process.env.SMOKE_BASE_URL || 'http://localhost:3002').replace(/\/$/, '');
const EMAIL_FROM_ENV = process.env.SMOKE_AUTH_EMAIL || '';
const PASSWORD_FROM_ENV = process.env.SMOKE_AUTH_PASSWORD || '';
const TOKEN_FROM_ENV = process.env.SMOKE_AUTH_TOKEN || '';
const SCRAPE_LIMIT = Math.max(1, parseInt(process.env.SMOKE_SCRAPE_LIMIT || '1', 10) || 1);
const REQUEST_TIMEOUT_MS = Math.max(
  10000,
  parseInt(process.env.SMOKE_AUTH_TIMEOUT_MS || '240000', 10) || 240000
);
const ALLOW_LOCAL_JWT_FALLBACK =
  String(process.env.SMOKE_ALLOW_LOCAL_JWT_FALLBACK || 'true').toLowerCase() === 'true';
const JWT_SECRET = process.env.JWT_SECRET || '';

function randomSuffix(size = 6) {
  return crypto.randomBytes(size).toString('hex');
}

function buildSmokeUser() {
  const suffix = randomSuffix(4);
  return {
    username: `smoke_${suffix}`,
    email: `smoke_${suffix}@example.com`,
    password: `SmokeTestA1!${suffix}`,
  };
}

async function fetchJson(path, options = {}, expectedStatuses = [200]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {
      json = null;
    }
    if (!expectedStatuses.includes(res.status)) {
      throw new Error(
        `${options.method || 'GET'} ${path} retornou ${res.status} (esperado ${expectedStatuses.join('/')})` +
          (text ? ` :: ${text.slice(0, 240)}` : '')
      );
    }
    return { res, json, text };
  } finally {
    clearTimeout(timeout);
  }
}

async function tryLogin(email, password) {
  const { json } = await fetchJson(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    [200]
  );
  if (!json?.token) {
    throw new Error('Login sem token no payload');
  }
  return json.token;
}

async function tryRegisterAndGetToken() {
  const user = buildSmokeUser();
  const { json: registerJson } = await fetchJson(
    '/api/auth/register',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        email: user.email,
        password: user.password,
        country: 'BR',
      }),
    },
    [200, 201]
  );

  if (registerJson?.token) return registerJson.token;

  // Se vier link de debug, tenta confirmar email e logar.
  const debugLink = registerJson?.debugVerificationLink;
  if (debugLink) {
    const path = debugLink.startsWith('http')
      ? debugLink.replace(/^https?:\/\/[^/]+/i, '')
      : debugLink;
    await fetchJson(path, { method: 'GET' }, [200, 302]);
    return tryLogin(user.email, user.password);
  }

  // Tenta login direto (caso AUTO_APPROVE_USERS=true sem token no register).
  try {
    return await tryLogin(user.email, user.password);
  } catch (err) {
    throw new Error(
      'Não foi possível obter token automático (registro sem token/debug link e login falhou): ' +
        err.message
    );
  }
}

async function getAuthToken() {
  if (TOKEN_FROM_ENV) return TOKEN_FROM_ENV;
  if (EMAIL_FROM_ENV && PASSWORD_FROM_ENV) {
    return tryLogin(EMAIL_FROM_ENV, PASSWORD_FROM_ENV);
  }
  return tryRegisterAndGetToken();
}

function buildLocalJwtFallback() {
  if (!ALLOW_LOCAL_JWT_FALLBACK) {
    throw new Error('fallback JWT local desabilitado');
  }
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET ausente para fallback JWT local');
  }
  return jwt.sign(
    {
      id: `smoke-local-${randomSuffix(6)}`,
      email: 'smoke-local@example.com',
    },
    JWT_SECRET,
    { expiresIn: '30m' }
  );
}

function validateScraperStatusPayload(json) {
  const issues = [];
  if (typeof json !== 'object' || json == null) {
    issues.push('payload não é objeto');
    return issues;
  }
  if (!('last_scrape' in json)) issues.push('campo ausente: last_scrape');
  if (typeof json.total_decks !== 'number') issues.push('campo inválido: total_decks (number)');
  if (typeof json.archetypes !== 'number') issues.push('campo inválido: archetypes (number)');
  if (!Array.isArray(json.archetype_list)) issues.push('campo inválido: archetype_list (array)');
  return issues;
}

function parseNdjson(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const events = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch (_) {
      // ignora linha inválida; será refletido por ausência de eventos esperados
    }
  }
  return events;
}

async function run() {
  const output = [];
  const failures = [];

  let token = null;
  try {
    token = await getAuthToken();
    output.push('OK    token de autenticação obtido');
  } catch (err) {
    try {
      token = buildLocalJwtFallback();
      output.push(
        `OK    token de autenticação via fallback JWT local (${err.message})`
      );
    } catch (fallbackErr) {
      failures.push(`token auth: ${err.message}; fallback: ${fallbackErr.message}`);
    }
  }

  if (!token) {
    console.log('FAIL  não foi possível continuar sem token');
    for (const f of failures) console.log(`      - ${f}`);
    process.exitCode = 1;
    return;
  }

  // 1) /scraper-status autenticado
  try {
    const { json } = await fetchJson(
      '/api/meta-analysis/scraper-status',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
      [200]
    );
    const issues = validateScraperStatusPayload(json);
    if (issues.length) {
      failures.push(`/scraper-status payload inválido: ${issues.join('; ')}`);
    } else {
      output.push('OK    GET /api/meta-analysis/scraper-status -> 200');
    }
  } catch (err) {
    failures.push(`GET /api/meta-analysis/scraper-status falhou: ${err.message}`);
  }

  // 2) /scrape autenticado (NDJSON, fim-a-fim)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(`${BASE_URL}/api/meta-analysis/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ limit: SCRAPE_LIMIT }),
      signal: controller.signal,
    });
    const text = await res.text();
    clearTimeout(timeout);

    if (res.status !== 200) {
      throw new Error(`/scrape retornou ${res.status}: ${text.slice(0, 240)}`);
    }

    const events = parseNdjson(text);
    const hasLog = events.some((e) => e?.type === 'log');
    const completeEvent = events.find((e) => e?.type === 'complete');

    if (!hasLog) failures.push('/scrape NDJSON sem eventos de log');
    if (!completeEvent) failures.push('/scrape NDJSON sem evento complete');
    if (completeEvent && typeof completeEvent.total !== 'number') {
      failures.push('/scrape complete.total ausente/inválido');
    }

    if (hasLog && completeEvent && typeof completeEvent.total === 'number') {
      output.push(
        `OK    POST /api/meta-analysis/scrape -> 200 (complete.total=${completeEvent.total})`
      );
    }
  } catch (err) {
    failures.push(`POST /api/meta-analysis/scrape falhou: ${err.message}`);
  }

  console.log('='.repeat(72));
  console.log('SMOKE TEST HTTP AUTENTICADO - SCRAPER P2P');
  console.log('='.repeat(72));
  for (const line of output) console.log(line);

  if (failures.length) {
    for (const f of failures) {
      console.log(`FAIL  ${f}`);
    }
    console.log('\nResultado final: COM FALHAS');
    process.exitCode = 1;
    return;
  }

  console.log('\nResultado final: SUCESSO');
}

run().catch((err) => {
  console.error('Erro fatal no smoke test autenticado:', err);
  process.exit(1);
});

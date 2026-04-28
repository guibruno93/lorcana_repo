/* eslint-disable no-console */
'use strict';

const BASE_URL = (process.env.SMOKE_BASE_URL || 'http://localhost:3002').replace(/\/$/, '');

function isObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function hasType(value, type) {
  if (type === 'array') return Array.isArray(value);
  if (type === 'null') return value === null;
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'string') return typeof value === 'string';
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'object') return isObject(value);
  if (type === 'any') return true;
  return false;
}

async function requestJson({ name, method = 'GET', path, expectedStatus, body, headers }) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = null;
  let rawText = null;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    json = await res.json();
  } else {
    rawText = await res.text();
  }

  const statusOk = res.status === expectedStatus;
  return {
    name,
    method,
    path,
    url,
    expectedStatus,
    status: res.status,
    statusOk,
    json,
    rawText,
    contentType: ct,
  };
}

function validateFields(payload, fieldSpecs) {
  const issues = [];
  for (const spec of fieldSpecs) {
    const value = payload?.[spec.key];
    if (spec.required && !(spec.key in (payload || {}))) {
      issues.push(`campo ausente: ${spec.key}`);
      continue;
    }
    if (spec.required || value !== undefined) {
      const accepted = Array.isArray(spec.type) ? spec.type : [spec.type];
      const ok = accepted.some((t) => hasType(value, t));
      if (!ok) {
        issues.push(
          `tipo inválido em ${spec.key} (esperado ${accepted.join('|')}, recebido ${value === null ? 'null' : typeof value})`
        );
      }
    }
  }
  return issues;
}

async function run() {
  const checks = [];

  checks.push(
    await requestJson({
      name: 'Health check',
      path: '/api/health',
      expectedStatus: 200,
    })
  );

  checks.push(
    await requestJson({
      name: 'Meta share (scraped-meta)',
      path: '/api/meta/share',
      expectedStatus: 200,
    })
  );

  checks.push(
    await requestJson({
      name: 'Tier list (scraped-meta)',
      path: '/api/meta/tier-list',
      expectedStatus: 200,
    })
  );

  checks.push(
    await requestJson({
      name: 'Stats (scraped-meta)',
      path: '/api/meta/stats',
      expectedStatus: 200,
    })
  );

  checks.push(
    await requestJson({
      name: 'Dashboard (meta-analysis)',
      path: '/api/meta-analysis/dashboard?days=30',
      expectedStatus: 200,
    })
  );

  checks.push(
    await requestJson({
      name: 'Meta share (meta-analysis)',
      path: '/api/meta-analysis/meta-share',
      expectedStatus: 200,
    })
  );

  checks.push(
    await requestJson({
      name: 'Scraped tier list (meta-analysis)',
      path: '/api/meta-analysis/scraped-tier-list?min_games=10',
      expectedStatus: 200,
    })
  );

  checks.push(
    await requestJson({
      name: 'Decks cache list',
      path: '/api/meta-analysis/decks',
      expectedStatus: 200,
    })
  );

  checks.push(
    await requestJson({
      name: 'Cache status',
      path: '/api/meta-analysis/cache-status',
      expectedStatus: 200,
    })
  );

  checks.push(
    await requestJson({
      name: 'Scraper status sem token',
      path: '/api/meta-analysis/scraper-status',
      expectedStatus: 401,
    })
  );

  checks.push(
    await requestJson({
      name: 'Scrape sem token',
      method: 'POST',
      path: '/api/meta-analysis/scrape',
      expectedStatus: 401,
      body: { limit: 1 },
    })
  );

  const payloadChecks = [];
  for (const c of checks) {
    if (!c.statusOk) continue;
    if (!isObject(c.json)) continue;
    if (c.path === '/api/meta/share') {
      payloadChecks.push({
        endpoint: c.path,
        issues: validateFields(c.json, [
          { key: 'total_decks', type: 'number', required: true },
          { key: 'archetypes', type: 'array', required: true },
        ]),
      });
    }
    if (c.path === '/api/meta/tier-list') {
      payloadChecks.push({
        endpoint: c.path,
        issues: validateFields(c.json, [
          { key: 'total_decks', type: 'number', required: true },
          { key: 'tiers', type: 'object', required: true },
          { key: 'generated_at', type: 'string', required: true },
        ]),
      });
    }
    if (c.path === '/api/meta/stats') {
      payloadChecks.push({
        endpoint: c.path,
        issues: validateFields(c.json, [
          { key: 'total_decks', type: 'number', required: true },
          { key: 'unique_archetypes', type: 'number', required: true },
          { key: 'with_standing_pct', type: 'number', required: true },
          { key: 'with_event_pct', type: 'number', required: true },
          { key: 'latest_scrape', type: ['string', 'null'], required: true },
        ]),
      });
    }
    if (c.path.startsWith('/api/meta-analysis/dashboard')) {
      payloadChecks.push({
        endpoint: '/api/meta-analysis/dashboard',
        issues: validateFields(c.json, [
          { key: 'success', type: 'boolean', required: true },
          { key: 'stats', type: 'object', required: true },
          { key: 'topArchetypes', type: 'array', required: true },
        ]),
      });
    }
    if (c.path === '/api/meta-analysis/meta-share') {
      payloadChecks.push({
        endpoint: c.path,
        issues: validateFields(c.json, [
          { key: 'success', type: 'boolean', required: true },
          { key: 'total_decks', type: 'number', required: true },
          { key: 'archetypes', type: 'array', required: true },
          { key: 'meta', type: 'object', required: true },
        ]),
      });
    }
    if (c.path.startsWith('/api/meta-analysis/scraped-tier-list')) {
      payloadChecks.push({
        endpoint: '/api/meta-analysis/scraped-tier-list',
        issues: validateFields(c.json, [
          { key: 'success', type: 'boolean', required: true },
          { key: 'tier_list', type: 'object', required: true },
          { key: 'all_archetypes', type: 'array', required: true },
        ]),
      });
    }
    if (c.path === '/api/meta-analysis/decks') {
      payloadChecks.push({
        endpoint: c.path,
        issues: validateFields(c.json, [
          { key: 'success', type: 'boolean', required: true },
          { key: 'decks', type: 'array', required: true },
          { key: 'meta', type: 'object', required: true },
        ]),
      });
    }
    if (c.path === '/api/meta-analysis/cache-status') {
      payloadChecks.push({
        endpoint: c.path,
        issues: validateFields(c.json, [
          { key: 'success', type: 'boolean', required: true },
          { key: 'cache', type: 'object', required: true },
        ]),
      });
    }
  }

  const failed = checks.filter((c) => !c.statusOk);
  const payloadFailed = payloadChecks.filter((p) => p.issues.length > 0);

  console.log('='.repeat(72));
  console.log('SMOKE TEST HTTP - META/SCRAPER');
  console.log('='.repeat(72));
  for (const c of checks) {
    const mark = c.statusOk ? 'OK' : 'FAIL';
    console.log(`${mark.padEnd(5)} ${c.method} ${c.path} -> ${c.status} (esperado ${c.expectedStatus})`);
  }

  console.log('\nChecklist de payloads');
  if (payloadChecks.length === 0) {
    console.log('WARN  Nenhum payload JSON validado.');
  } else {
    for (const p of payloadChecks) {
      if (p.issues.length === 0) {
        console.log(`OK    ${p.endpoint}`);
      } else {
        console.log(`FAIL  ${p.endpoint}`);
        for (const issue of p.issues) {
          console.log(`      - ${issue}`);
        }
      }
    }
  }

  if (failed.length || payloadFailed.length) {
    process.exitCode = 1;
    console.log('\nResultado final: COM FALHAS');
    return;
  }

  console.log('\nResultado final: SUCESSO');
}

run().catch((err) => {
  console.error('Erro fatal no smoke test:', err);
  process.exit(1);
});

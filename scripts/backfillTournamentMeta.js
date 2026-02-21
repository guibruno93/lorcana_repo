// backend/scripts/backfillTournamentMeta.js
"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { scrapeDeckWithPage, normalizeName } = require("../scrapers/inkdecksDeckScraper");

// ----------------- args helpers -----------------
function arg(name, fallback) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=").slice(1).join("=") : fallback;
}
function argNum(name, fallback) {
  const v = arg(name, null);
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function hasFlag(flag) {
  return process.argv.includes(flag);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function jitter(ms, pct = 0.25) {
  const d = ms * pct;
  return Math.max(0, Math.round(ms + (Math.random() * 2 - 1) * d));
}

function safeReadJSON(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

// ----------------- meta helpers -----------------
function sumDeckQty(deck) {
  if (Number.isFinite(Number(deck?.totalQty))) return Number(deck.totalQty);
  let s = 0;
  for (const c of Array.isArray(deck?.cards) ? deck.cards : []) {
    const q = Number(c?.quantity ?? c?.count ?? c?.copies ?? c?.qty ?? 0) || 0;
    s += q;
  }
  return s;
}

function deckNeedsBackfill(deck, minTotalQty) {
  const total = sumDeckQty(deck);
  const cardsLen = Array.isArray(deck?.cards) ? deck.cards.length : 0;
  // precisa se:
  // - não tem cartas
  // - total < min
  // - ou foi marcado como backfill ok=false (falhou antes)
  if (cardsLen === 0) return true;
  if (total < minTotalQty) return true;
  if (deck?.backfill && deck.backfill.ok === false) return true;
  return false;
}

function toMetaCard(c) {
  return {
    qty: Number(c.qty) || 0,
    name: c.name,
    normalizedName: c.normalizedName || normalizeName(c.name),
    cost: Number.isFinite(Number(c.cost)) ? Number(c.cost) : null,
    raw: `${Number(c.qty) || 0}\t${c.name}`,
  };
}

// ----------------- Cloudflare detection -----------------
function isCloudflareBlockedText(title, bodyText) {
  const t = String(title || "");
  const b = String(bodyText || "");
  return (
    /Why have I been blocked\?/i.test(b) ||
    /Cloudflare Ray ID/i.test(b) ||
    /Attention Required/i.test(t) ||
    /Access denied/i.test(t) ||
    /This website is using a security service/i.test(b) ||
    /Sorry, you have been blocked/i.test(b)
  );
}

function extractCloudflareRayId(bodyText) {
  const b = String(bodyText || "");
  const m = b.match(/Cloudflare Ray ID:\s*([a-z0-9]+)\b/i);
  return m ? m[1] : null;
}

// ----------------- debug dump -----------------
async function dumpDebug(page, i, extra = {}) {
  const dir = path.join(process.cwd(), "debug_backfill");
  fs.mkdirSync(dir, { recursive: true });

  const safe = String(i).padStart(4, "0");
  const htmlPath = path.join(dir, `fail_${safe}.html`);
  const pngPath = path.join(dir, `fail_${safe}.png`);
  const metaPath = path.join(dir, `fail_${safe}.meta.json`);

  const title = await page.title().catch(() => "");
  const url = page.url();

  const html = await page.content().catch(() => null);
  if (html) fs.writeFileSync(htmlPath, html, "utf8");

  await page.screenshot({ path: pngPath, fullPage: true }).catch(() => {});

  const bodyText = await page.locator("body").innerText().catch(() => "");
  const rayId = extractCloudflareRayId(bodyText);

  writeJSON(metaPath, {
    url,
    title,
    rayId,
    bodySnippet: bodyText.slice(0, 6000),
    savedHtml: html ? htmlPath : null,
    savedPng: pngPath,
    ...extra,
  });
}

// ----------------- merge/resume -----------------
function normalizeMetaShape(raw) {
  if (!raw) return { schemaVersion: 1, source: "inkdecks", updatedAt: null, decks: [] };
  if (Array.isArray(raw)) return { schemaVersion: 1, source: "inkdecks", updatedAt: null, decks: raw };
  if (raw && Array.isArray(raw.decks)) return raw;
  return { schemaVersion: raw?.schemaVersion ?? 1, source: raw?.source ?? "inkdecks", updatedAt: raw?.updatedAt ?? null, decks: [] };
}

// Tenta fazer resume usando URL como chave (mais estável que índice)
function buildDeckMapByUrl(decks) {
  const m = new Map();
  for (const d of Array.isArray(decks) ? decks : []) {
    if (d?.url) m.set(String(d.url), d);
  }
  return m;
}

function mergeDeckProgress(baseDecks, progressedDecks) {
  const progressed = buildDeckMapByUrl(progressedDecks);
  const out = [];

  for (const d of baseDecks) {
    const url = d?.url ? String(d.url) : null;
    if (url && progressed.has(url)) out.push(progressed.get(url));
    else out.push(d);
  }
  return out;
}

// ----------------- main -----------------
async function main() {
  const inPath = arg("in", path.join("db", "tournamentMeta.json"));
  const outPath = arg("out", path.join("db", "tournamentMeta.backfilled.json"));

  const minTotalQty = argNum("min", 60);
  const concurrency = argNum("concurrency", 1);
  const delayMs = argNum("delayMs", 3500);
  const timeoutMs = argNum("timeoutMs", 90000);
  const retries = argNum("retries", 2);
  const checkpointEvery = argNum("checkpointEvery", 25);
  const max = argNum("max", 0);

  const force = hasFlag("--force");
  const dryRun = hasFlag("--dry-run");
  const overwriteMetaFields = hasFlag("--overwrite-meta");
  const headful = hasFlag("--headful");
  const resume = hasFlag("--resume");
  const onlyMissing = hasFlag("--onlyMissing") || hasFlag("--only-missing");
  const stopOnBlock = !hasFlag("--noStopOnBlock") && !hasFlag("--no-stop-on-block");

  const userDataDir = arg("userDataDir", path.join(".pw-profile-inkdecks"));

  const rawIn = safeReadJSON(inPath);
  if (!rawIn) {
    console.error("❌ Não encontrei o meta de entrada:", inPath);
    process.exit(1);
  }
  const inState = normalizeMetaShape(rawIn);

  // resume: se out existe, usa o progresso dele
  let baseDecks = inState.decks;
  if (resume && fs.existsSync(outPath)) {
    const rawOut = safeReadJSON(outPath);
    const outState = normalizeMetaShape(rawOut);
    baseDecks = mergeDeckProgress(inState.decks, outState.decks);
    console.log("🔁 RESUME ativo: usando progresso do OUT existente.");
  }

  const state = { ...inState, decks: baseDecks };

  console.log("IN :", inPath);
  console.log("OUT:", outPath);
  console.log(
    `Config: min=${minTotalQty} concurrency=${concurrency} delayMs=${delayMs} timeoutMs=${timeoutMs} retries=${retries} checkpointEvery=${checkpointEvery} headful=${headful} resume=${resume} onlyMissing=${onlyMissing} stopOnBlock=${stopOnBlock}`
  );
  console.log("userDataDir:", userDataDir);

  // Se você já está bloqueado no navegador, esse script vai detectar e abortar cedo (o que é o correto).
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: !headful,
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    locale: "en-US",
    args: ["--disable-blink-features=AutomationControlled"],
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  let cursor = 0;
  let processed = 0;
  let shouldStop = false;
  let stopReason = null;

  const log = [];
  let ok = 0, warn = 0, fail = 0, skip = 0;

  function checkpoint() {
    if (dryRun) return;
    state.updatedAt = new Date().toISOString();
    writeJSON(outPath, state);
    writeJSON(outPath.replace(/\.json$/i, ".backfill.log.json"), log.sort((a, b) => a.i - b.i));
  }

  function requestStop(reason) {
    shouldStop = true;
    stopReason = reason || "stopped";
  }

  async function worker(wid) {
    const page = await context.newPage();

    try {
      while (true) {
        if (shouldStop) return;

        const i = cursor++;
        if (i >= state.decks.length) return;
        if (max > 0 && processed >= max) return;

        const d = state.decks[i];
        const url = d?.url;

        if (!url || !/^https?:\/\//i.test(url)) {
          fail++;
          processed++;
          log.push({ i, status: "fail", reason: "invalid_url", url: url || null });
          continue;
        }

        const before = sumDeckQty(d);

        if (!force) {
          if (onlyMissing) {
            if (!deckNeedsBackfill(d, minTotalQty)) {
              skip++;
              processed++;
              log.push({ i, status: "skip", reason: "not_missing", url, before });
              continue;
            }
          } else {
            if (before >= minTotalQty) {
              skip++;
              processed++;
              log.push({ i, status: "skip", reason: "already_meets_min", url, before });
              continue;
            }
          }
        }

        let lastErr = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
          if (shouldStop) break;

          try {
            const r = await scrapeDeckWithPage(page, url, { timeoutMs });

            const extractedTotal = Number(r.totalQty) || 0;
            const meetsMin = extractedTotal >= minTotalQty;

            d.totalQtySource = d.totalQty ?? null;
            d.totalQty = extractedTotal;
            d.cards = (r.cards || []).map(toMetaCard);

            if (overwriteMetaFields && r.tournament) {
              d.date = d.date ?? r.tournament.date ?? null;
              d.players = d.players ?? r.tournament.players ?? null;
              d.event = d.event ?? r.tournament.name ?? null;
              d.standing = d.standing ?? r.tournament.placementText ?? null;
              d.author = d.author ?? r.tournament.player ?? null;
            }

            d.backfilledAt = new Date().toISOString();
            d.backfill = {
              ok: meetsMin,
              httpStatus: r.status ?? null,
              declaredTotalCards: r.declaredTotalCards ?? null,
              extractedTotalQty: extractedTotal,
              method: "playwright-persistent",
              attempt,
            };

            if (meetsMin) {
              ok++;
              console.log(`✅ [${wid}] #${i} ${before} -> ${extractedTotal} | ${url}`);
              log.push({ i, status: "ok", url, before, extractedTotal, httpStatus: r.status ?? null, attempt });
            } else {
              warn++;
              console.log(`⚠️ [${wid}] #${i} ${before} -> ${extractedTotal} (<${minTotalQty}) | ${url}`);
              log.push({ i, status: "warn", url, before, extractedTotal, httpStatus: r.status ?? null, attempt });
            }

            lastErr = null;
            break;
          } catch (e) {
            lastErr = String(e?.message || e);

            // Checa se virou bloqueio Cloudflare
            const title = await page.title().catch(() => "");
            const bodyText = await page.locator("body").innerText().catch(() => "");
            const blocked = isCloudflareBlockedText(title, bodyText);
            const rayId = blocked ? extractCloudflareRayId(bodyText) : null;

            console.log(`❌ [${wid}] #${i} attempt=${attempt} fail (${lastErr}) | ${url}${blocked ? " [CLOUDFLARE BLOCK]" : ""}`);

            await dumpDebug(page, i, { attempt, error: lastErr, blocked, rayId }).catch(() => {});

            if (blocked && stopOnBlock) {
              // Salva checkpoint e para tudo (evita piorar o ban)
              log.push({ i, status: "blocked", url, reason: "cloudflare_block", rayId, attempt });
              requestStop(`cloudflare_block${rayId ? ` rayId=${rayId}` : ""}`);
              checkpoint();
              break;
            }

            // backoff progressivo para falhas normais
            const backoff = 12000 + attempt * 25000;
            await sleep(jitter(backoff, 0.35));
            await page.goto("about:blank").catch(() => {});
          }
        }

        if (lastErr && !shouldStop) {
          fail++;
          log.push({ i, status: "fail", url, reason: lastErr });
        }

        processed++;

        if (checkpointEvery > 0 && processed % checkpointEvery === 0) {
          checkpoint();
          console.log(`💾 checkpoint (${processed} processados)`);
        }

        await sleep(jitter(delayMs, 0.35));
      }
    } finally {
      await page.close().catch(() => {});
    }
  }

  const workers = [];
  for (let w = 1; w <= Math.max(1, concurrency); w++) workers.push(worker(w));
  await Promise.all(workers);

  await context.close().catch(() => {});

  // final save
  checkpoint();

  console.log("\nResumo:");
  console.log("ok:", ok, "| warn:", warn, "| fail:", fail, "| skip:", skip, "| processed:", processed);
  if (shouldStop) console.log("🛑 interrompido:", stopReason);
}

main().catch((e) => {
  console.error("❌ erro fatal:", e);
  process.exit(1);
});

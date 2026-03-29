/**
 * Analisa a estrutura da página de deck no Inkdecks (tabs, scroll, seletores, cópias vs linhas).
 *
 * Uso (a partir da pasta backend):
 *   node debug-deck-structure.js
 *
 * Env opcional:
 *   DEBUG_HEADLESS=true          — sem janela
 *   PUPPETEER_EXECUTABLE_PATH=   — Chromium do sistema (Render/Linux)
 *   DEBUG_BROWSER_WAIT_MS=120000 — tempo para inspeção manual (headless false)
 */

'use strict';

const path = require('path');
const fs = require('fs').promises;
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const BASE_URL = 'https://inkdecks.com';
const LIST_URL = `${BASE_URL}/lorcana-decks/core`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function debugDeckPage() {
  console.log('🔍 Debugging Inkdecks deck page structure\n');

  const headless = process.env.DEBUG_HEADLESS === 'true';
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

  const browser = await puppeteer.launch({
    headless,
    executablePath: executablePath || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('📄 Loading deck listing...');
    await page.goto(LIST_URL, { waitUntil: 'networkidle2', timeout: 90000 });
    await sleep(4000);

    const deckUrl = await page.evaluate((base) => {
      const row = document.querySelector('tr[id^="desktop-deck-"]');
      const href = row && row.getAttribute('data-href');
      if (!href) return null;
      return href.startsWith('http') ? href : base + href;
    }, BASE_URL);

    if (!deckUrl) {
      throw new Error(
        'Nenhum deck encontrado (tr[id^="desktop-deck-"] + data-href). Cloudflare ou HTML alterado.'
      );
    }

    console.log(`\n✅ Deck URL: ${deckUrl}\n`);
    console.log('🔄 Loading deck page...');

    await page.goto(deckUrl, { waitUntil: 'networkidle2', timeout: 90000 });
    await sleep(3000);

    const sumQuantities = async () =>
      page.$$eval('tr.card-list-item', (rows) =>
        rows.reduce((s, row) => {
          const q = parseInt(row.getAttribute('data-quantity') || '0', 10);
          return s + (Number.isNaN(q) ? 0 : q);
        }, 0)
      );

    const initialCount = await page.$$eval(
      'tr.card-list-item',
      (rows) => rows.length
    );
    const initialCopies = await sumQuantities();

    console.log('\n📊 Contagem inicial');
    console.log(`   Linhas tr.card-list-item: ${initialCount}`);
    console.log(`   Soma data-quantity (cópias no baralho): ${initialCopies}`);

    console.log('\n📑 Secções / tabs (possíveis)');
    const sections = await page.evaluate(() => {
      const possibleSections = document.querySelectorAll(
        '.decklist, .deck-section, .card-list, [class*="main-deck"], [class*="sideboard"], section, .tab-pane'
      );
      return Array.from(possibleSections).map((section) => ({
        tag: section.tagName,
        class: section.className.slice(0, 120),
        id: section.id,
        visible: section.offsetHeight > 0,
        cardCount: section.querySelectorAll('tr.card-list-item').length,
        text: (section.textContent || '').substring(0, 50).replace(/\s+/g, ' '),
      }));
    });
    console.log(JSON.stringify(sections, null, 2));

    console.log('\n🔄 Scroll (lazy load)...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(1000);

    const beforeScroll = await page.$$eval(
      'tr.card-list-item',
      (rows) => rows.length
    );
    const beforeCopies = await sumQuantities();
    console.log(`Antes scroll: ${beforeScroll} linhas, ${beforeCopies} cópias`);

    await page.evaluate(
      () =>
        new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              setTimeout(resolve, 1000);
            }
          }, 100);
        })
    );

    await sleep(3000);

    const afterScroll = await page.$$eval(
      'tr.card-list-item',
      (rows) => rows.length
    );
    const afterCopies = await sumQuantities();
    console.log(`Depois scroll: ${afterScroll} linhas, ${afterCopies} cópias`);
    console.log(
      `Δ linhas: ${afterScroll - beforeScroll} | Δ cópias: ${afterCopies - beforeCopies}`
    );

    console.log('\n🔘 Botões relevantes (show / more / ver / expand)');
    const buttons = await page.evaluate(() => {
      const allButtons = Array.from(
        document.querySelectorAll('button, .btn, a[role="button"]')
      );
      return allButtons
        .filter((btn) => btn.offsetHeight > 0)
        .map((btn) => ({
          text: (btn.textContent || '').trim().substring(0, 50),
          class: (btn.className || '').slice(0, 80),
          id: btn.id,
        }))
        .filter((btn) => {
          const t = btn.text.toLowerCase();
          return (
            t.includes('show') ||
            t.includes('all') ||
            t.includes('more') ||
            t.includes('expand') ||
            t.includes('ver') ||
            t.includes('load')
          );
        });
    });
    console.log(JSON.stringify(buttons, null, 2));

    console.log('\n🎯 Seletores alternativos (contagem elementos)');
    const selectorTests = [
      'tr.card-list-item',
      'tr[data-quantity]',
      'tr[class*="card"]',
      '[data-card-type]',
      'tr[id*="card"]',
      '.card-row',
      '.decklist tr',
    ];

    for (const selector of selectorTests) {
      try {
        const count = await page.$$eval(selector, (els) => els.length);
        if (count > 0) {
          console.log(`  ${selector}: ${count}`);
        }
      } catch {
        /* inválido */
      }
    }

    console.log('\n📊 Texto no corpo (pistas "N cards" / total)');
    const deckTotal = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const matches = bodyText.match(/(\d+)\s*(cards?|cartas|total)/gi);
      return matches ? matches.slice(0, 8) : [];
    });
    console.log(deckTotal);

    const outHtml = path.join(__dirname, 'debug-deck-full.html');
    const html = await page.content();
    await fs.writeFile(outHtml, html, 'utf8');
    console.log(`\n💾 HTML: ${outHtml} (${html.length} chars)`);

    const sampleCards = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr.card-list-item'));
      return rows.slice(0, 5).map((row) => ({
        quantity: row.getAttribute('data-quantity'),
        cardType: row.getAttribute('data-card-type'),
        visible: row.offsetHeight > 0,
        html: row.outerHTML.substring(0, 280),
      }));
    });
    console.log('\n📋 Amostra de linhas:', JSON.stringify(sampleCards, null, 2));

    const finalCount = await page.$$eval(
      'tr.card-list-item',
      (rows) => rows.length
    );
    const finalCopies = await sumQuantities();

    console.log('\n' + '='.repeat(60));
    console.log('RESUMO');
    console.log('='.repeat(60));
    console.log(`Linhas (tipos únicos na lista): ${finalCount}`);
    console.log(`Cópias no baralho (Σ data-quantity): ${finalCopies}`);
    console.log('Alvo Lorcana: ~60 cópias (não 60 linhas — cada linha pode ser 4x a mesma carta).');
    console.log('='.repeat(60));

    if (finalCopies >= 50 && finalCopies <= 65) {
      console.log('\n✅ Soma de quantidades compatível com deck completo.');
    } else if (finalCopies < 50) {
      console.log('\n⚠️ Poucas cópias — investigar abas, botão "mostrar tudo" ou HTML em debug-deck-full.html');
    }

    const waitMs = headless
      ? 0
      : parseInt(process.env.DEBUG_BROWSER_WAIT_MS || '120000', 10);
    if (!headless && waitMs > 0) {
      console.log(
        `\n🔍 Navegador aberto — inspeção manual. Fecha a janela ou aguarda ${waitMs / 1000}s…`
      );
      await sleep(waitMs);
    }
  } catch (err) {
    console.error('\n❌ Debug failed:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

debugDeckPage();

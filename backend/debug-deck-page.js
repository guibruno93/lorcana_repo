/**
 * Inspeciona uma página de deck no Inkdecks (scroll, contagem, HTML).
 *
 * Uso:
 *   node debug-deck-page.js "https://inkdecks.com/lorcana-decks/deck-XXXX"
 *   set INKDECKS_DEBUG_URL=https://... && node debug-deck-page.js
 */

const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scrollFull(page) {
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

async function main() {
  const deckUrl =
    process.argv[2] ||
    process.env.INKDECKS_DEBUG_URL ||
    '';

  if (!deckUrl || !deckUrl.includes('inkdecks.com')) {
    console.error(
      'Informe a URL do deck:\n  node debug-deck-page.js "https://inkdecks.com/lorcana-decks/deck-..."\n' +
        'ou defina INKDECKS_DEBUG_URL.'
    );
    process.exit(1);
  }

  console.log('🔍 Debug deck page\nURL:', deckUrl, '\n');

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
    await page.goto(deckUrl, { waitUntil: 'networkidle2', timeout: 90000 });
    await sleep(4000);

    await page.waitForSelector('tr.card-list-item', { timeout: 25000 });

    const initial = await page.$$eval(
      'tr.card-list-item',
      (rows) => rows.length
    );
    console.log('Contagem inicial tr.card-list-item:', initial);

    const altCount = await page.$$eval(
      'tr[data-quantity][data-card-type]',
      (rows) => rows.length
    );
    console.log('tr[data-quantity][data-card-type]:', altCount);

    console.log('\nScroll até o fim…');
    await scrollFull(page);
    await sleep(3000);

    const afterScroll = await page.$$eval(
      'tr.card-list-item',
      (rows) => rows.length
    );
    console.log('Após scroll:', afterScroll);

    const buttons = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll('button, a.btn, .btn, [role="button"], .nav-link')
      )
        .filter((b) => b && b.offsetParent !== null)
        .slice(0, 40)
        .map((b) => ({
          tag: b.tagName,
          text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
          class: (b.className || '').slice(0, 120),
        }));
    });
    console.log('\nBotões/links (amostra):');
    console.log(JSON.stringify(buttons, null, 2));

    const html = await page.content();
    const outFile = path.join(__dirname, 'debug-deck-page.html');
    await fs.writeFile(outFile, html, 'utf8');
    console.log('\n✅ HTML salvo em:', outFile);
    console.log('outerHTML length:', html.length);

    if (!headless) {
      console.log('\n(Navegador visível — feche a janela ou Ctrl+C.)');
      await sleep(120000);
    }
  } catch (err) {
    console.error('❌ Debug failed:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();

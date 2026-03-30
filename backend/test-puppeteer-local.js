// test-puppeteer-local.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
  console.log('🚀 Iniciando Puppeteer...');
  
  const browser = await puppeteer.launch({
    headless: false, // Ver o que está acontecendo
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080'
    ]
  });
  
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('🌐 Navegando para Inkdecks...');
  
  try {
    await page.goto('https://inkdecks.com/lorcana-decks/core', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    console.log('✅ Navegação bem-sucedida!');
    
    // Aguardar seletor de decks
    await page.waitForSelector('tr[id^="desktop-deck-"]', { timeout: 10000 });
    
    console.log('✅ Decks encontrados!');
    
    // Extrair alguns decks
    const deckLinks = await page.$$eval('tr[id^="desktop-deck-"][data-href]', rows => {
      return rows.slice(0, 3).map(row => ({
        href: row.getAttribute('data-href'),
        id: row.id
      }));
    });
    
    console.log('📊 Decks extraídos:', deckLinks);
    
    // Aguardar para ver
    console.log('⏳ Aguardando 5s para você ver...');
    await new Promise(r => setTimeout(r, 5000));
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
    
    // Screenshot do erro
    await page.screenshot({ path: 'error.png', fullPage: true });
    console.log('📸 Screenshot salvo em error.png');
  }
  
  await browser.close();
  console.log('✅ Teste completo!');
})();
// 🔍 INKDECKS PAGE INSPECTOR
// Debug script to analyze Inkdecks page structure and find performance data
//
// Usage: node debug-inkdecks-inspector.js <deck_url>
// Example: node debug-inkdecks-inspector.js https://inkdecks.com/lorcana-metagame/deck-cory-bs-508281

const puppeteer = require('puppeteer');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteerExtra.use(StealthPlugin());

async function inspectInkdecksPage(url) {
  console.log('\n🔍 INKDECKS PAGE INSPECTOR\n');
  console.log(`📄 URL: ${url}\n`);

  const browser = await puppeteerExtra.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  console.log('🚀 Loading page...');
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000); // Wait for Cloudflare

  console.log('✅ Page loaded\n');

  // ═══════════════════════════════════════════════════
  // EXTRACT PAGE CONTENT
  // ═══════════════════════════════════════════════════

  const pageData = await page.evaluate(() => {
    const data = {
      title: document.title,
      h1: null,
      h2: null,
      h3: null,
      metaTags: {},
      bodyText: document.body.innerText,
      bodyTextLines: [],
      htmlSnippets: {}
    };

    // Extract headers
    const h1 = document.querySelector('h1');
    const h2 = document.querySelector('h2');
    const h3 = document.querySelector('h3');
    
    if (h1) data.h1 = h1.textContent.trim();
    if (h2) data.h2 = h2.textContent.trim();
    if (h3) data.h3 = h3.textContent.trim();

    // Extract meta tags
    const metaTags = document.querySelectorAll('meta[property], meta[name]');
    metaTags.forEach(meta => {
      const prop = meta.getAttribute('property') || meta.getAttribute('name');
      const content = meta.getAttribute('content');
      if (prop && content) {
        data.metaTags[prop] = content;
      }
    });

    // Split body text into lines for easier inspection
    data.bodyTextLines = data.bodyText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Extract specific sections (if they have class names)
    const sectionsToCheck = [
      '.deck-info',
      '.deck-stats',
      '.tournament-info',
      '.event-info',
      '.player-info',
      '.deck-performance',
      '.record',
      '.standing',
      '.placement'
    ];

    sectionsToCheck.forEach(selector => {
      const elem = document.querySelector(selector);
      if (elem) {
        data.htmlSnippets[selector] = elem.innerHTML;
      }
    });

    return data;
  });

  // ═══════════════════════════════════════════════════
  // DISPLAY EXTRACTED DATA
  // ═══════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════');
  console.log('📋 PAGE STRUCTURE');
  console.log('═══════════════════════════════════════════════════\n');

  console.log(`📄 Title: ${pageData.title}`);
  console.log(`📌 H1: ${pageData.h1 || '(none)'}`);
  console.log(`📌 H2: ${pageData.h2 || '(none)'}`);
  console.log(`📌 H3: ${pageData.h3 || '(none)'}`);
  console.log('');

  console.log('🏷️  Meta Tags:');
  Object.entries(pageData.metaTags).forEach(([key, value]) => {
    console.log(`   ${key}: ${value}`);
  });
  console.log('');

  if (Object.keys(pageData.htmlSnippets).length > 0) {
    console.log('📦 Found Sections:');
    Object.keys(pageData.htmlSnippets).forEach(selector => {
      console.log(`   ✓ ${selector}`);
    });
    console.log('');
  }

  // ═══════════════════════════════════════════════════
  // SEARCH FOR PERFORMANCE DATA
  // ═══════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════');
  console.log('🔎 SEARCHING FOR PERFORMANCE DATA');
  console.log('═══════════════════════════════════════════════════\n');

  const bodyText = pageData.bodyText;

  // Test various patterns
  const patterns = [
    { name: 'W-L Record (X-Y)', regex: /\b(\d+)\s*-\s*(\d+)\b/g },
    { name: 'Wins/Losses (words)', regex: /(\d+)\s*wins?\s*[,/]\s*(\d+)\s*losses?/gi },
    { name: 'Record: X-Y', regex: /record[:\s]+(\d+)[^\d]+(\d+)/gi },
    { name: 'Standing (Nth place)', regex: /(\d+)(?:st|nd|rd|th)\s*place/gi },
    { name: 'Top N', regex: /top\s*(\d+)/gi },
    { name: 'Placement', regex: /placement[:\s]+(\d+)/gi },
    { name: 'Final Standing', regex: /final\s*standing[:\s]+(\d+)/gi }
  ];

  const findings = {};

  patterns.forEach(({ name, regex }) => {
    const matches = [...bodyText.matchAll(regex)];
    if (matches.length > 0) {
      findings[name] = matches.map(m => m[0]);
      console.log(`✅ ${name}:`);
      matches.forEach(match => {
        console.log(`   → "${match[0]}"`);
      });
      console.log('');
    } else {
      console.log(`❌ ${name}: Not found`);
    }
  });

  console.log('');

  // ═══════════════════════════════════════════════════
  // DISPLAY RELEVANT TEXT SECTIONS
  // ═══════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════');
  console.log('📝 RELEVANT TEXT SECTIONS');
  console.log('═══════════════════════════════════════════════════\n');

  // Look for lines containing keywords
  const keywords = [
    'win', 'loss', 'record', 'standing', 'place', 'top',
    'tournament', 'event', 'championship', 'placement',
    'final', 'result', 'score'
  ];

  const relevantLines = pageData.bodyTextLines.filter(line => {
    const lowerLine = line.toLowerCase();
    return keywords.some(keyword => lowerLine.includes(keyword));
  });

  if (relevantLines.length > 0) {
    console.log('Lines containing performance keywords:\n');
    relevantLines.forEach((line, index) => {
      console.log(`${index + 1}. ${line}`);
    });
  } else {
    console.log('⚠️  No lines found with performance keywords');
  }

  console.log('');

  // ═══════════════════════════════════════════════════
  // DISPLAY FULL TEXT (FIRST 100 LINES)
  // ═══════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════');
  console.log('📄 FULL PAGE TEXT (First 100 lines)');
  console.log('═══════════════════════════════════════════════════\n');

  pageData.bodyTextLines.slice(0, 100).forEach((line, index) => {
    console.log(`${String(index + 1).padStart(3, ' ')}. ${line}`);
  });

  if (pageData.bodyTextLines.length > 100) {
    console.log(`\n... (${pageData.bodyTextLines.length - 100} more lines)\n`);
  }

  // ═══════════════════════════════════════════════════
  // RECOMMENDATIONS
  // ═══════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════');
  console.log('💡 RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════\n');

  if (Object.keys(findings).length > 0) {
    console.log('✅ Found performance data patterns!');
    console.log('\nSuccessful patterns:');
    Object.keys(findings).forEach(name => {
      console.log(`   ✓ ${name}`);
    });
    console.log('\nThese patterns should work in extractDeckPagePerformance()');
  } else {
    console.log('❌ No performance data found with current patterns');
    console.log('\nPossible reasons:');
    console.log('   1. Inkdecks does not display performance data on this page');
    console.log('   2. Data is in a different format than expected');
    console.log('   3. Data is loaded dynamically (check Network tab)');
    console.log('   4. Data is in a different section (check full text above)');
    console.log('\nNext steps:');
    console.log('   1. Review "RELEVANT TEXT SECTIONS" above');
    console.log('   2. Review "FULL PAGE TEXT" above');
    console.log('   3. Manually visit the URL in a browser');
    console.log('   4. Check if performance data exists on the page');
    console.log('   5. If it exists, identify the exact format');
    console.log('   6. Update regex patterns accordingly');
  }

  console.log('\n');

  await browser.close();

  // Return findings for programmatic use
  return {
    success: Object.keys(findings).length > 0,
    findings,
    pageData
  };
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
🔍 INKDECKS PAGE INSPECTOR

Usage: node debug-inkdecks-inspector.js <deck_url>

Examples:
  node debug-inkdecks-inspector.js https://inkdecks.com/lorcana-metagame/deck-cory-bs-508281
  node debug-inkdecks-inspector.js https://inkdecks.com/lorcana-metagame/deck-jasmin-s-allies-508276

This script will:
  1. Load the Inkdecks page
  2. Extract all text content
  3. Search for performance data patterns (W-L, standings, etc.)
  4. Show relevant text sections
  5. Display full page text for manual inspection
  6. Provide recommendations for fixing extraction
`);
  process.exit(0);
}

const url = args[0];

if (!url.includes('inkdecks.com')) {
  console.error('❌ Error: URL must be from inkdecks.com');
  process.exit(1);
}

inspectInkdecksPage(url)
  .then(result => {
    if (result.success) {
      console.log('✅ Inspector completed successfully');
      process.exit(0);
    } else {
      console.log('⚠️  Inspector completed but no performance data found');
      process.exit(0);
    }
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

/**
 * investigate-deck.js
 * Baixa HTML de 1 deck e analisa estrutura completa
 */

'use strict';

const https = require('https');
const fs = require('fs');

const deckUrl = process.argv[2] || 'https://inkdecks.com/lorcana-metagame/deck-jdrr-bp-499968';

console.log('🔍 Investigating deck...');
console.log(`URL: ${deckUrl}\n`);

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    };
    
    const req = https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
  });
}

async function investigate() {
  try {
    // Download HTML
    console.log('📥 Downloading HTML...');
    const html = await httpsGet(deckUrl);
    
    // Save to file
    const filename = './deck-sample.html';
    fs.writeFileSync(filename, html, 'utf8');
    console.log(`💾 Saved to: ${filename}\n`);
    
    // Count card-list-item occurrences
    const cardItemMatches = html.match(/<tr[^>]*class="card-list-item"/g);
    const cardItemCount = cardItemMatches ? cardItemMatches.length : 0;
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 ANALYSIS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log(`Total <tr class="card-list-item"> found: ${cardItemCount}`);
    
    // Check for different table sections
    const characterSection = (html.match(/<div[^>]*subheader[^>]*>.*?character/gi) || []).length;
    const actionSection = (html.match(/<div[^>]*subheader[^>]*>.*?action/gi) || []).length;
    const songSection = (html.match(/<div[^>]*subheader[^>]*>.*?song/gi) || []).length;
    const itemSection = (html.match(/<div[^>]*subheader[^>]*>.*?item/gi) || []).length;
    
    console.log(`\nSections found:`);
    console.log(`  Characters: ${characterSection}`);
    console.log(`  Actions:    ${actionSection}`);
    console.log(`  Songs:      ${songSection}`);
    console.log(`  Items:      ${itemSection}`);
    
    // Count quantities
    const quantities = [];
    const qtyRegex = /<b>(\d+)&nbsp;<\/b>/g;
    let match;
    while ((match = qtyRegex.exec(html)) !== null) {
      quantities.push(parseInt(match[1]));
    }
    
    const totalCards = quantities.reduce((a, b) => a + b, 0);
    
    console.log(`\nCard quantities found: ${quantities.length}`);
    console.log(`Total cards in deck:   ${totalCards}`);
    
    if (totalCards === 60) {
      console.log('✅ COMPLETE DECK (60 cards)');
    } else if (totalCards < 60) {
      console.log(`⚠️  INCOMPLETE (${60 - totalCards} cards missing)`);
    } else {
      console.log(`⚠️  TOO MANY CARDS (${totalCards - 60} extra)`);
    }
    
    // Check for pagination or "show more" buttons
    const showMoreBtn = html.includes('show-more') || html.includes('load-more') || html.includes('expand');
    console.log(`\n"Show more" button: ${showMoreBtn ? 'YES ⚠️' : 'NO ✅'}`);
    
    // Check for JavaScript-loaded content
    const hasReact = html.includes('react') || html.includes('__NEXT_DATA__');
    const hasVue = html.includes('vue') || html.includes('v-for');
    console.log(`JavaScript framework: ${hasReact ? 'React' : hasVue ? 'Vue' : 'None ✅'}`);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('💡 RECOMMENDATIONS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    if (totalCards === 60) {
      console.log('✅ Parser is working correctly!');
      console.log('   All 60 cards are in the HTML.');
      console.log('   No changes needed.');
    } else if (totalCards < 60) {
      console.log('⚠️  Parser is missing cards.');
      if (showMoreBtn) {
        console.log('   Likely cause: "Show more" button needs to be clicked.');
        console.log('   Solution: Use Puppeteer to click button before parsing.');
      } else if (hasReact || hasVue) {
        console.log('   Likely cause: Cards loaded via JavaScript.');
        console.log('   Solution: Use Puppeteer to wait for content to load.');
      } else {
        console.log('   Likely cause: Cards in different HTML structure.');
        console.log('   Solution: Investigate deck-sample.html manually.');
      }
    }
    
    console.log('\n📝 Next steps:');
    console.log('   1. Open deck-sample.html in browser');
    console.log('   2. Search for card names in HTML');
    console.log('   3. Find the correct selector/regex');
    console.log('   4. Update parseDeck() function\n');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

investigate();

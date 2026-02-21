/**
 * test-html-parse.js
 * Teste rápido com HTML real do inkDecks
 */

'use strict';

const fs = require('fs');

// Sample HTML from real deck
const SAMPLE_HTML = `
<tr class="card-list-item" data-card-type="character" data-quantity="4">
    <td class="align-text-top">
        <div style="width:16px">
            <div style="position:relative;"><div style="position:absolute;left:0px;top:6px;font-size:7px;width:15.5px;text-align:center;color:#d3c5af;">1</div></div><img src="/img/symbols/lorcana/inkpot.svg" alt="1" loading="lazy" class="fluid-img">
        </div>
    </td>
    <td style="width:20px;" class="align-text-top text-center">
        <b>4&nbsp;</b>
    </td>
    <td>
        <a href="/cards/details-clarabelle-clumsy-guest">
            <b>Clarabelle -</b>
            Clumsy Guest
        </a>
    </td>
    <td>
        <div class="mx-1" style="width:12px;">
            <span><img src="/img/symbols/lorcana/emerald.svg" alt="emerald" loading="lazy" class="fluid-img"></span>
        </div>
    </td>
</tr>

<tr class="card-list-item" data-card-type="action" data-quantity="4">
    <td class="align-text-top">
        <div style="width:16px">
            <div style="position:relative;"><div style="position:absolute;left:0px;top:6px;font-size:7px;width:15.5px;text-align:center;color:#d3c5af;">1</div></div><img src="/img/symbols/lorcana/inkpot.svg" alt="1" loading="lazy" class="fluid-img">
        </div>
    </td>
    <td style="width:20px;" class="align-text-top text-center">
        <b>4&nbsp;</b>
    </td>
    <td>
        <a href="/cards/details-develop-your-brain">
            <b>Develop Your Brain</b>
        </a>
    </td>
    <td>
        <div class="mx-1" style="width:12px;">
            <span><img src="/img/symbols/lorcana/sapphire.svg" alt="sapphire" loading="lazy" class="fluid-img"></span>
        </div>
    </td>
</tr>

<tr class="card-list-item" data-card-type="character" data-quantity="4">
    <td class="align-text-top">
        <div style="width:16px">
            <div style="position:relative;"><div style="position:absolute;left:0px;top:6px;font-size:7px;width:15.5px;text-align:center;color:#d3c5af;">4</div></div><img src="/img/symbols/lorcana/ink-cost.svg" alt="4" loading="lazy" class="fluid-img">
        </div>
    </td>
    <td style="width:20px;" class="align-text-top text-center">
        <b>4&nbsp;</b>
    </td>
    <td>
        <a href="/cards/details-cinderella-dream-come-true">
            <b>Cinderella -</b>
            Dream Come True
        </a>
    </td>
    <td>
        <div class="mx-1" style="width:12px;">
            <span><img src="/img/symbols/lorcana/sapphire.svg" alt="sapphire" loading="lazy" class="fluid-img"></span>
        </div>
    </td>
</tr>
`;

function parseCards(html) {
  const cards = [];
  
  const cardRegex = /<tr[^>]*class="card-list-item"[^>]*data-card-type="([^"]+)"[^>]*data-quantity="(\d+)"[^>]*>([\s\S]*?)<\/tr>/gi;
  let cardMatch;
  
  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const cardType = cardMatch[1];
    const quantity = parseInt(cardMatch[2]);
    const rowHtml = cardMatch[3];
    
    // Extract cost
    let cost = null;
    const costMatch = rowHtml.match(/position:absolute[^>]*>(\d+)<\/div>/);
    if (costMatch) {
      cost = parseInt(costMatch[1]);
    }
    
    // Extract name
    let cardName = null;
    
    // Try with subtitle
    let nameMatch = rowHtml.match(/<a[^>]*href="\/cards\/details-[^"]*"[^>]*>[\s\S]*?<b>\s*([^<-]+)\s*-\s*<\/b>\s*([^<]+)/i);
    if (nameMatch) {
      const baseName = nameMatch[1].trim();
      const subtitle = nameMatch[2].trim();
      cardName = `${baseName} - ${subtitle}`;
    } else {
      // Try without subtitle
      nameMatch = rowHtml.match(/<a[^>]*href="\/cards\/details-[^"]*"[^>]*>[\s\S]*?<b>\s*([^<]+)\s*<\/b>/i);
      if (nameMatch) {
        cardName = nameMatch[1].trim();
      }
    }
    
    // Extract ink
    let ink = null;
    // Look for all SVGs, excluding inkpot and ink-cost
    const allInkMatches = rowHtml.match(/\/symbols\/lorcana\/([^.\/]+)\.svg/g);
    if (allInkMatches) {
      for (const match of allInkMatches) {
        const inkNameMatch = match.match(/\/symbols\/lorcana\/([^.\/]+)\.svg/);
        if (inkNameMatch) {
          const inkRaw = inkNameMatch[1].toLowerCase();
          // Skip inkpot and ink-cost, these are not colors
          if (inkRaw !== 'inkpot' && inkRaw !== 'ink-cost') {
            ink = inkRaw.charAt(0).toUpperCase() + inkRaw.slice(1);
            break; // Found the color, stop
          }
        }
      }
    }
    
    // Inkable?
    const inkable = rowHtml.includes('inkpot.svg');
    
    cards.push({
      name: cardName,
      quantity,
      cost,
      type: cardType,
      ink,
      inkable,
    });
  }
  
  return cards;
}

// Test
console.log('Testing HTML parsing...\n');
const cards = parseCards(SAMPLE_HTML);

console.log('Parsed cards:');
console.log(JSON.stringify(cards, null, 2));

console.log(`\n✅ Parsed ${cards.length} cards`);

// Verify
const expected = [
  { name: 'Clarabelle - Clumsy Guest', quantity: 4, cost: 1, type: 'character', ink: 'Emerald', inkable: true },
  { name: 'Develop Your Brain', quantity: 4, cost: 1, type: 'action', ink: 'Sapphire', inkable: true },
  { name: 'Cinderella - Dream Come True', quantity: 4, cost: 4, type: 'character', ink: 'Sapphire', inkable: false },
];

let allMatch = true;
for (let i = 0; i < expected.length; i++) {
  const exp = expected[i];
  const got = cards[i];
  
  if (JSON.stringify(exp) !== JSON.stringify(got)) {
    console.error(`\n❌ Mismatch at index ${i}:`);
    console.error('Expected:', exp);
    console.error('Got:', got);
    allMatch = false;
  }
}

if (allMatch) {
  console.log('\n✅ All tests passed!');
} else {
  console.log('\n❌ Some tests failed');
  process.exit(1);
}

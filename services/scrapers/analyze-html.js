/**
 * analyze-html.js
 * Analisa HTML salvo e mostra estrutura de links
 */

'use strict';

const fs = require('fs');

const htmlPath = process.argv[2] || './backend/data/tournaments-page1.html';

if (!fs.existsSync(htmlPath)) {
  console.error(`❌ File not found: ${htmlPath}`);
  console.error('Usage: node analyze-html.js [path-to-html]');
  process.exit(1);
}

console.log(`📄 Analyzing: ${htmlPath}\n`);

const html = fs.readFileSync(htmlPath, 'utf8');

// Extract ALL links
const allLinks = [];
const linkRegex = /href="([^"]+)"/gi;
let match;

while ((match = linkRegex.exec(html)) !== null) {
  allLinks.push(match[1]);
}

console.log(`📊 Total links found: ${allLinks.length}\n`);

// Filter tournament-related links
const tournamentLinks = allLinks.filter(link => 
  link.includes('/lorcana-tournaments/') || 
  link.includes('tournament')
);

console.log(`🎯 Tournament-related links: ${tournamentLinks.length}\n`);

// Categorize links
const categories = {
  navigation: [],
  categories: [],
  possibleTournaments: [],
  other: [],
};

for (const link of tournamentLinks) {
  // Skip external links
  if (link.startsWith('http') && !link.includes('inkdecks.com')) {
    continue;
  }
  
  // Remove domain if present
  const path = link.replace('https://inkdecks.com', '').replace('http://inkdecks.com', '');
  
  if (path.includes('?page=')) {
    categories.navigation.push(path);
  } else if (path === '/lorcana-tournaments' || 
             path === '/lorcana-tournaments/core' ||
             path === '/lorcana-tournaments/infinity' ||
             path === '/lorcana-tournaments/poorcana') {
    categories.categories.push(path);
  } else if (path.includes('/lorcana-tournaments/')) {
    // Check if it looks like a tournament (has ID or long name with dashes)
    const parts = path.split('/').filter(p => p);
    const lastPart = parts[parts.length - 1];
    
    if (lastPart.includes('-') && lastPart.length > 15) {
      categories.possibleTournaments.push(path);
    } else if (/\d{6}/.test(lastPart)) {
      categories.possibleTournaments.push(path);
    } else {
      categories.other.push(path);
    }
  } else {
    categories.other.push(path);
  }
}

// Display results
console.log('═══════════════════════════════════════════════════════════');
console.log('📋 NAVIGATION LINKS (pagination)');
console.log('═══════════════════════════════════════════════════════════');
console.log(`Count: ${categories.navigation.length}\n`);
categories.navigation.slice(0, 10).forEach((link, i) => {
  console.log(`${i + 1}. ${link}`);
});
if (categories.navigation.length > 10) {
  console.log(`... and ${categories.navigation.length - 10} more`);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('📁 CATEGORY LINKS');
console.log('═══════════════════════════════════════════════════════════');
console.log(`Count: ${categories.categories.length}\n`);
categories.categories.forEach((link, i) => {
  console.log(`${i + 1}. ${link}`);
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('🎯 POSSIBLE TOURNAMENT LINKS (what we want!)');
console.log('═══════════════════════════════════════════════════════════');
console.log(`Count: ${categories.possibleTournaments.length}\n`);
categories.possibleTournaments.slice(0, 20).forEach((link, i) => {
  console.log(`${i + 1}. ${link}`);
});
if (categories.possibleTournaments.length > 20) {
  console.log(`... and ${categories.possibleTournaments.length - 20} more`);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('❓ OTHER LINKS');
console.log('═══════════════════════════════════════════════════════════');
console.log(`Count: ${categories.other.length}\n`);
categories.other.slice(0, 10).forEach((link, i) => {
  console.log(`${i + 1}. ${link}`);
});
if (categories.other.length > 10) {
  console.log(`... and ${categories.other.length - 10} more`);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('📊 SUMMARY');
console.log('═══════════════════════════════════════════════════════════');
console.log(`Navigation:  ${categories.navigation.length}`);
console.log(`Categories:  ${categories.categories.length}`);
console.log(`Tournaments: ${categories.possibleTournaments.length} ✅`);
console.log(`Other:       ${categories.other.length}`);
console.log('');

// Suggest regex pattern
if (categories.possibleTournaments.length > 0) {
  console.log('💡 Suggested regex pattern:');
  
  // Analyze common patterns
  const withDecks = categories.possibleTournaments.filter(p => p.includes('tournament-decks'));
  const withNumbers = categories.possibleTournaments.filter(p => /\d{6}/.test(p));
  
  if (withDecks.length > 0) {
    console.log('   Pattern 1: /lorcana-tournaments/[name]-tournament-decks-[id]');
  }
  if (withNumbers.length > 0) {
    console.log('   Pattern 2: /lorcana-tournaments/[name]-[6digits]');
  }
  
  console.log('');
}

/**
 * SCRAPER MELHORADO: Captura dados precisos do InkDecks
 * 
 * Baseado no HTML real do InkDecks:
 * - Placement (1st, 2nd, etc)
 * - W-L Record (11-1-1)
 * - Inks (Emerald, Amber via SVG)
 * - Set usado (Set 11 - Winterspell)
 * - Format (Core)
 * - Archetype (A/E Aggro, Dogs Orchestra)
 * 
 * Arquivo: backend/services/inkdecks-scraper.js
 */

const puppeteer = require('puppeteer');

class InkdecksScraper {
  constructor() {
    this.baseUrl = 'https://inkdecks.com';
  }

  /**
   * Scrape tournament page e extrai TODOS os decks com dados precisos
   */
  async scrapeTournamentDecks(tournamentUrl) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
      console.log(`🔍 Scraping tournament: ${tournamentUrl}`);
      await page.goto(tournamentUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Extrai dados de cada deck na página
      const decks = await page.evaluate(() => {
        const deckElements = document.querySelectorAll('.row.align-items-center');
        const decks = [];

        deckElements.forEach((deckRow) => {
          try {
            // ═══════════════════════════════════════════════════════
            // 1. PLACEMENT (Colocação)
            // ═══════════════════════════════════════════════════════
            const placementText = deckRow.querySelector('.col-2.text-center strong')?.textContent?.trim();
            let placement = null;
            if (placementText) {
              // Converter "1st" → 1, "2nd" → 2, "11-1-1" → null (é record, não placement)
              const match = placementText.match(/^(\d+)(st|nd|rd|th)$/);
              if (match) {
                placement = parseInt(match[1]);
              }
            }

            // ═══════════════════════════════════════════════════════
            // 2. W-L RECORD (11-1-1 ou 11-1)
            // ═══════════════════════════════════════════════════════
            const recordText = deckRow.querySelector('.text-secondary.small')?.textContent?.trim();
            let wins = null, losses = null, draws = null;
            
            if (recordText && recordText.includes('-')) {
              const parts = recordText.split('-').map(x => parseInt(x.trim()));
              if (parts.length >= 2) {
                wins = parts[0] || 0;
                losses = parts[1] || 0;
                draws = parts[2] || 0;
              }
            }

            // ═══════════════════════════════════════════════════════
            // 3. INKS (Emerald, Amber via SVG)
            // ═══════════════════════════════════════════════════════
            const inkSvgs = deckRow.querySelectorAll('img[src*="/symbols/lorcana/"]');
            const inks = [];
            
            inkSvgs.forEach(img => {
              const src = img.getAttribute('src');
              const alt = img.getAttribute('alt');
              
              // Extrair nome da cor do src ou alt
              // /symbols/lorcana/emerald.svg → emerald
              const match = src.match(/\/([^/]+)\.svg$/);
              if (match) {
                const inkName = match[1];
                // Capitalizar primeira letra
                const capitalizedInk = inkName.charAt(0).toUpperCase() + inkName.slice(1);
                inks.push(capitalizedInk);
              } else if (alt) {
                inks.push(alt);
              }
            });

            // ═══════════════════════════════════════════════════════
            // 4. SET USADO (Set 11 - Winterspell)
            // ═══════════════════════════════════════════════════════
            const setElement = deckRow.querySelector('.bg-indigo-lt.text-indigo.badge');
            let setNumber = null;
            let setName = null;
            
            if (setElement) {
              const setText = setElement.textContent.trim();
              // "Set 11" → 11
              const match = setText.match(/Set\s+(\d+)/i);
              if (match) {
                setNumber = parseInt(match[1]);
                
                // Mapear número para nome
                const setNames = {
                  1: 'The First Chapter',
                  2: 'Rise of the Floodborn',
                  3: 'Into the Inklands',
                  4: 'Ursula\'s Return',
                  5: 'Shimmering Skies',
                  6: 'Azurite Sea',
                  7: 'Archazia\'s Island',
                  8: 'Fabled',
                  9: 'The Reign of Jafar',
                  10: 'Whispers in the Well',
                  11: 'Winterspell'
                };
                
                setName = setNames[setNumber] || `Set ${setNumber}`;
              }
            }

            // ═══════════════════════════════════════════════════════
            // 5. FORMAT (Core)
            // ═══════════════════════════════════════════════════════
            const formatElement = deckRow.querySelector('.badge.bg-theme-lt');
            let format = 'infinity'; // default
            
            if (formatElement) {
              const formatText = formatElement.textContent.trim().toLowerCase();
              if (formatText === 'core') {
                format = 'core';
              } else if (formatText === 'infinity') {
                format = 'infinity';
              }
            }

            // ═══════════════════════════════════════════════════════
            // 6. ARCHETYPE (A/E Aggro, Dogs Orchestra)
            // ═══════════════════════════════════════════════════════
            const archetypeElement = deckRow.querySelector('.text-muted.small');
            let archetype = null;
            
            if (archetypeElement) {
              archetype = archetypeElement.textContent.trim();
              // Limpar "by s4iler" se existir
              archetype = archetype.split('by')[0].trim();
            }

            // ═══════════════════════════════════════════════════════
            // 7. DECK NAME e URL
            // ═══════════════════════════════════════════════════════
            const deckLink = deckRow.querySelector('a[href*="/lorcana-metagame/deck-"]');
            let deckName = null;
            let deckUrl = null;
            
            if (deckLink) {
              deckName = deckLink.textContent.trim();
              deckUrl = deckLink.getAttribute('href');
              
              // Tornar URL absoluta
              if (deckUrl && !deckUrl.startsWith('http')) {
                deckUrl = 'https://inkdecks.com' + deckUrl;
              }
            }

            // ═══════════════════════════════════════════════════════
            // VALIDAÇÃO: Só adicionar se tiver dados mínimos
            // ═══════════════════════════════════════════════════════
            if (deckUrl && inks.length > 0) {
              decks.push({
                placement,
                wins,
                losses,
                draws,
                inks: inks.sort(), // Ordenar para consistência
                setNumber,
                setName,
                format,
                archetype,
                name: deckName || archetype || 'Unknown Deck',
                url: deckUrl
              });
            }
          } catch (err) {
            console.error('Error parsing deck:', err.message);
          }
        });

        return decks;
      });

      console.log(`✅ Scraped ${decks.length} decks from tournament`);
      
      await browser.close();
      return decks;

    } catch (error) {
      console.error(`❌ Error scraping tournament ${tournamentUrl}:`, error.message);
      await browser.close();
      return [];
    }
  }

  /**
   * Scrape lista de torneios e seus decks
   */
  async scrapeTournaments(limit = 10) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
      const tournamentsUrl = `${this.baseUrl}/lorcana-tournaments`;
      console.log(`🔍 Scraping tournaments from: ${tournamentsUrl}`);
      
      await page.goto(tournamentsUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Extrai URLs dos torneios
      const tournamentUrls = await page.evaluate((baseUrl, limit) => {
        const links = Array.from(document.querySelectorAll('a[href*="/lorcana-tournaments/"]'));
        return links
          .map(a => a.href)
          .filter(url => url.includes('-tournament-decks-'))
          .slice(0, limit);
      }, this.baseUrl, limit);

      console.log(`✅ Found ${tournamentUrls.length} tournaments`);

      await browser.close();

      // Scrape cada torneio
      const allDecks = [];
      for (const tournamentUrl of tournamentUrls) {
        const decks = await this.scrapeTournamentDecks(tournamentUrl);
        allDecks.push(...decks);
      }

      console.log(`✅ Total decks scraped: ${allDecks.length}`);
      return allDecks;

    } catch (error) {
      console.error(`❌ Error scraping tournaments:`, error.message);
      await browser.close();
      return [];
    }
  }
}

module.exports = InkdecksScraper;

// ═══════════════════════════════════════════════════════════════════
// EXEMPLO DE USO:
// ═══════════════════════════════════════════════════════════════════

/*
const scraper = new InkdecksScraper();

// Scrape 10 torneios mais recentes
const decks = await scraper.scrapeTournaments(10);

console.log(decks[0]);
// Output:
{
  placement: 1,
  wins: 11,
  losses: 1,
  draws: 1,
  inks: ['Amber', 'Emerald'],
  setNumber: 11,
  setName: 'Winterspell',
  format: 'core',
  archetype: 'A/E Aggro',
  name: 'Dogs Orchestra',
  url: 'https://inkdecks.com/lorcana-metagame/deck-dogs-orchestra-502320'
}
*/

'use strict';

/**
 * Unit tests for parser/metaComparator
 * Run with: npm test
 */

const {
  _internal: {
    similarityScore,
    parseFinish,
    computeAggregate,
    analysisToCounts,
    deckToCounts
  }
} = require('../parser/metaComparator.improved');

describe('metaComparator service', () => {
  describe('similarityScore', () => {
    test('returns 1.0 for identical decks', () => {
      const counts = new Map([
        ['card1', 4],
        ['card2', 2]
      ]);
      expect(similarityScore(counts, counts)).toBe(1);
    });

    test('returns 0 for completely different decks', () => {
      const countsA = new Map([['card1', 4]]);
      const countsB = new Map([['card2', 4]]);
      expect(similarityScore(countsA, countsB)).toBe(0);
    });

    test('returns 0 for empty deck A', () => {
      const countsA = new Map();
      const countsB = new Map([['card1', 4]]);
      expect(similarityScore(countsA, countsB)).toBe(0);
    });

    test('calculates partial overlap correctly', () => {
      const countsA = new Map([
        ['card1', 4],
        ['card2', 2]
      ]);
      const countsB = new Map([
        ['card1', 3],
        ['card2', 2]
      ]);
      const score = similarityScore(countsA, countsB);
      expect(score).toBeGreaterThan(0.7);
      expect(score).toBeLessThan(1.0);
    });

    test('accounts for quantity differences', () => {
      const countsA = new Map([['card1', 4]]);
      const countsB1 = new Map([['card1', 4]]);
      const countsB2 = new Map([['card1', 1]]);
      
      const score1 = similarityScore(countsA, countsB1);
      const score2 = similarityScore(countsA, countsB2);
      
      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe('parseFinish', () => {
    test('parses numeric finish directly', () => {
      expect(parseFinish({ finish: 5 })).toBe(5);
      expect(parseFinish({ placement: 10 })).toBe(10);
    });

    test('parses ordinal strings', () => {
      expect(parseFinish({ standing: '2nd' })).toBe(2);
      expect(parseFinish({ standing: '1st' })).toBe(1);
      expect(parseFinish({ standing: '3rd' })).toBe(3);
      expect(parseFinish({ standing: '4th' })).toBe(4);
    });

    test('parses "TOP N" format', () => {
      expect(parseFinish({ standing: 'TOP 32' })).toBe(32);
      expect(parseFinish({ standing: 'Top 8' })).toBe(8);
      expect(parseFinish({ standing: 'TOP64' })).toBe(64);
    });

    test('parses rank labels with #', () => {
      expect(parseFinish({ rankLabel: '#12' })).toBe(12);
    });

    test('returns null for invalid input', () => {
      expect(parseFinish({})).toBeNull();
      expect(parseFinish({ standing: 'Winner' })).toBeNull();
      expect(parseFinish({ standing: '' })).toBeNull();
    });

    test('prioritizes finish over other fields', () => {
      expect(parseFinish({
        finish: 1,
        placement: 2,
        standing: '3rd'
      })).toBe(1);
    });
  });

  describe('computeAggregate', () => {
    test('returns empty stats for empty deck list', () => {
      const result = computeAggregate([]);
      expect(result).toEqual({
        count: 0,
        bestFinish: null,
        avgFinish: null,
        top8Rate: null,
        byArchetype: {}
      });
    });

    test('computes stats for single deck', () => {
      const decks = [{
        archetype: 'Aggro',
        finish: 5
      }];
      const result = computeAggregate(decks);
      
      expect(result.count).toBe(1);
      expect(result.bestFinish).toBe(5);
      expect(result.avgFinish).toBe(5);
      expect(result.top8Rate).toBe(1);
      expect(result.byArchetype).toEqual({ Aggro: 1 });
    });

    test('computes stats for multiple decks', () => {
      const decks = [
        { archetype: 'Aggro', finish: 1 },
        { archetype: 'Aggro', finish: 5 },
        { archetype: 'Control', finish: 10 },
        { archetype: 'Midrange', finish: 32 }
      ];
      const result = computeAggregate(decks);
      
      expect(result.count).toBe(4);
      expect(result.bestFinish).toBe(1);
      expect(result.avgFinish).toBe(12); // (1+5+10+32)/4 = 12
      expect(result.top8Rate).toBe(0.5); // 2 out of 4
      expect(result.byArchetype).toEqual({
        Aggro: 2,
        Control: 1,
        Midrange: 1
      });
    });

    test('handles decks without finish', () => {
      const decks = [
        { archetype: 'Aggro' },
        { archetype: 'Control' }
      ];
      const result = computeAggregate(decks);
      
      expect(result.count).toBe(2);
      expect(result.bestFinish).toBeNull();
      expect(result.avgFinish).toBeNull();
      expect(result.top8Rate).toBeNull();
    });

    test('handles missing archetype', () => {
      const decks = [
        { finish: 5 }
      ];
      const result = computeAggregate(decks);
      
      expect(result.byArchetype).toEqual({ Unknown: 1 });
    });
  });

  describe('analysisToCounts', () => {
    test('converts analysis to count map', () => {
      const analysis = {
        cards: [
          { name: 'Card A', normalizedName: 'card a', quantity: 4 },
          { name: 'Card B', normalizedName: 'card b', quantity: 2 }
        ]
      };
      
      const counts = analysisToCounts(analysis);
      expect(counts.get('card a')).toBe(4);
      expect(counts.get('card b')).toBe(2);
    });

    test('handles missing normalizedName', () => {
      const analysis = {
        cards: [
          { name: 'Card A', quantity: 4 }
        ]
      };
      
      const counts = analysisToCounts(analysis);
      expect(counts.has('card a')).toBe(true);
    });

    test('aggregates duplicate cards', () => {
      const analysis = {
        cards: [
          { normalizedName: 'card a', quantity: 2 },
          { normalizedName: 'card a', quantity: 2 }
        ]
      };
      
      const counts = analysisToCounts(analysis);
      expect(counts.get('card a')).toBe(4);
    });

    test('handles empty or invalid analysis', () => {
      expect(analysisToCounts({}).size).toBe(0);
      expect(analysisToCounts({ cards: [] }).size).toBe(0);
      expect(analysisToCounts({ cards: null }).size).toBe(0);
    });
  });

  describe('deckToCounts', () => {
    test('converts deck to count map', () => {
      const deck = {
        cards: [
          { name: 'Card A', count: 4 },
          { name: 'Card B', quantity: 2 }
        ]
      };
      
      const counts = deckToCounts(deck);
      expect(counts.get('card a')).toBe(4);
      expect(counts.get('card b')).toBe(2);
    });

    test('handles different quantity field names', () => {
      const deck = {
        cards: [
          { name: 'Card A', count: 4 },
          { name: 'Card B', quantity: 2 },
          { name: 'Card C', qty: 3 }
        ]
      };
      
      const counts = deckToCounts(deck);
      expect(counts.get('card a')).toBe(4);
      expect(counts.get('card b')).toBe(2);
      expect(counts.get('card c')).toBe(3);
    });

    test('normalizes card names', () => {
      const deck = {
        cards: [
          { name: 'Basil - Detective', count: 4 }
        ]
      };
      
      const counts = deckToCounts(deck);
      expect(counts.has('basil detective')).toBe(true);
    });
  });
});

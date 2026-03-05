'use strict';

/**
 * Unit tests for utils/parsers module
 * Run with: npm test
 */

const {
  parseIntOr,
  parseNum,
  parseBool,
  safeText,
  normalizeCardName,
  escapeRegex,
  parseQuantityPrefix
} = require('../utils/parsers');

describe('parsers utilities', () => {
  describe('parseIntOr', () => {
    test('parses valid integer string', () => {
      expect(parseIntOr('42', 0)).toBe(42);
      expect(parseIntOr('100', 0)).toBe(100);
    });

    test('parses negative integers', () => {
      expect(parseIntOr('-5', 0)).toBe(-5);
    });

    test('returns fallback for invalid input', () => {
      expect(parseIntOr('invalid', 10)).toBe(10);
      expect(parseIntOr('', 10)).toBe(10);
      expect(parseIntOr(undefined, 10)).toBe(10);
      expect(parseIntOr(null, 10)).toBe(10);
    });

    test('returns null by default when no fallback provided', () => {
      expect(parseIntOr('invalid')).toBeNull();
    });

    test('parses numeric values', () => {
      expect(parseIntOr(42, 0)).toBe(42);
    });

    test('truncates floats', () => {
      expect(parseIntOr('3.14', 0)).toBe(3);
    });
  });

  describe('parseNum', () => {
    test('parses valid numbers', () => {
      expect(parseNum('3.14', 0)).toBe(3.14);
      expect(parseNum('42', 0)).toBe(42);
      expect(parseNum('-5.5', 0)).toBe(-5.5);
    });

    test('returns fallback for invalid input', () => {
      expect(parseNum('invalid', 1.5)).toBe(1.5);
      expect(parseNum('', 1.5)).toBe(1.5);
      expect(parseNum(undefined, 1.5)).toBe(1.5);
    });

    test('handles Infinity correctly', () => {
      expect(parseNum('Infinity', 0)).toBeCloseTo(Infinity);
    });
  });

  describe('parseBool', () => {
    test('recognizes truthy values', () => {
      expect(parseBool('true')).toBe(true);
      expect(parseBool('TRUE')).toBe(true);
      expect(parseBool('1')).toBe(true);
      expect(parseBool('yes')).toBe(true);
      expect(parseBool('YES')).toBe(true);
      expect(parseBool('y')).toBe(true);
      expect(parseBool('on')).toBe(true);
      expect(parseBool(true)).toBe(true);
    });

    test('recognizes falsy values', () => {
      expect(parseBool('false')).toBe(false);
      expect(parseBool('FALSE')).toBe(false);
      expect(parseBool('0')).toBe(false);
      expect(parseBool('no')).toBe(false);
      expect(parseBool('n')).toBe(false);
      expect(parseBool('off')).toBe(false);
      expect(parseBool(false)).toBe(false);
    });

    test('returns fallback for invalid input', () => {
      expect(parseBool('invalid', true)).toBe(true);
      expect(parseBool('invalid', false)).toBe(false);
      expect(parseBool(undefined, true)).toBe(true);
      expect(parseBool(null, false)).toBe(false);
    });

    test('defaults to false when no fallback provided', () => {
      expect(parseBool('invalid')).toBe(false);
    });
  });

  describe('safeText', () => {
    test('normalizes whitespace', () => {
      expect(safeText('  hello   world  ')).toBe('hello world');
      expect(safeText('hello\n\nworld')).toBe('hello world');
      expect(safeText('hello\t\tworld')).toBe('hello world');
    });

    test('handles empty input', () => {
      expect(safeText('')).toBe('');
      expect(safeText(null)).toBe('');
      expect(safeText(undefined)).toBe('');
    });

    test('converts non-string input', () => {
      expect(safeText(42)).toBe('42');
      expect(safeText(true)).toBe('true');
    });
  });

  describe('normalizeCardName', () => {
    test('converts to lowercase', () => {
      expect(normalizeCardName('Basil - Detective')).toBe('basil detective');
    });

    test('removes diacritics', () => {
      expect(normalizeCardName('José - García')).toBe('jose garcia');
    });

    test('replaces dashes with spaces', () => {
      expect(normalizeCardName('Basil - Practiced Detective')).toBe('basil practiced detective');
      expect(normalizeCardName('Raya — Headstrong')).toBe('raya headstrong');
    });

    test('removes punctuation', () => {
      expect(normalizeCardName("Belle's Book")).toBe('belles book');
      expect(normalizeCardName('Card (Special)')).toBe('card special');
    });

    test('collapses multiple spaces', () => {
      expect(normalizeCardName('Multiple    Spaces')).toBe('multiple spaces');
    });

    test('handles empty input', () => {
      expect(normalizeCardName('')).toBe('');
      expect(normalizeCardName(null)).toBe('');
    });

    test('complete example', () => {
      expect(normalizeCardName('Basil — Great Mouse Detective'))
        .toBe('basil great mouse detective');
    });
  });

  describe('escapeRegex', () => {
    test('escapes special regex characters', () => {
      expect(escapeRegex('hello (world)')).toBe('hello \\(world\\)');
      expect(escapeRegex('a.b*c+d?')).toBe('a\\.b\\*c\\+d\\?');
      expect(escapeRegex('[a-z]')).toBe('\\[a\\-z\\]');
    });

    test('handles strings without special characters', () => {
      expect(escapeRegex('hello world')).toBe('hello world');
    });

    test('escapes all special characters', () => {
      const special = '.*+?^${}()|[]\\';
      const escaped = escapeRegex(special);
      expect(() => new RegExp(escaped)).not.toThrow();
    });
  });

  describe('parseQuantityPrefix', () => {
    test('parses quantity with space', () => {
      expect(parseQuantityPrefix('4 Basil')).toEqual({
        quantity: 4,
        text: 'Basil'
      });
    });

    test('parses quantity with x', () => {
      expect(parseQuantityPrefix('2x Sword')).toEqual({
        quantity: 2,
        text: 'Sword'
      });
    });

    test('parses quantity with × (multiplication symbol)', () => {
      expect(parseQuantityPrefix('3× Card Name')).toEqual({
        quantity: 3,
        text: 'Card Name'
      });
    });

    test('handles multiple spaces', () => {
      expect(parseQuantityPrefix('4    Basil')).toEqual({
        quantity: 4,
        text: 'Basil'
      });
    });

    test('returns zero quantity for invalid input', () => {
      expect(parseQuantityPrefix('No quantity')).toEqual({
        quantity: 0,
        text: 'No quantity'
      });
      expect(parseQuantityPrefix('')).toEqual({
        quantity: 0,
        text: ''
      });
    });

    test('handles full card names', () => {
      expect(parseQuantityPrefix('4 Basil - Practiced Detective')).toEqual({
        quantity: 4,
        text: 'Basil - Practiced Detective'
      });
    });
  });
});

'use strict';

/**
 * Utility functions for parsing and type coercion
 * Centralizes parsing logic used across the application
 * @module utils/parsers
 */

/**
 * Safely parse a value to integer with fallback
 * @param {*} value - Value to parse
 * @param {number|null} [fallback=null] - Fallback value if parsing fails
 * @returns {number|null} Parsed integer or fallback
 * @example
 * parseIntOr('42', 0) // => 42
 * parseIntOr('invalid', 10) // => 10
 * parseIntOr(undefined) // => null
 */
function parseIntOr(value, fallback = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Safely parse a value to number with fallback
 * @param {*} value - Value to parse
 * @param {number|null} [fallback=null] - Fallback value if parsing fails
 * @returns {number|null} Parsed number or fallback
 * @example
 * parseNum('3.14', 0) // => 3.14
 * parseNum('invalid', 1.5) // => 1.5
 */
function parseNum(value, fallback = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  // Support Infinity / -Infinity string literals
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^[+-]?infinity$/i.test(s) || /^[+-]?inf$/i.test(s)) {
      return s.startsWith('-') ? -Infinity : Infinity;
    }
  }

  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
}

/**
 * Parse a value to boolean with fallback
 * Recognizes: true/false, 1/0, yes/no, y/n, on/off (case insensitive)
 * @param {*} value - Value to parse
 * @param {boolean} [fallback=false] - Fallback value if parsing fails
 * @returns {boolean} Parsed boolean or fallback
 * @example
 * parseBool('true') // => true
 * parseBool('1') // => true
 * parseBool('yes') // => true
 * parseBool('invalid', false) // => false
 */
function parseBool(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const str = String(value).trim().toLowerCase();
  
  const truthyValues = ['1', 'true', 'yes', 'y', 'on'];
  const falsyValues = ['0', 'false', 'no', 'n', 'off'];
  
  if (truthyValues.includes(str)) return true;
  if (falsyValues.includes(str)) return false;
  
  return fallback;
}

/**
 * Normalize text by removing extra whitespace and trimming
 * @param {*} text - Text to normalize
 * @returns {string} Normalized text
 * @example
 * safeText('  hello   world  ') // => 'hello world'
 */
function safeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

/**
 * Normalize card name for matching
 * - Converts to lowercase
 * - Removes accents/diacritics
 * - Replaces hyphens and em-dashes with spaces
 * - Removes punctuation
 * - Collapses multiple spaces
 * @param {string} name - Card name to normalize
 * @returns {string} Normalized name
 * @example
 * normalizeCardName('Basil - Practiced Detective') // => 'basil practiced detective'
 * normalizeCardName('Raya  —  Headstrong') // => 'raya headstrong'
 */
function normalizeCardName(name) {
  if (!name) return '';
  
  return String(name)
    .toLowerCase()
    .normalize('NFD') // Decompose accents
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[—–-]/g, ' ') // Replace dashes with space
    .replace(/[^\w\s]/g, '') // Remove punctuation except word chars and spaces
    .replace(/\s+/g, ' ') // Collapse spaces
    .trim();
}

/**
 * Escape special characters in a string for use in RegExp
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for RegExp
 * @example
 * escapeRegex('hello (world)') // => 'hello \\(world\\)'
 */
function escapeRegex(str) {
  // Escape regex metacharacters (including '-' which is special inside character classes)
  return String(str).replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}

/**
 * Parse a string that may contain a number at the beginning
 * Common pattern: "4 Card Name" or "4x Card Name"
 * @param {string} text - Text to parse
 * @returns {{quantity: number, text: string}} Parsed quantity and remaining text
 * @example
 * parseQuantityPrefix('4 Basil') // => { quantity: 4, text: 'Basil' }
 * parseQuantityPrefix('2x Sword') // => { quantity: 2, text: 'Sword' }
 */
function parseQuantityPrefix(text) {
  const match = String(text || '').trim().match(/^(\d+)\s*(?:x|×)?\s+(.+)$/i);
  if (match) {
    return {
      quantity: parseInt(match[1], 10),
      text: match[2].trim()
    };
  }
  return { quantity: 0, text: String(text || '').trim() };
}

module.exports = {
  parseIntOr,
  parseNum,
  parseBool,
  safeText,
  normalizeCardName,
  escapeRegex,
  parseQuantityPrefix
};

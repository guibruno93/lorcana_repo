'use strict';

/**
 * Input validation helpers
 * @module utils/validation
 */

const { ValidationError } = require('./errors');

/**
 * Require a non-empty string.
 * @param {*} value
 * @param {string} fieldName
 * @returns {string}
 */
function requireString(value, fieldName = 'value') {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }
  if (value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must not be empty`, fieldName);
  }
  return value;
}

/**
 * Require an integer (strict). Rejects decimals like "3.14".
 * @param {*} value
 * @param {string} fieldName
 * @param {{min?: number, max?: number}} options
 * @returns {number}
 */
function requireInteger(value, fieldName = 'value', options = {}) {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${fieldName} must be a valid integer`, fieldName);
  }

  let num;

  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    const s = value.trim();
    // Strict integer string (no decimals)
    if (!/^[+-]?\d+$/.test(s)) {
      throw new ValidationError(`${fieldName} must be a valid integer`, fieldName);
    }
    num = Number(s);
  } else {
    throw new ValidationError(`${fieldName} must be a valid integer`, fieldName);
  }

  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new ValidationError(`${fieldName} must be a valid integer`, fieldName);
  }

  if (options.min !== undefined && num < options.min) {
    throw new ValidationError(`${fieldName} must be at least ${options.min}`, fieldName);
  }

  if (options.max !== undefined && num > options.max) {
    throw new ValidationError(`${fieldName} must be at most ${options.max}`, fieldName);
  }

  return num;
}

/**
 * Require one of allowed enum values.
 * @param {*} value
 * @param {string[]} allowed
 * @param {string} fieldName
 * @returns {*}
 */
function requireEnum(value, allowed, fieldName = 'value') {
  if (!Array.isArray(allowed) || allowed.length === 0) {
    throw new ValidationError(`${fieldName} has invalid enum definition`, fieldName);
  }
  if (!allowed.includes(value)) {
    throw new ValidationError(`${fieldName} must be one of: ${allowed.join(', ')}`, fieldName);
  }
  return value;
}

/**
 * Require a URL (http/https).
 * @param {*} value
 * @param {string} fieldName
 * @returns {string}
 */
function requireUrl(value, fieldName = 'url') {
  requireString(value, fieldName);

  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error('Unsupported URL protocol');
    }
    return value;
  } catch (_) {
    throw new ValidationError(`${fieldName} must be a valid URL`, fieldName);
  }
}

/**
 * Lightweight object validator by schema.
 * @param {*} input
 * @param {Record<string, any>} schema
 * @returns {object}
 */
function validateObject(input, schema) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('input must be an object', 'input');
  }
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new ValidationError('schema must be an object', 'schema');
  }

  const out = {};

  for (const key of Object.keys(schema)) {
    const rules = schema[key] || {};
    const hasDefault = Object.prototype.hasOwnProperty.call(rules, 'default');

    let value = input[key];

    if (value === undefined) {
      if (hasDefault) value = rules.default;
      if (rules.required && value === undefined) {
        throw new ValidationError(`${key} is required`, key);
      }
    }

    if (value === undefined) continue;

    switch (rules.type) {
      case 'string': {
        const s = requireString(value, key);

        if (rules.minLength !== undefined && s.length < rules.minLength) {
          throw new ValidationError(`${key} must be at least ${rules.minLength} characters`, key);
        }
        if (rules.maxLength !== undefined && s.length > rules.maxLength) {
          throw new ValidationError(`${key} must be at most ${rules.maxLength} characters`, key);
        }
        if (rules.pattern instanceof RegExp && !rules.pattern.test(s)) {
          throw new ValidationError(`${key} has invalid format`, key);
        }
        if (Array.isArray(rules.enum) && rules.enum.length > 0 && !rules.enum.includes(s)) {
          throw new ValidationError(`${key} must be one of: ${rules.enum.join(', ')}`, key);
        }

        out[key] = s;
        break;
      }

      case 'integer': {
        out[key] = requireInteger(value, key, { min: rules.min, max: rules.max });
        break;
      }

      case 'number': {
        const n = Number(value);
        if (Number.isNaN(n) || !Number.isFinite(n)) {
          throw new ValidationError(`${key} must be a valid number`, key);
        }
        out[key] = n;
        break;
      }

      case 'boolean': {
        if (typeof value !== 'boolean') {
          throw new ValidationError(`${key} must be a boolean`, key);
        }
        out[key] = value;
        break;
      }

      case 'array': {
        if (!Array.isArray(value)) {
          throw new ValidationError(`${key} must be an array`, key);
        }
        out[key] = value;
        break;
      }

      case 'object': {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
          throw new ValidationError(`${key} must be an object`, key);
        }
        out[key] = value;
        break;
      }

      default: {
        out[key] = value;
        break;
      }
    }
  }

  return out;
}

module.exports = {
  ValidationError,
  requireString,
  requireInteger,
  requireEnum,
  requireUrl,
  validateObject
};

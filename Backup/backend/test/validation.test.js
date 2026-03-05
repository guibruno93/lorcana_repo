'use strict';

/**
 * Unit tests for utils/validation module
 * Run with: npm test
 */

const {
  ValidationError,
  requireString,
  requireInteger,
  requireEnum,
  requireUrl,
  validateObject
} = require('../utils/validation');

describe('validation utilities', () => {
  describe('ValidationError', () => {
    test('creates error with message', () => {
      const error = new ValidationError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ValidationError');
    });

    test('stores field name', () => {
      const error = new ValidationError('Test error', 'username');
      expect(error.field).toBe('username');
    });
  });

  describe('requireString', () => {
    test('accepts valid non-empty string', () => {
      expect(requireString('hello')).toBe('hello');
      expect(requireString('hello world')).toBe('hello world');
    });

    test('throws on empty string', () => {
      expect(() => requireString('')).toThrow(ValidationError);
      expect(() => requireString('   ')).toThrow(ValidationError);
    });

    test('throws on non-string', () => {
      expect(() => requireString(42)).toThrow(ValidationError);
      expect(() => requireString(null)).toThrow(ValidationError);
      expect(() => requireString(undefined)).toThrow(ValidationError);
    });

    test('includes field name in error', () => {
      expect(() => requireString('', 'username')).toThrow(/username/);
    });
  });

  describe('requireInteger', () => {
    test('accepts valid integers', () => {
      expect(requireInteger('42')).toBe(42);
      expect(requireInteger(42)).toBe(42);
      expect(requireInteger('-5')).toBe(-5);
    });

    test('throws on invalid input', () => {
      expect(() => requireInteger('invalid')).toThrow(ValidationError);
      expect(() => requireInteger('3.14')).toThrow(ValidationError);
    });

    test('validates minimum value', () => {
      expect(requireInteger(5, 'age', { min: 0 })).toBe(5);
      expect(() => requireInteger(-1, 'age', { min: 0 })).toThrow(/at least 0/);
    });

    test('validates maximum value', () => {
      expect(requireInteger(10, 'score', { max: 100 })).toBe(10);
      expect(() => requireInteger(150, 'score', { max: 100 })).toThrow(/at most 100/);
    });

    test('validates min and max together', () => {
      expect(requireInteger(50, 'value', { min: 0, max: 100 })).toBe(50);
      expect(() => requireInteger(-10, 'value', { min: 0, max: 100 })).toThrow();
      expect(() => requireInteger(150, 'value', { min: 0, max: 100 })).toThrow();
    });
  });

  describe('requireEnum', () => {
    test('accepts valid enum values', () => {
      const colors = ['red', 'green', 'blue'];
      expect(requireEnum('red', colors)).toBe('red');
      expect(requireEnum('blue', colors)).toBe('blue');
    });

    test('throws on invalid enum value', () => {
      const colors = ['red', 'green', 'blue'];
      expect(() => requireEnum('yellow', colors)).toThrow(ValidationError);
      expect(() => requireEnum('yellow', colors)).toThrow(/red, green, blue/);
    });

    test('includes field name in error', () => {
      const colors = ['red', 'green', 'blue'];
      expect(() => requireEnum('yellow', colors, 'color')).toThrow(/color/);
    });
  });

  describe('requireUrl', () => {
    test('accepts valid URLs', () => {
      expect(requireUrl('https://example.com')).toBe('https://example.com');
      expect(requireUrl('http://localhost:3000')).toBe('http://localhost:3000');
    });

    test('throws on invalid URLs', () => {
      expect(() => requireUrl('not a url')).toThrow(ValidationError);
      expect(() => requireUrl('ftp://invalid')).toThrow(ValidationError);
      expect(() => requireUrl('')).toThrow(ValidationError);
    });

    test('throws on non-string input', () => {
      expect(() => requireUrl(123)).toThrow(ValidationError);
    });
  });

  describe('validateObject', () => {
    test('validates simple object', () => {
      const schema = {
        name: { type: 'string', required: true },
        age: { type: 'integer' }
      };
      
      const result = validateObject({ name: 'John', age: 30 }, schema);
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    test('throws on missing required field', () => {
      const schema = {
        name: { type: 'string', required: true }
      };
      
      expect(() => validateObject({}, schema)).toThrow(/name is required/);
    });

    test('applies default values', () => {
      const schema = {
        name: { type: 'string', default: 'Anonymous' }
      };
      
      const result = validateObject({}, schema);
      expect(result.name).toBe('Anonymous');
    });

    test('validates string with minLength', () => {
      const schema = {
        password: { type: 'string', minLength: 8 }
      };
      
      expect(() => validateObject({ password: 'short' }, schema))
        .toThrow(/at least 8 characters/);
      
      expect(validateObject({ password: 'longenough' }, schema).password)
        .toBe('longenough');
    });

    test('validates string with maxLength', () => {
      const schema = {
        username: { type: 'string', maxLength: 20 }
      };
      
      expect(() => validateObject({ username: 'a'.repeat(25) }, schema))
        .toThrow(/at most 20 characters/);
    });

    test('validates string with pattern', () => {
      const schema = {
        email: { type: 'string', pattern: /@/ }
      };
      
      expect(() => validateObject({ email: 'notanemail' }, schema))
        .toThrow(/invalid format/);
      
      expect(validateObject({ email: 'test@example.com' }, schema).email)
        .toBe('test@example.com');
    });

    test('validates integer type', () => {
      const schema = {
        age: { type: 'integer', min: 0, max: 120 }
      };
      
      expect(validateObject({ age: 30 }, schema).age).toBe(30);
      expect(() => validateObject({ age: -5 }, schema)).toThrow();
      expect(() => validateObject({ age: 150 }, schema)).toThrow();
    });

    test('validates number type', () => {
      const schema = {
        price: { type: 'number' }
      };
      
      expect(validateObject({ price: 19.99 }, schema).price).toBe(19.99);
      expect(() => validateObject({ price: 'invalid' }, schema)).toThrow();
    });

    test('validates boolean type', () => {
      const schema = {
        active: { type: 'boolean' }
      };
      
      expect(validateObject({ active: true }, schema).active).toBe(true);
      expect(validateObject({ active: false }, schema).active).toBe(false);
      expect(() => validateObject({ active: 'yes' }, schema)).toThrow();
    });

    test('validates array type', () => {
      const schema = {
        tags: { type: 'array' }
      };
      
      expect(validateObject({ tags: ['a', 'b'] }, schema).tags).toEqual(['a', 'b']);
      expect(() => validateObject({ tags: 'not array' }, schema)).toThrow();
    });

    test('validates object type', () => {
      const schema = {
        meta: { type: 'object' }
      };
      
      expect(validateObject({ meta: { key: 'value' } }, schema).meta)
        .toEqual({ key: 'value' });
      expect(() => validateObject({ meta: [] }, schema)).toThrow();
      expect(() => validateObject({ meta: 'string' }, schema)).toThrow();
    });

    test('validates enum constraint', () => {
      const schema = {
        status: { type: 'string', enum: ['active', 'inactive', 'pending'] }
      };
      
      expect(validateObject({ status: 'active' }, schema).status).toBe('active');
      expect(() => validateObject({ status: 'invalid' }, schema))
        .toThrow(/active, inactive, pending/);
    });

    test('throws on non-object input', () => {
      const schema = { name: { type: 'string' } };
      expect(() => validateObject(null, schema)).toThrow(/must be an object/);
      expect(() => validateObject('string', schema)).toThrow(/must be an object/);
    });

    test('handles complex nested validation', () => {
      const schema = {
        username: { type: 'string', required: true, minLength: 3, maxLength: 20 },
        email: { type: 'string', required: true, pattern: /@/ },
        age: { type: 'integer', min: 13, max: 120 },
        role: { type: 'string', enum: ['user', 'admin'], default: 'user' },
        active: { type: 'boolean', default: true }
      };
      
      const validData = {
        username: 'johndoe',
        email: 'john@example.com',
        age: 30
      };
      
      const result = validateObject(validData, schema);
      expect(result.username).toBe('johndoe');
      expect(result.email).toBe('john@example.com');
      expect(result.age).toBe(30);
      expect(result.role).toBe('user'); // default
      expect(result.active).toBe(true); // default
    });
  });
});

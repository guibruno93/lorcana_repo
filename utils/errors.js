'use strict';

/**
 * Shared error types used across backend.
 * @module utils/errors
 */

class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=500]
   * @param {any} [details=null]
   */
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

class ValidationError extends AppError {
  /**
   * @param {string} message
   * @param {string|null} [field=null]
   */
  constructor(message, field = null) {
    super(message, 400, field ? { field } : null);
    this.field = field;
  }
}

class ParsingError extends AppError {
  /**
   * @param {string} message
   * @param {any} [details=null]
   */
  constructor(message = 'Parsing error', details = null) {
    super(message, 422, details);
  }
}

class ScrapingBlockedError extends AppError {
  /**
   * @param {string} url
   * @param {string} [reason='blocked']
   * @param {any} [details=null]
   */
  constructor(url, reason = 'blocked', details = null) {
    super(`Scraping blocked for ${url}: ${reason}`, 403, details || { url, reason });
    this.url = url;
    this.reason = reason;
  }
}

module.exports = {
  AppError,
  ValidationError,
  ParsingError,
  ScrapingBlockedError
};

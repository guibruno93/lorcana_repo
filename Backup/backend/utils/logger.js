'use strict';

/**
 * Structured logger with levels and formatting
 * Provides consistent logging across the application
 * @module utils/logger
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const COLORS = {
  ERROR: '\x1b[31m', // Red
  WARN: '\x1b[33m',  // Yellow
  INFO: '\x1b[36m',  // Cyan
  DEBUG: '\x1b[90m', // Gray
  RESET: '\x1b[0m'
};

const EMOJIS = {
  ERROR: '❌',
  WARN: '⚠️',
  INFO: 'ℹ️',
  DEBUG: '🔍'
};

class Logger {
  /**
   * Create a logger instance
   * @param {Object} [options] - Logger configuration
   * @param {string} [options.level='INFO'] - Minimum log level (ERROR, WARN, INFO, DEBUG)
   * @param {boolean} [options.colors=true] - Enable colored output
   * @param {boolean} [options.emojis=true] - Enable emoji prefixes
   * @param {boolean} [options.timestamps=true] - Include timestamps
   */
  constructor(options = {}) {
    this.level = LOG_LEVELS[options.level?.toUpperCase()] ?? LOG_LEVELS.INFO;
    this.useColors = options.colors !== false;
    this.useEmojis = options.emojis !== false;
    this.useTimestamps = options.timestamps !== false;
  }

  /**
   * Format a log message
   * @private
   */
  _format(level, message, meta = {}) {
    const parts = [];
    
    // Timestamp
    if (this.useTimestamps) {
      parts.push(`[${new Date().toISOString()}]`);
    }
    
    // Level with emoji
    const emoji = this.useEmojis ? `${EMOJIS[level]} ` : '';
    const color = this.useColors ? COLORS[level] : '';
    const reset = this.useColors ? COLORS.RESET : '';
    parts.push(`${color}${emoji}${level}${reset}`);
    
    // Message
    parts.push(message);
    
    // Metadata
    if (Object.keys(meta).length > 0) {
      parts.push(JSON.stringify(meta, null, 2));
    }
    
    return parts.join(' ');
  }

  /**
   * Check if a level should be logged
   * @private
   */
  _shouldLog(level) {
    return LOG_LEVELS[level] <= this.level;
  }

  /**
   * Log an error message
   * @param {string} message - Error message
   * @param {Object|Error} [meta] - Additional metadata or Error object
   */
  error(message, meta = {}) {
    if (!this._shouldLog('ERROR')) return;
    
    // Handle Error objects
    if (meta instanceof Error) {
      meta = {
        name: meta.name,
        message: meta.message,
        stack: meta.stack
      };
    }
    
    console.error(this._format('ERROR', message, meta));
  }

  /**
   * Log a warning message
   * @param {string} message - Warning message
   * @param {Object} [meta] - Additional metadata
   */
  warn(message, meta = {}) {
    if (!this._shouldLog('WARN')) return;
    console.warn(this._format('WARN', message, meta));
  }

  /**
   * Log an info message
   * @param {string} message - Info message
   * @param {Object} [meta] - Additional metadata
   */
  info(message, meta = {}) {
    if (!this._shouldLog('INFO')) return;
    console.log(this._format('INFO', message, meta));
  }

  /**
   * Log a debug message
   * @param {string} message - Debug message
   * @param {Object} [meta] - Additional metadata
   */
  debug(message, meta = {}) {
    if (!this._shouldLog('DEBUG')) return;
    console.log(this._format('DEBUG', message, meta));
  }

  /**
   * Create a child logger with a context prefix
   * @param {string} context - Context name (e.g., 'scraper', 'parser')
   * @returns {Logger} New logger instance with context
   */
  child(context) {
    const childLogger = new Logger({
      level: Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === this.level),
      colors: this.useColors,
      emojis: this.useEmojis,
      timestamps: this.useTimestamps
    });
    
    // Override format to include context
    const originalFormat = childLogger._format.bind(childLogger);
    childLogger._format = (level, message, meta) => {
      return originalFormat(level, `[${context}] ${message}`, meta);
    };
    
    return childLogger;
  }
}

// Create default logger instance
const defaultLogger = new Logger({
  level: process.env.LOG_LEVEL || 'INFO',
  colors: process.env.LOG_COLORS !== 'false',
  emojis: process.env.LOG_EMOJIS !== 'false',
  timestamps: process.env.LOG_TIMESTAMPS !== 'false'
});

module.exports = defaultLogger;
module.exports.Logger = Logger;
module.exports.LOG_LEVELS = LOG_LEVELS;

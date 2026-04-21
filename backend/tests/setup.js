const path = require('path');

process.env.NODE_ENV = 'test';

require('dotenv').config({ path: path.join(__dirname, '..', '.env.test') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

global.testUser = {
  id: 'test-user-id',
  email: 'test@inkwelllabs.com',
  username: 'testuser',
};

if (process.env.SILENT_TESTS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

jest.setTimeout(parseInt(process.env.JEST_TIMEOUT_MS || '60000', 10));

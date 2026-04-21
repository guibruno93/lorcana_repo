module.exports = {
  testEnvironment: 'node',
  forceExit: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'routes/**/*.js',
    'services/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/*-OLD.js',
    '!**/*.test.js',
    '!routes/bckp/**',
    '!services/_backup/**',
  ],
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/jest-env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 60000,
};

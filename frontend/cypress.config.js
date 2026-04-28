const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3001',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    setupNodeEvents() {},
    env: {
      apiUrl: 'http://localhost:3002/api',
      testUser: {
        email: 'cypress@inkwelllabs.com',
        password: 'Cypress@12345',
        username: 'cypresstest',
      },
    },
  },
});

/**
 * Puppeteer runtime configuration
 * Sets executable path for Puppeteer
 */
module.exports = {
  // Use system Chromium if available (Render deployment)
  // Falls back to downloaded Chromium (local development)
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
};

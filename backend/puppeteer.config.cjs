/**
 * Puppeteer configuration
 * Controls Chromium download behavior
 */
const skipDownload = process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD === 'true';

if (skipDownload) {
  console.log('ℹ️ Puppeteer: Skipping Chromium download (using system Chromium)');
}

module.exports = {
  skipDownload: skipDownload,
};

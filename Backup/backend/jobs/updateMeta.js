// backend/jobs/updateMeta.js
const { updateTournamentMeta } = require("../scraper/meleeScraper");

(async () => {
  try {
    await updateTournamentMeta();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

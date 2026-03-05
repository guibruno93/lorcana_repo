const { getDeckUrls } = require("./inkdecksIndexScraper");

(async () => {
  try {
    const urls = await getDeckUrls("core");

    console.log("✅ URLs encontradas:");
    urls.slice(0, 10).forEach(u => console.log(" -", u));

    console.log(`📊 Total: ${urls.length}`);
  } catch (err) {
    console.error("💥 Erro no teste:", err);
  }
})();

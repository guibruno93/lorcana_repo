"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const crypto_1 = __importDefault(require("crypto"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const deckAnalyzer_1 = require("./services/deckAnalyzer");
const app = (0, express_1.default)();
const PORT = 3000;
// Middlewares
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Rate limit
const limiter = (0, express_rate_limit_1.default)({ windowMs: 60000, max: 10, message: { error: "Muitas requisições" } });
app.use("/analyzeDeck", limiter);
const CACHE_DURATION = 10 * 60 * 1000; // 10min
const deckCache = new Map();
function hashDeck(deck) { return crypto_1.default.createHash("md5").update(JSON.stringify(deck)).digest("hex"); }
setInterval(() => { const now = Date.now(); deckCache.forEach((v, k) => { if (v.expiresAt < now)
    deckCache.delete(k); }); }, 5 * 60 * 1000);
// Endpoint
app.post("/analyzeDeck", async (req, res) => {
    const deck = req.body.deck;
    if (!deck || !Array.isArray(deck) || deck.length === 0)
        return res.status(400).json({ error: "Deck inválido" });
    if (deck.length > 60)
        return res.status(400).json({ error: "Deck muito grande" });
    const deckHash = hashDeck(deck);
    const cached = deckCache.get(deckHash);
    if (cached && cached.expiresAt > Date.now())
        return res.json(cached.data);
    try {
        const analysis = await (0, deckAnalyzer_1.analyzeDeck)(deck);
        deckCache.set(deckHash, { data: analysis, expiresAt: Date.now() + CACHE_DURATION });
        return res.json(analysis);
    }
    catch (err) {
        return res.status(500).json({ error: err.message || "Erro ao analisar deck" });
    }
});
app.listen(PORT, () => console.log(`Backend rodando em http://localhost:${PORT}`));

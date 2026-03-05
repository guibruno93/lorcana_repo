# Lorcana Analyzer

Backend parseia decklist (texto), normaliza, enriquece com `backend/db/cards.json`, gera estatísticas e (opcionalmente) compara com meta e recomendações via IA. Resposta JSON estável.

## Como rodar

### Backend

```bash
cd backend
npm install
npm start
```

Servidor: `http://localhost:5000`. Entrada principal: `server.js` (POST `/api/analyzeDeck`).

### Frontend

```bash
cd frontend
npm install
npm start
```

Consome a API do backend (configurar `API_BASE` se necessário).

## Endpoint principal

**POST** `/api/analyzeDeck`

- **Query:** `compare=0|1` (padrão 0), `ai=0|1` (padrão 0), `top`, `sameFormat`.
- **Body:** `{ "decklist": "4 Nome Carta\n2 Outra" }` ou `{ "text": "..." }`.

Exemplo com curl (PowerShell):

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/analyzeDeck?compare=0&ai=0" -Method Post -ContentType "application/json" -Body '{"decklist":"4 Ariel - On Human Legs\n2 Mickey Mouse"}'
```

Resposta (sucesso): objeto com `totalCards`, `cards`, `unknownCards`, `curveCounts`, `inks`, `metaComparison`, etc.  
Em erro: sempre JSON, ex.: `{ "error": "mensagem", "details": "..." }`.

## Dados e scripts

- **cards.json:** `backend/db/cards.json` (fonte canônica). Scripts em `backend/scripts/`: `mergeSets.js`, `syncCards.js`, `enrichCardsDbFromSetData.js`, etc.
- **Variáveis de ambiente (opcional):** `PORT`, `CARDS_DB_PATH`, `TOURNAMENT_META_PATH`. Para IA: ver `backend/routes/ai.js` (ex.: `OPENAI_API_KEY`).

## Inventário e fluxo

Ver [INVENTORY.md](./INVENTORY.md) para estrutura de pastas, diagrama de fluxo e convenções (parser canônico: `backend/services/deckParser.js`).

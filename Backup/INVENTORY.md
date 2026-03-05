Patch: Sprint 2 (core-only)

Arquivos incluídos / sobrescritos:

Backend:
- backend/server.js
- backend/services/deckParser.js            (parser real)
- backend/parser/deckParser.js              (wrapper -> services/deckParser)
- backend/parser/analyzeDeck.js
- backend/parser/metaComparator.js
- backend/services/cardIndex.js             (index singleton para AI)
- backend/routes/ai.js                      (ping + resolve-names)

Frontend:
- frontend/src/App.js
- frontend/src/api.js
- frontend/src/MetaComparison.jsx
- frontend/src/styles.css

Requisitos:
- backend/db/cards.json
- backend/db/tournamentMeta.json  (ou defina TOURNAMENT_META_PATH)

# INKWELL LABS - PROJECT MEMORY

## 🎯 WHAT WE'VE BUILT
- Full i18n (PT-BR/EN)
- 8 Archetypes in meta_analysis
- Card Database (2319 cards)
- Deck Builder
- Auth system (JWT)
- Meta Dashboard
- Backend deployed: https://lorcana-backend.onrender.com
- Frontend deployed: Vercel

## 🔴 CURRENT ISSUES
1. App.jsx has code duplication (lines 189-429)
   - File should be 188 lines
   - Need to remove duplicate code
   
2. Meta scraper returns 0 decks
   - Selectors need to be updated
   - Inkdecks.com structure needs inspection

## 📝 NEXT TASKS
1. Fix App.jsx duplication
2. Update scraper selectors
3. Test scraping with real data
4. Implement Deck vs Meta analyzer
5. Deploy all changes

## 🗂️ KEY FILES
- backend/routes/meta-analysis.js - Meta endpoints
- backend/services/meta-scraper.js - Puppeteer scraper
- frontend/src/pages/MetaDashboard.jsx - Meta UI
- frontend/src/DeckAnalyzer.jsx - Main analyzer
- frontend/src/App.jsx - Router (HAS BUG!)

## 🎨 DESIGN PATTERNS
[Copiar da .cursorrules]

## 📊 DATABASE SCHEMA
[Copiar do prompt master]
```

---

## ✅ CHECKLIST DE MIGRAÇÃO
```
PRÉ-MIGRAÇÃO:
[ ] Commit atual do Git (backup!)
[ ] Anotar ambiente funcionando (node version, etc)
[ ] Salvar .env files

MIGRAÇÃO:
[ ] Instalar Cursor
[ ] Abrir projeto
[ ] Criar .cursorrules
[ ] Criar memory.md
[ ] Testar chat com @mention
[ ] Testar Composer mode

PÓS-MIGRAÇÃO:
[ ] Corrigir App.jsx
[ ] npm start funciona?
[ ] Backend responde?
[ ] Commit: "chore: setup Cursor workspace"

VALIDAÇÃO:
[ ] Todas features funcionando?
[ ] Hot reload OK?
[ ] Git integrado?
[ ] Terminal funcionando?
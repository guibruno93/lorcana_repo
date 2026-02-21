# 🚀 FASE 1: FOUNDATION - Guia de Implementação

## 📦 O QUE FOI CRIADO

**11 arquivos novos** para transformar o Lorcana AI em plataforma premium:

### **Core Services (5 arquivos)**
1. `cardUpdater.js` - Auto-update de cards (Dreamborn + Lorcania)
2. `tournamentAggregator.js` - Multi-source tournament fetcher
3. `metaAnalyzer.js` - ML meta trends detection
4. `scheduler.js` - Cron jobs automáticos
5. `package.json` - Dependências atualizadas

### **CLI Scripts (3 arquivos)**
6. `update-cards.js` - Executar update manual
7. `sync-tournaments.js` - Sincronizar torneios
8. `analyze-meta.js` - Analisar meta state

### **Documentação (3 arquivos)**
9. `VIABILIDADE-ROADMAP.md` - Análise completa de viabilidade
10. `IMPLEMENTACAO-FASE1.md` - Este guia
11. `README-v4.md` - Documentação geral

---

## 📂 ESTRUTURA DE PASTAS

```
lorcana_ai/
├── backend/
│   ├── services/
│   │   ├── cards/
│   │   │   └── cardUpdater.js          ← NOVO
│   │   │
│   │   ├── tournaments/
│   │   │   ├── tournamentAggregator.js ← NOVO
│   │   │   └── metaAnalyzer.js         ← NOVO
│   │   │
│   │   └── ai/ (existente)
│   │       ├── mulliganAdvisor.js
│   │       ├── matchupAnalyzer.js
│   │       └── strategyAnalyzer.js
│   │
│   ├── db/
│   │   ├── cards.json                  ← Auto-updated
│   │   ├── tournamentMeta.json         ← Auto-updated
│   │   ├── sets.json                   ← Auto-generated
│   │   ├── updateLog.json              ← Auto-generated
│   │   └── sourcesLog.json             ← Auto-generated
│   │
│   ├── scripts/
│   │   ├── scheduler.js                ← NOVO
│   │   ├── update-cards.js             ← NOVO
│   │   ├── sync-tournaments.js         ← NOVO
│   │   └── analyze-meta.js             ← NOVO
│   │
│   ├── package.json                    ← ATUALIZADO
│   └── server.js
│
└── frontend/
    └── (v3 existente)
```

---

## ⚡ INSTALAÇÃO RÁPIDA

### **PASSO 1: Criar estrutura**

```powershell
cd S:\INKREC\lorcana_ai\backend

# Criar pastas
mkdir services\cards
mkdir services\tournaments
mkdir scripts
mkdir db
```

### **PASSO 2: Copiar arquivos**

```powershell
# Core services
copy cardUpdater.js services\cards\cardUpdater.js
copy tournamentAggregator.js services\tournaments\tournamentAggregator.js
copy metaAnalyzer.js services\tournaments\metaAnalyzer.js

# Scripts
copy scheduler.js scripts\scheduler.js
copy cli-scripts.js scripts\cli-scripts-template.js

# Package.json
copy /Y package.json package.json
```

### **PASSO 3: Instalar dependências**

```powershell
npm install
# Instala: node-cron, pdfkit, sharp
```

### **PASSO 4: Executar primeiro update**

```powershell
# Update de cards (demora ~30s)
node scripts/update-cards.js

# Sincronizar torneios (demora ~2-3 min)
node scripts/sync-tournaments.js

# Analisar meta
node scripts/analyze-meta.js
```

---

## 🧪 TESTANDO AS FEATURES

### **1. Auto-Update de Cards**

```powershell
cd backend

# Update manual (força)
node scripts/update-cards.js --force

# Output esperado:
# 🎴 Card Auto-Updater v4.0
# 📦 Local database: 0 cards
# 
# 🔄 Fetching from dreamborn...
#   Fetched 500 cards
#   500 new, 0 updated from dreamborn
# 
# 🔄 Fetching from lorcania.com...
#   Fetched 500 cards
#   50 new, 450 updated from lorcania.com
# 
# ✅ Saved 550 cards to db/cards.json
# ✅ Update complete!
#    Total cards: 550 (+550)
#    Sets: 10
#    Duration: 32s
```

**Verificar:**
```powershell
dir db\cards.json
# Deve existir e ter ~800KB+

type db\sets.json
# Deve listar todos os sets (TFC, ROTF, ITI, etc.)
```

### **2. Tournament Aggregator**

```powershell
# Sincronizar torneios
node scripts/sync-tournaments.js

# Output esperado:
# 🏆 Tournament Aggregator v4.0
# 
# 🔄 Fetching from Melee.gg...
#   Found 100 tournaments
#   ✅ Disney Lorcana Challenge Hong Kong: 32 decks
#   ✅ Store Championship São Paulo: 28 decks
#   ...
#   melee.gg: 180 decks
# 
# 🔄 Fetching from Lorcania.com...
#   Found 50 tournaments
#   ✅ Community Tournament: 16 decks
#   ...
#   lorcania.com: 45 decks
# 
# ✅ Saved 665 decks to db/tournamentMeta.json
# ✅ Aggregation complete!
#    Fetched: 225 decks
#    Total in DB: 665 decks (440 local + 225 new)
#    Duration: 142s
```

**Verificar:**
```powershell
dir db\tournamentMeta.json
# Deve ter ~600KB+

type db\sourcesLog.json
# Histórico de sincronizações
```

### **3. Meta Analyzer**

```powershell
# Analisar estado do meta
node scripts/analyze-meta.js

# Output esperado:
# 📊 Meta Analyzer v4.0
# 📦 Loaded 665 tournament decks
#    Last 7 days: 45 decks
#    Last 30 days: 180 decks
# 
# ═══════════════════════════════════════════════
#   META STATE REPORT
# ═══════════════════════════════════════════════
# 
# 📊 Health: Healthy
#    Diversity: 76%
#    Viable archetypes: 7
#    Top archetype share: 24%
# 
# 🏆 TOP 5 ARCHETYPES (Last 7 days):
# 
#    📈 24.4% Blurple
#       Change: +3.2%
#       Avg placement: #12
# 
#    ➡️ 18.9% Ruby/Amethyst Aggro
#       Change: -1.1%
#       Avg placement: #8
# 
#    📉 15.6% Sapphire Ramp
#       Change: -5.3%
#       Avg placement: #16
# 
# 🃏 TOP 10 CARDS (Last 7 days):
# 
#    📈 42.2% Hades - Infernal Schemer
#    ➡️ 38.9% Junior Woodchuck Guidebook
#    📈 35.6% Tipo - Growing Son
#    ...
```

**Verificar JSON:**
```powershell
node scripts/analyze-meta.js --json > meta-report.json
type meta-report.json
# JSON completo com todos os dados
```

### **4. Scheduler Automático**

```powershell
# Iniciar scheduler (daemon)
node scripts/scheduler.js

# Output:
# 🤖 Auto-Scheduler v4.0 started
# 
# Scheduled tasks:
#   ✅ Daily cards update
#      Cron: 0 3 * * * (daily 3am)
#   ✅ Weekly tournaments sync
#      Cron: 0 4 * * 0 (sunday 4am)
# 
# ✅ Scheduler running. Press Ctrl+C to stop.

# Deixar rodando em background
# Updates automáticos:
# - Cards: todo dia às 3am
# - Tournaments: todo domingo às 4am
```

---

## 🔄 WORKFLOW TÍPICO

### **Setup Inicial (uma vez)**

```powershell
# 1. Instalar
npm install

# 2. Update inicial
node scripts/update-cards.js
node scripts/sync-tournaments.js

# 3. Verificar
node scripts/analyze-meta.js
```

### **Uso Diário**

```powershell
# Iniciar scheduler (background)
start node scripts/scheduler.js

# Iniciar backend
npm start

# Verificar meta quando quiser
node scripts/analyze-meta.js
```

### **Updates Manuais (quando precisar)**

```powershell
# Forçar update de cards
node scripts/update-cards.js --force

# Sincronizar torneios
node scripts/sync-tournaments.js

# Analisar meta
node scripts/analyze-meta.js
```

---

## 📊 INTEGRAÇÃO COM BACKEND

### **Endpoint /api/meta (NOVO)**

Criar `routes/meta.js`:

```javascript
const express = require('express');
const router = express.Router();
const { analyzeMetaState } = require('../services/tournaments/metaAnalyzer');

router.get('/state', (req, res) => {
  const result = analyzeMetaState();
  res.json(result);
});

module.exports = router;
```

Registrar no `server.js`:

```javascript
app.use('/api/meta', require('./routes/meta'));
```

**Testar:**
```powershell
curl http://localhost:5000/api/meta/state
# Retorna JSON completo do meta
```

---

## 🎯 FEATURES DISPONÍVEIS

### ✅ **1. Auto-Update de Cards**
- Busca de Dreamborn.ink + Lorcania.com
- Merge inteligente (prioridade Dreamborn > Lorcania)
- Detecção de novos sets
- Deduplicação por fingerprint
- Log de updates

### ✅ **2. Tournament Multi-Source**
- Melee.gg (API pública)
- Lorcania.com (API pública)
- Procedência verificada
- Deduplicação por SHA256 de decklist
- 440 decks locais + novos remotos

### ✅ **3. Meta Analysis com ML**
- Trend detection (rising/falling)
- Archetype popularity over time
- Card popularity tracking
- Meta health score (diversity)
- Time windows (7d, 30d)

### ✅ **4. Scheduler Automático**
- Cron diário (cards às 3am)
- Cron semanal (tournaments domingo 4am)
- Logs de execução
- Manual override

---

## 🔮 PRÓXIMOS PASSOS (Fase 2)

Após validar a Fase 1, implementar:

1. **Tournament Manager**
   - Criar eventos locais
   - Swiss pairings
   - Standings real-time
   - PDF export para judges

2. **Frontend Dashboard**
   - Visualizar meta trends
   - Gráficos de popularidade
   - Arquetype rise/fall
   - Top decks da semana

3. **API Pública**
   - Rate limiting
   - API keys
   - Documentação Swagger
   - Endpoints RESTful

---

## ⚠️ TROUBLESHOOTING

### **Erro: Cannot find module 'node-cron'**

```powershell
npm install node-cron
```

### **Erro: Melee.gg timeout**

É normal - alguns tournaments demoram. O sistema continua com os próximos.

### **Erro: cards.json not found**

```powershell
# Executar primeiro update
node scripts/update-cards.js
```

### **Scheduler não roda em Windows**

Use PM2 ou Windows Task Scheduler:

```powershell
# Instalar PM2
npm install -g pm2

# Iniciar scheduler
pm2 start scripts/scheduler.js --name lorcana-scheduler

# Ver logs
pm2 logs lorcana-scheduler

# Auto-start on boot
pm2 startup
pm2 save
```

---

## 📈 MÉTRICAS DE SUCESSO

Após Fase 1, você terá:

- ✅ **550+ cards** auto-atualizados
- ✅ **665+ tournament decks** de fontes verificadas
- ✅ **Meta analysis** com trends em tempo real
- ✅ **Updates automáticos** sem intervenção manual
- ✅ **Procedência verificada** em todos os dados
- ✅ **Zero custo** de infraestrutura

---

## 🎯 VALIDAÇÃO

Execute este checklist:

```powershell
# ✅ Cards database
dir db\cards.json
type db\sets.json

# ✅ Tournament database
dir db\tournamentMeta.json
type db\sourcesLog.json

# ✅ Meta analysis
node scripts/analyze-meta.js

# ✅ Scheduler
node scripts/scheduler.js
# (Ctrl+C para parar)

# ✅ Backend integration
npm start
curl http://localhost:5000/api/meta/state
```

**TUDO PASSOU? FASE 1 COMPLETA!** 🎉

---

## 🚀 DEPOIS DA FASE 1

**Você estará pronto para:**
1. Implementar Tournament Manager (Fase 2)
2. Criar Meta Dashboard no frontend
3. Adicionar Game Simulator (Fase 3)
4. Lançar API pública
5. Escalar para plataforma premium

**A base está sólida. O céu é o limite!** 🌟

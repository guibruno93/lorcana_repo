# 🚀 META ANALYSIS - Guia Completo de Integração

## 📦 ARQUIVOS CRIADOS

### **Backend:**
1. `meta-analysis-schema.sql` - Database schema (Supabase)
2. `tournament-scraper.js` - Scraper para inkDecks
3. `meta-analyzer.js` - Análise de win rates e tier list
4. `meta-analysis-routes.js` - API routes
5. `meta-cron.js` - Automação com cron jobs

### **Frontend:**
6. `MetaDashboard-ENHANCED.jsx` - Component atualizado
7. `MetaDashboard-ENHANCED.css` - Estilos completos

---

## 🎯 FUNCIONALIDADES

### ✅ **Real-time Tournament Scraping**
- Scrape automático de inkDecks.com
- Scraping manual via API
- Cron job diário (2 AM)
- Quick updates a cada 3h

### ✅ **Win Rate Tracking**
- Win rate por arquétipo
- Win rate por carta
- Histórico de performance
- Top 8 tracking
- Average placement

### ✅ **Tier List Automático**
- Cálculo de power level (0-100)
- Classificação S/A/B/C/D
- Histórico de mudanças
- Visual interativo

### ✅ **Meta Trends**
- Rising archetypes
- Falling archetypes
- Meta share tracking
- Trend indicators

---

## 📋 PASSO 1: Database Setup (Supabase)

### **1.1 Executar Schema SQL**

```sql
-- Copiar todo conteúdo de meta-analysis-schema.sql
-- Colar no Supabase SQL Editor
-- Executar
```

**Tabelas criadas:**
- ✅ `tournaments` - Torneios
- ✅ `decks` - Decks (enhanced)
- ✅ `cards_meta` - Estatísticas de cartas
- ✅ `archetype_meta` - Estatísticas de arquétipos
- ✅ `tier_list_history` - Histórico de tier list
- ✅ `scraping_jobs` - Jobs de scraping

### **1.2 Verificar Criação**

```sql
-- Executar no SQL Editor
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'tournaments',
    'decks',
    'cards_meta',
    'archetype_meta',
    'tier_list_history',
    'scraping_jobs'
  )
ORDER BY table_name;
```

**Deve aparecer 6 tabelas!** ✅

---

## 🔧 PASSO 2: Backend Setup

### **2.1 Instalar Dependências**

```powershell
cd S:\INKREC\lorcana_ai\backend

# Instalar novas dependências
npm install axios cheerio node-cron
```

**Pacotes:**
- `axios` - HTTP requests para scraping
- `cheerio` - HTML parsing
- `node-cron` - Scheduled jobs

### **2.2 Copiar Arquivos**

```powershell
# Services
copy tournament-scraper.js services\tournament-scraper.js
copy meta-analyzer.js services\meta-analyzer.js
copy meta-cron.js jobs\meta-cron.js

# Routes
copy meta-analysis-routes.js routes\meta-analysis.js
```

### **2.3 Atualizar server.js**

```javascript
// backend/server.js

// ... existing code ...

// Adicionar no topo com outros requires
const metaAnalysisRoutes = require('./routes/meta-analysis');
const metaCron = require('./jobs/meta-cron');

// ... existing middlewares ...

// Adicionar route (antes de app.listen)
app.use('/api/meta-analysis', metaAnalysisRoutes);

// Inicializar cron jobs
metaCron.init();

// ... app.listen ...
```

### **2.4 Reiniciar Backend**

```powershell
# Se estiver rodando, parar (Ctrl+C)
# Reiniciar
npm start
```

**Deve aparecer:**
```
⏰ Initializing meta cron jobs...
✅ 3 cron jobs initialized
📅 Schedule:
  - Full scraping: Daily at 2 AM
  - Meta analysis: Every 6 hours
  - Quick scraping: Every 3 hours
```

---

## 🎨 PASSO 3: Frontend Setup

### **3.1 Copiar Arquivos**

```powershell
cd S:\INKREC\lorcana_ai\frontend\src

# Backup do MetaDashboard atual
copy MetaDashboard.jsx MetaDashboard.jsx.backup
copy MetaDashboard.css MetaDashboard.css.backup

# Substituir com versão enhanced
copy MetaDashboard-ENHANCED.jsx MetaDashboard.jsx -Force
copy MetaDashboard-ENHANCED.css MetaDashboard.css -Force
```

### **3.2 Recarregar Frontend**

```powershell
# Navegador
Ctrl + Shift + R
```

---

## 🧪 PASSO 4: Testar Sistema

### **4.1 Testar Scraping Manual**

**Via API (Postman/Thunder Client):**

```http
POST http://localhost:3002/api/meta-analysis/scrape
Content-Type: application/json

{
  "limit": 5
}
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Scraping completed",
  "tournaments": 5,
  "decks": 234
}
```

**OU via Frontend:**
- Abrir Meta Dashboard
- Click "🔍 Scrape Now"
- Aguardar (30-60 segundos)
- Alert com resultado

### **4.2 Testar Análise**

**Via API:**

```http
POST http://localhost:3002/api/meta-analysis/analyze
```

**OU via Frontend:**
- Click "📊 Analyze"
- Aguardar (10-20 segundos)
- Alert "Analysis completed!"

### **4.3 Verificar Tier List**

```http
GET http://localhost:3002/api/meta-analysis/tier-list
```

**OU via Frontend:**
- Click aba "🏆 Tier List"
- Ver archetypes organizados por tier

### **4.4 Verificar Database**

```sql
-- No Supabase SQL Editor

-- Contar tournaments
SELECT COUNT(*) FROM tournaments;

-- Contar decks
SELECT COUNT(*) FROM decks;

-- Ver tier list
SELECT archetype, tier, power_level, meta_share 
FROM archetype_meta 
WHERE tier IS NOT NULL
ORDER BY power_level DESC;

-- Ver top cards
SELECT card_name, meta_share, win_rate
FROM cards_meta
ORDER BY meta_share DESC
LIMIT 10;
```

---

## 📊 PASSO 5: Deploy (Render)

### **5.1 Commit Mudanças**

```powershell
cd S:\INKREC\lorcana_ai

git add .
git commit -m "feat: add meta analysis system with scraping and tier list"
git push origin main
```

### **5.2 Redeploy Backend (Render)**

```
1. Render Dashboard
2. lorcana-backend
3. Manual Deploy → Deploy Latest Commit
4. Aguardar build (2-3 min)
```

### **5.3 Redeploy Frontend (Vercel)**

```
Vercel auto-deploys no git push!
OU:

1. Vercel Dashboard
2. inkwell-labs
3. Deployments → Redeploy
```

---

## ⏰ PASSO 6: Configurar Automação

### **6.1 Cron Jobs (Automático)**

**Já funciona!** Backend inicializa cron jobs automaticamente.

**Schedule atual:**
```
🔍 Full Scraping:  Daily at 2:00 AM
📊 Meta Analysis:  Every 6 hours
🔄 Quick Scraping: Every 3 hours
```

### **6.2 Ajustar Schedule (Opcional)**

**Editar `meta-cron.js`:**

```javascript
// Mudar de "Daily at 2 AM"
cron.schedule('0 2 * * *', ...)

// Para "Twice daily" (2 AM e 2 PM)
cron.schedule('0 2,14 * * *', ...)

// Para "Every 12 hours"
cron.schedule('0 */12 * * *', ...)
```

### **6.3 Trigger Manual (Via API)**

**Scraping:**
```bash
curl -X POST https://seu-backend.onrender.com/api/meta-analysis/scrape \
  -H "Content-Type: application/json" \
  -d '{"limit": 20}'
```

**Analysis:**
```bash
curl -X POST https://seu-backend.onrender.com/api/meta-analysis/analyze
```

---

## 📈 PASSO 7: Monitorar Sistema

### **7.1 Ver Jobs Status**

```http
GET http://localhost:3002/api/meta-analysis/scraping-jobs
```

**Response:**
```json
{
  "jobs": [
    {
      "id": "...",
      "source": "inkdecks",
      "status": "completed",
      "tournaments_found": 15,
      "decks_scraped": 432,
      "started_at": "2026-02-21T02:00:00Z",
      "completed_at": "2026-02-21T02:02:34Z"
    }
  ]
}
```

### **7.2 Ver Recent Tournaments**

```http
GET http://localhost:3002/api/meta-analysis/tournaments/recent?limit=10
```

### **7.3 Dashboard Metrics**

**Frontend mostra:**
- ✅ Total decks analyzed
- ✅ Unique archetypes
- ✅ Average win rate
- ✅ Top deck share
- ✅ Last update time

---

## 🔧 TROUBLESHOOTING

### **Scraping não funciona?**

**Problema:** inkDecks pode ter mudado HTML

**Solução:**
```javascript
// Atualizar seletores em tournament-scraper.js

// De:
$('.tournament-item')

// Para novo seletor (inspecionar site):
$('.new-tournament-class')
```

### **Tier list vazio?**

**Causa:** Não tem dados suficientes

**Solução:**
```powershell
# Rodar scraping + análise manual
POST /api/meta-analysis/scrape (limit: 30)
POST /api/meta-analysis/analyze

# Aguardar e verificar
GET /api/meta-analysis/tier-list
```

### **Cron jobs não rodam?**

**Verificar logs:**
```powershell
# No Render
View Logs → Procurar "cron"
```

**Se não aparecer:**
- Verificar se `metaCron.init()` está em server.js
- Verificar timezone do servidor
- Testar jobs manualmente via API

### **Analysis muito lento?**

**Otimizar:**
```javascript
// meta-analyzer.js

// Reduzir dias analisados
this.daysToAnalyze = 15; // De 30 para 15

// Limitar cards processados
cards.slice(0, 500); // De 1000 para 500
```

---

## 📊 ENDPOINTS DISPONÍVEIS

### **Scraping:**
```
POST   /api/meta-analysis/scrape
GET    /api/meta-analysis/scraping-jobs
```

### **Analysis:**
```
POST   /api/meta-analysis/analyze
GET    /api/meta-analysis/tier-list
GET    /api/meta-analysis/archetype/:name
GET    /api/meta-analysis/trends
GET    /api/meta-analysis/win-rates
```

### **Data:**
```
GET    /api/meta-analysis/cards/top?limit=50
GET    /api/meta-analysis/tournaments/recent?limit=20
POST   /api/meta-analysis/dashboard
```

---

## 🎯 RESULTADO FINAL

### **Frontend Features:**

✅ **4 Tabs:**
- 📊 Overview - Meta breakdown + top cards
- 🏆 Tier List - S/A/B/C/D classification
- 📈 Trends - Rising/falling archetypes
- 🃏 Cards - Top 50 cards com stats

✅ **Real-time Actions:**
- 🔍 Scrape Now - Manual scraping
- 📊 Analyze - Manual analysis
- 🔄 Refresh - Reload data

✅ **Visual:**
- Dark theme profissional
- Tier colors (S=Red, A=Orange, etc)
- Trend indicators (↑ green, ↓ red)
- Interactive cards

### **Backend Features:**

✅ **Automated:**
- Daily scraping (2 AM)
- Analysis every 6h
- Quick updates every 3h

✅ **Data Tracking:**
- 6 tables (Supabase)
- Win rates
- Meta share
- Tier history
- Trends

✅ **API:**
- 10+ endpoints
- Complete meta data
- Historical tracking

---

## 🚀 PRÓXIMOS PASSOS

### **Melhorias Futuras:**

1. **Multiple Sources:**
   - Melee.gg scraping
   - Official Ravensburger results
   - Community tournaments

2. **Advanced Analytics:**
   - Matchup matrix (A vs B win rate)
   - Card synergy analysis
   - Meta prediction (ML)

3. **User Features:**
   - Save favorite archetypes
   - Email alerts for tier changes
   - Deck suggestions based on meta

4. **Performance:**
   - Cache tier list (1h TTL)
   - Incremental scraping
   - Database indexes optimization

---

## ✅ CHECKLIST FINAL

- [ ] Database schema executado (Supabase)
- [ ] 6 tabelas criadas
- [ ] Dependências instaladas (axios, cheerio, node-cron)
- [ ] Services copiados (scraper, analyzer)
- [ ] Routes adicionado (meta-analysis.js)
- [ ] Cron jobs configurado (meta-cron.js)
- [ ] server.js atualizado
- [ ] Frontend atualizado (MetaDashboard-ENHANCED)
- [ ] CSS atualizado
- [ ] Teste de scraping funcionou
- [ ] Teste de análise funcionou
- [ ] Tier list aparece
- [ ] Trends aparecem
- [ ] Deploy backend OK
- [ ] Deploy frontend OK
- [ ] Cron jobs rodando
- [ ] Sistema completo funcionando

---

**SISTEMA COMPLETO DE META ANALYSIS!** 🎉

**Recursos:**
- ✅ Real-time scraping
- ✅ Win rate tracking
- ✅ Tier list automático
- ✅ Trend analysis
- ✅ Automated updates
- ✅ Professional UI

**Tudo pronto para produção!** 🚀

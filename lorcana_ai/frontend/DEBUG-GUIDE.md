# 🐛 DEBUG - Por Que o Gráfico Não Aparece?

## 📋 PASSO A PASSO DE DEBUG

### **PASSO 1: Instalar Versão Debug**

```powershell
cd S:\INKREC\lorcana_ai

# Parar frontend (Ctrl+C)

# Instalar versão debug
copy DeckAnalyzer-DEBUG.jsx frontend\src\DeckAnalyzer.jsx

# Reiniciar
cd frontend
npm start
```

---

### **PASSO 2: Abrir DevTools**

1. Abrir: http://localhost:3001
2. Pressionar: **F12**
3. Ir para tab: **Console**

---

### **PASSO 3: Fazer Análise**

1. **Deck Analyzer tab**
2. **Colar deck:**
   ```
   4 Tipo - Growing Son
   4 Sail the Azurite Sea
   4 Vision of the Future
   2 Spooky Sight
   4 Hades - Infernal Schemer
   3 Mulan - Disguised Soldier
   4 Vincenzo Santorini - The Explosives Expert
   4 He Hurled His Thunderbolt
   4 Namaari - Single-Minded Rival
   2 Beyond the Horizon
   4 Develop Your Brain
   4 Goliath - Clan Leader
   1 Pluto - Steel Champion
   1 Arthur - King Victorious
   4 Tinker Bell - Giant Fairy
   4 Cinderella - Dream Come True
   2 Jasmine - Fearless Princess
   2 Inkrunner
   3 Jafar - Tyrannical Hypnotist
   ```
3. **Clicar:** "Analisar Deck"
4. **Ver Console** - Deve mostrar logs

---

### **PASSO 4: Analisar Logs**

**Logs esperados no Console:**

```
▶️ Starting analysis
📡 Fetching: /api/deck/analyze
   Body: {...}
📥 Response status: 200
📥 Response data: {totalCards: 60, curveCounts: {...}, ...}
✅ Analysis set
🎨 Rendering DeckAnalyzerTab
   analysis: {...}
   advancedStats: {...}
🔄 Computing advancedStats
🔍 analyzeDeckAdvanced called
   Analysis received: {...}
   curveCounts: {0: 0, 1: 8, 2: 12, ...}
   ✅ Processed curve: {...}
   Total count: 60
   Early game count: 20
   ✅ Returning: {...}
   Result: {...}
📊 InkCurveChart rendering
   inkCurve: {0: {count: 0}, 1: {count: 8}, ...}
   maxCount: 12
   Bar 0: count=0, height=0%
   Bar 1: count=8, height=66%
   Bar 2: count=12, height=100%
   ...
```

---

### **PASSO 5: Identificar Problema**

#### **Cenário A: curveCounts não vem na response**

**Log mostra:**
```
Has curveCounts: NO
```

**Solução:** Backend não está retornando curveCounts. Verificar se `analyzeDeck` está correto.

---

#### **Cenário B: advancedStats é NULL**

**Log mostra:**
```
Has advancedStats: NO
❌ advancedStats is NULL
```

**Solução:** Problema na função `analyzeDeckAdvanced`. Ver logs anteriores.

---

#### **Cenário C: InkCurveChart não renderiza**

**Log mostra:**
```
✅ Returning: {inkCurve: {...}}
```

Mas gráfico não aparece.

**Solução:** Problema no CSS. Verificar se `DeckAnalyzer.css` está carregado.

---

#### **Cenário D: Erro no Console**

**Log mostra:**
```
❌ Error: ...
```

**Solução:** Copiar erro completo e me enviar.

---

## 📸 O QUE EU PRECISO VER

**Me envie:**

1. ✅ **Print da página inteira** (com Deck Analyzer)
2. ✅ **Print do Console (F12)** com todos os logs
3. ✅ **Print do Network tab (F12)**:
   - Clicar em `/api/deck/analyze`
   - Ver tab "Response"
   - Me enviar o JSON completo

---

## 🎯 AÇÕES BASEADAS NO RESULTADO

### **Se curveCounts não vem:**

```powershell
# Verificar deckParser
type backend\services\deckParser.js | findstr curveCounts

# Deve mostrar: curveCounts: {
```

### **Se CSS não carrega:**

```powershell
# Verificar se CSS existe
dir frontend\src\DeckAnalyzer.css

# Se não existe, copiar:
copy DeckAnalyzer.css frontend\src\
```

### **Se ainda não funciona:**

Me envie:
- Print do console (F12)
- Response do /api/deck/analyze
- Qualquer erro que aparecer

---

## ⚡ INSTALAÇÃO RÁPIDA

```powershell
cd S:\INKREC\lorcana_ai

# Instalar debug version
copy DeckAnalyzer-DEBUG.jsx frontend\src\DeckAnalyzer.jsx

# Reiniciar frontend
cd frontend
npm start

# Abrir http://localhost:3001
# Pressionar F12
# Fazer análise
# Copiar TODOS os logs do console
# Me enviar
```

---

**EXECUTE AGORA E ME ENVIE OS LOGS!** 🔍

Com os logs, vou identificar exatamente onde está falhando.

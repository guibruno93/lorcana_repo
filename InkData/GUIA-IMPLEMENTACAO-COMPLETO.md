# 🚀 GUIA COMPLETO DE IMPLEMENTAÇÃO

Sistema completo: Backend API + Login + Supabase

---

## 📋 FASE 1: BACKEND - API DE COMPARAÇÃO

### **1.1 Instalar Dependências**

```powershell
cd S:\INKREC\lorcana_ai\backend

# Instalar pacotes necessários
npm install express bcryptjs jsonwebtoken cors dotenv
```

### **1.2 Copiar Arquivos**

```powershell
# Criar diretórios
mkdir routes -Force
mkdir data -Force

# Copiar rotas
copy deckComparison.js routes\
copy auth.js routes\
```

### **1.3 Atualizar server.js**

Adicionar as rotas no `backend/server.js`:

```javascript
// Após outras rotas existentes
const deckComparison = require('./routes/deckComparison');
const auth = require('./routes/auth');

// Rotas públicas
app.use('/api/deck-comparison', deckComparison);
app.use('/api/auth', auth);

// Rotas protegidas (exemplo)
const { authenticateToken } = require('./routes/auth');
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({ message: 'Protected route', user: req.user });
});
```

### **1.4 Testar API**

```powershell
# Iniciar backend
cd backend
npm start

# Em outro terminal, testar:
curl http://localhost:3002/api/deck-comparison/stats
```

---

## 📋 FASE 2: FRONTEND - INTEGRAÇÃO

### **2.1 Criar Componente de Comparação**

```powershell
cd frontend\src
# Criar DeckComparison.jsx
```

```jsx
// frontend/src/DeckComparison.jsx
import React, { useState } from 'react';
import axios from 'axios';

function DeckComparison({ analysis }) {
  const [filter, setFilter] = useState('all');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    if (!analysis || !analysis.cards) return;

    setLoading(true);
    try {
      const response = await axios.post('http://localhost:3002/api/deck-comparison/compare', {
        cards: analysis.cards,
        filter,
      });

      setResult(response.data);
    } catch (err) {
      console.error('Comparison error:', err);
      alert('Erro ao comparar deck');
    } finally {
      setLoading(false);
    }
  };

  if (!analysis) return null;

  return (
    <div className="deck-comparison">
      <h2>📊 Comparação com Meta</h2>

      <div className="filter-buttons">
        <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>
          Todos
        </button>
        <button onClick={() => setFilter('top32')} className={filter === 'top32' ? 'active' : ''}>
          Top 32
        </button>
        <button onClick={() => setFilter('top16')} className={filter === 'top16' ? 'active' : ''}>
          Top 16
        </button>
        <button onClick={() => setFilter('top8')} className={filter === 'top8' ? 'active' : ''}>
          Top 8
        </button>
        <button onClick={() => setFilter('top4')} className={filter === 'top4' ? 'active' : ''}>
          Top 4
        </button>
      </div>

      <button onClick={handleCompare} disabled={loading} className="compare-btn">
        {loading ? 'Comparando...' : '🔍 Comparar com Meta'}
      </button>

      {result && (
        <div className="comparison-result">
          <div className="score-display">
            <h3>Nota do Deck</h3>
            <div className="score-value">{result.comparison.score}/10</div>
            <div className="confidence">Confiança: {result.comparison.confidence}</div>
          </div>

          <div className="stats">
            <p>Similaridade média: {result.comparison.avgSimilarity}%</p>
            <p>Decks similares encontrados: {result.comparison.matchesFound}</p>
            <p>Filtro aplicado: {result.filter}</p>
          </div>

          {result.comparison.top5Matches && (
            <div className="top-matches">
              <h4>Top 5 Decks Similares:</h4>
              <ul>
                {result.comparison.top5Matches.map((match, i) => (
                  <li key={i}>
                    {match.similarity}% similar - Placement: {match.placement}
                    {match.tournament && ` - ${match.tournament}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DeckComparison;
```

### **2.2 Adicionar ao DeckAnalyzer**

```javascript
// Em DeckAnalyzer.jsx
import DeckComparison from './DeckComparison';

// Dentro do render, após outros componentes:
{analysis && <DeckComparison analysis={analysis} />}
```

---

## 📋 FASE 3: SISTEMA DE LOGIN

### **3.1 Criar Componente de Login**

```jsx
// frontend/src/Login.jsx
import React, { useState } from 'react';
import axios from 'axios';

function Login({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' ou 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = mode === 'login'
        ? { email, password }
        : { email, password, name, country };

      const response = await axios.post(`http://localhost:3002${endpoint}`, payload);

      // Salvar token
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      // Callback de sucesso
      if (onLoginSuccess) {
        onLoginSuccess(response.data.user);
      }

    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>{mode === 'login' ? 'Login' : 'Registrar'}</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {mode === 'register' && (
            <>
              <input
                type="text"
                placeholder="Nome (opcional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                type="text"
                placeholder="País (opcional)"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </>
          )}

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Registrar'}
          </button>
        </form>

        <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="switch-mode">
          {mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
        </button>
      </div>
    </div>
  );
}

export default Login;
```

### **3.2 Proteger Rotas**

```jsx
// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import Login from './Login';
import DeckAnalyzer from './DeckAnalyzer';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Verificar se usuário está logado
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  return (
    <div className="App">
      <header>
        <h1>Lorcana AI</h1>
        <div className="user-info">
          <span>Olá, {user.email}</span>
          <button onClick={handleLogout}>Sair</button>
        </div>
      </header>
      
      <DeckAnalyzer />
    </div>
  );
}
```

---

## 📋 FASE 4: MIGRAÇÃO PARA SUPABASE

### **4.1 Criar Conta no Supabase**

1. Acessar: https://supabase.com
2. Criar novo projeto
3. Anotar:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (public)
   - `SUPABASE_SERVICE_KEY` (secret)

### **4.2 Executar Schema**

1. No Supabase Dashboard → SQL Editor
2. Copiar todo conteúdo de `supabase-schema.sql`
3. Executar

### **4.3 Instalar Dependências**

```powershell
cd backend
npm install @supabase/supabase-js
```

### **4.4 Configurar .env**

```powershell
# backend/.env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua-service-key
JWT_SECRET=sua-secret-key-aleatoria
ENCRYPTION_KEY=sua-encryption-key-32-chars
```

### **4.5 Executar Migração**

```powershell
cd backend\services\scrapers

# Copiar script
copy migrate-to-supabase.js .

# Executar
node migrate-to-supabase.js
```

**Output esperado:**
```
╔═══════════════════════════════════════════════════════╗
║   Lorcana AI - Supabase Migration                   ║
╚═══════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════
📦 Migrating Cards
═══════════════════════════════════════════════════════

📊 Found 1234 cards to migrate
   ✅ Batch 0-1000: 1000 cards
   ✅ Batch 1000-2000: 234 cards

✅ Cards migration complete:
   Inserted: 1234
   Errors:   0

═══════════════════════════════════════════════════════
📦 Migrating Tournaments & Decks
═══════════════════════════════════════════════════════

📊 Found 169 decks to migrate
📊 Found 10 unique tournaments

✅ 10 tournaments inserted
✅ 169 decks inserted

╔═══════════════════════════════════════════════════════╗
║   ✅ Migration Complete!                             ║
╚═══════════════════════════════════════════════════════╝
```

### **4.6 Atualizar Backend para Usar Supabase**

```javascript
// backend/routes/deckComparison.js (Supabase version)
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Substituir loadDecks() por:
async function loadDecks(filter = 'all') {
  let query = supabase
    .from('decks')
    .select('*')
    .eq('get_deck_total_cards(cards)', 60);

  if (filter && filter !== 'all') {
    const placements = { top4: 4, top8: 8, top16: 16, top32: 32 };
    const maxPlacement = placements[filter.toLowerCase()];
    if (maxPlacement) {
      query = query.lte('placement', maxPlacement);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return { decks: data };
}
```

---

## 📋 FASE 5: TESTES

### **5.1 Testar API de Comparação**

```powershell
# Testar endpoint
curl -X POST http://localhost:3002/api/deck-comparison/compare `
  -H "Content-Type: application/json" `
  -d '{\"cards\": [{\"name\": \"Basil - Practiced Detective\", \"quantity\": 4, \"cost\": 1, \"ink\": \"Sapphire\", \"inkable\": true}], \"filter\": \"top16\"}'
```

### **5.2 Testar Login**

```powershell
# Registrar
curl -X POST http://localhost:3002/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{\"email\": \"test@example.com\", \"password\": \"password123\", \"name\": \"Test User\"}'

# Login
curl -X POST http://localhost:3002/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"email\": \"test@example.com\", \"password\": \"password123\"}'
```

### **5.3 Testar Supabase**

```powershell
# Ver dados no Supabase Dashboard
# Table Editor → cards / tournaments / decks
```

---

## 📋 CHECKLIST COMPLETO

### **Backend:**
- [ ] Instalar dependências (express, bcryptjs, jwt, supabase)
- [ ] Copiar `deckComparison.js` para routes/
- [ ] Copiar `auth.js` para routes/
- [ ] Atualizar server.js com rotas
- [ ] Criar .env com variáveis
- [ ] Testar API de comparação
- [ ] Testar endpoints de auth

### **Frontend:**
- [ ] Criar `DeckComparison.jsx`
- [ ] Criar `Login.jsx`
- [ ] Atualizar `App.jsx` com proteção de rotas
- [ ] Adicionar componente ao `DeckAnalyzer`
- [ ] Testar login/registro
- [ ] Testar comparação de deck

### **Supabase:**
- [ ] Criar projeto no Supabase
- [ ] Executar schema SQL
- [ ] Configurar .env com credenciais
- [ ] Executar migração de dados
- [ ] Verificar dados no dashboard
- [ ] Atualizar backend para usar Supabase

---

## 🎯 RESULTADO FINAL

Após seguir todos os passos, você terá:

✅ **API de Comparação**
- Filtros: top32/16/8/4
- Nota 0-10 baseada em similaridade
- Comparação com mesmas cores

✅ **Sistema de Login**
- Registro de usuários
- Login com JWT
- Dados criptografados (email, nome, país)
- Proteção de rotas

✅ **Banco de Dados Supabase**
- Cards migrados
- Decks migrados
- Consultas rápidas
- RLS (Row Level Security)
- Views para estatísticas

---

## 📞 PRÓXIMOS PASSOS

1. **Implementar salvamento de decks do usuário**
2. **Dashboard de estatísticas**
3. **Histórico de comparações**
4. **Deck builder integrado**
5. **Sharing de decks públicos**

---

**COMECE PELA FASE 1 E ME AVISE QUANDO CONCLUIR!** 🚀

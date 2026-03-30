# GitHub Actions — scraping agendado

Este documento descreve o scraping automático do Inkdecks via GitHub Actions e a API em modo cache-first.

## Como funciona

1. **GitHub Actions** corre o workflow às **00:00 e 12:00 UTC** (ou manualmente).
2. **Puppeteer** (`InkdecksPuppeteerScraper`) faz scrape do Inkdecks e grava em **`scraped_decks`** no Supabase.
3. A **API no Render** serve dados já em cache (`GET /api/meta-analysis/decks`) sem correr browser no servidor.

## Configuração inicial

### 1. Secrets no GitHub

**Repositório → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Valor |
|--------|--------|
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Service role key (não expor no frontend) |

### 2. Ativar Actions

**Actions** → se pedido, confirmar que os workflows estão permitidos.

### 3. Primeira execução (manual)

1. **Actions** → **Scrape Inkdecks Decks** → **Run workflow**
2. Opcional: `limit` (ex.: `10` para teste)
3. Aguardar os logs (vários minutos consoante o limite)

## Agenda

Definida em `.github/workflows/scrape-inkdecks.yml`:

```yaml
schedule:
  - cron: '0 */12 * * *'
```

Para alterar (exemplos):

```yaml
# A cada 6 horas
- cron: '0 */6 * * *'

# Diariamente às 03:00 UTC
- cron: '0 3 * * *'
```

## Monitorização

- **Último run:** Actions → workflow → run mais recente → logs do job `scrape`.
- **Cache na API:**

```http
GET /api/meta-analysis/cache-status
```

Exemplo de resposta:

```json
{
  "success": true,
  "cache": {
    "last_update": "2026-03-30T00:00:00.000Z",
    "age_hours": 2.5,
    "is_fresh": true,
    "next_scheduled_run": "12:00 UTC",
    "scraper_location": "GitHub Actions (automated)",
    "update_frequency": "Every 12 hours"
  }
}
```

## Teste local

Na pasta `backend` (com `.env` ou variáveis definidas):

```bash
node scripts/local-scraper.js 5
```

## Endpoints públicos (cache)

| Método | Caminho | Descrição |
|--------|---------|-----------|
| GET | `/api/meta-analysis/decks` | Lista `scraped_decks` + meta (idade do cache, arquétipos) |
| GET | `/api/meta-analysis/cache-status` | Resumo leve do cache |

**Nota:** `GET /decks` pode devolver muitas linhas; para produção considera paginação ou campos selecionados numa evolução futura.

## Limites GitHub Actions (free tier)

- Minutos mensais limitados; cada run pode demorar **~10–25 min** consoante `limit`.
- Agenda **2×/dia** costuma ficar dentro do plano gratuito.

## Resolução de problemas

| Problema | O que verificar |
|----------|------------------|
| Workflow não corre | Actions ativadas; sintaxe YAML; branch `main` com o ficheiro do workflow |
| Falha no scrape | Logs do job; Cloudflare; credenciais Supabase |
| Supabase sem linhas novas | Permissões da service key; tabela `scraped_decks`; erros no passo “Run Puppeteer scraper” |
| API 500 em `/decks` | `SUPABASE_*` no Render; RLS/policies a permitir leitura com anon se aplicável (ou usar apenas service no backend) |

O backend Render usa **service key** nas rotas server-side; as rotas `/decks` e `/cache-status` usam o mesmo cliente Supabase já configurado em `meta-analysis.js`.

# Lorcana / Inkwell Labs

Monorepo com frontend e backend para análise de decks Lorcana.

## Instalação (resumo)

- **Backend:** `cd backend && npm install`
- **Frontend:** `cd frontend && npm install`

Variáveis de ambiente: ver `.env.example` ou documentação em `backend/`.

## Sistema de scraping automático

A plataforma pode usar **GitHub Actions** para atualizar dados do Inkdecks **a cada 12 horas** (00:00 e 12:00 UTC), sem depender do Puppeteer no Render.

### Fluxo

1. **GitHub Actions** executa o workflow agendado (ou manual).
2. **Puppeteer** faz scrape ao Inkdecks (ambiente Ubuntu nas runners).
3. **Supabase** guarda os resultados na tabela `scraped_decks`.
4. A **API** expõe cache imediato em `GET /api/meta-analysis/decks` e `GET /api/meta-analysis/cache-status`.

### Configuração

Guia detalhado: **[backend/GITHUB_ACTIONS_SETUP.md](backend/GITHUB_ACTIONS_SETUP.md)**

### Destaques

- Atualizações automáticas no horário definido no workflow
- Respostas da API a partir de cache (sem esperar scrape por pedido)
- Gatilho manual na UI do GitHub (`workflow_dispatch`)
- Custo do scraping concentrado nas runners GitHub (free tier com limites razoáveis)

## Documentação adicional

- Deploy Render: `backend/DEPLOY_COMMANDS.md`
- SQL da tabela de cache: `backend/scraped_decks.sql`

# Render Deployment Commands

# ⚠️ TROUBLESHOOTING: Chrome Not Found

If you see error: `Could not find Chrome (ver. XXX)`

## Solution 1: Verify Environment Variables

Render Dashboard → Environment

**DELETE these if present:**

- ❌ `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD`
- ❌ `PUPPETEER_EXECUTABLE_PATH`

**KEEP:**

- ✅ `PUPPETEER_HEADLESS=true`

### Required for Chrome persistence (runtime)

O cache em `/opt/render/.cache` **não** persiste entre build e runtime no free tier. O Chrome é instalado **na primeira execução do scraper** em diretório gravável:

```text
PUPPETEER_CACHE_DIR=/tmp/.cache/puppeteer
```

Se não definires, o código assume `/tmp/.cache/puppeteer` quando `RENDER=true`.

## Solution 2: Force Chrome Download

Optional temporary env var (se downloads falharem por rede):

- `PUPPETEER_DOWNLOAD_BASE_URL=https://storage.googleapis.com`

## Solution 3: Clear Cache & Redeploy

Render Dashboard → Manual Deploy → ✅ **Clear build cache**

Após o primeiro `POST /api/meta-analysis/scrape`, nos logs de **runtime** deves ver a instalação do Chrome, por exemplo:

```text
Chrome não encontrado; a instalar em /tmp/.cache/puppeteer
puppeteer browsers install chrome
```

---

# ⚠️ RENDER FREE TIER CONFIGURATION

## Environment Variables (Free Tier)

**REMOVE these if present:**

- ❌ `PUPPETEER_EXECUTABLE_PATH`
- ❌ `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD`

**SET (recomendado):**

- ✅ `PUPPETEER_HEADLESS=true`
- ✅ `PUPPETEER_CACHE_DIR=/tmp/.cache/puppeteer` (cache gravável em runtime)
- ✅ Todas as outras (Supabase, JWT, etc.)

## Build Settings

- **Build Command:** `npm run render-build`
- **Start Command:** `node server.js`

## Note

No free tier, o Chrome **não** é fiável no disco do build: o `render-build-freetier.sh` só instala dependências npm. O Chrome é descarregado **lazy** no primeiro scrape para `PUPPETEER_CACHE_DIR` (por omissão `/tmp/.cache/puppeteer` no Render). A primeira execução pode demorar **~1–2 min**; as seguintes reutilizam o cache em `/tmp` (até cold start do serviço).

---

## After fixing files with Cursor

### 1. Review Changes

```bash
git status
git diff
```

### 2. Stage Changes

```bash
git add backend/package.json
git add backend/package-lock.json
git add backend/scripts/render-build-freetier.sh
git add backend/scripts/puppeteer-browser-install.cjs
git add backend/scripts/render-build.sh
git add backend/puppeteer.config.cjs
git add backend/.puppeteerrc.cjs
git add backend/.gitignore
git add backend/DEPLOY_COMMANDS.md
```

### 3. Commit

```bash
git commit -m "fix: configure Render deployment with Chromium support

- Add render-build script to package.json
- Create render-build.sh for Chromium installation
- Add Puppeteer config files
- Set execute permissions on build script"
```

### 4. Push

```bash
git push origin main
```

## Render Dashboard Configuration

### Build & Deploy Settings

- **Root Directory:** `backend`
- **Build Command:** `npm run render-build`
- **Start Command:** `node server.js`

### Environment Variables

```
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_HEADLESS=true
```

### Deploy

1. Clear build cache & deploy
2. Monitor logs for Chromium installation
3. Test endpoints after deployment

## Expected Build Logs

```
==> Running build command 'npm run render-build'...
> bash scripts/render-build.sh
🔧 Render build script starting...
✅ apt-get detected, configuring for Linux...
📦 Installing dependencies...
📥 Installing Chromium and dependencies...
Setting up chromium...
✅ Chromium installed successfully
✅ Build complete!
==> Build successful 🎉
```

## Post-Deployment Tests

```bash
# Health check
curl https://your-backend.onrender.com/health

# Scraper status
curl https://your-backend.onrender.com/api/meta-analysis/scraper-status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Run scraper
curl https://your-backend.onrender.com/api/meta-analysis/scrape \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"limit": 3}'
```

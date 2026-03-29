# Render Deployment Commands

# ⚠️ RENDER FREE TIER CONFIGURATION

## Environment Variables (Free Tier)

**REMOVE these if present:**

- ❌ `PUPPETEER_EXECUTABLE_PATH`
- ❌ `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD`

**KEEP only:**

- ✅ `PUPPETEER_HEADLESS=true`
- ✅ All other vars (Supabase, JWT, etc.)

## Build Settings

- **Build Command:** `npm run render-build`
- **Start Command:** `node server.js`

## Note

Free tier uses Puppeteer's bundled Chrome (~170MB download during build).
This increases build time by 2–3 minutes but works reliably on read-only filesystems (no `apt-get`).

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

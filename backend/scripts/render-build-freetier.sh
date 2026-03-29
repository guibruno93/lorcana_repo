#!/bin/bash
set -e

echo "🔧 Render build script (Free Tier) starting..."
echo "ℹ️ Chrome will be downloaded on first scraper use (runtime, /tmp cache)"

BACKEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_ROOT"

unset PUPPETEER_SKIP_CHROMIUM_DOWNLOAD

echo "📦 Installing dependencies..."
npm ci --production --legacy-peer-deps || npm install --production --legacy-peer-deps

echo "ℹ️  Chrome will be installed on first scraping request (lazy)"
echo "ℹ️  Set PUPPETEER_CACHE_DIR=/tmp/.cache/puppeteer on Render for writable cache"
echo "✅ Build complete!"

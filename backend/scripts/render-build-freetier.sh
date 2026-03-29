#!/bin/bash
set -e

echo "🔧 Render build script (Free Tier) starting..."
echo "ℹ️ Using Puppeteer's bundled Chrome (no system Chromium needed)"

BACKEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_ROOT"

# CRITICAL: Ensure Chrome download is NOT skipped
unset PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
export PUPPETEER_CACHE_DIR="${PUPPETEER_CACHE_DIR:-/opt/render/.cache/puppeteer}"

echo "📦 Installing dependencies..."
npm ci --production --legacy-peer-deps || npm install --production --legacy-peer-deps

# Force browser install (idempotent; garante versão alinhada ao puppeteer em package.json)
echo "🌐 Installing Puppeteer-managed Chrome (browsers install)..."
npx puppeteer browsers install chrome

echo "✅ Build complete! Puppeteer Chrome ready."

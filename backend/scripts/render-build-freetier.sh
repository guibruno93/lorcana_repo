#!/bin/bash
set -e

echo "🔧 Render build script (Free Tier) starting..."
echo "ℹ️ Using Puppeteer's bundled Chrome (no system Chromium needed)"

BACKEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_ROOT"

# Allow Puppeteer to download Chrome during npm install
unset PUPPETEER_SKIP_CHROMIUM_DOWNLOAD

echo "📦 Installing dependencies..."
npm ci --production --legacy-peer-deps || npm install --production --legacy-peer-deps

echo "✅ Build complete! Puppeteer Chrome ready."

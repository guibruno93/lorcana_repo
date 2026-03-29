#!/bin/bash
set -e

echo "🔧 Render build script starting..."

# Garantir cwd = pasta backend (npm run render-build já corre aqui; isto cobre execução direta)
BACKEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_ROOT"

# Detect if we're on Linux (Render) or not (local dev)
if command -v apt-get &> /dev/null; then
  echo "✅ apt-get detected, configuring for Linux..."

  # Skip Chromium download by npm
  export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

  echo "📦 Installing dependencies..."
  npm ci --production --legacy-peer-deps || npm install --production --legacy-peer-deps

  echo "📥 Installing Chromium and dependencies..."
  apt-get update
  apt-get install -y \
    chromium \
    chromium-sandbox \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2

  apt-get clean
  rm -rf /var/lib/apt/lists/*

  echo "✅ Chromium installed successfully"
else
  echo "ℹ️ Not on Linux, skipping Chromium installation (using npm's Chromium)"
  npm install
fi

echo "✅ Build complete!"

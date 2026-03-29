'use strict';

/**
 * postinstall: baixa Chrome gerido pelo Puppeteer quando o skip não está ativo.
 * Evita depender de `bash` no Windows (npm scripts); no Render o bash também funciona.
 */
if (process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD === 'true') {
  console.log(
    'Skipping Puppeteer browser download (PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true)'
  );
  process.exit(0);
}

const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
try {
  execSync('npx puppeteer browsers install chrome', {
    stdio: 'inherit',
    env: process.env,
    cwd: root,
  });
} catch {
  // equivalente a || true no script bash (não falhar o npm install)
  console.warn(
    '⚠️ puppeteer browsers install chrome falhou (continuar; o render-build pode corrigir).'
  );
}

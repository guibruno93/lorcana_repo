'use strict';

/**
 * Cron noturno: regenera o glossário LLM (meta_archetype_glossary.json).
 * O scraping pesado Inkdecks continua no GitHub Actions; aqui só texto/IA.
 *
 * Ativar no servidor (ex. Render): ENABLE_INKDECKS_NIGHTLY_CRON=true
 * Opcional: CRON_TZ=America/Sao_Paulo (default)
 */

const path = require('path');
const { spawn } = require('child_process');
const cron = require('node-cron');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'refresh-meta-glossary.js');

function runGlossaryScript() {
  const child = spawn(process.execPath, [SCRIPT], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env },
  });
  child.on('exit', (code) => {
    if (code === 0) {
      console.log('✅ Nightly meta glossary: script terminou com sucesso.');
    } else {
      console.error(`⚠️ Nightly meta glossary: exit ${code}`);
    }
  });
}

function start() {
  const tz = process.env.CRON_TZ || 'America/Sao_Paulo';
  // 03:45 madrugada (fuso configurável)
  cron.schedule(
    '45 3 * * *',
    () => {
      console.log('⏰ Cron: refresh-meta-glossary (madrugada)');
      runGlossaryScript();
    },
    { timezone: tz }
  );
  console.log(
    `⏰ inkdecks-meta-cron: glossário LLM agendado (45 3 * * * — ${tz}).`
  );
}

module.exports = { start, runGlossaryScript };

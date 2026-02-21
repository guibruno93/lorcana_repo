@echo off
REM ═══════════════════════════════════════════════════════════════════════════
REM  LORCANA AI v4.0 - FASE 1 INSTALLER
REM  Foundation: Auto-updater + Tournament Aggregator + Meta Analyzer
REM ═══════════════════════════════════════════════════════════════════════════

echo.
echo ========================================
echo   LORCANA AI v4.0 - FASE 1 INSTALLER
echo   Foundation Package
echo ========================================
echo.

REM ── Verificar diretório ──
if not exist "backend" (
    echo ERRO: Execute na pasta raiz do projeto
    pause
    exit /b 1
)

echo [1/6] Verificando arquivos...
echo.

set "files=cardUpdater.js tournamentAggregator.js metaAnalyzer.js scheduler.js package.json"
for %%f in (%files%) do (
    if not exist "%%f" (
        echo   FALTA: %%f
        set missing=1
    ) else (
        echo   OK: %%f
    )
)

if defined missing (
    echo.
    echo ERRO: Faltam arquivos. Baixe todos os 7 arquivos da Fase 1.
    pause
    exit /b 1
)

echo.
echo [2/6] Criando estrutura de pastas...
echo.

cd backend

if not exist "services\cards" mkdir services\cards
if not exist "services\tournaments" mkdir services\tournaments
if not exist "scripts" mkdir scripts
if not exist "db" mkdir db

echo   OK: Pastas criadas
echo.

echo [3/6] Copiando arquivos core...
echo.

copy /Y ..\cardUpdater.js services\cards\cardUpdater.js >nul
if errorlevel 1 goto :error

copy /Y ..\tournamentAggregator.js services\tournaments\tournamentAggregator.js >nul
if errorlevel 1 goto :error

copy /Y ..\metaAnalyzer.js services\tournaments\metaAnalyzer.js >nul
if errorlevel 1 goto :error

copy /Y ..\scheduler.js scripts\scheduler.js >nul
if errorlevel 1 goto :error

echo   [OK] cardUpdater.js
echo   [OK] tournamentAggregator.js
echo   [OK] metaAnalyzer.js
echo   [OK] scheduler.js
echo.

echo [4/6] Criando scripts CLI...
echo.

REM Criar update-cards.js
(
echo #!/usr/bin/env node
echo 'use strict';
echo const { updateCards } = require^('../services/cards/cardUpdater'^);
echo updateCards^({ force: process.argv.includes^('--force'^) }^)
echo   .then^(^(^) =^> process.exit^(0^)^)
echo   .catch^(err =^> { console.error^('Error:', err.message^); process.exit^(1^); }^);
) > scripts\update-cards.js

REM Criar sync-tournaments.js
(
echo #!/usr/bin/env node
echo 'use strict';
echo const { aggregateTournaments } = require^('../services/tournaments/tournamentAggregator'^);
echo aggregateTournaments^(^)
echo   .then^(^(^) =^> process.exit^(0^)^)
echo   .catch^(err =^> { console.error^('Error:', err.message^); process.exit^(1^); }^);
) > scripts\sync-tournaments.js

REM Criar analyze-meta.js
(
echo #!/usr/bin/env node
echo 'use strict';
echo const { analyzeMetaState } = require^('../services/tournaments/metaAnalyzer'^);
echo const r = analyzeMetaState^(^);
echo if ^(!r.available^) { console.log^(r.note^); process.exit^(0^); }
echo console.log^(JSON.stringify^(r, null, 2^)^);
) > scripts\analyze-meta.js

echo   [OK] update-cards.js
echo   [OK] sync-tournaments.js
echo   [OK] analyze-meta.js
echo.

echo [5/6] Atualizando package.json...
echo.

copy /Y ..\package.json package.json >nul
if errorlevel 1 goto :error

echo   [OK] package.json atualizado
echo.

echo [6/6] Instalando dependencias...
echo.

call npm install

if errorlevel 1 (
    echo.
    echo ERRO: npm install falhou
    pause
    exit /b 1
)

echo.
echo ========================================
echo   INSTALACAO CONCLUIDA!
echo ========================================
echo.
echo Proximos passos:
echo.
echo   1. TESTAR AUTO-UPDATER:
echo      node scripts\update-cards.js
echo.
echo   2. SINCRONIZAR TORNEIOS:
echo      node scripts\sync-tournaments.js
echo.
echo   3. ANALISAR META:
echo      node scripts\analyze-meta.js
echo.
echo   4. INICIAR SCHEDULER (opcional):
echo      node scripts\scheduler.js
echo.
echo Features instaladas:
echo   - Auto-update de cards (Dreamborn + Lorcania)
echo   - Tournament aggregator (Melee.gg + Lorcania)
echo   - Meta analyzer com ML trends
echo   - Scheduler automatico (cron)
echo.
echo ========================================
echo   FASE 1 COMPLETA! 
echo ========================================
echo.
pause
exit /b 0

:error
echo.
echo ERRO durante instalacao
pause
exit /b 1

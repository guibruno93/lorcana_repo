@echo off
REM ===============================================
REM Lorcana Deck Analyser - Fullstack Dev Script
REM ===============================================

REM Guarda o diretório onde o batch está localizado
SET ROOT_DIR=%~dp0

echo ===============================================
echo Rodando backend TypeScript + frontend React...
echo ===============================================

REM --------- Frontend Build ---------
cd /d "%ROOT_DIR%frontend"
echo -----------------------------------------------
echo Instalando dependencias do frontend...
npm install
if %ERRORLEVEL% NEQ 0 (
    echo Erro ao instalar dependencias do frontend.
    pause
    exit /b %ERRORLEVEL%
)
echo -----------------------------------------------
echo Buildando frontend React...
npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Erro ao buildar frontend.
    pause
    exit /b %ERRORLEVEL%
)

REM --------- Backend Dev ---------
cd /d "%ROOT_DIR%backend"
echo -----------------------------------------------
echo Instalando dependencias do backend...
npm install
if %ERRORLEVEL% NEQ 0 (
    echo Erro ao instalar dependencias do backend.
    pause
    exit /b %ERRORLEVEL%
)
echo -----------------------------------------------
echo Rodando backend com ts-node e nodemon...
npm run dev

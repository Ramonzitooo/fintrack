@echo off
chcp 65001 >nul
title FinTrack — Publicador Automático GitHub (Ramonzitooo)

echo ========================================================
echo   FINTRACK v4.0 — PUBLICAÇÃO AUTOMÁTICA NO GITHUB
echo   Conta: https://github.com/Ramonzitooo
echo ========================================================
echo.

set "GH_EXE=C:\Program Files\GitHub CLI\gh.exe"
if not exist "%GH_EXE%" (
    set "GH_EXE=gh"
)

echo [1/4] Executando verificação de tipos e testes...
call npm run lint
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha na verificação de tipos ^(npm run lint^). Publicação abortada.
    pause
    exit /b 1
)
call npm test
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha nos testes ^(npm test^). Publicação abortada.
    pause
    exit /b 1
)

echo.
echo [2/4] Verificando autenticação no GitHub...
"%GH_EXE%" auth status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Você ainda não está autenticado no GitHub CLI.
    echo Abrindo autenticação via navegador...
    "%GH_EXE%" auth login --hostname github.com --git-protocol https --web
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERRO] Falha na autenticação do GitHub. Tente novamente.
        pause
        exit /b 1
    )
)

echo.
echo [3/4] Criando repositório público Ramonzitooo/fintrack e enviando código...
git remote remove origin >nul 2>&1
"%GH_EXE%" repo create Ramonzitooo/fintrack --public --source=. --remote=origin --push
if %ERRORLEVEL% NEQ 0 (
    echo Repositório já existente. Configurando remote e enviando branch main...
    git remote add origin https://github.com/Ramonzitooo/fintrack.git >nul 2>&1
    git push -u origin main
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERRO] Falha ao enviar código para o GitHub ^(git push^).
        pause
        exit /b 1
    )
)

echo.
echo [4/4] ========================================================
echo   SUCESSO! SEU APP ESTÁ PUBLICADO EM:
echo   https://github.com/Ramonzitooo/fintrack
echo ========================================================
start "" "https://github.com/Ramonzitooo/fintrack"
pause

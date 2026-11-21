@echo off
chcp 65001 > nul
title FinTrack — Servidor Local
echo ========================================================
echo   FINTRACK v4.0 — CONTROLE FINANCEIRO & PATRIMONIAL
echo ========================================================
echo.

if not exist node_modules (
    echo [0/2] Dependências não encontradas. Executando npm install...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERRO] Falha ao instalar dependências. Verifique o Node.js e tente novamente.
        pause
        exit /b 1
    )
)

echo [1/2] Agendando abertura do navegador em http://localhost:3000 ...
start /b "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"
echo [2/2] Iniciando servidor Vite local...
echo.
echo Pressione Ctrl+C nesta janela caso deseje encerrar.
echo.
call npm run dev
pause

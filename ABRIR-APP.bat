@echo off
chcp 65001 > nul
title FinTrack — Servidor Local
echo ========================================================
echo   FINTRACK v4.0 — CONTROLE FINANCEIRO & PATRIMONIAL
echo ========================================================
echo.
echo [1/2] Abrindo navegador em http://localhost:3000 ...
start http://localhost:3000
echo [2/2] Iniciando servidor Vite local...
echo.
echo Pressione Ctrl+C nesta janela caso deseje encerrar.
echo.
cmd /c npm run dev
pause

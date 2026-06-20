@echo off
title Parar OTTO Device Agent
color 0C

echo.
echo Parando tarefa OTTO Device Agent...
schtasks /End /TN "OTTO Device Agent" >nul 2>&1

echo.
echo Se ainda existir node.exe do OTTO rodando, feche pelo Gerenciador de Tarefas.
echo.
pause

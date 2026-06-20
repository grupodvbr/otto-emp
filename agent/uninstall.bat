@echo off
title Remover OTTO Device Agent
color 0C

echo.
echo ================================================
echo  REMOVENDO OTTO DEVICE AGENT
echo ================================================
echo.

schtasks /End /TN "OTTO Device Agent" >nul 2>&1
schtasks /Delete /TN "OTTO Device Agent" /F

echo.
echo Tarefa removida.
echo Agora voce pode apagar a pasta C:\OTTO-DEVICE
echo.
pause

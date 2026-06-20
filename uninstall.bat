@echo off
title Remover OTTO Device Agent
color 0C

echo.
echo ================================================
echo  REMOVENDO OTTO DEVICE AGENT
echo ================================================
echo.

schtasks /Delete /TN "OTTO Device Agent" /F

echo.
echo Tarefa removida.
echo.
echo Agora voce pode apagar a pasta:
echo C:\OTTO-DEVICE
echo.
pause

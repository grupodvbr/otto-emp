@echo off
title Parar OTTO Device Agent
color 0C

echo.
echo Parando OTTO Device Agent...
echo.

taskkill /F /IM node.exe /FI "WINDOWTITLE eq OTTO Device Agent" >nul 2>&1

for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| find "PID:"') do (
  echo Verificando processo node %%a
)

echo.
echo Se ainda estiver rodando, finalize pelo Gerenciador de Tarefas procurando node.exe.
echo.
pause

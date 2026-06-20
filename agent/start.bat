@echo off
title OTTO Device Agent
cd /d "%~dp0"
if not exist logs mkdir logs

echo [%date% %time%] Iniciando OTTO Device Agent >> logs\startup.log



node otto-device-agent.js >> logs\console.log 2>&1

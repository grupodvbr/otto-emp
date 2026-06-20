@echo off
title Instalador OTTO Device Agent
color 0A
cd /d "%~dp0"

echo.
echo ================================================
echo  INSTALANDO OTTO DEVICE AGENT
echo ================================================
echo.

echo Verificando Node.js...
node -v >nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado.
  echo Instalando Node.js LTS via winget...
  winget install OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
  echo.
  echo Se o comando node ainda nao funcionar, reinicie o computador e rode install.bat novamente.
  pause
  exit /b 1
)
echo Node.js encontrado.

echo.
echo Verificando NPM...
npm -v >nul 2>&1
if errorlevel 1 (
  echo NPM nao encontrado. Reinstale o Node.js LTS.
  pause
  exit /b 1
)
echo NPM encontrado.

echo.
echo Instalando dependencias do agente...
npm install
if errorlevel 1 (
  echo Falha ao instalar dependencias.
  pause
  exit /b 1
)

echo.
echo Verificando FFmpeg...
ffmpeg -version >nul 2>&1
if errorlevel 1 (
  echo FFmpeg nao encontrado.
  echo Tentando instalar via winget...
  winget install Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements
  echo Se o FFmpeg ainda nao funcionar, reinicie o computador.
) else (
  echo FFmpeg encontrado.
)

echo.
echo Criando pasta de logs...
if not exist logs mkdir logs

echo.
echo Criando tarefa para iniciar automaticamente no login...
schtasks /Delete /TN "OTTO Device Agent" /F >nul 2>&1
schtasks /Create /TN "OTTO Device Agent" /TR "\"%~dp0start.bat\"" /SC ONLOGON /RL HIGHEST /F
if errorlevel 1 (
  echo Nao foi possivel criar a tarefa automatica. Rode este instalador como administrador.
  pause
  exit /b 1
)

echo.
echo ================================================
echo  INSTALACAO CONCLUIDA
echo ================================================
echo.
echo O agente vai iniciar automaticamente no login do Windows.
echo Para iniciar agora, rode start.bat
echo.
pause

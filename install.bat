@echo off
title Instalador OTTO Device Agent
color 0A

echo.
echo ================================================
echo  INSTALANDO OTTO DEVICE AGENT
echo ================================================
echo.

cd /d "%~dp0"

echo Verificando Node.js...
node -v >nul 2>&1
if errorlevel 1 (
  echo.
  echo Node.js nao encontrado.
  echo Instale o Node.js LTS primeiro:
  echo https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo Node.js encontrado.
echo.

echo Verificando NPM...
npm -v >nul 2>&1
if errorlevel 1 (
  echo.
  echo NPM nao encontrado.
  pause
  exit /b 1
)

echo NPM encontrado.
echo.

echo Instalando dependencias...
npm install

echo.
echo Verificando FFmpeg...
ffmpeg -version >nul 2>&1
if errorlevel 1 (
  echo.
  echo FFmpeg nao encontrado.
  echo Tentando instalar via winget...
  winget install Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements

  echo.
  echo Se o FFmpeg ainda nao funcionar, reinicie o computador.
) else (
  echo FFmpeg encontrado.
)

echo.
echo Criando tarefa para iniciar automaticamente no login...

schtasks /Delete /TN "OTTO Device Agent" /F >nul 2>&1

schtasks /Create ^
 /TN "OTTO Device Agent" ^
 /TR "\"%~dp0start.bat\"" ^
 /SC ONLOGON ^
 /RL HIGHEST ^
 /F

echo.
echo ================================================
echo  INSTALACAO CONCLUIDA
echo ================================================
echo.
echo O agente foi instalado e vai iniciar automaticamente no login.
echo.
echo Para iniciar agora, execute:
echo start.bat
echo.
pause

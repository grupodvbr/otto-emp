OTTO DEVICE AGENT

USO AUTORIZADO
Instale somente em computador da empresa, com autorizacao e ciencia dos responsaveis.
O agente envia dados tecnicos do aparelho e, se AUDIO_ATIVO estiver true, captura audio do microfone configurado.

INSTALACAO RAPIDA
1. Extraia este ZIP em C:\OTTO-DEVICE ou rode o comando de instalacao pelo PowerShell.
2. Execute install.bat como administrador.
3. Confira config.json e ajuste EMPRESA, UNIDADE, SETOR e MIC_DEVICE.

LISTAR MICROFONES
ffmpeg -list_devices true -f dshow -i dummy

INSTALAR FFMPEG MANUALMENTE
winget install Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements

INICIAR MANUALMENTE
start.bat

REMOVER INICIALIZACAO AUTOMATICA
uninstall.bat

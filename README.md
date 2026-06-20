# OTTO EMP COMPLETO

Projeto pronto para subir no GitHub/Vercel e liberar o download do agente interno OTTO.

## Estrutura principal

```txt
public/
  index.html
  dashboard.html
  otto-device.zip
agent/
  config.json
  install.bat
  listar-microfones.bat
  otto-device-agent.js
  package.json
  README-INSTALACAO.txt
  start.bat
  stop.bat
  uninstall.bat
package.json
server.js
vercel.json
```

## Link do ZIP depois do deploy

```txt
https://otto-emp.vercel.app/otto-device.zip
```

## Instalar no computador

```powershell
$zip = "$env:TEMP\otto-device.zip"
$destino = "C:\OTTO-DEVICE"

Remove-Item $zip -Force -ErrorAction SilentlyContinue
Remove-Item $destino -Recurse -Force -ErrorAction SilentlyContinue

Invoke-WebRequest -Uri "https://otto-emp.vercel.app/otto-device.zip" -OutFile $zip
Expand-Archive -Path $zip -DestinationPath $destino -Force
Set-Location $destino
.\install.bat
```

## Observação importante

Instale somente em equipamentos autorizados da empresa. O agente envia dados técnicos e pode transmitir áudio se AUDIO_ATIVO estiver true no config.json.

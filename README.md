# OTTO WebSocket - Dispositivos em tempo real

Projeto completo para enviar dados de dispositivos para uma dashboard em tempo real usando WebSocket.

## Arquivos

```txt
otto-audio-ws/
├── package.json
├── server.js
├── .gitignore
└── public/
    ├── index.html
    └── dashboard.html
```

## Como rodar local

```bash
npm install
npm start
```

Depois abra:

```txt
http://localhost:3000
```

Dashboard:

```txt
http://localhost:3000/dashboard
```

Health:

```txt
http://localhost:3000/health
```

## Como publicar no Render

1. Crie um repositório no GitHub.
2. Envie todos os arquivos deste projeto.
3. Entre no Render.
4. Clique em New Web Service.
5. Selecione o repositório.
6. Configure:

```txt
Runtime: Node
Build Command: npm install
Start Command: npm start
```

7. Em Environment Variables, coloque:

```txt
OTTO_SECRET=otto_audio_2026
```

8. Faça o deploy.

Depois a URL ficará parecida com:

```txt
https://otto-audio-ws.onrender.com
```

Abra:

```txt
https://otto-audio-ws.onrender.com
```

E a dashboard:

```txt
https://otto-audio-ws.onrender.com/dashboard
```

## Importante

Este projeto deve rodar no Render, Railway ou VPS.

Não use Vercel para o WebSocket persistente.

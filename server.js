const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");

const app = express();

const PORT = process.env.PORT || 3000;
const SECRET = process.env.OTTO_SECRET || "otto_audio_2026";

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "OTTO WEBSOCKET",
    status: "online",
    port: PORT,
    time: new Date().toISOString()
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/dashboard.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

const server = http.createServer(app);

const wss = new WebSocket.Server({
  server
});

const dispositivos = new Map();
const dashboards = new Set();

function agoraISO() {
  return new Date().toISOString();
}

function enviar(ws, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;

  try {
    ws.send(JSON.stringify(payload));
    return true;
  } catch (error) {
    return false;
  }
}

function segundosDesde(dataISO) {
  if (!dataISO) return 999999;

  const ms = Date.now() - new Date(dataISO).getTime();

  if (!Number.isFinite(ms)) return 999999;

  return Math.max(0, Math.floor(ms / 1000));
}

function calcularStatus(item) {
  const segundos = segundosDesde(item.ultimoSinal);

  if (segundos <= 8) return "online";
  if (segundos <= 30) return "instavel";

  return "offline";
}

function montarLista() {
  return Array.from(dispositivos.values()).map((item) => ({
    id: item.id,
    nome: item.nome,
    empresa: item.empresa,
    unidade: item.unidade,
    setor: item.setor,
    tipo: item.tipo,
    observacao: item.observacao,
    navegador: item.navegador,
    sistema: item.sistema,
    larguraTela: item.larguraTela,
    alturaTela: item.alturaTela,
    ip: item.ip,
    primeiroSinal: item.primeiroSinal,
    ultimoSinal: item.ultimoSinal,
    segundosSemSinal: segundosDesde(item.ultimoSinal),
    status: calcularStatus(item)
  }));
}

function enviarDashboardUnico(ws) {
  enviar(ws, {
    type: "devices-list",
    devices: montarLista(),
    total: dispositivos.size,
    time: agoraISO()
  });
}

function enviarParaDashboards() {
  const payload = {
    type: "devices-list",
    devices: montarLista(),
    total: dispositivos.size,
    time: agoraISO()
  };

  for (const dashboard of dashboards) {
    enviar(dashboard, payload);
  }
}

function validar(ws, msg) {
  if (!msg || msg.secret !== SECRET) {
    enviar(ws, {
      type: "error",
      message: "Senha/secret inválido."
    });

    return false;
  }

  return true;
}

function pegarIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")?.[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket.remoteAddress ||
    ""
  );
}

function registrarDispositivo(ws, msg, req) {
  const id = String(msg.id || "").trim();

  if (!id) {
    enviar(ws, {
      type: "error",
      message: "ID do dispositivo não informado."
    });

    return;
  }

  const anterior = dispositivos.get(id);

  const item = {
    ws,
    id,
    nome: String(msg.nome || "DISPOSITIVO SEM NOME").trim(),
    empresa: String(msg.empresa || "").trim(),
    unidade: String(msg.unidade || "").trim(),
    setor: String(msg.setor || "").trim(),
    tipo: String(msg.tipo || "").trim(),
    observacao: String(msg.observacao || "").trim(),
    navegador: String(msg.navegador || "").trim(),
    sistema: String(msg.sistema || "").trim(),
    larguraTela: Number(msg.larguraTela || 0),
    alturaTela: Number(msg.alturaTela || 0),
    ip: pegarIP(req),
    primeiroSinal: anterior?.primeiroSinal || agoraISO(),
    ultimoSinal: agoraISO()
  };

  dispositivos.set(id, item);

  ws._ottoTipo = "dispositivo";
  ws._ottoId = id;

  enviar(ws, {
    type: "device-ok",
    id,
    status: "online",
    time: agoraISO()
  });

  enviarParaDashboards();
}

function registrarDashboard(ws) {
  dashboards.add(ws);

  ws._ottoTipo = "dashboard";

  enviar(ws, {
    type: "dashboard-ok",
    status: "conectado",
    time: agoraISO()
  });

  enviarDashboardUnico(ws);
}

function limparConexao(ws) {
  if (ws._ottoTipo === "dashboard") {
    dashboards.delete(ws);
  }

  if (ws._ottoTipo === "dispositivo") {
    const id = ws._ottoId;
    const item = dispositivos.get(id);

    if (item && item.ws === ws) {
      item.ws = null;
      item.ultimoSinal = agoraISO();
      dispositivos.set(id, item);
    }

    enviarParaDashboards();
  }
}

wss.on("connection", (ws, req) => {
  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (buffer) => {
    let msg = {};

    try {
      msg = JSON.parse(buffer.toString());
    } catch (error) {
      enviar(ws, {
        type: "error",
        message: "Mensagem inválida. Envie JSON."
      });

      return;
    }

    if (!validar(ws, msg)) return;

    if (msg.type === "dashboard-register") {
      registrarDashboard(ws);
      return;
    }

    if (msg.type === "device-register" || msg.type === "device-heartbeat") {
      registrarDispositivo(ws, msg, req);
      return;
    }

    if (msg.type === "devices-list-request") {
      enviarDashboardUnico(ws);
      return;
    }

    enviar(ws, {
      type: "error",
      message: "Tipo não reconhecido: " + msg.type
    });
  });

  ws.on("close", () => {
    limparConexao(ws);
  });

  ws.on("error", () => {
    limparConexao(ws);
  });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      try {
        ws.terminate();
      } catch (error) {}

      continue;
    }

    ws.isAlive = false;

    try {
      ws.ping();
    } catch (error) {}
  }
}, 30000);

setInterval(() => {
  enviarParaDashboards();
}, 3000);

server.listen(PORT, () => {
  console.log("========================================");
  console.log("OTTO WEBSOCKET ONLINE");
  console.log("PORTA:", PORT);
  console.log("INDEX: /");
  console.log("DASHBOARD: /dashboard");
  console.log("HEALTH: /health");
  console.log("========================================");
});

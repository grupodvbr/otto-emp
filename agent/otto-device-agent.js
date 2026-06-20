'use strict';

/*
  OTTO DEVICE AGENT
  Agente interno para computador Windows.

  Uso permitido: equipamentos autorizados da empresa, com ciência dos responsáveis.
  O agente envia dados técnicos e, se AUDIO_ATIVO=true no config.json, envia áudio do microfone configurado.
*/

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');
const WebSocket = require('ws');
const { machineIdSync } = require('node-machine-id');

const BASE_DIR = __dirname;
const CONFIG_PATH = path.join(BASE_DIR, 'config.json');
const LOG_DIR = path.join(BASE_DIR, 'logs');
const DEVICE_ID_PATH = path.join(BASE_DIR, 'device-id.txt');

let CONFIG = carregarConfig();
let ws = null;
let heartbeatTimer = null;
let reconnectTimer = null;
let ffmpegProcess = null;
let enviandoAudio = false;
let conectado = false;
let pacotesEnviados = 0;
let ultimoEnvio = null;
let deviceId = carregarDeviceId();
let encerrando = false;

garantirPastas();
log('===============================================');
log('OTTO DEVICE AGENT INICIADO');
log('===============================================');
log('Device ID: ' + deviceId);
log('Servidor: ' + CONFIG.WS_URL);
log('Empresa: ' + CONFIG.EMPRESA);
log('Unidade: ' + CONFIG.UNIDADE);
log('Setor: ' + CONFIG.SETOR);
log('Audio ativo: ' + CONFIG.AUDIO_ATIVO);

iniciar();

function carregarConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      console.error('Arquivo config.json não encontrado.');
      process.exit(1);
    }

    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const cfg = JSON.parse(raw);

    return {
      SECRET: cfg.SECRET || 'otto_audio_2026',
      WS_URL: cfg.WS_URL || 'wss://otto-audio-ws.onrender.com',

      EMPRESA: cfg.EMPRESA || 'MERCATTO RESTAURANTE',
      UNIDADE: cfg.UNIDADE || '',
      SETOR: cfg.SETOR || '',
      TIPO: cfg.TIPO || 'COMPUTADOR',
      NOME: cfg.NOME || os.hostname() || 'COMPUTADOR OTTO',
      OBSERVACAO: cfg.OBSERVACAO || '',

      HEARTBEAT_MS: Number(cfg.HEARTBEAT_MS || 3000),
      RECONNECT_MS: Number(cfg.RECONNECT_MS || 3000),

      AUDIO_ATIVO: cfg.AUDIO_ATIVO !== false,
      AUDIO_CHUNK_SECONDS: Number(cfg.AUDIO_CHUNK_SECONDS || 1),
      AUDIO_BITRATE: cfg.AUDIO_BITRATE || '48k',
      MIC_DEVICE: cfg.MIC_DEVICE || 'default',

      LOG_ATIVO: cfg.LOG_ATIVO !== false
    };
  } catch (error) {
    console.error('Erro ao carregar config.json:', error.message);
    process.exit(1);
  }
}

function garantirPastas() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function dataArquivoLog() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function log(msg) {
  const linha = `[${new Date().toISOString()}] ${msg}`;
  console.log(linha);

  if (CONFIG && CONFIG.LOG_ATIVO) {
    try {
      garantirPastas();
      fs.appendFileSync(path.join(LOG_DIR, dataArquivoLog() + '.log'), linha + '\n', 'utf8');
    } catch (error) {
      console.error('Erro ao gravar log:', error.message);
    }
  }
}

function carregarDeviceId() {
  try {
    if (fs.existsSync(DEVICE_ID_PATH)) {
      const salvo = fs.readFileSync(DEVICE_ID_PATH, 'utf8').trim();
      if (salvo) return salvo;
    }

    let machine = '';
    try {
      machine = machineIdSync({ original: true });
    } catch (error) {
      machine = os.hostname() + '-' + crypto.randomBytes(6).toString('hex');
    }

    const hash = crypto.createHash('sha256')
      .update(machine + '-' + os.hostname())
      .digest('hex')
      .slice(0, 12)
      .toUpperCase();

    const novo = 'OTTO-PC-' + hash;
    fs.writeFileSync(DEVICE_ID_PATH, novo, 'utf8');
    return novo;
  } catch (error) {
    return 'OTTO-PC-' + Date.now();
  }
}

function iniciar() {
  conectarWS();

  process.on('SIGINT', finalizar);
  process.on('SIGTERM', finalizar);

  process.on('uncaughtException', (error) => {
    log('ERRO NAO TRATADO: ' + (error && error.stack ? error.stack : String(error)));
  });

  process.on('unhandledRejection', (error) => {
    log('PROMISE REJEITADA: ' + String(error));
  });
}

function conectarWS() {
  if (encerrando) return;

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  log('Conectando WebSocket...');

  try {
    ws = new WebSocket(CONFIG.WS_URL, {
      perMessageDeflate: false
    });
  } catch (error) {
    log('Erro criando WebSocket: ' + error.message);
    agendarReconexao();
    return;
  }

  ws.on('open', () => {
    conectado = true;
    log('WebSocket conectado.');

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    enviar(payload('device-register'));
    iniciarHeartbeat();

    if (CONFIG.AUDIO_ATIVO) {
      iniciarAudio();
    }
  });

  ws.on('message', (data) => {
    let msg = {};

    try {
      msg = JSON.parse(String(data));
    } catch (error) {
      return;
    }

    if (msg.type === 'device-ok') {
      return;
    }

    if (msg.type === 'audio-ok') {
      return;
    }

    if (msg.type === 'error') {
      log('Erro recebido do servidor: ' + (msg.message || 'sem mensagem'));
    }
  });

  ws.on('close', () => {
    conectado = false;
    log('WebSocket desconectado.');
    pararHeartbeat();
    pararAudio();
    agendarReconexao();
  });

  ws.on('error', (error) => {
    conectado = false;
    log('Erro WebSocket: ' + error.message);
  });
}

function agendarReconexao() {
  if (encerrando) return;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  reconnectTimer = setTimeout(() => {
    conectarWS();
  }, CONFIG.RECONNECT_MS);
}

function iniciarHeartbeat() {
  pararHeartbeat();

  heartbeatTimer = setInterval(() => {
    enviar(payload('device-heartbeat'));
  }, CONFIG.HEARTBEAT_MS);

  enviar(payload('device-heartbeat'));
}

function pararHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function enviar(obj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  try {
    ws.send(JSON.stringify(obj));
    pacotesEnviados++;
    ultimoEnvio = new Date().toISOString();
    return true;
  } catch (error) {
    log('Erro ao enviar pacote: ' + error.message);
    return false;
  }
}

function payload(type) {
  return {
    type,
    secret: CONFIG.SECRET,

    id: deviceId,
    nome: CONFIG.NOME || os.hostname(),
    empresa: CONFIG.EMPRESA,
    unidade: CONFIG.UNIDADE,
    setor: CONFIG.SETOR,
    tipo: CONFIG.TIPO,
    observacao: CONFIG.OBSERVACAO,

    status: conectado ? 'online' : 'offline',
    sistema: detectarSistema(),
    navegador: 'AGENTE NODE INTERNO',
    hostname: os.hostname(),
    usuario: obterUsuario(),
    plataforma: os.platform(),
    arquitetura: os.arch(),
    release: os.release(),
    uptimeSistemaSegundos: Math.floor(os.uptime()),
    uptimeAgenteSegundos: Math.floor(process.uptime()),

    cpu: obterCpu(),
    memoria: obterMemoria(),
    rede: obterRede(),

    larguraTela: null,
    alturaTela: null,

    audioAtivo: enviandoAudio,
    audioMetodo: 'ffmpeg',
    microfone: CONFIG.MIC_DEVICE,

    pacotesEnviados,
    ultimoEnvio,

    timestamp: new Date().toISOString()
  };
}

function obterUsuario() {
  try {
    return os.userInfo().username;
  } catch (error) {
    return null;
  }
}

function detectarSistema() {
  const platform = os.platform();
  if (platform === 'win32') return 'Windows';
  if (platform === 'darwin') return 'macOS';
  if (platform === 'linux') return 'Linux';
  return platform;
}

function obterCpu() {
  try {
    const cpus = os.cpus() || [];
    return {
      modelo: cpus[0] ? cpus[0].model : null,
      nucleos: cpus.length,
      carga: os.loadavg()
    };
  } catch (error) {
    return null;
  }
}

function obterMemoria() {
  try {
    const total = os.totalmem();
    const livre = os.freemem();
    const usado = total - livre;
    return {
      totalBytes: total,
      livreBytes: livre,
      usadoBytes: usado,
      totalGB: Number((total / 1024 / 1024 / 1024).toFixed(2)),
      livreGB: Number((livre / 1024 / 1024 / 1024).toFixed(2)),
      usadoGB: Number((usado / 1024 / 1024 / 1024).toFixed(2)),
      usadoPercentual: Number(((usado / total) * 100).toFixed(2))
    };
  } catch (error) {
    return null;
  }
}

function obterRede() {
  try {
    const interfaces = os.networkInterfaces();
    const lista = [];

    Object.keys(interfaces).forEach((nome) => {
      interfaces[nome].forEach((item) => {
        if (!item.internal) {
          lista.push({
            nome,
            endereco: item.address,
            familia: item.family,
            mac: item.mac
          });
        }
      });
    });

    return lista;
  } catch (error) {
    return [];
  }
}

function ffmpegExiste() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

function iniciarAudio() {
  if (enviandoAudio || encerrando) return;

  if (!ffmpegExiste()) {
    log('FFmpeg não encontrado. Instale com: winget install Gyan.FFmpeg');
    return;
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    log('Áudio aguardando WebSocket conectar.');
    return;
  }

  log('Iniciando captura de áudio...');
  log('Microfone configurado: ' + CONFIG.MIC_DEVICE);

  enviandoAudio = true;

  const inputAudio = `audio=${CONFIG.MIC_DEVICE}`;

  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-f', 'dshow',
    '-i', inputAudio,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-b:a', CONFIG.AUDIO_BITRATE,
    '-f', 'webm',
    '-cluster_time_limit', String(CONFIG.AUDIO_CHUNK_SECONDS * 1000),
    'pipe:1'
  ];

  log('Comando FFmpeg: ffmpeg ' + args.join(' '));

  try {
    ffmpegProcess = spawn('ffmpeg', args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    enviandoAudio = false;
    log('Erro ao iniciar FFmpeg: ' + error.message);
    return;
  }

  let buffer = Buffer.alloc(0);
  const limiteChunkBytes = 60 * 1024;

  ffmpegProcess.stdout.on('data', (chunk) => {
    if (!chunk || chunk.length === 0) return;

    buffer = Buffer.concat([buffer, chunk]);

    if (buffer.length >= limiteChunkBytes) {
      enviarAudioChunk(buffer);
      buffer = Buffer.alloc(0);
    }
  });

  ffmpegProcess.stderr.on('data', (data) => {
    const texto = String(data || '').trim();
    if (texto) log('FFmpeg: ' + texto);
  });

  ffmpegProcess.on('close', (code) => {
    if (buffer.length > 0) {
      enviarAudioChunk(buffer);
      buffer = Buffer.alloc(0);
    }

    log('FFmpeg encerrado. Código: ' + code);
    ffmpegProcess = null;
    enviandoAudio = false;

    if (!encerrando && CONFIG.AUDIO_ATIVO && conectado) {
      setTimeout(() => iniciarAudio(), 3000);
    }
  });

  ffmpegProcess.on('error', (error) => {
    log('Erro no processo FFmpeg: ' + error.message);
    ffmpegProcess = null;
    enviandoAudio = false;
  });
}

function enviarAudioChunk(buffer) {
  if (!buffer || buffer.length === 0) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  enviar({
    type: 'device-audio-chunk',
    secret: CONFIG.SECRET,

    id: deviceId,
    nome: CONFIG.NOME || os.hostname(),
    empresa: CONFIG.EMPRESA,
    unidade: CONFIG.UNIDADE,
    setor: CONFIG.SETOR,
    tipo: CONFIG.TIPO,

    audio: {
      deviceId,
      mimeType: 'audio/webm',
      encoding: 'base64',
      size: buffer.length,
      base64: buffer.toString('base64'),
      origem: 'ffmpeg',
      microfone: CONFIG.MIC_DEVICE,
      enviadoEm: new Date().toISOString()
    },

    timestamp: new Date().toISOString()
  });
}

function pararAudio() {
  enviandoAudio = false;

  if (ffmpegProcess) {
    try {
      ffmpegProcess.kill('SIGTERM');
    } catch (error) {}
    ffmpegProcess = null;
  }
}

function finalizar() {
  encerrando = true;
  log('Finalizando OTTO DEVICE AGENT...');

  try {
    enviar(payload('device-stop'));
  } catch (error) {}

  pararHeartbeat();
  pararAudio();

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (ws) {
    try {
      ws.close();
    } catch (error) {}
  }

  setTimeout(() => process.exit(0), 500);
}

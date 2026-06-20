'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ZIP_PATH = path.join(PUBLIC_DIR, 'otto-device.zip');

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(PUBLIC_DIR, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.zip')) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="otto-device.zip"');
      res.setHeader('Cache-Control', 'public, max-age=60');
    }
  }


  
}));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    app: 'otto-emp',
    zipExists: fs.existsSync(ZIP_PATH),
    zipPath: '/otto-device.zip',
    now: new Date().toISOString()
  });
});

app.get('/otto-device.zip', (req, res) => {
  if (!fs.existsSync(ZIP_PATH)) {
    return res.status(404).send('Arquivo otto-device.zip nao encontrado em /public.');
  }

  return res.download(ZIP_PATH, 'otto-device.zip');
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`OTTO EMP rodando na porta ${PORT}`);
  });
}

/**
 * Servidor HTTP embutido.
 *
 * Expõe três rotas:
 *   GET /        → página de status do bot
 *   GET /qr      → QR Code para escanear (só aparece quando bot está desconectado)
 *   GET /health  → health check para o Railway saber que o processo está vivo
 */

const http  = require('http');
const QRCode = require('qrcode');

// Estado compartilhado com index.js
let _currentQr  = null;
let _botReady   = false;
let _botName    = 'Bot WhatsApp';

const PORT = process.env.PORT || 3000;

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function page(title, body, refresh = null) {
  const meta = refresh ? `<meta http-equiv="refresh" content="${refresh}">` : '';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${meta}
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #222;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      padding: 40px 48px;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,.10);
      max-width: 420px;
      width: 90%;
    }
    h1 { font-size: 1.6rem; margin-bottom: 10px; }
    p  { color: #555; font-size: .95rem; line-height: 1.5; margin-top: 8px; }
    .badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 99px;
      font-size: .8rem;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .green { background: #d4edda; color: #155724; }
    .yellow { background: #fff3cd; color: #856404; }
    .blue   { background: #cce5ff; color: #004085; }
    img { margin-top: 20px; width: 260px; height: 260px; border-radius: 8px; }
    small { display: block; margin-top: 16px; color: #999; font-size: .78rem; }
  </style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`;
}

// ─── Servidor ─────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // Health check — Railway usa isso para saber se o processo está vivo
  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', ready: _botReady, timestamp: new Date().toISOString() }));
    return;
  }

  // Página do QR Code / status
  if (url === '/' || url === '/qr') {
    // Bot já conectado
    if (_botReady) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page('Bot Online ✅', `
        <span class="badge green">● Online</span>
        <h1>✅ Bot Conectado!</h1>
        <p>${_botName} está online e respondendo normalmente.</p>
        <small>Atualize a página para checar o status.</small>
      `, 60));
      return;
    }

    // QR Code ainda não disponível
    if (!_currentQr) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page('Aguardando...', `
        <span class="badge yellow">⏳ Iniciando</span>
        <h1>Gerando QR Code...</h1>
        <p>O bot está inicializando. A página vai atualizar automaticamente.</p>
        <small>Isso pode levar até 30 segundos na primeira vez.</small>
      `, 4));
      return;
    }

    // Gera a imagem do QR Code
    try {
      const qrDataUrl = await QRCode.toDataURL(_currentQr, {
        width: 280,
        margin: 2,
        color: { dark: '#111', light: '#fff' },
      });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page('Escanear QR Code 📱', `
        <span class="badge blue">📱 Aguardando escaneamento</span>
        <h1>Escaneie o QR Code</h1>
        <p>Abra o WhatsApp → <strong>Dispositivos conectados</strong> → <strong>Conectar dispositivo</strong></p>
        <img src="${qrDataUrl}" alt="QR Code WhatsApp">
        <small>O QR Code expira em ~60s. A página atualiza automaticamente.</small>
      `, 28));
    } catch (err) {
      res.writeHead(500);
      res.end('Erro ao gerar QR Code: ' + err.message);
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// ─── API pública (chamada pelo index.js) ──────────────────────────────────────

function setQr(qr)      { _currentQr = qr; }
function setBotReady()  { _botReady = true; _currentQr = null; }
function setBotName(n)  { _botName = n; }
function setBotOffline(){ _botReady = false; }

function start() {
  server.listen(PORT, () => {
    console.log(`🌐 Servidor HTTP: http://localhost:${PORT}`);
    console.log(`   QR Code:       http://localhost:${PORT}/qr`);
  });
}

module.exports = { start, setQr, setBotReady, setBotName, setBotOffline };

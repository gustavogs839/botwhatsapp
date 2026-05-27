/**
 * Servidor HTTP embutido.
 *
 * Rotas:
 *   GET /        → status / QR Code
 *   GET /qr      → mesma coisa (alias)
 *   GET /reset   → confirmação de reset de sessão
 *   POST /reset  → executa o reset (apaga sessão e gera novo QR)
 *   GET /health  → health check para o Railway
 */

const http   = require('http');
const QRCode = require('qrcode');

// Estado compartilhado com index.js
let _currentQr      = null;
let _botReady       = false;
let _botName        = 'Bot WhatsApp';
let _resetCallback  = null; // função registrada pelo index.js

const PORT = process.env.PORT || 3000;

// ─── HTML helper ──────────────────────────────────────────────────────────────

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
      display: flex; align-items: center; justify-content: center;
      background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #222;
    }
    .card {
      background: #fff; border-radius: 16px;
      padding: 40px 48px; text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,.10);
      max-width: 420px; width: 90%;
    }
    h1 { font-size: 1.6rem; margin-bottom: 10px; }
    p  { color: #555; font-size: .95rem; line-height: 1.5; margin-top: 8px; }
    .badge {
      display: inline-block; padding: 4px 14px; border-radius: 99px;
      font-size: .8rem; font-weight: 600; margin-bottom: 20px;
    }
    .green  { background: #d4edda; color: #155724; }
    .yellow { background: #fff3cd; color: #856404; }
    .blue   { background: #cce5ff; color: #004085; }
    .red    { background: #f8d7da; color: #721c24; }
    img { margin-top: 20px; width: 260px; height: 260px; border-radius: 8px; }
    small { display: block; margin-top: 16px; color: #999; font-size: .78rem; }
    .btn {
      display: inline-block; margin-top: 20px; padding: 10px 24px;
      border-radius: 8px; font-size: .9rem; font-weight: 600;
      cursor: pointer; text-decoration: none; border: none;
    }
    .btn-red  { background: #dc3545; color: #fff; }
    .btn-gray { background: #6c757d; color: #fff; }
    .divider  { margin: 20px 0; border: none; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`;
}

// ─── Servidor ─────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url    = req.url.split('?')[0];
  const method = req.method.toUpperCase();

  // ── Health check ────────────────────────────────────────────────────────────
  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', ready: _botReady, timestamp: new Date().toISOString() }));
    return;
  }

  // ── POST /reset — executa o reset da sessão ─────────────────────────────────
  if (url === '/reset' && method === 'POST') {
    if (!_resetCallback) {
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page('Erro', '<h1>Reset indisponível</h1><p>O bot ainda está inicializando.</p>'));
      return;
    }
    // Dispara reset em background e responde imediatamente
    _resetCallback().catch(console.error);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page('Resetando... ⏳', `
      <span class="badge yellow">⏳ Resetando</span>
      <h1>Sessão apagada!</h1>
      <p>O bot vai gerar um novo QR Code em alguns segundos.</p>
      <small>Redirecionando para a página de QR Code...</small>
    `, 5));
    return;
  }

  // ── GET /reset — página de confirmação ──────────────────────────────────────
  if (url === '/reset' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page('Resetar Sessão ⚠️', `
      <span class="badge red">⚠️ Atenção</span>
      <h1>Resetar sessão?</h1>
      <p>Isso vai <strong>desconectar o WhatsApp atual</strong> e gerar um novo QR Code para escanear.</p>
      <p style="margin-top:8px">Use quando o bot estiver conectado à conta errada ou não estiver respondendo.</p>
      <hr class="divider">
      <form method="POST" action="/reset">
        <button type="submit" class="btn btn-red">🔄 Sim, resetar sessão</button>
      </form>
      <br>
      <a href="/" class="btn btn-gray">← Cancelar</a>
    `));
    return;
  }

  // ── GET / ou /qr — status / QR Code ─────────────────────────────────────────
  if (url === '/' || url === '/qr') {
    // Bot conectado
    if (_botReady) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page('Bot Online ✅', `
        <span class="badge green">● Online</span>
        <h1>✅ Bot Conectado!</h1>
        <p>${_botName} está online e respondendo normalmente.</p>
        <hr class="divider">
        <small>Atualize a página para checar o status.</small>
        <br>
        <a href="/reset" class="btn btn-gray" style="margin-top:12px;font-size:.8rem">⚙️ Resetar sessão</a>
      `, 60));
      return;
    }

    // QR ainda não disponível
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

    // Gera o QR Code como imagem
    try {
      const qrDataUrl = await QRCode.toDataURL(_currentQr, {
        width: 280, margin: 2,
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

function setQr(qr)             { _currentQr = qr; }
function setBotReady()         { _botReady = true; _currentQr = null; }
function setBotName(n)         { _botName = n; }
function setBotOffline()       { _botReady = false; }
function setResetCallback(fn)  { _resetCallback = fn; }

function start() {
  server.listen(PORT, () => {
    console.log(`🌐 Servidor HTTP: http://localhost:${PORT}`);
    console.log(`   QR Code:       http://localhost:${PORT}/qr`);
    console.log(`   Reset sessão:  http://localhost:${PORT}/reset`);
  });
}

module.exports = { start, setQr, setBotReady, setBotName, setBotOffline, setResetCallback };

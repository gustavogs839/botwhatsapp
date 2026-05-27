require('dotenv').config();

const fs      = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode  = require('qrcode-terminal');
const server  = require('./server');
const { chat, clearHistory, activeConversations } = require('./claude');
const config  = require('./studio-config');

// ─── Inicia o servidor HTTP (QR Code + health check) ─────────────────────────
server.setBotName(config.nome);
server.start();

// ─── Validação de ambiente ────────────────────────────────────────────────────
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌  ANTHROPIC_API_KEY não definida. Crie o arquivo .env com sua chave.');
  process.exit(1);
}

const OWNER_NUMBER = process.env.OWNER_PHONE_NUMBER
  ? `${process.env.OWNER_PHONE_NUMBER}@c.us`
  : null;

if (!OWNER_NUMBER) {
  console.warn('⚠️  OWNER_PHONE_NUMBER não definido. Notificações e comandos de handoff desativados.');
}

// ─── Cliente WhatsApp ─────────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    // Em produção (Docker/Railway) usa o Chromium instalado no sistema
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--disable-gpu',
      '--no-zygote',                // essencial para containers (Railway/Docker)
      '--disable-extensions',
    ],
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
//  CONTROLE DE HANDOFF (Bot ↔ Humano)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Números com o bot PAUSADO (atendente humano no controle).
 * Chave: phoneNumber ("5562...@c.us")
 * Valor: timestamp da pausa
 */
const humanControlled = new Map();

/** Timers de retomada automática do bot por número */
const humanControlTimers = new Map();

/** Marca quais números o bot está enviando agora — evita falso-positivo no auto-pause */
const botCurrentlySending = new Set();

const HANDOFF_TIMEOUT_MS = (config.handoff.retomarAposMinutos || 60) * 60 * 1000;

/**
 * Pausa o bot para um contato e inicia o timer de retomada automática.
 * @param {string} phoneNumber
 */
function pauseBot(phoneNumber) {
  humanControlled.set(phoneNumber, Date.now());

  // Reinicia o timer de retomada toda vez que o humano envia uma mensagem
  if (humanControlTimers.has(phoneNumber)) {
    clearTimeout(humanControlTimers.get(phoneNumber));
  }
  const timer = setTimeout(() => {
    resumeBot(phoneNumber, 'timeout automático');
  }, HANDOFF_TIMEOUT_MS);
  humanControlTimers.set(phoneNumber, timer);

  console.log(`🤚 Bot PAUSADO para ${fmt(phoneNumber)} — retoma em ${config.handoff.retomarAposMinutos}min de inatividade`);
}

/**
 * Reativa o bot para um contato.
 * @param {string} phoneNumber
 * @param {string} motivo - texto para o log
 */
function resumeBot(phoneNumber, motivo = 'manual') {
  if (!humanControlled.has(phoneNumber)) return;
  humanControlled.delete(phoneNumber);
  if (humanControlTimers.has(phoneNumber)) {
    clearTimeout(humanControlTimers.get(phoneNumber));
    humanControlTimers.delete(phoneNumber);
  }
  console.log(`🤖 Bot REATIVADO para ${fmt(phoneNumber)} (${motivo})`);
}

/** Verifica se o bot está pausado para um número */
function isBotPaused(phoneNumber) {
  return humanControlled.has(phoneNumber);
}

/** Formata número para exibição no log */
function fmt(phoneNumber) {
  return phoneNumber.replace('@c.us', '');
}

// ─── Auto-pause: detecta quando Gabriella digita manualmente ─────────────────
//
// O evento 'message_create' dispara para TODA mensagem, incluindo as enviadas
// pelo próprio celular. Quando o bot envia, ele marca o número em
// botCurrentlySending — assim sabemos que não foi a Gabriella quem digitou.
//
client.on('message_create', (message) => {
  if (!message.fromMe) return;                         // só saídas
  if (!message.to || message.to === message.from) return; // ignora mensagens pra si mesmo

  const phoneNumber = message.to;

  // Se o bot acabou de enviar para esse número, ignora (não é a Gabriella)
  if (botCurrentlySending.has(phoneNumber)) return;

  // Se a mensagem foi para a própria dona (comandos), ignora
  if (OWNER_NUMBER && phoneNumber === OWNER_NUMBER) return;

  // Chegou aqui = Gabriella digitou manualmente → pausa o bot
  if (!isBotPaused(phoneNumber)) {
    pauseBot(phoneNumber);
    console.log(`💡 Auto-pause ativado: Gabriella respondeu manualmente para ${fmt(phoneNumber)}`);
  } else {
    // Já pausado: reinicia o timer (ela continua respondendo)
    pauseBot(phoneNumber);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  COMANDOS DA GABRIELLA
// ═══════════════════════════════════════════════════════════════════════════════
//
// Gabriella envia comandos do celular PESSOAL dela para o WhatsApp do estúdio.
// O bot recebe como mensagem normal e interpreta se vier de OWNER_NUMBER.
//
// Comandos disponíveis:
//   !status              — lista contatos com bot pausado
//   !pausar 62912345678  — pausa o bot para um contato
//   !ativar 62912345678  — reativa o bot para um contato
//   !ativar todos        — reativa para todos
//   !ajuda               — lista de comandos
//

async function handleOwnerCommand(message, body) {
  const parts  = body.trim().split(/\s+/);
  const cmd    = parts[0].toLowerCase();
  const arg    = parts.slice(1).join(' ');
  const numArg = arg.replace(/\D/g, '');

  // !ajuda
  if (cmd === '!ajuda') {
    await message.reply(
      '🤖 *Comandos do Bot — Maria Gabriella Beauty Studio*\n\n' +
      '📋 *!status*\n   Ver quais contatos estão com o bot pausado\n\n' +
      '⏸️ *!pausar [numero]*\n   Pausa o bot para esse contato\n   Ex: !pausar 62981234567\n\n' +
      '▶️ *!ativar [numero]*\n   Reativa o bot para esse contato\n   Ex: !ativar 62981234567\n\n' +
      '▶️ *!ativar todos*\n   Reativa o bot para TODOS os contatos\n\n' +
      '🧪 *!testar*\n   Envia uma notificação de teste para verificar se as notificações estão funcionando\n\n' +
      '💡 *Dica:* quando você responde diretamente a uma cliente pelo celular do estúdio, ' +
      'o bot pausa automaticamente para ela e retoma após ' + config.handoff.retomarAposMinutos + ' min sem resposta sua.'
    );
    return;
  }

  // !status
  if (cmd === '!status') {
    if (humanControlled.size === 0) {
      await message.reply('✅ Bot ativo para todos os contatos. Nenhuma conversa pausada.');
    } else {
      const lista = [...humanControlled.entries()]
        .map(([num, ts]) => {
          const min = Math.round((Date.now() - ts) / 60000);
          return `• ${fmt(num)} (pausado há ${min} min)`;
        })
        .join('\n');
      await message.reply(
        `⏸️ *Bot pausado para ${humanControlled.size} contato(s):*\n\n${lista}\n\n` +
        `_Retomada automática em ${config.handoff.retomarAposMinutos}min de inatividade._`
      );
    }
    return;
  }

  // !pausar [numero]
  if (cmd === '!pausar') {
    if (!numArg) {
      await message.reply('❌ Informe o número. Ex: *!pausar 62981234567*');
      return;
    }
    const phoneNumber = `${numArg}@c.us`;
    pauseBot(phoneNumber);
    await message.reply(`⏸️ Bot pausado para *${numArg}*.\nUse *!ativar ${numArg}* para reativar.`);
    return;
  }

  // !ativar todos
  if (cmd === '!ativar' && arg.toLowerCase() === 'todos') {
    const total = humanControlled.size;
    [...humanControlled.keys()].forEach((n) => resumeBot(n, 'comando !ativar todos'));
    await message.reply(total > 0
      ? `▶️ Bot reativado para *${total} contato(s)*. Estou de volta! 🤖`
      : '✅ Nenhum contato estava pausado.');
    return;
  }

  // !ativar [numero]
  if (cmd === '!ativar') {
    if (!numArg) {
      await message.reply('❌ Informe o número. Ex: *!ativar 62981234567* ou *!ativar todos*');
      return;
    }
    const phoneNumber = `${numArg}@c.us`;
    if (!isBotPaused(phoneNumber)) {
      await message.reply(`ℹ️ O bot já estava ativo para *${numArg}*.`);
      return;
    }
    resumeBot(phoneNumber, 'comando !ativar');
    await message.reply(`▶️ Bot reativado para *${numArg}*. Vou retomar o atendimento! 🤖`);
    return;
  }

  // !testar — envia uma notificação de teste para si mesma
  if (cmd === '!testar') {
    await message.reply('🔄 Enviando notificação de teste...');
    await notificarProfissional(
      { nome: 'Ana Teste', numero: '5562900000001' },
      'Alongamento em Gel (TESTE)'
    );
    await message.reply('✅ Notificação de teste enviada! Verifique se chegou com o link clicável.');
    return;
  }

  // Comando desconhecido
  await message.reply('❓ Comando não reconhecido. Envie *!ajuda* para ver os comandos disponíveis.');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  NOTIFICAÇÃO DE AGENDAMENTO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve o número da profissional para o formato correto do WhatsApp.
 * Usa getNumberId() que valida se o número está registrado no WhatsApp.
 * O resultado é cacheado após a primeira consulta bem-sucedida.
 */
let ownerWhatsAppId = null; // cache do ID resolvido

async function resolverOwnerWhatsAppId() {
  if (ownerWhatsAppId) return ownerWhatsAppId;

  const raw = process.env.OWNER_PHONE_NUMBER;
  if (!raw) return null;

  try {
    const numberId = await client.getNumberId(raw);
    if (!numberId) {
      console.error(`❌ Número ${raw} não foi encontrado no WhatsApp.`);
      console.error('   Verifique se OWNER_PHONE_NUMBER está correto no .env');
      return null;
    }
    ownerWhatsAppId = numberId._serialized; // ex: "5562981234567@c.us"
    console.log(`✅ Número da profissional validado: ${ownerWhatsAppId}`);
    return ownerWhatsAppId;
  } catch (err) {
    console.error(`❌ Erro ao validar OWNER_PHONE_NUMBER (${raw}):`, err.message);
    return null;
  }
}

/**
 * Extrai o número de telefone real de um contato WhatsApp.
 * Necessário porque o WhatsApp pode retornar IDs no formato @lid
 * (ex: "74174118768756@lid") em vez do número real (@c.us).
 *
 * @param {import('whatsapp-web.js').Message} message
 * @returns {Promise<{ nome: string, numero: string|null }>}
 */
async function resolverInfoContato(message) {
  try {
    const contact = await message.getContact();
    const nome = contact.pushname || contact.name || message._data?.notifyName || 'Cliente';

    // contact.number é o número real quando disponível
    let numero = contact.number?.replace(/\D/g, '') || '';

    // Números de telefone brasileiros têm no máximo 13 dígitos (55 + DDD + número)
    // IDs @lid costumam ter 14+ dígitos — descartamos nesses casos
    if (numero.length > 13) {
      const serialized = contact.id?._serialized || '';
      numero = serialized.endsWith('@c.us') ? contact.id.user : '';
    }

    return { nome, numero: numero || null };
  } catch {
    return { nome: message._data?.notifyName || 'Cliente', numero: null };
  }
}

/**
 * Formata um número de telefone brasileiro para exibição legível.
 * Entrada: "5562981794239"  →  Saída: "(62) 98179-4239"
 * @param {string|null} numero - Apenas dígitos
 * @returns {string}
 */
function formatarTelefone(numero) {
  if (!numero) return '_não disponível_';
  const d = numero.replace(/\D/g, '');
  // Remove o código do país (55) se houver
  const local = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return d;
}

/**
 * Envia notificação de agendamento para a profissional.
 * @param {{ nome: string, numero: string|null }} clienteInfo
 * @param {string} servico
 */
async function notificarProfissional(clienteInfo, servico) {
  if (!OWNER_NUMBER) return;

  const { nome, numero } = clienteInfo;
  const numeroFormatado = formatarTelefone(numero);
  const waLink = numero
    ? `https://wa.me/${numero}`
    : '_link indisponível_';

  const texto = config.mensagens.handoffProfissional
    .replace('{nomeCliente}',     nome)
    .replace('{numeroFormatado}', numeroFormatado)
    .replace('{servico}',         servico)
    .replace('{waLink}',          waLink);

  try {
    const destino = await resolverOwnerWhatsAppId();
    if (!destino) {
      console.error('❌ Notificação cancelada: número da profissional inválido.');
      return;
    }
    await client.sendMessage(destino, texto);
    console.log(`🔔 Gabriella notificada — ${nome} (${numeroFormatado}) quer: ${servico}`);
  } catch (err) {
    console.error('❌ Falha ao notificar profissional:', err.message);
    console.error('   Número configurado:', process.env.OWNER_PHONE_NUMBER);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONTROLES DE FLUXO
// ═══════════════════════════════════════════════════════════════════════════════

const processing       = new Set();
const inactivityTimers = new Map();

function resetInactivityTimer(phoneNumber) {
  if (inactivityTimers.has(phoneNumber)) clearTimeout(inactivityTimers.get(phoneNumber));
  const ms = config.ia.inactividadeMinutos * 60 * 1000;
  const timer = setTimeout(() => {
    clearHistory(phoneNumber);
    inactivityTimers.delete(phoneNumber);
  }, ms);
  inactivityTimers.set(phoneNumber, timer);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EVENTOS DO WHATSAPP
// ═══════════════════════════════════════════════════════════════════════════════

client.on('qr', (qr) => {
  server.setQr(qr); // disponibiliza para a página web
  console.log('\n📱 QR Code disponível em: http://localhost:' + (process.env.PORT || 3000) + '/qr');
  console.log('   (ou escaneie diretamente abaixo)\n');
  qrcode.generate(qr, { small: true }); // também exibe no terminal (útil localmente)
});

client.on('loading_screen', (percent, message) => {
  process.stdout.write(`\r⏳ Carregando WhatsApp Web: ${percent}% — ${message}   `);
});

client.on('authenticated', () => {
  console.log('\n✅ Autenticado! Sessão salva em .wwebjs_auth/');
});

client.on('auth_failure', (msg) => {
  console.error('\n❌ Falha de autenticação:', msg);
  process.exit(1);
});

client.on('ready', () => {
  server.setBotReady(); // atualiza a página web para "Bot Online"
  console.log(`\n✨ Bot ${config.nome} está online!`);
  console.log(`📊 Conversas ativas no cache: ${activeConversations()}`);
  console.log(`🤖 Modelo IA: ${config.ia.modelo}`);
  console.log(`⏱️  Retomada automática após: ${config.handoff.retomarAposMinutos} min de inatividade`);
  OWNER_NUMBER
    ? console.log(`🔔 Comandos e alertas para: ${fmt(OWNER_NUMBER)}`)
    : console.log('🔕 OWNER_PHONE_NUMBER não configurado — comandos !pausar/!ativar desativados');
  console.log('─────────────────────────────────────────────────\n');
  if (OWNER_NUMBER) {
    console.log('💡 Envie !ajuda para o WhatsApp do estúdio para ver os comandos disponíveis.\n');
  }
});

client.on('disconnected', (reason) => {
  server.setBotOffline(); // volta para o estado "aguardando"
  console.warn('\n⚠️  Desconectado:', reason);
  console.log('Reconectando em 5 segundos...');
  setTimeout(() => client.initialize(), 5000);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PROCESSAMENTO DE MENSAGENS RECEBIDAS
// ═══════════════════════════════════════════════════════════════════════════════

client.on('message', async (message) => {
  if (message.isGroupMsg || message.fromMe || message.isStatus) return;
  const body = message.body?.trim();
  if (!body) return;

  const phoneNumber = message.from;
  const contactName = message._data?.notifyName || 'Cliente';

  // ── Mensagens da Gabriella (celular pessoal → WhatsApp do estúdio) ──────────
  if (OWNER_NUMBER && phoneNumber === OWNER_NUMBER) {
    if (body.startsWith('!')) {
      console.log(`\n⚙️  Comando de Gabriella: ${body}`);
      await handleOwnerCommand(message, body);
    } else {
      // Mensagem não é um comando — ignora sem responder com IA
      console.log(`\n👤 Mensagem de Gabriella ignorada (não é comando): "${body.substring(0, 40)}"`);
    }
    return; // sempre encerra aqui para mensagens da dona
  }

  // ── Bot pausado para esse contato? ────────────────────────────────────────
  if (isBotPaused(phoneNumber)) {
    console.log(`\n⏸️  [${contactName}] Mensagem ignorada — humano no controle`);
    return;
  }

  // ── Sem processamento paralelo na mesma conversa ──────────────────────────
  if (processing.has(phoneNumber)) return;
  processing.add(phoneNumber);

  console.log(`\n📩 [${new Date().toLocaleTimeString('pt-BR')}] ${contactName}: ${body}`);

  try {
    const chatObj = await message.getChat();
    await chatObj.sendStateTyping();

    // Gera resposta via Claude
    const { reply, agendarServico } = await chat(phoneNumber, body);

    // Marca como "bot enviando" antes de enviar (evita falso-positivo no auto-pause)
    botCurrentlySending.add(phoneNumber);
    await message.reply(reply);
    // Remove a marca após 3 segundos (margem para o evento message_create disparar)
    setTimeout(() => botCurrentlySending.delete(phoneNumber), 3000);

    console.log(`💬 → ${contactName}: ${reply.substring(0, 100)}${reply.length > 100 ? '…' : ''}`);

    // Notifica Gabriella se a cliente quer agendar
    if (agendarServico) {
      console.log(`📅 Intenção de agendamento: "${agendarServico}"`);
      const clienteInfo = await resolverInfoContato(message);
      await notificarProfissional(clienteInfo, agendarServico);
    }

    resetInactivityTimer(phoneNumber);
  } catch (error) {
    console.error(`❌ Erro ao processar mensagem de ${contactName}:`, error.message);
    botCurrentlySending.delete(phoneNumber);
    try {
      await message.reply('Oi! 😊 Tive uma instabilidade aqui. Pode repetir sua mensagem? ✨');
    } catch (_) { /* ignora */ }
  } finally {
    processing.delete(phoneNumber);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  RESET DE SESSÃO (via página /reset)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Apaga a sessão do WhatsApp salva e reinicializa o cliente.
 * Isso fará aparecer um novo QR Code na página /qr.
 */
async function resetSession() {
  console.log('\n🔄 Resetando sessão do WhatsApp...');
  server.setBotOffline();

  try {
    await client.destroy();
  } catch (e) {
    console.warn('Aviso ao destruir cliente:', e.message);
  }

  // Apaga a pasta de sessão
  const authPath = './.wwebjs_auth';
  try {
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
    }
    fs.mkdirSync(authPath, { recursive: true });
    console.log('✅ Sessão apagada com sucesso.');
  } catch (e) {
    console.error('Erro ao apagar sessão:', e.message);
  }

  // Reinicializa após 2s para o destroy completar
  console.log('⏳ Reinicializando cliente em 2s...');
  setTimeout(() => client.initialize(), 2000);
}

// Registra o callback de reset no servidor HTTP
server.setResetCallback(resetSession);

// ═══════════════════════════════════════════════════════════════════════════════
//  INICIALIZAÇÃO E SHUTDOWN
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`🚀 Iniciando bot ${config.nome}...`);
client.initialize();

async function shutdown() {
  console.log('\n\n👋 Encerrando bot...');
  await client.destroy();
  process.exit(0);
}
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

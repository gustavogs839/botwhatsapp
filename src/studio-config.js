/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          CONFIGURAÇÃO DO ESTÚDIO — edite aqui livremente        ║
 * ║  Não precisa mexer em nenhum outro arquivo para alterar dados.  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Após salvar, reinicie o bot com: npm start
 */

module.exports = {

  // ── Identidade ────────────────────────────────────────────────────────────
  nome: 'Maria Gabriella Beauty Studio',
  nomeProfissional: 'Gabriella',
  especialidade: 'Nails & Lashes',
  bio: 'Especialista em nail design e lash design com mais de 2.000 atendimentos realizados. Avaliação 5 estrelas das clientes. ✨',

  // ── Contato e redes sociais ───────────────────────────────────────────────
  whatsapp: '(62) 98179-4239',
  instagram: '@studio_maria_gabriella',
  linkMapa: 'https://maps.app.goo.gl/', // substitua pelo link real do Maps/Waze do site

  // ── Endereço ──────────────────────────────────────────────────────────────
  endereco: 'Goiânia - GO (localização completa disponível via Google Maps e Waze no site)',
  linkSite: 'https://mariagabriellabeauty.vercel.app/',

  // ── Horários de funcionamento ─────────────────────────────────────────────
  horarios: {
    'Segunda a Domingo': '09h às 19h',
  },
  obs_horario: 'Atendimento exclusivamente com agendamento prévio.',

  // ── Serviços e preços ─────────────────────────────────────────────────────
  servicos: [
    // UNHAS
    { nome: 'Manicure Tradicional',        categoria: 'Unhas',    preco: 40,   obs: null },
    { nome: 'Blindagem',                   categoria: 'Unhas',    preco: 120,  obs: null },
    { nome: 'Alongamento em Gel',          categoria: 'Unhas',    preco: 190,  obs: null },
    { nome: 'Manutenção em Gel',           categoria: 'Unhas',    preco: 150,  obs: null },

    // PEDICURE
    { nome: 'Pedicure',                    categoria: 'Pedicure', preco: 45,   obs: null },
    { nome: 'Spa dos Pés',                 categoria: 'Pedicure', preco: 135,  obs: null },
    { nome: 'Manicure + Pedicure',         categoria: 'Pedicure', preco: 95,   obs: null },

    // CÍLIOS
    { nome: 'Extensão Fio a Fio',          categoria: 'Cílios',   preco: 150,  obs: null },
    { nome: 'Volume Russo',                categoria: 'Cílios',   preco: 190,  obs: null },
    { nome: 'Volume Brasileiro',           categoria: 'Cílios',   preco: 150,  obs: null },
    { nome: 'Mega Brasileiro',             categoria: 'Cílios',   preco: 220,  obs: null },
    { nome: 'Efeito Fox',                  categoria: 'Cílios',   preco: 190,  obs: null },
    { nome: 'Volume 3D',                   categoria: 'Cílios',   preco: 150,  obs: null },
    { nome: 'Volume 4D',                   categoria: 'Cílios',   preco: 180,  obs: null },
    { nome: 'Volume 5D',                   categoria: 'Cílios',   preco: 190,  obs: null },
  ],

  // ── Diferenciais do estúdio ───────────────────────────────────────────────
  diferenciais: [
    'Materiais esterilizados e seguros',
    'Técnicas modernas com acabamento delicado',
    'Ambiente acolhedor e moderno',
    'Opções para eventos e manutenção',
    'Mais de 2.000 atendimentos realizados',
    'Avaliação 5 estrelas das clientes',
  ],

  // ── Regras e políticas ────────────────────────────────────────────────────
  regras: [
    'Atendimento exclusivamente com agendamento prévio.',
    'Manutenções e encaixes disponíveis sob consulta.',
    'Sinal pode ser solicitado para horários especiais.',
    'Cancelamentos devem ser avisados com antecedência.',
  ],

  // ── Mensagens personalizadas ──────────────────────────────────────────────
  mensagens: {
    // Mensagem enviada à CLIENTE quando ela quer agendar
    handoffCliente:
      'Que ótimo! 💅 Já avisei a {nomeProfissional} sobre o seu interesse em {servico}. ' +
      'Ela vai entrar em contato com você em breve para confirmar o melhor horário. ' +
      'Qualquer dúvida, é só chamar! ✨',

    // Mensagem enviada à PROFISSIONAL no WhatsApp dela.
    // Placeholders disponíveis:
    //   {nomeCliente}     → nome do WhatsApp da cliente
    //   {numeroFormatado} → ex: (62) 98179-4239
    //   {servico}         → serviço que a cliente quer
    //   {waLink}          → link wa.me para abrir a conversa com 1 toque
    handoffProfissional:
      '🔔 *Nova solicitação de agendamento!*\n\n' +
      '👤 *Cliente:* {nomeCliente}\n' +
      '📱 *Número:* {numeroFormatado}\n' +
      '💅 *Serviço:* {servico}\n\n' +
      '👇 *Toque para abrir a conversa:*\n' +
      '{waLink}\n\n' +
      '_Bot Maria Gabriella Beauty Studio_',
  },

  // ── Comportamento da IA ───────────────────────────────────────────────────
  ia: {
    // Modelo Claude a usar. Opções:
    //   'claude-haiku-4-5-20251001'  → mais rápido e barato
    //   'claude-sonnet-4-6'          → equilibrado (recomendado) ✅
    //   'claude-opus-4-7'            → mais inteligente, mais caro
    modelo: 'claude-sonnet-4-6',

    // Tamanho máximo da resposta em tokens
    maxTokens: 512,

    // Quantas mensagens do histórico manter por conversa
    maxHistorico: 20,

    // Apagar histórico após X minutos de inatividade do cliente
    inactividadeMinutos: 120,
  },

  // ── Controle humano (handoff) ─────────────────────────────────────────────
  handoff: {
    // Após quantos minutos sem resposta humana o bot retoma automaticamente
    // (conta a partir da última mensagem que a Gabriella enviou)
    retomarAposMinutos: 60,

    // Mensagem enviada à CLIENTE quando o bot é pausado automaticamente
    // (deixe null para não enviar nenhuma mensagem)
    avisoClientePausado: null,

    // Mensagem enviada à CLIENTE quando o bot é reativado
    // (deixe null para não enviar nenhuma mensagem)
    avisoClienteReativado: null,
  },
};

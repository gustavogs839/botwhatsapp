const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT } = require('./persona');
const config = require('./studio-config');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Histórico de conversas por número de telefone
const conversationHistory = new Map();

/**
 * Detecta e extrai a tag [AGENDAR:serviço] da resposta da IA.
 * Retorna { replyLimpa, agendarServico } onde agendarServico é null se não houver intenção.
 *
 * @param {string} text
 * @returns {{ replyLimpa: string, agendarServico: string|null }}
 */
function extrairIntencaoAgendamento(text) {
  const match = text.match(/\[AGENDAR:([^\]]+)\]/i);
  if (!match) return { replyLimpa: text.trim(), agendarServico: null };

  // Remove a tag da resposta que será enviada à cliente
  const replyLimpa = text.replace(/\s*\[AGENDAR:[^\]]+\]/i, '').trim();
  const agendarServico = match[1].trim();

  return { replyLimpa, agendarServico };
}

/**
 * Envia uma mensagem para o Claude e retorna a resposta processada.
 *
 * @param {string} phoneNumber - Número do WhatsApp da cliente (ex: "5562999999999@c.us")
 * @param {string} userMessage - Texto enviado pela cliente
 * @returns {Promise<{ reply: string, agendarServico: string|null }>}
 *   reply          → texto a enviar para a cliente (sem a tag oculta)
 *   agendarServico → nome do serviço se houver intenção de agendar, caso contrário null
 */
async function chat(phoneNumber, userMessage) {
  if (!conversationHistory.has(phoneNumber)) {
    conversationHistory.set(phoneNumber, []);
  }

  const history = conversationHistory.get(phoneNumber);
  history.push({ role: 'user', content: userMessage });

  try {
    const response = await anthropic.messages.create({
      model:      config.ia.modelo,
      max_tokens: config.ia.maxTokens,
      system:     SYSTEM_PROMPT,
      messages:   history,
    });

    const rawText = response.content[0].text;
    const { replyLimpa, agendarServico } = extrairIntencaoAgendamento(rawText);

    // Salva a versão limpa no histórico (sem a tag oculta)
    history.push({ role: 'assistant', content: replyLimpa });

    // Mantém apenas as últimas N mensagens
    const max = config.ia.maxHistorico;
    if (history.length > max) {
      history.splice(0, history.length - max);
    }

    return { reply: replyLimpa, agendarServico };
  } catch (error) {
    // Remove a última mensagem do usuário se a chamada falhou
    history.pop();
    console.error(`[Claude] Erro para ${phoneNumber}:`, error.message);
    throw error;
  }
}

/**
 * Limpa o histórico de uma conversa (chamado após inatividade).
 * @param {string} phoneNumber
 */
function clearHistory(phoneNumber) {
  conversationHistory.delete(phoneNumber);
  console.log(`[Claude] Histórico apagado para ${phoneNumber}`);
}

/**
 * Número de conversas com histórico ativo.
 */
function activeConversations() {
  return conversationHistory.size;
}

module.exports = { chat, clearHistory, activeConversations };

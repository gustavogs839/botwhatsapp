# 💅 Bot WhatsApp — Maria Gabriella Beauty Studio

Bot de atendimento automático via WhatsApp Web com IA (Claude da Anthropic).

---

## 🚀 Como configurar e rodar

### 1. Pré-requisitos

- [Node.js](https://nodejs.org/) **v18 ou superior**
- API Key da [Anthropic](https://console.anthropic.com/) (com créditos)
- WhatsApp instalado no celular do estúdio

### 2. Instalar dependências

```bash
npm install
```

> ⚠️ O `whatsapp-web.js` baixa o Chromium automaticamente (~150 MB). Aguarde a instalação.

### 3. Configurar variáveis de ambiente

```bash
copy .env.example .env
```

Abra `.env` e preencha:

```env
ANTHROPIC_API_KEY=sk-ant-SUA_CHAVE_AQUI
OWNER_PHONE_NUMBER=5562999999999   # número da Gabriella (recebe alertas de agendamento)
```

### 4. Rodar o bot

```bash
npm start
```

### 5. Escanear o QR Code

1. QR Code aparece no terminal.
2. No celular: **WhatsApp → Dispositivos conectados → Conectar dispositivo**.
3. Escaneie o QR Code.
4. Aguarde: `✨ Bot online!`

> A sessão é salva em `.wwebjs_auth/`. Na próxima vez **não precisa escanear de novo**.

---

## 📁 Estrutura do projeto

```
botwhatsapp/
├── src/
│   ├── studio-config.js  ⭐  EDITE AQUI — preços, serviços, horários, mensagens
│   ├── persona.js            Constrói o prompt da IA a partir do config
│   ├── claude.js             Integração Claude API (histórico por cliente)
│   └── index.js              Cliente WhatsApp, QR Code, roteamento
├── .env                      Suas credenciais (nunca commitar)
├── .env.example
└── package.json
```

---

## ✏️ Como personalizar

**Para alterar preços, serviços, horários, mensagens ou modelo de IA:**

Edite apenas o arquivo `src/studio-config.js` — está totalmente comentado e organizado por seções.

| O que alterar | Onde no arquivo |
|---|---|
| Preços e serviços | `servicos: [...]` |
| Horários | `horarios: {...}` |
| Endereço | `endereco:` |
| Mensagem enviada à cliente | `mensagens.handoffCliente` |
| Mensagem enviada à Gabriella | `mensagens.handoffProfissional` |
| Modelo de IA (velocidade/qualidade) | `ia.modelo` |

---

## 🔄 Fluxo de atendimento

```
Cliente envia mensagem
        │
        ▼
   Bot responde com IA
   (dúvidas, preços, info)
        │
        ▼
  Cliente quer agendar?
   ┌────┴────┐
  NÃO      SIM
   │         │
   │    Bot avisa a cliente
   │    + envia alerta no
   │    WhatsApp da Gabriella
   │         │
   └────┬────┘
        ▼
  Gabriella assume a conversa
  e confirma o horário manualmente
```

---

## 🤖 Modelos de IA disponíveis

Altere `ia.modelo` em `studio-config.js`:

| Modelo | Velocidade | Custo | Ideal para |
|---|---|---|---|
| `claude-haiku-4-5-20251001` | ⚡⚡⚡ Rápido | 💰 Mais barato | Respostas simples |
| `claude-sonnet-4-6` ✅ | ⚡⚡ Equilibrado | 💰💰 Moderado | **Recomendado** |
| `claude-opus-4-7` | ⚡ Mais lento | 💰💰💰 Premium | Respostas mais elaboradas |

---

## 🔄 Manter rodando em produção (PM2)

```bash
npm install -g pm2
pm2 start src/index.js --name beauty-bot
pm2 save
pm2 startup
```

---

## ❓ Problemas comuns

| Problema | Solução |
|---|---|
| QR Code não aparece | Aguarde 30-60s; o Chromium precisa inicializar |
| `Session closed` | Delete `.wwebjs_auth/` e escaneie novamente |
| API Key inválida | Verifique o `.env` e seu saldo na Anthropic Console |
| Notificação não chega | Confira o `OWNER_PHONE_NUMBER` no `.env` (só números) |

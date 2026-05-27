# ── Build stage: instala dependências ────────────────────────────────────────
FROM node:20-slim AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-slim

# Instala Chromium e fontes necessárias para o Puppeteer
RUN apt-get update && apt-get install -y \
      chromium \
      fonts-noto-color-emoji \
      fonts-noto-cjk \
      ca-certificates \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Diz ao Puppeteer para usar o Chromium do sistema (não baixar um próprio)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copia dependências do stage anterior
COPY --from=deps /app/node_modules ./node_modules

# Copia código fonte
COPY src/ ./src/
COPY package.json ./

# Pasta de sessão do WhatsApp (volume do Railway será montado aqui)
RUN mkdir -p .wwebjs_auth

# Porta exposta (Railway define a porta via env PORT)
EXPOSE 3000

# Usuário não-root por segurança
RUN groupadd -r botuser && useradd -r -g botuser -G audio,video botuser \
    && chown -R botuser:botuser /app
USER botuser

CMD ["node", "src/index.js"]

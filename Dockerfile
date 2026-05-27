FROM node:20-slim

# Instala Chromium e TODAS as dependências de sistema que ele precisa
RUN apt-get update && apt-get install -y \
      chromium \
      fonts-noto-color-emoji \
      ca-certificates \
      libglib2.0-0 \
      libnss3 \
      libnspr4 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libcups2 \
      libdrm2 \
      libdbus-1-3 \
      libxcb1 \
      libxkbcommon0 \
      libx11-6 \
      libxcomposite1 \
      libxdamage1 \
      libxext6 \
      libxfixes3 \
      libxrandr2 \
      libgbm1 \
      libpango-1.0-0 \
      libcairo2 \
      libasound2 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Diz ao Puppeteer para usar o Chromium do sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Instala dependências Node
COPY package*.json ./
RUN npm ci --only=production

# Copia o código
COPY src/ ./src/

# Cria a pasta de sessão do WhatsApp (volume do Railway será montado aqui)
RUN mkdir -p .wwebjs_auth

# Porta (Railway injeta a variável PORT automaticamente)
EXPOSE 3000

# Roda como root — necessário para o Chromium funcionar sem sandbox em containers
CMD ["node", "src/index.js"]

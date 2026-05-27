FROM node:20

# Instala apenas as BIBLIOTECAS DE SISTEMA que o Chrome precisa
# (não instala o Chromium via apt — o Puppeteer baixa o próprio Chrome compatível)
RUN apt-get update && apt-get install -y \
      ca-certificates \
      fonts-liberation \
      libappindicator3-1 \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libc6 \
      libcairo2 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
      libexpat1 \
      libfontconfig1 \
      libgbm1 \
      libgcc1 \
      libglib2.0-0 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libpango-1.0-0 \
      libpangocairo-1.0-0 \
      libstdc++6 \
      libx11-6 \
      libx11-xcb1 \
      libxcb1 \
      libxcomposite1 \
      libxcursor1 \
      libxdamage1 \
      libxext6 \
      libxfixes3 \
      libxi6 \
      libxkbcommon0 \
      libxrandr2 \
      libxrender1 \
      libxss1 \
      libxtst6 \
      lsb-release \
      wget \
      xdg-utils \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia os manifestos de dependências
COPY package*.json ./

# npm ci instala as deps E o Puppeteer baixa o Chrome compatível automaticamente
RUN npm ci --only=production

# Copia o código fonte
COPY src/ ./src/

# Cria a pasta de sessão do WhatsApp
RUN mkdir -p .wwebjs_auth

EXPOSE 3000
CMD ["node", "src/index.js"]

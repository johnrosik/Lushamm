# Dockerfile otimizado para produção
FROM node:18-alpine AS build

# Instalar dependências do sistema
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    vips-dev

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código fonte
COPY src/ ./src/
COPY *.ts ./

# Build da aplicação
RUN npm run build

# Imagem final
FROM node:18-alpine AS production

# Instalar dependências de runtime
RUN apk add --no-cache \
    vips \
    dumb-init

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Copiar arquivos de produção
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./

# Criar diretórios necessários
RUN mkdir -p uploads temp && \
    chown -R nodejs:nodejs uploads temp

# Expor porta
EXPOSE 3001

# Usar usuário não-root
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Usar dumb-init para proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Comando de start
CMD ["node", "dist/server.js"]

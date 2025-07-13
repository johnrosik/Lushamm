#!/bin/bash

# Script de deploy automatizado para Oracle Cloud
# Execute: chmod +x deploy.sh && ./deploy.sh

set -e

echo "🚀 Iniciando deploy do LUSHAMM RPG Backend na Oracle Cloud..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    error "Execute este script no diretório raiz do backend"
fi

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    error "Docker não está instalado. Instale o Docker primeiro."
fi

if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose não está instalado. Instale o Docker Compose primeiro."
fi

# Verificar se arquivo .env existe
if [ ! -f "deploy/.env" ]; then
    warning "Arquivo deploy/.env não encontrado. Copiando template..."
    cp deploy/.env.production deploy/.env
    warning "Configure as variáveis em deploy/.env antes de continuar!"
    read -p "Pressione Enter após configurar o arquivo .env..."
fi

# Build da aplicação
log "Fazendo build da aplicação TypeScript..."
npm run build

# Parar containers existentes
log "Parando containers existentes..."
cd deploy
docker-compose down

# Limpar imagens antigas (opcional)
read -p "Deseja limpar imagens Docker antigas? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Limpando imagens antigas..."
    docker system prune -f
fi

# Build e start dos containers
log "Fazendo build dos containers..."
docker-compose build --no-cache

log "Iniciando containers..."
docker-compose up -d

# Aguardar containers ficarem prontos
log "Aguardando containers ficarem prontos..."
sleep 10

# Verificar se containers estão rodando
log "Verificando status dos containers..."
docker-compose ps

# Testar conectividade
log "Testando conectividade..."
sleep 5

if curl -f http://localhost:3001/ > /dev/null 2>&1; then
    log "✅ Backend está respondendo!"
else
    warning "❌ Backend não está respondendo. Verificando logs..."
    docker-compose logs backend
fi

# Mostrar logs finais
log "Últimos logs do backend:"
docker-compose logs --tail=20 backend

log "🎉 Deploy concluído!"
log "🌐 Backend disponível em: http://localhost:3001"
log "📊 Para monitorar: docker-compose logs -f"
log "🛑 Para parar: docker-compose down"

echo ""
echo "📋 Próximos passos:"
echo "1. Configure o firewall da Oracle Cloud para as portas 80, 443 e 3001"
echo "2. Configure um domínio apontando para o IP público"
echo "3. Configure SSL/TLS com Let's Encrypt"
echo "4. Configure backup automático do MongoDB"

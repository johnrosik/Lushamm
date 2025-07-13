#!/bin/bash

# Script para migrar dados do MongoDB Atlas para MongoDB local
# Execute após o deploy estar funcionando

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

echo "🔄 Migração de dados MongoDB Atlas → Local"
echo ""

# Verificar se .env existe
if [ ! -f ".env" ]; then
    error "Arquivo .env não encontrado. Execute no diretório deploy/"
fi

# Solicitar dados do Atlas
echo "📝 Configure a conexão com MongoDB Atlas:"
read -p "URI do MongoDB Atlas (mongodb+srv://...): " ATLAS_URI
read -p "Database name (padrão: lushamm): " DB_NAME
DB_NAME=${DB_NAME:-lushamm}

# Verificar se Docker está rodando
if ! docker-compose ps | grep -q "mongodb"; then
    error "Container MongoDB não está rodando. Execute docker-compose up -d primeiro."
fi

# Criar diretório temporário para backup
TEMP_DIR="/tmp/lushamm_migration_$(date +%s)"
mkdir -p $TEMP_DIR

log "Fazendo backup dos dados do Atlas..."

# Fazer dump do Atlas
if ! mongodump --uri="$ATLAS_URI" --out="$TEMP_DIR"; then
    error "Falha ao fazer backup do Atlas. Verifique a URI de conexão."
fi

log "Backup do Atlas concluído em $TEMP_DIR"

# Verificar se há dados para migrar
if [ ! -d "$TEMP_DIR/$DB_NAME" ]; then
    warning "Nenhum dado encontrado para o database '$DB_NAME'"
    read -p "Continuar mesmo assim? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

log "Importando dados para MongoDB local..."

# Carregar variáveis do .env
source .env

# Construir URI local
LOCAL_URI="mongodb://${MONGO_USER}:${MONGO_PASSWORD}@localhost:27017/${DB_NAME}?authSource=${DB_NAME}"

# Fazer restore no MongoDB local
if [ -d "$TEMP_DIR/$DB_NAME" ]; then
    docker-compose exec -T mongodb mongorestore \
        --uri="$LOCAL_URI" \
        --drop \
        --dir="/tmp/migration/$DB_NAME" \
        < <(cd $TEMP_DIR && tar -c $DB_NAME)
else
    log "Nenhum dado para importar"
fi

log "Verificando importação..."

# Verificar se os dados foram importados
COLLECTIONS=$(docker-compose exec -T mongodb mongo "$LOCAL_URI" --quiet --eval "db.getCollectionNames().join(', ')")

if [ -n "$COLLECTIONS" ]; then
    log "✅ Coleções importadas: $COLLECTIONS"
    
    # Mostrar contagem de documentos
    log "📊 Contagem de documentos:"
    docker-compose exec -T mongodb mongo "$LOCAL_URI" --quiet --eval "
        db.getCollectionNames().forEach(function(collection) {
            var count = db[collection].count();
            print(collection + ': ' + count + ' documentos');
        })
    "
else
    warning "⚠️  Nenhuma coleção encontrada. Verificar logs."
fi

# Limpeza
log "Limpando arquivos temporários..."
rm -rf $TEMP_DIR

log "🎉 Migração concluída!"
echo ""
echo "📋 Próximos passos:"
echo "1. Teste a aplicação para verificar se os dados estão corretos"
echo "2. Atualize a variável MONGO_CONNECTION_STRING no .env"
echo "3. Remova a conexão com Atlas do seu código"
echo "4. Configure backup regular com /opt/lushamm/backup.sh"

# Oferecer atualizar .env
read -p "Deseja atualizar MONGO_CONNECTION_STRING no .env agora? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Backup do .env original
    cp .env .env.backup
    
    # Atualizar connection string
    sed -i "s|MONGO_CONNECTION_STRING=.*|MONGO_CONNECTION_STRING=$LOCAL_URI|g" .env
    
    log "✅ MONGO_CONNECTION_STRING atualizado em .env"
    log "📁 Backup original salvo em .env.backup"
    
    # Reiniciar backend para usar nova connection string
    log "Reiniciando backend..."
    docker-compose restart backend
    
    sleep 5
    log "✅ Backend reiniciado com nova configuração"
fi

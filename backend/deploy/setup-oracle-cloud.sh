#!/bin/bash

# Script de instalação e configuração inicial para Oracle Cloud
# Execute este script primeiro na sua instância Oracle Cloud

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

log "🛠️  Configurando Oracle Cloud para LUSHAMM RPG Backend..."

# Atualizar sistema
log "Atualizando sistema..."
sudo apt update && sudo apt upgrade -y

# Instalar dependências básicas
log "Instalando dependências básicas..."
sudo apt install -y \
    curl \
    wget \
    git \
    unzip \
    htop \
    nano \
    ufw \
    fail2ban \
    certbot \
    python3-certbot-nginx

# Instalar Docker
log "Instalando Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    log "Docker instalado com sucesso!"
else
    log "Docker já está instalado"
fi

# Instalar Docker Compose
log "Instalando Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    log "Docker Compose instalado com sucesso!"
else
    log "Docker Compose já está instalado"
fi

# Instalar Node.js (para desenvolvimento local)
log "Instalando Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Configurar firewall
log "Configurando firewall básico..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3001/tcp
sudo ufw --force enable

# Configurar fail2ban
log "Configurando fail2ban..."
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Criar diretório para a aplicação
log "Criando diretório para aplicação..."
sudo mkdir -p /opt/lushamm
sudo chown $USER:$USER /opt/lushamm

# Configurar swap (recomendado para instâncias com pouca RAM)
log "Configurando swap..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    log "Swap de 2GB configurado"
else
    log "Swap já existe"
fi

# Otimizações de sistema
log "Aplicando otimizações de sistema..."
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf

# Criar script de monitoramento
log "Criando script de monitoramento..."
cat > /opt/lushamm/monitor.sh << 'EOF'
#!/bin/bash
# Script de monitoramento básico

echo "=== LUSHAMM RPG - Status do Sistema ==="
echo "Data: $(date)"
echo ""

echo "=== Uso de CPU e Memória ==="
top -bn1 | head -5

echo ""
echo "=== Uso de Disco ==="
df -h

echo ""
echo "=== Status dos Containers ==="
cd /opt/lushamm && docker-compose ps

echo ""
echo "=== Últimos logs do backend ==="
cd /opt/lushamm && docker-compose logs --tail=10 backend
EOF

chmod +x /opt/lushamm/monitor.sh

# Criar script de backup
log "Criando script de backup..."
cat > /opt/lushamm/backup.sh << 'EOF'
#!/bin/bash
# Script de backup do MongoDB

BACKUP_DIR="/opt/lushamm/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="lushamm_backup_$DATE.archive"

mkdir -p $BACKUP_DIR

echo "Iniciando backup do MongoDB..."
cd /opt/lushamm
docker-compose exec -T mongodb mongodump --uri="mongodb://lushamm_user:SuaSenhaLushamm456!@localhost:27017/lushamm" --archive > $BACKUP_DIR/$BACKUP_FILE

# Manter apenas os últimos 7 backups
find $BACKUP_DIR -name "lushamm_backup_*.archive" -mtime +7 -delete

echo "Backup concluído: $BACKUP_FILE"
EOF

chmod +x /opt/lushamm/backup.sh

# Configurar crontab para backup automático
log "Configurando backup automático..."
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/lushamm/backup.sh") | crontab -

log "✅ Configuração inicial concluída!"
echo ""
info "📋 Próximos passos:"
info "1. Reboot a instância: sudo reboot"
info "2. Após reboot, clone seu repositório em /opt/lushamm/"
info "3. Configure o arquivo .env em /opt/lushamm/deploy/"
info "4. Execute o script de deploy: ./deploy.sh"
echo ""
info "📊 Scripts úteis criados:"
info "- Monitor: /opt/lushamm/monitor.sh"
info "- Backup: /opt/lushamm/backup.sh"
echo ""
warning "⚠️  IMPORTANTE: Altere as senhas padrão no arquivo .env!"
warning "⚠️  Configure as regras de firewall da Oracle Cloud Console!"

read -p "Deseja reiniciar agora? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo reboot
fi

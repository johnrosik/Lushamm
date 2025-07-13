#!/bin/bash

# Script para configurar SSL/TLS com Let's Encrypt automaticamente
# Execute após o deploy estar funcionando e o domínio configurado

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

echo "🔒 Configuração SSL/TLS com Let's Encrypt"
echo ""

# Verificar se está no diretório correto
if [ ! -f "docker-compose.yml" ]; then
    error "Execute este script no diretório deploy/"
fi

# Solicitar informações do domínio
read -p "Digite seu domínio principal (ex: meusite.com): " DOMAIN
read -p "Digite seu subdomínio API (ex: api.meusite.com) ou Enter para pular: " API_DOMAIN

# Validar domínio
if [ -z "$DOMAIN" ]; then
    error "Domínio é obrigatório"
fi

# Verificar se domínio resolve para este servidor
log "Verificando DNS do domínio $DOMAIN..."
IP_RESOLVE=$(dig +short $DOMAIN)
IP_PUBLIC=$(curl -s ifconfig.me)

if [ "$IP_RESOLVE" != "$IP_PUBLIC" ]; then
    warning "DNS pode não estar configurado corretamente:"
    warning "Domínio resolve para: $IP_RESOLVE"
    warning "IP público do servidor: $IP_PUBLIC"
    read -p "Continuar mesmo assim? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Parar nginx temporariamente
log "Parando Nginx temporariamente..."
docker-compose stop nginx

# Criar diretório SSL
log "Criando diretório SSL..."
mkdir -p ssl

# Configurar domínios para certificado
CERT_DOMAINS="-d $DOMAIN"
if [ -n "$API_DOMAIN" ]; then
    CERT_DOMAINS="$CERT_DOMAINS -d $API_DOMAIN"
fi

# Obter certificado Let's Encrypt
log "Obtendo certificado SSL para $DOMAIN..."
if ! sudo certbot certonly --standalone $CERT_DOMAINS --email admin@$DOMAIN --agree-tos --non-interactive; then
    error "Falha ao obter certificado SSL"
fi

# Copiar certificados para diretório Docker
log "Copiando certificados..."
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl/key.pem
sudo chown $USER:$USER ssl/*.pem

# Backup da configuração nginx atual
log "Fazendo backup da configuração Nginx..."
cp nginx.conf nginx.conf.backup

# Atualizar configuração nginx para usar SSL
log "Atualizando configuração Nginx..."
cat > nginx.conf << EOF
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Configurações básicas
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=30r/m;
    limit_req_zone \$binary_remote_addr zone=upload:10m rate=5r/m;

    # Upstream para o backend
    upstream backend {
        server backend:3001;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name $DOMAIN${API_DOMAIN:+ $API_DOMAIN};
        return 301 https://\$server_name\$request_uri;
    }

    # HTTPS Server
    server {
        listen 443 ssl http2;
        server_name $DOMAIN${API_DOMAIN:+ $API_DOMAIN};

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        
        # SSL Security
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Configurações de upload
        client_max_body_size 20M;
        client_body_timeout 60s;
        client_header_timeout 60s;

        # Logs
        access_log /var/log/nginx/lushamm_access.log;
        error_log /var/log/nginx/lushamm_error.log;

        # API routes
        location /api/ {
            limit_req zone=api burst=10 nodelay;
            
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }

        # Upload específico com rate limiting mais restritivo
        location /api/images/upload {
            limit_req zone=upload burst=3 nodelay;
            
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }

        # WebSocket para Socket.IO
        location /socket.io/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_read_timeout 86400;
        }

        # Servir imagens estáticas com cache
        location /uploads/ {
            alias /var/www/uploads/;
            expires 30d;
            add_header Cache-Control "public, immutable";
            add_header X-Content-Type-Options nosniff;
            
            # Security: apenas imagens
            location ~* \.(jpg|jpeg|png|gif|webp)\$ {
                try_files \$uri =404;
            }
        }

        # Health check
        location /health {
            proxy_pass http://backend;
            access_log off;
        }

        # Root redirect
        location / {
            return 301 /api/;
        }
    }
}
EOF

# Configurar renovação automática
log "Configurando renovação automática do certificado..."
(crontab -l 2>/dev/null; echo "0 3 * * 1 certbot renew --quiet && cd /opt/lushamm/deploy && docker-compose restart nginx") | crontab -

# Atualizar arquivo .env com HTTPS
log "Atualizando .env com HTTPS..."
if [ -f ".env" ]; then
    sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=https://$DOMAIN|g" .env
    sed -i "s|DOMAIN=.*|DOMAIN=$DOMAIN|g" .env
fi

# Reiniciar containers
log "Reiniciando containers..."
docker-compose up -d

# Aguardar containers ficarem prontos
sleep 10

# Testar HTTPS
log "Testando configuração SSL..."
if curl -f -k https://$DOMAIN/api/ > /dev/null 2>&1; then
    log "✅ SSL configurado com sucesso!"
    log "🌐 Site disponível em: https://$DOMAIN"
    log "🔌 API disponível em: https://$DOMAIN/api/"
    log "📷 Upload de imagens: https://$DOMAIN/api/images/upload/single"
else
    warning "❌ Erro na configuração SSL. Verificando logs..."
    docker-compose logs nginx
fi

# Verificar certificado
log "Verificando certificado SSL..."
SSL_INFO=$(echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates)
log "📅 Certificado: $SSL_INFO"

log "🎉 Configuração SSL concluída!"
echo ""
echo "📋 Informações importantes:"
echo "- Certificado será renovado automaticamente"
echo "- Backup da configuração anterior: nginx.conf.backup"
echo "- Para verificar renovação: sudo certbot certificates"
echo "- Logs do Nginx: docker-compose logs nginx"

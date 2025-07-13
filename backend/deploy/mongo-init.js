// Script de inicialização do MongoDB
// Este script cria o usuário e database específicos para a aplicação

db = db.getSiblingDB('lushamm');

// Criar usuário específico para a aplicação
db.createUser({
  user: 'lushamm_user',
  pwd: 'SuaSenhaLushamm456!', // Altere esta senha
  roles: [
    {
      role: 'readWrite',
      db: 'lushamm'
    }
  ]
});

// Criar coleções básicas com índices
db.createCollection('users');
db.createCollection('campaigns');
db.createCollection('characters');
db.createCollection('images');

// Criar índices para performance
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "username": 1 }, { unique: true });
db.campaigns.createIndex({ "gmId": 1 });
db.campaigns.createIndex({ "players": 1 });
db.characters.createIndex({ "campaignId": 1 });
db.characters.createIndex({ "playerId": 1 });
db.images.createIndex({ "filename": 1 }, { unique: true });
db.images.createIndex({ "uploadedBy": 1 });
db.images.createIndex({ "uploadedAt": 1 });

print('Database lushamm initialized successfully!');

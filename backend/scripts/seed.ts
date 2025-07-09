import "dotenv/config";
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Campaign, Character, RPGSystem, UserRole, CampaignStatus } from '../src/models/node';

async function connectDB() {
    try {
        const mongoURI = process.env.MONGO_CONNECTION_STRING || 'mongodb://localhost:27017/lushamm';
        await mongoose.connect(mongoURI);
        console.log('✅ Conectado ao MongoDB');
    } catch (error) {
        console.error('❌ Erro ao conectar ao MongoDB:', error);
        process.exit(1);
    }
}

async function seedUsers() {
    console.log('👥 Criando usuários de exemplo...');

    // Admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const admin = new User({
        username: 'admin',
        email: 'admin@lushamm.com',
        passwordHash: adminPassword,
        role: UserRole.ADMIN,
        preferences: {
            theme: 'dark',
            diceSound: true,
            notifications: true,
            autoRoll: false
        },
        isOnline: false
    });

    // GM user
    const gmPassword = await bcrypt.hash('gm123', 12);
    const gm = new User({
        username: 'mestre_joao',
        email: 'gm@lushamm.com',
        passwordHash: gmPassword,
        role: UserRole.GM,
        preferences: {
            theme: 'dark',
            diceSound: true,
            notifications: true,
            autoRoll: false
        },
        isOnline: false
    });

    // Player users
    const player1Password = await bcrypt.hash('player123', 12);
    const player1 = new User({
        username: 'ana_jogadora',
        email: 'ana@lushamm.com',
        passwordHash: player1Password,
        role: UserRole.PLAYER,
        preferences: {
            theme: 'light',
            diceSound: true,
            notifications: true,
            autoRoll: true
        },
        isOnline: false
    });

    const player2Password = await bcrypt.hash('player123', 12);
    const player2 = new User({
        username: 'carlos_barbaro',
        email: 'carlos@lushamm.com',
        passwordHash: player2Password,
        role: UserRole.PLAYER,
        preferences: {
            theme: 'dark',
            diceSound: true,
            notifications: false,
            autoRoll: false
        },
        isOnline: false
    });

    try {
        await User.deleteMany({}); // Limpar usuários existentes
        await admin.save();
        await gm.save();
        await player1.save();
        await player2.save();
        
        console.log('✅ Usuários criados:');
        console.log('   - admin@lushamm.com (senha: admin123) - ADMIN');
        console.log('   - gm@lushamm.com (senha: gm123) - GM');
        console.log('   - ana@lushamm.com (senha: player123) - PLAYER');
        console.log('   - carlos@lushamm.com (senha: player123) - PLAYER');

        return { admin, gm, player1, player2 };
    } catch (error) {
        console.error('❌ Erro ao criar usuários:', error);
        throw error;
    }
}

async function seedCampaigns(users: { gm: any; player1: any; player2: any }) {
    console.log('🎲 Criando campanhas de exemplo...');

    const campaign1 = new Campaign({
        name: 'Mina Perdida de Phandelver',
        description: 'Uma aventura clássica de D&D 5e para personagens de nível 1-5. Os heróis devem investigar o desaparecimento de Gundren Rockseeker e descobrir os segredos da mina perdida.',
        gmId: users.gm._id,
        system: RPGSystem.DND5e,
        status: CampaignStatus.ACTIVE,
        players: [users.player1._id, users.player2._id],
        characters: [],
        sessions: [
            {
                name: 'Sessão 1: A Estrada para Phandalin',
                date: new Date('2024-01-15'),
                duration: 180,
                notes: 'Os heróis se conheceram e enfrentaram emboscada de goblins',
                chatHistory: [],
                isCompleted: true
            },
            {
                name: 'Sessão 2: Explorando a Caverna Goblin',
                date: new Date('2024-01-22'),
                duration: 210,
                notes: 'Resgate de Sildar e descoberta da primeira pista sobre Klarg',
                chatHistory: [],
                isCompleted: true
            }
        ],
        maps: [],
        settings: {
            allowPlayerDiceRolls: true,
            allowPlayerCharacterEdit: true,
            publicRolls: true,
            voiceChat: true,
            videoChat: false,
            maxPlayers: 4
        },
        customRules: [
            'Regra da casa: Crítico 20 sempre acerta, independente da CA',
            'Morte: Personagens caem inconscientes em 0 HP, morte apenas com 3 falhas consecutivas'
        ],
        houseRules: 'Usamos as regras opcionais de Feats e a regra de pontos de vida máximos no primeiro nível.',
        globalChat: []
    });

    const campaign2 = new Campaign({
        name: 'Cyberpunk: Noite Eterna',
        description: 'Night City, 2077. Um grupo de mercenários precisa sobreviver nas ruas perigosas enquanto realiza trabalhos cada vez mais arriscados.',
        gmId: users.gm._id,
        system: RPGSystem.CYBERPUNK,
        status: CampaignStatus.PLANNING,
        players: [users.player1._id],
        characters: [],
        sessions: [],
        maps: [],
        settings: {
            allowPlayerDiceRolls: true,
            allowPlayerCharacterEdit: false,
            publicRolls: false,
            voiceChat: true,
            videoChat: true,
            maxPlayers: 3
        },
        customRules: [
            'Cyber-psychosis: Acumular muito cyberware pode causar instabilidade mental'
        ],
        houseRules: 'Enfoque narrativo com menos combate e mais investigação.',
        globalChat: []
    });

    try {
        await Campaign.deleteMany({}); // Limpar campanhas existentes
        await campaign1.save();
        await campaign2.save();

        console.log('✅ Campanhas criadas:');
        console.log('   - Mina Perdida de Phandelver (D&D 5e) - ATIVA');
        console.log('   - Cyberpunk: Noite Eterna (Cyberpunk) - PLANEJAMENTO');

        return { campaign1, campaign2 };
    } catch (error) {
        console.error('❌ Erro ao criar campanhas:', error);
        throw error;
    }
}

async function seedCharacters(users: any, campaigns: any) {
    console.log('⚔️ Criando personagens de exemplo...');

    // Personagem da Ana - Mago Élfico
    const character1 = new Character({
        name: 'Lyralei Moonwhisper',
        playerId: users.player1._id,
        campaignId: campaigns.campaign1._id,
        system: RPGSystem.DND5e,
        race: 'Elfo',
        class: 'Mago',
        level: 3,
        background: 'Erudito',
        alignment: 'Caótico Bom',
        attributes: [
            { name: 'Força', value: 8, type: 'number', category: 'stats', description: 'Força física' },
            { name: 'Destreza', value: 14, type: 'number', category: 'stats', description: 'Agilidade e reflexos' },
            { name: 'Constituição', value: 13, type: 'number', category: 'stats', description: 'Resistência física' },
            { name: 'Inteligência', value: 16, type: 'number', category: 'stats', description: 'Raciocínio e memória' },
            { name: 'Sabedoria', value: 12, type: 'number', category: 'stats', description: 'Percepção e intuição' },
            { name: 'Carisma', value: 10, type: 'number', category: 'stats', description: 'Força de personalidade' },
            { name: 'Classe de Armadura', value: 12, type: 'number', category: 'defense', description: 'Dificuldade para ser atingido' },
            { name: 'Proficiência', value: 2, type: 'number', category: 'stats', description: 'Bônus de proficiência' }
        ],
        hitPoints: {
            current: 18,
            max: 18,
            temporary: 0
        },
        inventory: [
            {
                name: 'Grimório',
                quantity: 1,
                weight: 3,
                value: 50,
                description: 'Livro de magias pessoal',
                equipped: false,
                properties: new Map([['magical', true], ['spellbook', true]])
            },
            {
                name: 'Componentes Materiais',
                quantity: 1,
                weight: 2,
                value: 25,
                description: 'Bolsa com componentes para magias',
                equipped: true,
                properties: new Map([['spell_focus', true]])
            },
            {
                name: 'Adaga',
                quantity: 1,
                weight: 1,
                value: 2,
                description: 'Arma simples para emergências',
                equipped: true,
                properties: new Map([
                    ['weapon', 'true'], 
                    ['damage', '1d4'], 
                    ['type', 'piercing']
                ] as [string, string][])
            }
        ],
        abilities: [
            {
                name: 'Mísseis Mágicos',
                level: 1,
                type: 'spell',
                castingTime: '1 ação',
                range: '120 pés',
                duration: 'Instantâneo',
                description: 'Você cria três dardos brilhantes de força mágica.',
                damage: '1d4+1 por míssil',
                effects: 'Força, atinge automaticamente',
                components: ['V', 'S'],
                uses: {
                    current: 2,
                    max: 2,
                    resetOn: 'long_rest'
                },
                school: 'Evocação',
                ritual: false,
                concentration: false
            },
            {
                name: 'Detectar Magia',
                level: 1,
                type: 'spell',
                castingTime: '1 ação',
                range: 'Pessoal',
                duration: 'Concentração, até 10 minutos',
                description: 'Pela duração, você sente a presença de magia a até 30 pés.',
                damage: '',
                effects: 'Detecta auras mágicas',
                components: ['V', 'S'],
                uses: {
                    current: 1,
                    max: 1,
                    resetOn: 'long_rest'
                },
                school: 'Adivinhação',
                ritual: true,
                concentration: true
            }
        ],
        backstory: 'Lyralei é uma jovem elfa que deixou sua floresta natal em busca de conhecimento arcano. Ela acredita que a magia pode ser usada para proteger os inocentes e trazer equilíbrio ao mundo.',
        notes: 'Tem medo de aranhas gigantes devido a um trauma de infância.',
        appearance: {
            age: '110 anos (aparenta 20)',
            height: '1,65m',
            weight: '55kg',
            eyes: 'Azuis como safira',
            hair: 'Prateado longo',
            skin: 'Pálida com leve brilho élfico',
            portrait: 'https://example.com/lyralei-portrait.jpg'
        },
        systemData: new Map([
            ['spell_slots_1', 4],
            ['spell_slots_2', 2],
            ['cantrips_known', 4],
            ['spells_known', 6]
        ]),
        isPublic: false,
        allowEdit: []
    });

    // Personagem do Carlos - Bárbaro Humano
    const character2 = new Character({
        name: 'Grok Punho-de-Ferro',
        playerId: users.player2._id,
        campaignId: campaigns.campaign1._id,
        system: RPGSystem.DND5e,
        race: 'Humano',
        class: 'Bárbaro',
        level: 3,
        background: 'Forasteiro',
        alignment: 'Caótico Neutro',
        attributes: [
            { name: 'Força', value: 16, type: 'number', category: 'stats', description: 'Força física' },
            { name: 'Destreza', value: 13, type: 'number', category: 'stats', description: 'Agilidade e reflexos' },
            { name: 'Constituição', value: 15, type: 'number', category: 'stats', description: 'Resistência física' },
            { name: 'Inteligência', value: 8, type: 'number', category: 'stats', description: 'Raciocínio e memória' },
            { name: 'Sabedoria', value: 12, type: 'number', category: 'stats', description: 'Percepção e intuição' },
            { name: 'Carisma', value: 10, type: 'number', category: 'stats', description: 'Força de personalidade' },
            { name: 'Classe de Armadura', value: 13, type: 'number', category: 'defense', description: 'Dificuldade para ser atingido' },
            { name: 'Proficiência', value: 2, type: 'number', category: 'stats', description: 'Bônus de proficiência' }
        ],
        hitPoints: {
            current: 31,
            max: 31,
            temporary: 0
        },
        inventory: [
            {
                name: 'Machado de Batalha',
                quantity: 1,
                weight: 4,
                value: 10,
                description: 'Arma favorita de Grok, herdada de seu pai',
                equipped: true,
                properties: new Map([['weapon', true], ['damage', '1d8'], ['type', 'slashing'], ['versatile', '1d10']])
            },
            {
                name: 'Javelinas',
                quantity: 4,
                weight: 8,
                value: 2,
                description: 'Armas de arremesso',
                equipped: true,
                properties: new Map([['weapon', true], ['thrown', true], ['damage', '1d6'], ['type', 'piercing']])
            },
            {
                name: 'Armadura de Couro',
                quantity: 1,
                weight: 10,
                value: 10,
                description: 'Proteção básica',
                equipped: true,
                properties: new Map([['armor', true], ['ac_bonus', 1]])
            }
        ],
        abilities: [
            {
                name: 'Fúria',
                level: 1,
                type: 'ability',
                castingTime: '1 ação bônus',
                range: 'Pessoal',
                duration: '1 minuto',
                description: 'Vantagem em testes de Força, +2 de dano corpo a corpo, resistência a dano físico.',
                damage: '+2 dano em ataques corpo a corpo',
                effects: 'Vantagem em Força, resistência física',
                components: [],
                uses: {
                    current: 3,
                    max: 3,
                    resetOn: 'long_rest'
                }
            },
            {
                name: 'Defesa Imprudente',
                level: 2,
                type: 'ability',
                castingTime: 'Reação',
                range: 'Pessoal',
                duration: 'Até o próximo turno',
                description: 'Ataques corpo a corpo têm vantagem, mas ataques contra você também têm vantagem.',
                damage: 'Vantagem em ataques',
                effects: 'Vantagem para atacar e ser atacado',
                components: [],
                uses: {
                    current: 0,
                    max: 0,
                    resetOn: 'daily'
                }
            }
        ],
        backstory: 'Grok vem de uma tribo de bárbaros das montanhas. Deixou sua terra natal após uma visão profética que o guiou para o mundo civilizado, onde deve encontrar seu verdadeiro destino.',
        notes: 'Não sabe ler nem escrever, mas tem uma memória excepcional para histórias orais.',
        appearance: {
            age: '25 anos',
            height: '1,95m',
            weight: '110kg',
            eyes: 'Castanhos escuros',
            hair: 'Negro trançado',
            skin: 'Morena bronzeada pelo sol',
            portrait: 'https://example.com/grok-portrait.jpg'
        },
        systemData: new Map([
            ['rage_uses', 3],
            ['brutal_critical_dice', 1],
            ['fast_movement', 10]
        ]),
        isPublic: false,
        allowEdit: []
    });

    try {
        await Character.deleteMany({}); // Limpar personagens existentes
        await character1.save();
        await character2.save();

        // Atualizar campanhas com os personagens
        await Campaign.findByIdAndUpdate(campaigns.campaign1._id, {
            $push: { characters: { $each: [character1._id, character2._id] } }
        });

        console.log('✅ Personagens criados:');
        console.log('   - Lyralei Moonwhisper (Mago Élfico) - Nível 3');
        console.log('   - Grok Punho-de-Ferro (Bárbaro Humano) - Nível 3');

        return { character1, character2 };
    } catch (error) {
        console.error('❌ Erro ao criar personagens:', error);
        throw error;
    }
}

async function main() {
    console.log('🌱 Iniciando seed do banco de dados...\n');

    try {
        await connectDB();

        const users = await seedUsers();
        const campaigns = await seedCampaigns(users);
        const characters = await seedCharacters(users, campaigns);

        console.log('\n🎉 Seed concluído com sucesso!');
        console.log('\n📋 Dados criados:');
        console.log(`   👥 ${Object.keys(users).length} usuários`);
        console.log(`   🎲 ${Object.keys(campaigns).length} campanhas`);
        console.log(`   ⚔️  ${Object.keys(characters).length} personagens`);

        console.log('\n🔐 Credenciais de acesso:');
        console.log('   🛡️  Admin: admin@lushamm.com / admin123');
        console.log('   🎭 GM: gm@lushamm.com / gm123');
        console.log('   🎲 Jogador 1: ana@lushamm.com / player123');
        console.log('   🎲 Jogador 2: carlos@lushamm.com / player123');

        console.log('\n🚀 Agora você pode iniciar o servidor com: npm run dev');

    } catch (error) {
        console.error('❌ Erro durante o seed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Conexão com MongoDB fechada');
        process.exit(0);
    }
}

if (require.main === module) {
    main();
}

import { Schema, Document, model } from "mongoose";

//Enum para todos os tipos de sistemas de RPG
enum RPGSystem{
    DND5e = "dnd5e",
    FATE = "fate",
    CYBERPUNK = "cyberpunk",
    CALL_OF_CTHULHU = "call_of_cthulhu",
    PATHFINDER = "pathfinder",
    VAMPIRE = "vampire",
    CUSTOM = "custom"
}

//Enum para tipos de dados
enum NodeType {
    CHARACTER = "character",
    CAMPAIGN = "campaign",
    SESSION = "session",
    NPC = "npc",
    ITEM = "item",
    SPELL = "spell",
    MONSTER = "monster",
    LOCATION = "location",
    QUEST = "quest",
    RULE = "rule",
    NOTE = "note",
    MAP = "map",
    IMAGE = "image",
    CUSTOM = "custom"
}

//Enum para tipos de usuário
enum UserRole {
    PLAYER = "player",
    GM = "gm", // Game Master
    ADMIN = "admin"
}

//Enum para status de campanha
enum CampaignStatus {
    PLANNING = "planning",
    ACTIVE = "active",
    PAUSED = "paused",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}

//Schema para atributos flexiveis (stats, habilidades, etc.)
const attributeSchema = new Schema({
    name: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true }, // Pode ser Boolean, String, Number, etc.
    type: { 
        type: String, 
        enum: ["number", "string", "boolean", "array", "object"],
        required: true
    },
    category: { type: String, required: true }, // Categoria do atributo (ex: "stats", "skills", etc.)
    description: { type: String }
}, { _id: false });

//Schema para inventário/equipamentos
const inventorySchema = new Schema({
    name: { type: String, required: true },
    quantity: { type: Number, default: 1},
    weight: { type: Number, default: 0 },
    value: { type: Number, default: 0 },
    description: { type: String },
    equipped: { type: Boolean, default: false},
    properties: { type: Map, of: Schema.Types.Mixed },
    rarity: { type: String, enum: ["common", "uncommon", "rare", "very_rare", "legendary", "artifact"], default: "common" },
    category: { type: String }, // "weapon", "armor", "consumable", "tool", etc.
    tags: [{ type: String }] // Tags personalizáveis
}, { _id: false });

//Schema para magias/habilidades
const abilitySchema = new Schema({
    name: { type: String, required: true },
    level: { type: Number, default: 1 }, // Nível da magia/habilidade
    type: { type: String, enum: ["spell", "ability"], required: true }, // Tipo da habilidade (magia ou habilidade)
    castingTime: { type: String }, // Tempo de conjuração
    range: { type: String }, // Alcance da magia/habilidade
    duration: { type: String }, // Duração da magia/habilidade
    description: { type: String }, // Descrição da magia/habilidade
    damage: { type: String }, // Dano causado pela magia/habilidade
    effects: { type: String }, // Efeitos adicionais da magia/habilidade
    components: { type: [String], default: [] }, // Componentes necessários (ex: "V", "S", "M")
    uses: {
        current: { type: Number, default: 0 }, // Usos atuais
        max: { type: Number, default: 0 }, // Máximo de usos
        resetOn: { type: String, enum: ["short_rest", "long_rest", "daily", "weekly", "custom"] } // Quando os usos são resetados
    },
    school: { type: String }, // Escola de magia (para D&D 5e)
    ritual: { type: Boolean, default: false },
    concentration: { type: Boolean, default: false }
}, { _id: false });

//Schema para dados de rolagem de dados
const diceRollSchema = new Schema({
    formula: { type: String, required: true }, // ex: "1d20+5", "3d6+2"
    result: { type: Number, required: true },
    individual: [{ type: Number }], // Resultados individuais dos dados
    modifier: { type: Number, default: 0 },
    advantage: { type: Boolean, default: false },
    disadvantage: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
    rollerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    context: { type: String }, // Contexto da rolagem (ex: "Attack Roll", "Damage", etc.)
    isPrivate: { type: Boolean, default: false } // Se apenas o GM pode ver
}, { _id: false });

//Schema para mensagens de chat
const chatMessageSchema = new Schema({
    content: { type: String, required: true },
    type: { 
        type: String, 
        enum: ["text", "dice", "image", "system", "whisper"], 
        default: "text" 
    },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetId: { type: Schema.Types.ObjectId, ref: 'User' }, // Para whispers
    diceRoll: diceRollSchema,
    imageUrl: { type: String },
    timestamp: { type: Date, default: Date.now },
    isVisible: { type: Boolean, default: true }, // GM pode ocultar mensagens
    metadata: { type: Map, of: Schema.Types.Mixed } // Dados extras flexíveis
});

//Schema para posições no mapa
const mapPositionSchema = new Schema({
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    layer: { type: String, enum: ["background", "tokens", "foreground"], default: "tokens" },
    rotation: { type: Number, default: 0 },
    scale: { type: Number, default: 1 }
}, { _id: false });

//Schema para tokens no mapa
const mapTokenSchema = new Schema({
    name: { type: String, required: true },
    characterId: { type: Schema.Types.ObjectId, ref: 'Character' },
    position: mapPositionSchema,
    size: { type: String, enum: ["tiny", "small", "medium", "large", "huge", "gargantuan"], default: "medium" },
    imageUrl: { type: String },
    color: { type: String, default: "#ffffff" },
    isVisible: { type: Boolean, default: true },
    conditions: [{ type: String }], // Status effects
    healthBar: {
        current: { type: Number },
        max: { type: Number },
        isVisible: { type: Boolean, default: false } // Apenas GM vê por padrão
    }
}, { _id: false });

//Schema para mapas
const mapSchema = new Schema({
    name: { type: String, required: true },
    imageUrl: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    gridSize: { type: Number, default: 50 }, // Tamanho do grid em pixels
    gridType: { type: String, enum: ["square", "hex", "none"], default: "square" },
    tokens: [mapTokenSchema],
    layers: {
        background: { type: String }, // URL da imagem de fundo
        dm: [{ type: String }], // Camadas visíveis apenas para o DM
        fog: { type: Map, of: Schema.Types.Mixed } // Sistema de névoa de guerra
    },
    settings: {
        snapToGrid: { type: Boolean, default: true },
        showGrid: { type: Boolean, default: true },
        allowPlayerMovement: { type: Boolean, default: false }
    }
});

//Schema para usuários
const userSchema = new Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.PLAYER },
    avatar: { type: String },
    preferences: {
        theme: { type: String, enum: ["light", "dark"], default: "dark" },
        diceSound: { type: Boolean, default: true },
        notifications: { type: Boolean, default: true },
        autoRoll: { type: Boolean, default: false }
    },
    lastActive: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false }
}, { timestamps: true });

//Schema para personagens/fichas
const characterSchema = new Schema({
    name: { type: String, required: true },
    playerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    system: { type: String, enum: Object.values(RPGSystem), required: true },
    
    // Informações básicas
    race: { type: String },
    class: { type: String },
    level: { type: Number, default: 1 },
    background: { type: String },
    alignment: { type: String },
    
    // Atributos flexíveis por sistema
    attributes: [attributeSchema],
    
    // Vida e recursos
    hitPoints: {
        current: { type: Number, default: 0 },
        max: { type: Number, default: 0 },
        temporary: { type: Number, default: 0 }
    },
    
    // Inventário e equipamentos
    inventory: [inventorySchema],
    
    // Magias e habilidades
    abilities: [abilitySchema],
    
    // Notas e backstory
    backstory: { type: String },
    notes: { type: String },
    
    // Aparência
    appearance: {
        age: { type: String },
        height: { type: String },
        weight: { type: String },
        eyes: { type: String },
        hair: { type: String },
        skin: { type: String },
        portrait: { type: String } // URL da imagem
    },
    
    // Configurações específicas do sistema
    systemData: { type: Map, of: Schema.Types.Mixed },
    
    // Permissões
    isPublic: { type: Boolean, default: false },
    allowEdit: [{ type: Schema.Types.ObjectId, ref: 'User' }] // Usuários que podem editar
}, { timestamps: true });

//Schema para campanhas
const campaignSchema = new Schema({
    name: { type: String, required: true },
    description: { type: String },
    gmId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    system: { type: String, enum: Object.values(RPGSystem), required: true },
    status: { type: String, enum: Object.values(CampaignStatus), default: CampaignStatus.PLANNING },
    
    // Participantes
    players: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    characters: [{ type: Schema.Types.ObjectId, ref: 'Character' }],
    
    // Sessões
    sessions: [{
        name: { type: String, required: true },
        date: { type: Date },
        duration: { type: Number }, // em minutos
        notes: { type: String },
        chatHistory: [chatMessageSchema],
        isCompleted: { type: Boolean, default: false }
    }],
    
    // Mapas e assets
    maps: [mapSchema],
    
    // Configurações da campanha
    settings: {
        allowPlayerDiceRolls: { type: Boolean, default: true },
        allowPlayerCharacterEdit: { type: Boolean, default: true },
        publicRolls: { type: Boolean, default: true },
        voiceChat: { type: Boolean, default: true },
        videoChat: { type: Boolean, default: false },
        maxPlayers: { type: Number, default: 6 }
    },
    
    // Sistema de dados personalizados
    customRules: [{ type: String }],
    houseRules: { type: String },
    
    // Chat global da campanha
    globalChat: [chatMessageSchema]
}, { timestamps: true });

//Schema flexível para qualquer tipo de node (sistema original)
const nodeSchema = new Schema({
    name: { type: String, required: true },
    type: { type: String, enum: Object.values(NodeType), required: true },
    content: { type: Schema.Types.Mixed },
    tags: [{ type: String }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' },
    parentId: { type: Schema.Types.ObjectId, ref: 'Node' }, // Para hierarquias
    permissions: {
        read: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        write: [{ type: Schema.Types.ObjectId, ref: 'User' }]
    },
    metadata: { type: Map, of: Schema.Types.Mixed }
}, { timestamps: true });

// Definição das interfaces TypeScript
interface IUser extends Document {
    username: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    avatar?: string;
    preferences: {
        theme: "light" | "dark";
        diceSound: boolean;
        notifications: boolean;
        autoRoll: boolean;
    };
    lastActive: Date;
    isOnline: boolean;
}

interface ICharacter extends Document {
    name: string;
    playerId: Schema.Types.ObjectId;
    campaignId: Schema.Types.ObjectId;
    system: RPGSystem;
    race?: string;
    class?: string;
    level: number;
    background?: string;
    alignment?: string;
    attributes: Array<{
        name: string;
        value: string | number | boolean | Array<unknown> | Record<string, unknown>;
        type: string;
        category: string;
        description?: string;
    }>;
    hitPoints: {
        current: number;
        max: number;
        temporary: number;
    };
    inventory: Array<Record<string, unknown>>;
    abilities: Array<Record<string, unknown>>;
    backstory?: string;
    notes?: string;
    appearance: {
        age?: string;
        height?: string;
        weight?: string;
        eyes?: string;
        hair?: string;
        skin?: string;
        portrait?: string;
    };
    systemData: Map<string, unknown>;
    isPublic: boolean;
    allowEdit: Schema.Types.ObjectId[];
}

interface ICampaign extends Document {
    name: string;
    description?: string;
    gmId: Schema.Types.ObjectId;
    system: RPGSystem;
    status: CampaignStatus;
    players: Schema.Types.ObjectId[];
    characters: Schema.Types.ObjectId[];
    sessions: Array<{
        name: string;
        date?: Date;
        duration?: number;
        notes?: string;
        chatHistory: Array<Record<string, unknown>>;
        isCompleted: boolean;
    }>;
    maps: Array<Record<string, unknown>>;
    settings: {
        allowPlayerDiceRolls: boolean;
        allowPlayerCharacterEdit: boolean;
        publicRolls: boolean;
        voiceChat: boolean;
        videoChat: boolean;
        maxPlayers: number;
    };
    customRules: string[];
    houseRules?: string;
    globalChat: Array<Record<string, unknown>>;
}

interface INode extends Document {
    name: string;
    type: NodeType;
    content: Record<string, unknown>;
    tags: string[];
    createdBy: Schema.Types.ObjectId;
    campaignId?: Schema.Types.ObjectId;
    parentId?: Schema.Types.ObjectId;
    permissions: {
        read: Schema.Types.ObjectId[];
        write: Schema.Types.ObjectId[];
    };
    metadata: Map<string, unknown>;
}

// Criação dos modelos
const User = model<IUser>('User', userSchema);
const Character = model<ICharacter>('Character', characterSchema);
const Campaign = model<ICampaign>('Campaign', campaignSchema);
const Node = model<INode>('Node', nodeSchema);

// Exportações
export {
    RPGSystem,
    NodeType,
    UserRole,
    CampaignStatus,
    User,
    Character,
    Campaign,
    Node,
    type IUser,
    type ICharacter,
    type ICampaign,
    type INode
};


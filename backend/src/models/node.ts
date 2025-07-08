import { Schema, Document } from "mongoose";

//Enum para todos os tipos de sistemas de RPG
enum RPGSystem{
    DND5e = "dnd5e",
    FATE = "fate",
    CYBERPUNK = "cyberpunk",
    CALL_OF_CTHULHU = "call_of_cthulhu",
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
    CUSTOM = "custom"
}

//Schema para atributos flexiveis (stats, habilidades, etc.)
const attributeSchema = new Schema({
    name: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true }, // Pode ser Boolean, String, Number, etc.
    type: { String, 
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
})

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
    components: { type: [String], default: [] }, // Componentes necessários (ex: "V", "S", "M
    uses: {
        current : { type: Number, default: 0 }, // Usos atuais
        max: { type: Number, default: 0 }, // Máximo de usos
        resertOn: { type: String, enum: ["short_rest", "long_rest", "daily", "weekly", "custom"] } // Quando os usos são resetados
    }
}, { _id: false });


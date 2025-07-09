/**
 * Templates de personagem para diferentes sistemas de RPG
 * Define os campos e estruturas específicas para cada sistema
 */

import { RPGSystem } from '../models/node';

export interface CharacterTemplate {
    system: RPGSystem;
    defaultAttributes: Array<{
        name: string;
        value: string | number | boolean;
        type: "number" | "string" | "boolean" | "array" | "object";
        category: string;
        description?: string;
    }>;
    requiredFields: string[];
    optionalFields: string[];
    defaultSystemData: Record<string, unknown>;
}

// Template para D&D 5e
export const DND5E_TEMPLATE: CharacterTemplate = {
    system: RPGSystem.DND5e,
    defaultAttributes: [
        // Atributos principais
        { name: "strength", value: 10, type: "number", category: "abilities", description: "Força física" },
        { name: "dexterity", value: 10, type: "number", category: "abilities", description: "Agilidade e reflexos" },
        { name: "constitution", value: 10, type: "number", category: "abilities", description: "Resistência física" },
        { name: "intelligence", value: 10, type: "number", category: "abilities", description: "Capacidade de raciocínio" },
        { name: "wisdom", value: 10, type: "number", category: "abilities", description: "Percepção e intuição" },
        { name: "charisma", value: 10, type: "number", category: "abilities", description: "Força de personalidade" },
        
        // Modificadores (calculados automaticamente)
        { name: "strengthMod", value: 0, type: "number", category: "modifiers", description: "Modificador de Força" },
        { name: "dexterityMod", value: 0, type: "number", category: "modifiers", description: "Modificador de Destreza" },
        { name: "constitutionMod", value: 0, type: "number", category: "modifiers", description: "Modificador de Constituição" },
        { name: "intelligenceMod", value: 0, type: "number", category: "modifiers", description: "Modificador de Inteligência" },
        { name: "wisdomMod", value: 0, type: "number", category: "modifiers", description: "Modificador de Sabedoria" },
        { name: "charismaMod", value: 0, type: "number", category: "modifiers", description: "Modificador de Carisma" },
        
        // Proficiências
        { name: "proficiencyBonus", value: 2, type: "number", category: "proficiency", description: "Bônus de proficiência" },
        { name: "armorClass", value: 10, type: "number", category: "combat", description: "Classe de Armadura" },
        { name: "initiative", value: 0, type: "number", category: "combat", description: "Iniciativa" },
        { name: "speed", value: 30, type: "number", category: "movement", description: "Velocidade em pés" },
        
        // Perícias (algumas principais)
        { name: "acrobatics", value: false, type: "boolean", category: "skills", description: "Proficiência em Acrobacia" },
        { name: "athletics", value: false, type: "boolean", category: "skills", description: "Proficiência em Atletismo" },
        { name: "deception", value: false, type: "boolean", category: "skills", description: "Proficiência em Enganação" },
        { name: "history", value: false, type: "boolean", category: "skills", description: "Proficiência em História" },
        { name: "insight", value: false, type: "boolean", category: "skills", description: "Proficiência em Intuição" },
        { name: "intimidation", value: false, type: "boolean", category: "skills", description: "Proficiência em Intimidação" },
        { name: "investigation", value: false, type: "boolean", category: "skills", description: "Proficiência em Investigação" },
        { name: "medicine", value: false, type: "boolean", category: "skills", description: "Proficiência em Medicina" },
        { name: "nature", value: false, type: "boolean", category: "skills", description: "Proficiência em Natureza" },
        { name: "perception", value: false, type: "boolean", category: "skills", description: "Proficiência em Percepção" },
        { name: "performance", value: false, type: "boolean", category: "skills", description: "Proficiência em Atuação" },
        { name: "persuasion", value: false, type: "boolean", category: "skills", description: "Proficiência em Persuasão" },
        { name: "religion", value: false, type: "boolean", category: "skills", description: "Proficiência em Religião" },
        { name: "sleightOfHand", value: false, type: "boolean", category: "skills", description: "Proficiência em Prestidigitação" },
        { name: "stealth", value: false, type: "boolean", category: "skills", description: "Proficiência em Furtividade" },
        { name: "survival", value: false, type: "boolean", category: "skills", description: "Proficiência em Sobrevivência" },
        
        // Resistências de salvamento
        { name: "strengthSave", value: false, type: "boolean", category: "saves", description: "Proficiência em resistência de Força" },
        { name: "dexteritySave", value: false, type: "boolean", category: "saves", description: "Proficiência em resistência de Destreza" },
        { name: "constitutionSave", value: false, type: "boolean", category: "saves", description: "Proficiência em resistência de Constituição" },
        { name: "intelligenceSave", value: false, type: "boolean", category: "saves", description: "Proficiência em resistência de Inteligência" },
        { name: "wisdomSave", value: false, type: "boolean", category: "saves", description: "Proficiência em resistência de Sabedoria" },
        { name: "charismaSave", value: false, type: "boolean", category: "saves", description: "Proficiência em resistência de Carisma" },
    ],
    requiredFields: ["race", "class", "level", "background", "alignment"],
    optionalFields: ["subrace", "subclass", "feats", "languages", "weaponProficiencies", "armorProficiencies"],
    defaultSystemData: {
        hitDice: "1d8",
        spellcasting: {
            ability: null,
            level: 0,
            slots: {}
        },
        features: [],
        inspiration: false,
        experiencePoints: 0
    }
};

// Template para Fate Core
export const FATE_TEMPLATE: CharacterTemplate = {
    system: RPGSystem.FATE,
    defaultAttributes: [
        // Aspectos (5 aspectos principais do Fate)
        { name: "highConcept", value: "", type: "string", category: "aspects", description: "Conceito Principal" },
        { name: "trouble", value: "", type: "string", category: "aspects", description: "Dificuldade" },
        { name: "aspect3", value: "", type: "string", category: "aspects", description: "Aspecto 3" },
        { name: "aspect4", value: "", type: "string", category: "aspects", description: "Aspecto 4" },
        { name: "aspect5", value: "", type: "string", category: "aspects", description: "Aspecto 5" },
        
        // Atributos/Abordagens do Fate (usando Fate Acelerado como base)
        { name: "careful", value: 0, type: "number", category: "approaches", description: "Cuidadoso" },
        { name: "clever", value: 0, type: "number", category: "approaches", description: "Esperto" },
        { name: "flashy", value: 0, type: "number", category: "approaches", description: "Estiloso" },
        { name: "forceful", value: 0, type: "number", category: "approaches", description: "Vigoroso" },
        { name: "quick", value: 0, type: "number", category: "approaches", description: "Ágil" },
        { name: "sneaky", value: 0, type: "number", category: "approaches", description: "Sorrateiro" },
        
        // Ou perícias tradicionais do Fate Core (comentadas, use uma ou outra)
        /*
        { name: "athletics", value: 0, type: "number", category: "skills", description: "Atletismo" },
        { name: "burglary", value: 0, type: "number", category: "skills", description: "Roubo" },
        { name: "contacts", value: 0, type: "number", category: "skills", description: "Contatos" },
        { name: "crafts", value: 0, type: "number", category: "skills", description: "Ofícios" },
        { name: "deceive", value: 0, type: "number", category: "skills", description: "Enganar" },
        { name: "drive", value: 0, type: "number", category: "skills", description: "Dirigir" },
        { name: "empathy", value: 0, type: "number", category: "skills", description: "Empatia" },
        { name: "fight", value: 0, type: "number", category: "skills", description: "Lutar" },
        { name: "investigate", value: 0, type: "number", category: "skills", description: "Investigar" },
        { name: "lore", value: 0, type: "number", category: "skills", description: "Conhecimentos" },
        { name: "notice", value: 0, type: "number", category: "skills", description: "Perceber" },
        { name: "physique", value: 0, type: "number", category: "skills", description: "Vigor" },
        { name: "provoke", value: 0, type: "number", category: "skills", description: "Provocar" },
        { name: "rapport", value: 0, type: "number", category: "skills", description: "Comunicação" },
        { name: "resources", value: 0, type: "number", category: "skills", description: "Recursos" },
        { name: "shoot", value: 0, type: "number", category: "skills", description: "Atirar" },
        { name: "stealth", value: 0, type: "number", category: "skills", description: "Furtividade" },
        { name: "will", value: 0, type: "number", category: "skills", description: "Vontade" },
        */
        
        // Estresse e Consequências
        { name: "physicalStress1", value: false, type: "boolean", category: "stress", description: "Estresse Físico 1" },
        { name: "physicalStress2", value: false, type: "boolean", category: "stress", description: "Estresse Físico 2" },
        { name: "physicalStress3", value: false, type: "boolean", category: "stress", description: "Estresse Físico 3" },
        { name: "physicalStress4", value: false, type: "boolean", category: "stress", description: "Estresse Físico 4" },
        
        { name: "mentalStress1", value: false, type: "boolean", category: "stress", description: "Estresse Mental 1" },
        { name: "mentalStress2", value: false, type: "boolean", category: "stress", description: "Estresse Mental 2" },
        { name: "mentalStress3", value: false, type: "boolean", category: "stress", description: "Estresse Mental 3" },
        { name: "mentalStress4", value: false, type: "boolean", category: "stress", description: "Estresse Mental 4" },
        
        { name: "mildConsequence", value: "", type: "string", category: "consequences", description: "Consequência Suave (2)" },
        { name: "moderateConsequence", value: "", type: "string", category: "consequences", description: "Consequência Moderada (4)" },
        { name: "severeConsequence", value: "", type: "string", category: "consequences", description: "Consequência Severa (6)" },
        { name: "extremeConsequence", value: "", type: "string", category: "consequences", description: "Consequência Extrema (8)" },
        
        // Recursos do Fate
        { name: "fatePoints", value: 3, type: "number", category: "resources", description: "Pontos de Destino" },
        { name: "refresh", value: 3, type: "number", category: "resources", description: "Recarga" },
    ],
    requiredFields: ["highConcept", "trouble"],
    optionalFields: ["extras", "conditions"],
    defaultSystemData: {
        stunts: [], // Façanhas
        extras: [], // Extras
        conditions: [], // Condições
        aspectHistory: [], // Histórico de aspectos criados
        compels: [], // Compulsões recebidas
        skillMode: "accelerated" // "accelerated" ou "core"
    }
};

/**
 * Retorna o template apropriado para o sistema
 */
export function getCharacterTemplate(system: RPGSystem): CharacterTemplate {
    switch (system) {
        case RPGSystem.DND5e:
            return DND5E_TEMPLATE;
        case RPGSystem.FATE:
            return FATE_TEMPLATE;
        default:
            throw new Error(`Sistema ${system} não suportado para templates`);
    }
}

/**
 * Valida se um personagem tem todos os campos obrigatórios para o sistema
 */
export function validateCharacterForSystem(character: Record<string, unknown>, system: RPGSystem): { isValid: boolean; missingFields: string[] } {
    const template = getCharacterTemplate(system);
    const missingFields: string[] = [];
    
    template.requiredFields.forEach(field => {
        if (!character[field] && character[field] !== 0 && character[field] !== false) {
            missingFields.push(field);
        }
    });
    
    return {
        isValid: missingFields.length === 0,
        missingFields
    };
}

/**
 * Cria atributos padrão para um sistema específico
 */
export function createDefaultAttributes(system: RPGSystem) {
    const template = getCharacterTemplate(system);
    return [...template.defaultAttributes];
}

/**
 * Migra um personagem de um sistema para outro
 * Preserva dados compatíveis e aplica valores padrão para o novo sistema
 */
export function migrateCharacterSystem(character: Record<string, unknown>, newSystem: RPGSystem): Record<string, unknown> {
    const newTemplate = getCharacterTemplate(newSystem);
    const migratedCharacter = { ...character };
    
    // Atualiza o sistema
    migratedCharacter.system = newSystem;
    
    // Reseta atributos para o novo sistema
    migratedCharacter.attributes = createDefaultAttributes(newSystem);
    
    // Atualiza systemData
    migratedCharacter.systemData = { ...newTemplate.defaultSystemData };
    
    // Preserva dados básicos compatíveis (nome, aparência, backstory, notas)
    // Reseta dados específicos do sistema anterior
    migratedCharacter.abilities = [];
    
    // Para D&D -> Fate: resetar campos específicos do D&D
    if (newSystem === RPGSystem.FATE) {
        migratedCharacter.race = undefined;
        migratedCharacter.class = undefined;
        migratedCharacter.level = 1;
        migratedCharacter.background = undefined;
        migratedCharacter.alignment = undefined;
        migratedCharacter.hitPoints = { current: 0, max: 0, temporary: 0 };
    }
    
    // Para Fate -> D&D: resetar campos específicos do Fate  
    if (newSystem === RPGSystem.DND5e) {
        migratedCharacter.race = "";
        migratedCharacter.class = "";
        migratedCharacter.level = 1;
        migratedCharacter.background = "";
        migratedCharacter.alignment = "";
        migratedCharacter.hitPoints = { current: 0, max: 0, temporary: 0 };
    }
    
    return migratedCharacter;
}

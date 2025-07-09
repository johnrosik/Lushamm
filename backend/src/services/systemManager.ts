/**
 * Serviço para gerenciar sistemas de RPG e suas especificidades
 * Fornece métodos para trabalhar com diferentes sistemas de forma consistente
 */

import { RPGSystem } from '../models/node';
import { getCharacterTemplate, createDefaultAttributes, validateCharacterForSystem } from './characterTemplates';

export interface SystemInfo {
    name: string;
    description: string;
    version?: string;
    supportedFeatures: string[];
    characterFields: {
        required: string[];
        optional: string[];
        hidden: string[]; // Campos que não devem aparecer neste sistema
    };
}

// Informações sobre sistemas suportados
export const SYSTEM_INFO: Record<RPGSystem, SystemInfo> = {
    [RPGSystem.DND5e]: {
        name: "Dungeons & Dragons 5ª Edição",
        description: "Sistema clássico de fantasia medieval com foco em combate tático e progressão por níveis",
        version: "5.0",
        supportedFeatures: [
            "abilities", "skills", "saves", "hitPoints", "armor", "spells", 
            "feats", "classes", "races", "backgrounds", "alignment", "experience"
        ],
        characterFields: {
            required: ["name", "race", "class", "level", "background", "alignment"],
            optional: ["subrace", "subclass", "feats", "languages"],
            hidden: ["aspects", "stress", "consequences", "fatePoints", "refresh", "stunts"]
        }
    },
    [RPGSystem.FATE]: {
        name: "Fate Core/Acelerado",
        description: "Sistema narrativo focado em aspectos e storytelling colaborativo",
        version: "Core",
        supportedFeatures: [
            "aspects", "approaches", "skills", "stunts", "stress", "consequences", 
            "fatePoints", "refresh", "extras", "conditions"
        ],
        characterFields: {
            required: ["name", "highConcept", "trouble"],
            optional: ["aspects", "stunts", "extras", "conditions"],
            hidden: ["race", "class", "level", "background", "alignment", "hitPoints", "abilities", "saves"]
        }
    },
    [RPGSystem.CYBERPUNK]: {
        name: "Cyberpunk",
        description: "Sistema futurístico cyberpunk",
        supportedFeatures: [],
        characterFields: { required: [], optional: [], hidden: [] }
    },
    [RPGSystem.CALL_OF_CTHULHU]: {
        name: "Call of Cthulhu",
        description: "Sistema de horror cósmico",
        supportedFeatures: [],
        characterFields: { required: [], optional: [], hidden: [] }
    },
    [RPGSystem.PATHFINDER]: {
        name: "Pathfinder",
        description: "Sistema derivado do D&D 3.5",
        supportedFeatures: [],
        characterFields: { required: [], optional: [], hidden: [] }
    },
    [RPGSystem.VAMPIRE]: {
        name: "Vampire: The Masquerade",
        description: "Sistema de horror urbano",
        supportedFeatures: [],
        characterFields: { required: [], optional: [], hidden: [] }
    },
    [RPGSystem.CUSTOM]: {
        name: "Sistema Personalizado",
        description: "Sistema customizado pelo usuário",
        supportedFeatures: [],
        characterFields: { required: [], optional: [], hidden: [] }
    }
};

/**
 * Classe principal para gerenciar sistemas de RPG
 */
export class SystemManager {
    /**
     * Retorna informações sobre um sistema específico
     */
    static getSystemInfo(system: RPGSystem): SystemInfo {
        return SYSTEM_INFO[system];
    }

    /**
     * Verifica se um sistema é totalmente suportado
     */
    static isSystemSupported(system: RPGSystem): boolean {
        const supportedSystems = [RPGSystem.DND5e, RPGSystem.FATE];
        return supportedSystems.includes(system);
    }

    /**
     * Retorna lista de sistemas suportados
     */
    static getSupportedSystems(): RPGSystem[] {
        return [RPGSystem.DND5e, RPGSystem.FATE];
    }

    /**
     * Cria um personagem novo com template do sistema
     */
    static createCharacterForSystem(system: RPGSystem, basicData: Record<string, unknown>) {
        if (!this.isSystemSupported(system)) {
            throw new Error(`Sistema ${system} não é totalmente suportado`);
        }

        const template = getCharacterTemplate(system);

        return {
            ...basicData,
            system,
            attributes: createDefaultAttributes(system),
            systemData: { ...template.defaultSystemData },
            // Inicializar campos obrigatórios se não fornecidos
            ...this.initializeRequiredFields(system, basicData)
        };
    }

    /**
     * Inicializa campos obrigatórios com valores padrão
     */
    private static initializeRequiredFields(system: RPGSystem, data: Record<string, unknown>) {
        const systemInfo = this.getSystemInfo(system);
        const initialized: Record<string, unknown> = {};

        systemInfo.characterFields.required.forEach(field => {
            if (!(field in data)) {
                switch (field) {
                    case "level":
                        initialized[field] = 1;
                        break;
                    case "hitPoints":
                        initialized[field] = { current: 0, max: 0, temporary: 0 };
                        break;
                    case "fatePoints":
                        initialized[field] = 3;
                        break;
                    case "refresh":
                        initialized[field] = 3;
                        break;
                    default:
                        initialized[field] = "";
                }
            }
        });

        return initialized;
    }

    /**
     * Filtra campos visíveis para um sistema específico
     */
    static filterFieldsForSystem(character: Record<string, unknown>, system: RPGSystem): Record<string, unknown> {
        const systemInfo = this.getSystemInfo(system);
        const filtered = { ...character };

        // Remove campos que devem estar ocultos neste sistema
        systemInfo.characterFields.hidden.forEach(field => {
            delete filtered[field];
        });

        // Filtra atributos por categoria baseado no sistema
        if (filtered.attributes && Array.isArray(filtered.attributes)) {
            filtered.attributes = this.filterAttributesForSystem(filtered.attributes, system);
        }

        return filtered;
    }

    /**
     * Filtra atributos baseado no sistema
     */
    private static filterAttributesForSystem(attributes: unknown[], system: RPGSystem): unknown[] {
        const template = getCharacterTemplate(system);
        const validCategories = new Set(template.defaultAttributes.map(attr => attr.category));

        return attributes.filter((attr: unknown) => {
            const attribute = attr as { category?: string };
            return attribute.category && validCategories.has(attribute.category);
        });
    }

    /**
     * Valida se um personagem está completo para o sistema
     */
    static validateCharacter(character: Record<string, unknown>, system: RPGSystem) {
        if (!this.isSystemSupported(system)) {
            return {
                isValid: false,
                errors: [`Sistema ${system} não é suportado`],
                missingFields: []
            };
        }

        const validation = validateCharacterForSystem(character, system);

        const errors: string[] = [];
        
        if (!validation.isValid) {
            errors.push(`Campos obrigatórios faltando: ${validation.missingFields.join(', ')}`);
        }

        // Validações específicas por sistema
        if (system === RPGSystem.DND5e) {
            errors.push(...this.validateDND5eSpecific(character));
        } else if (system === RPGSystem.FATE) {
            errors.push(...this.validateFateSpecific(character));
        }

        return {
            isValid: errors.length === 0,
            errors,
            missingFields: validation.missingFields
        };
    }

    /**
     * Validações específicas para D&D 5e
     */
    private static validateDND5eSpecific(character: Record<string, unknown>): string[] {
        const errors: string[] = [];
        
        const level = character.level as number;
        if (level && (level < 1 || level > 20)) {
            errors.push("Nível deve estar entre 1 e 20");
        }

        // Verificar se atributos estão no range correto (3-20 para D&D)
        const attributes = character.attributes as Array<{ name: string; value: unknown; category: string }>;
        if (attributes) {
            const abilityAttrs = attributes.filter(attr => attr.category === "abilities");
            abilityAttrs.forEach(attr => {
                const value = attr.value as number;
                if (typeof value === "number" && (value < 3 || value > 20)) {
                    errors.push(`${attr.name} deve estar entre 3 e 20`);
                }
            });
        }

        return errors;
    }

    /**
     * Validações específicas para Fate
     */
    private static validateFateSpecific(character: Record<string, unknown>): string[] {
        const errors: string[] = [];
        
        // Verificar se abordagens somam 3 (Fate Acelerado)
        const attributes = character.attributes as Array<{ name: string; value: unknown; category: string }>;
        if (attributes) {
            const approaches = attributes.filter(attr => attr.category === "approaches");
            const total = approaches.reduce((sum, attr) => sum + (attr.value as number || 0), 0);
            
            if (total !== 3) {
                errors.push("Soma das abordagens deve ser igual a 3");
            }

            // Verificar se nenhuma abordagem é maior que 3
            approaches.forEach(attr => {
                const value = attr.value as number;
                if (typeof value === "number" && value > 3) {
                    errors.push(`${attr.name} não pode ser maior que 3`);
                }
            });
        }

        const refresh = character.refresh as number;
        if (typeof refresh === "number" && refresh < 1) {
            errors.push("Recarga deve ser pelo menos 1");
        }

        return errors;
    }

    /**
     * Converte dados de um sistema para formato de exibição amigável
     */
    static formatCharacterForDisplay(character: Record<string, unknown>, system: RPGSystem): Record<string, unknown> {
        const formatted = this.filterFieldsForSystem(character, system);
        const systemInfo = this.getSystemInfo(system);

        // Adicionar informações do sistema
        formatted._systemInfo = {
            name: systemInfo.name,
            description: systemInfo.description,
            supportedFeatures: systemInfo.supportedFeatures
        };

        // Processar atributos para exibição mais amigável
        if (formatted.attributes && Array.isArray(formatted.attributes)) {
            formatted._attributesByCategory = this.groupAttributesByCategory(formatted.attributes);
        }

        return formatted;
    }

    /**
     * Agrupa atributos por categoria para exibição
     */
    private static groupAttributesByCategory(attributes: unknown[]): Record<string, unknown[]> {
        const grouped: Record<string, unknown[]> = {};
        
        attributes.forEach((attr: unknown) => {
            const attribute = attr as { category: string };
            if (!grouped[attribute.category]) {
                grouped[attribute.category] = [];
            }
            grouped[attribute.category].push(attr);
        });

        return grouped;
    }

    /**
     * Calcula valores derivados baseado no sistema
     */
    static calculateDerivedValues(character: Record<string, unknown>, system: RPGSystem): Record<string, unknown> {
        const updated = { ...character };

        if (system === RPGSystem.DND5e) {
            updated.attributes = this.calculateDND5eDerivedValues(updated.attributes as Array<{ name: string; value: unknown; category: string }>);
        } else if (system === RPGSystem.FATE) {
            updated.attributes = this.calculateFateDerivedValues(updated.attributes as Array<{ name: string; value: unknown; category: string }>);
        }

        return updated;
    }

    /**
     * Calcula modificadores e valores derivados para D&D 5e
     */
    private static calculateDND5eDerivedValues(attributes: Array<{ name: string; value: unknown; category: string }>) {
        const updated = [...attributes];
        
        // Calcular modificadores de atributos
        const abilityMods = new Map();
        updated.forEach((attr) => {
            if (attr.category === "abilities") {
                const score = attr.value as number;
                const modifier = Math.floor((score - 10) / 2);
                abilityMods.set(attr.name, modifier);
                
                // Atualizar modificador correspondente
                const modIndex = updated.findIndex(a => a.name === `${attr.name}Mod`);
                if (modIndex !== -1) {
                    updated[modIndex] = { ...updated[modIndex], value: modifier };
                }
            }
        });

        // Calcular iniciativa (modificador de destreza)
        const dexMod = abilityMods.get("dexterity") || 0;
        const initiativeIndex = updated.findIndex(a => a.name === "initiative");
        if (initiativeIndex !== -1) {
            updated[initiativeIndex] = { ...updated[initiativeIndex], value: dexMod };
        }

        return updated;
    }

    /**
     * Calcula valores derivados para Fate
     */
    private static calculateFateDerivedValues(attributes: Array<{ name: string; value: unknown; category: string }>) {
        // Fate geralmente não tem valores derivados complexos
        // Mas podemos calcular caixas de estresse baseado em atributos se necessário
        return attributes;
    }
}

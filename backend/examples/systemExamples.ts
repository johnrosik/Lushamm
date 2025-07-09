/**
 * Exemplo de como usar o novo sistema de alternância entre D&D 5e e Fate
 * Este arquivo demonstra como criar e gerenciar personagens para ambos os sistemas
 */

import { RPGSystem } from '../models/node';
import { SystemManager } from '../services/systemManager';
import { getCharacterTemplate, migrateCharacterSystem } from '../services/characterTemplates';

// ================================
// EXEMPLO 1: Criando personagem D&D 5e
// ================================

console.log("=== CRIANDO PERSONAGEM D&D 5e ===");

const dndCharacterData = {
    name: "Thorin Escudo de Ferro",
    race: "Anão",
    class: "Guerreiro",
    level: 3,
    background: "Soldado",
    alignment: "Leal e Bom"
};

const dndCharacter = SystemManager.createCharacterForSystem(RPGSystem.DND5e, dndCharacterData);

console.log("Personagem D&D 5e criado:");
console.log("Nome:", dndCharacter.name);
console.log("Sistema:", dndCharacter.system);
console.log("Atributos disponíveis:", dndCharacter.attributes?.length);

// Exemplo de atributos do D&D 5e
console.log("\n=== ATRIBUTOS D&D 5e ===");
const dndAttributes = dndCharacter.attributes as Array<{name: string, value: unknown, category: string}>;
const abilities = dndAttributes.filter(attr => attr.category === "abilities");
console.log("Atributos principais:", abilities.map(a => `${a.name}: ${a.value}`));

const skills = dndAttributes.filter(attr => attr.category === "skills");
console.log("Perícias (primeiras 5):", skills.slice(0, 5).map(s => `${s.name}: ${s.value}`));

// ================================
// EXEMPLO 2: Criando personagem Fate
// ================================

console.log("\n=== CRIANDO PERSONAGEM FATE ===");

const fateCharacterData = {
    name: "Maya Sombraluna",
    highConcept: "Ladina Élfica com Coração de Ouro",
    trouble: "Não Consegue Resistir a um Mistério"
};

const fateCharacter = SystemManager.createCharacterForSystem(RPGSystem.FATE, fateCharacterData);

console.log("Personagem Fate criado:");
console.log("Nome:", fateCharacter.name);
console.log("Sistema:", fateCharacter.system);
console.log("Conceito Principal:", fateCharacter.highConcept);
console.log("Dificuldade:", fateCharacter.trouble);

// Exemplo de atributos do Fate
console.log("\n=== ATRIBUTOS FATE ===");
const fateAttributes = fateCharacter.attributes as Array<{name: string, value: unknown, category: string}>;
const aspects = fateAttributes.filter(attr => attr.category === "aspects");
console.log("Aspectos:", aspects.map(a => `${a.name}: ${a.value}`));

const approaches = fateAttributes.filter(attr => attr.category === "approaches");
console.log("Abordagens:", approaches.map(a => `${a.name}: ${a.value}`));

const stress = fateAttributes.filter(attr => attr.category === "stress");
console.log("Estresse (primeiras 4):", stress.slice(0, 4).map(s => `${s.name}: ${s.value}`));

// ================================
// EXEMPLO 3: Validação de sistemas
// ================================

console.log("\n=== VALIDAÇÃO DE PERSONAGENS ===");

// Validar personagem D&D 5e
const dndValidation = SystemManager.validateCharacter(dndCharacter as Record<string, unknown>, RPGSystem.DND5e);
console.log("D&D 5e válido:", dndValidation.isValid);
if (!dndValidation.isValid) {
    console.log("Erros D&D:", dndValidation.errors);
}

// Validar personagem Fate
const fateValidation = SystemManager.validateCharacter(fateCharacter as Record<string, unknown>, RPGSystem.FATE);
console.log("Fate válido:", fateValidation.isValid);
if (!fateValidation.isValid) {
    console.log("Erros Fate:", fateValidation.errors);
}

// ================================
// EXEMPLO 4: Migração entre sistemas
// ================================

console.log("\n=== MIGRAÇÃO DE SISTEMAS ===");

// Migrar D&D para Fate
console.log("Migrando Thorin (D&D) para Fate...");
const thorinAsFate = migrateCharacterSystem(dndCharacter as Record<string, unknown>, RPGSystem.FATE);

console.log("Thorin migrado para Fate:");
console.log("Nome:", thorinAsFate.name);
console.log("Sistema:", thorinAsFate.system);
console.log("Campos D&D removidos:", !thorinAsFate.race && !thorinAsFate.class ? "✓" : "✗");

// Migrar Fate para D&D
console.log("\nMigrando Maya (Fate) para D&D...");
const mayaAsDnD = migrateCharacterSystem(fateCharacter as Record<string, unknown>, RPGSystem.DND5e);

console.log("Maya migrada para D&D:");
console.log("Nome:", mayaAsDnD.name);
console.log("Sistema:", mayaAsDnD.system);
console.log("Campos D&D inicializados:", mayaAsDnD.race === "" && mayaAsDnD.class === "" ? "✓" : "✗");

// ================================
// EXEMPLO 5: Formatação para exibição
// ================================

console.log("\n=== FORMATAÇÃO PARA EXIBIÇÃO ===");

// Formatar D&D para exibição
const dndFormatted = SystemManager.formatCharacterForDisplay(dndCharacter as Record<string, unknown>, RPGSystem.DND5e);
console.log("D&D formatado para exibição:");
console.log("Sistema:", (dndFormatted._systemInfo as any)?.name);
console.log("Categorias de atributos:", Object.keys(dndFormatted._attributesByCategory || {}));

// Formatar Fate para exibição
const fateFormatted = SystemManager.formatCharacterForDisplay(fateCharacter as Record<string, unknown>, RPGSystem.FATE);
console.log("\nFate formatado para exibição:");
console.log("Sistema:", (fateFormatted._systemInfo as any)?.name);
console.log("Categorias de atributos:", Object.keys(fateFormatted._attributesByCategory || {}));

// ================================
// EXEMPLO 6: Filtragem de campos
// ================================

console.log("\n=== FILTRAGEM DE CAMPOS POR SISTEMA ===");

// Criar um personagem "híbrido" com campos dos dois sistemas
const hybridCharacter = {
    name: "Híbrido",
    system: RPGSystem.DND5e,
    // Campos D&D
    race: "Humano",
    class: "Mago",
    level: 5,
    // Campos Fate (que devem ser filtrados)
    highConcept: "Não deveria aparecer",
    trouble: "Não deveria aparecer",
    fatePoints: 3,
    attributes: [
        ...dndAttributes,
        ...fateAttributes
    ]
};

// Filtrar para D&D (remove campos do Fate)
const filteredForDnD = SystemManager.filterFieldsForSystem(hybridCharacter, RPGSystem.DND5e);
console.log("Híbrido filtrado para D&D:");
console.log("Tem race:", !!filteredForDnD.race);
console.log("Tem highConcept:", !!filteredForDnD.highConcept); // Deve ser false
console.log("Tem fatePoints:", !!filteredForDnD.fatePoints); // Deve ser false

// Filtrar para Fate (remove campos do D&D)
const filteredForFate = SystemManager.filterFieldsForSystem(hybridCharacter, RPGSystem.FATE);
console.log("\nHíbrido filtrado para Fate:");
console.log("Tem race:", !!filteredForFate.race); // Deve ser false
console.log("Tem highConcept:", !!filteredForFate.highConcept);
console.log("Tem fatePoints:", !!filteredForFate.fatePoints);

// ================================
// RESUMO FINAL
// ================================

console.log("\n=== RESUMO DO SISTEMA ===");
console.log("✅ Sistemas suportados:", SystemManager.getSupportedSystems());
console.log("✅ Templates automáticos por sistema");
console.log("✅ Validação específica por sistema");
console.log("✅ Migração entre sistemas preservando dados compatíveis");
console.log("✅ Filtragem de campos para exibição correta");
console.log("✅ Formatação automática para interfaces");

console.log("\n🎯 PRINCIPAIS DIFERENÇAS ENTRE SISTEMAS:");
console.log("D&D 5e: Atributos numéricos, perícias, saves, níveis, classes");
console.log("Fate: Aspectos, abordagens, estresse, pontos de destino, façanhas");
console.log("Sistema gerencia automaticamente qual conjunto exibir!");

export {};

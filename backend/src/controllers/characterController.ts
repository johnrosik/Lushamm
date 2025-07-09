import { Request, Response } from 'express';
import { Character, Campaign, ICampaign } from '../models/node';
import { RPGSystem } from '../models/node';
import { SystemManager } from '../services/systemManager';
import { getCharacterTemplate, validateCharacterForSystem, migrateCharacterSystem } from '../services/characterTemplates';

interface CreateCharacterRequest {
    name: string;
    campaignId: string;
    system: RPGSystem;
    race?: string;
    class?: string;
    level?: number;
}

export class CharacterController {
    // Criar novo personagem
    static async createCharacter(req: Request, res: Response) {
        try {
            const { name, campaignId, system, race, class: characterClass, level = 1 }: CreateCharacterRequest = req.body;
            const playerId = req.user?.id;

            if (!playerId) {
                return res.status(401).json({ error: 'Usuário não autenticado' });
            }

            // Verificar se o sistema é suportado
            if (!SystemManager.isSystemSupported(system)) {
                return res.status(400).json({ 
                    error: `Sistema ${system} não é totalmente suportado. Sistemas suportados: ${SystemManager.getSupportedSystems().join(', ')}` 
                });
            }

            // Verificar se a campanha existe e se o usuário tem acesso
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                return res.status(404).json({ error: 'Campanha não encontrada' });
            }

            const isGM = campaign.gmId.toString() === playerId;
            const isPlayer = campaign.players.includes(playerId as never);

            if (!isGM && !isPlayer) {
                return res.status(403).json({ error: 'Acesso negado à campanha' });
            }

            // Verificar se o sistema da campanha é compatível
            if (campaign.system !== system) {
                return res.status(400).json({ 
                    error: `Personagem deve usar o sistema da campanha: ${campaign.system}` 
                });
            }

            // Criar dados básicos do personagem
            const basicData = {
                name,
                playerId,
                campaignId,
                race,
                class: characterClass,
                level,
                isPublic: false,
                allowEdit: []
            };

            // Usar SystemManager para criar personagem com template correto
            const characterData = SystemManager.createCharacterForSystem(system, basicData);

            const character = new Character(characterData);
            await character.save();

            // Adicionar personagem à campanha
            campaign.characters.push(character._id as never);
            await campaign.save();

            // Retornar personagem formatado para exibição
            const formattedCharacter = SystemManager.formatCharacterForDisplay(character.toObject() as unknown as Record<string, unknown>, system);

            res.status(201).json(formattedCharacter);
        } catch (error) {
            console.error('Erro ao criar personagem:', error);
            res.status(500).json({ error: 'Erro ao criar personagem' });
        }
    }

    // Buscar personagem específico
    static async getCharacter(req: Request, res: Response) {
        try {
            const { characterId } = req.params;
            const userId = req.user?.id;

            const character = await Character.findById(characterId)
                .populate('playerId', 'username avatar')
                .populate({
                    path: 'campaignId',
                    select: 'name gmId players'
                });

            if (!character) {
                return res.status(404).json({ error: 'Personagem não encontrado' });
            }

            // Verificar permissões de acesso (usando unknown para resolver problemas de tipo)
            const campaignData = character.campaignId as unknown as { gmId: { toString: () => string }; players: string[] };
            const isOwner = character.playerId.toString() === userId;
            const isGM = campaignData.gmId.toString() === userId;
            const isInCampaign = campaignData.players.includes(userId as never);
            const hasEditPermission = character.allowEdit.includes(userId as never);

            if (!isOwner && !isGM && !isInCampaign && !character.isPublic && !hasEditPermission) {
                return res.status(403).json({ error: 'Acesso negado' });
            }

            // Retornar personagem formatado para o sistema específico
            const formattedCharacter = SystemManager.formatCharacterForDisplay(
                character.toObject() as unknown as Record<string, unknown>, 
                character.system
            );

            res.json(formattedCharacter);
        } catch (error) {
            console.error('Erro ao buscar personagem:', error);
            res.status(500).json({ error: 'Erro ao buscar personagem' });
        }
    }

    // Listar personagens do usuário
    static async getUserCharacters(req: Request, res: Response) {
        try {
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: 'Usuário não autenticado' });
            }

            const characters = await Character.find({
                $or: [
                    { playerId: userId },
                    { allowEdit: userId },
                    { isPublic: true }
                ]
            }).populate('campaignId', 'name system');

            res.json(characters);
        } catch (error) {
            console.error('Erro ao buscar personagens:', error);
            res.status(500).json({ error: 'Erro ao buscar personagens' });
        }
    }

    // Listar personagens de uma campanha
    static async getCampaignCharacters(req: Request, res: Response) {
        try {
            const { campaignId } = req.params;
            const userId = req.user?.id;

            // Verificar acesso à campanha
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                return res.status(404).json({ error: 'Campanha não encontrada' });
            }

            const isGM = campaign.gmId.toString() === userId;
            const isPlayer = campaign.players.includes(userId as never);

            if (!isGM && !isPlayer) {
                return res.status(403).json({ error: 'Acesso negado à campanha' });
            }

            const characters = await Character.find({ campaignId })
                .populate('playerId', 'username avatar');

            res.json(characters);
        } catch (error) {
            console.error('Erro ao buscar personagens da campanha:', error);
            res.status(500).json({ error: 'Erro ao buscar personagens da campanha' });
        }
    }

    // Validar personagem para o sistema
    static async validateCharacter(req: Request, res: Response) {
        try {
            const { characterId } = req.params;
            const userId = req.user?.id;

            const character = await Character.findById(characterId);
            if (!character) {
                return res.status(404).json({ error: 'Personagem não encontrado' });
            }

            // Verificar permissões (owner, GM ou edit permission)
            const campaign = await Campaign.findById(character.campaignId);
            const isOwner = character.playerId.toString() === userId;
            const isGM = campaign?.gmId.toString() === userId;
            const hasEditPermission = character.allowEdit.includes(userId as never);

            if (!isOwner && !isGM && !hasEditPermission) {
                return res.status(403).json({ error: 'Acesso negado' });
            }

            // Validar personagem para o sistema
            const validation = SystemManager.validateCharacter(
                character.toObject() as unknown as Record<string, unknown>, 
                character.system
            );

            res.json(validation);
        } catch (error) {
            console.error('Erro ao validar personagem:', error);
            res.status(500).json({ error: 'Erro ao validar personagem' });
        }
    }

    // Migrar personagem para outro sistema
    static async migrateCharacterSystem(req: Request, res: Response) {
        try {
            const { characterId } = req.params;
            const { newSystem } = req.body;
            const userId = req.user?.id;

            if (!SystemManager.isSystemSupported(newSystem)) {
                return res.status(400).json({ 
                    error: `Sistema ${newSystem} não é suportado` 
                });
            }

            const character = await Character.findById(characterId);
            if (!character) {
                return res.status(404).json({ error: 'Personagem não encontrado' });
            }

            // Verificar permissões (owner ou GM)
            const campaign = await Campaign.findById(character.campaignId);
            const isOwner = character.playerId.toString() === userId;
            const isGM = campaign?.gmId.toString() === userId;

            if (!isOwner && !isGM) {
                return res.status(403).json({ error: 'Apenas o dono ou GM podem migrar o sistema' });
            }

            // Verificar se a campanha permite este sistema
            if (campaign && campaign.system !== newSystem) {
                return res.status(400).json({ 
                    error: `A campanha usa o sistema ${campaign.system}. Não é possível migrar para ${newSystem}` 
                });
            }

            // Migrar personagem
            const migratedData = migrateCharacterSystem(
                character.toObject() as unknown as Record<string, unknown>, 
                newSystem
            );

            // Atualizar personagem no banco
            await Character.findByIdAndUpdate(characterId, migratedData);
            const updatedCharacter = await Character.findById(characterId);

            if (!updatedCharacter) {
                return res.status(500).json({ error: 'Erro ao recuperar personagem migrado' });
            }

            // Retornar personagem formatado para o novo sistema
            const formattedCharacter = SystemManager.formatCharacterForDisplay(
                updatedCharacter.toObject() as unknown as Record<string, unknown>, 
                newSystem
            );

            res.json({
                message: `Personagem migrado com sucesso para ${newSystem}`,
                character: formattedCharacter
            });
        } catch (error) {
            console.error('Erro ao migrar personagem:', error);
            res.status(500).json({ error: 'Erro ao migrar personagem' });
        }
    }

    // Obter informações sobre sistemas suportados
    static async getSupportedSystems(req: Request, res: Response) {
        try {
            const systems = SystemManager.getSupportedSystems().map(system => ({
                id: system,
                info: SystemManager.getSystemInfo(system)
            }));

            res.json({
                supportedSystems: systems,
                currentlySupported: SystemManager.getSupportedSystems()
            });
        } catch (error) {
            console.error('Erro ao obter sistemas suportados:', error);
            res.status(500).json({ error: 'Erro ao obter sistemas suportados' });
        }
    }

    // Atualizar personagem com validações de sistema
    static async updateCharacter(req: Request, res: Response) {
        try {
            const { characterId } = req.params;
            const updates = req.body;
            const userId = req.user?.id;

            const character = await Character.findById(characterId);
            if (!character) {
                return res.status(404).json({ error: 'Personagem não encontrado' });
            }

            // Verificar permissões
            const campaign = await Campaign.findById(character.campaignId);
            const isOwner = character.playerId.toString() === userId;
            const isGM = campaign?.gmId.toString() === userId;
            const hasEditPermission = character.allowEdit.includes(userId as never);

            if (!isOwner && !isGM && !hasEditPermission) {
                return res.status(403).json({ error: 'Acesso negado' });
            }

            // Calcular valores derivados se necessário
            let updatedData = { ...character.toObject(), ...updates };
            updatedData = SystemManager.calculateDerivedValues(
                updatedData as unknown as Record<string, unknown>, 
                character.system
            );

            // Validar dados atualizados
            const validation = SystemManager.validateCharacter(
                updatedData as Record<string, unknown>, 
                character.system
            );

            if (!validation.isValid) {
                return res.status(400).json({
                    error: 'Dados inválidos para o sistema',
                    validation
                });
            }

            // Atualizar personagem
            const updatedCharacter = await Character.findByIdAndUpdate(
                characterId,
                updatedData,
                { new: true, runValidators: true }
            );

            if (!updatedCharacter) {
                return res.status(500).json({ error: 'Erro ao atualizar personagem' });
            }

            // Retornar personagem formatado
            const formattedCharacter = SystemManager.formatCharacterForDisplay(
                updatedCharacter.toObject() as unknown as Record<string, unknown>, 
                character.system
            );

            res.json(formattedCharacter);
        } catch (error) {
            console.error('Erro ao atualizar personagem:', error);
            res.status(500).json({ error: 'Erro ao atualizar personagem' });
        }
    }

    // Deletar personagem
    static async deleteCharacter(req: Request, res: Response) {
        try {
            const { characterId } = req.params;
            const userId = req.user?.id;

            const character = await Character.findById(characterId).populate('campaignId', 'gmId');

            if (!character) {
                return res.status(404).json({ error: 'Personagem não encontrado' });
            }

            // Apenas o dono ou GM pode deletar
            const campaignData = character.campaignId as unknown as { gmId: { toString: () => string } };
            const isOwner = character.playerId.toString() === userId;
            const isGM = campaignData.gmId.toString() === userId;

            if (!isOwner && !isGM) {
                return res.status(403).json({ error: 'Permissão negada para deletar personagem' });
            }

            await Character.findByIdAndDelete(characterId);

            // Remover da campanha
            await Campaign.findByIdAndUpdate(character.campaignId, {
                $pull: { characters: characterId }
            });

            res.json({ message: 'Personagem deletado com sucesso' });
        } catch (error) {
            console.error('Erro ao deletar personagem:', error);
            res.status(500).json({ error: 'Erro ao deletar personagem' });
        }
    }

    // Adicionar item ao inventário
    static async addInventoryItem(req: Request, res: Response) {
        try {
            const { characterId } = req.params;
            const { item } = req.body;
            const userId = req.user?.id;

            const character = await Character.findById(characterId).populate('campaignId', 'gmId settings');

            if (!character) {
                return res.status(404).json({ error: 'Personagem não encontrado' });
            }

            // Verificar permissões (addInventoryItem)
            const campaignData = character.campaignId as unknown as { gmId: { toString: () => string }; settings?: { allowPlayerCharacterEdit: boolean } };
            const isOwner = character.playerId.toString() === userId;
            const isGM = campaignData.gmId.toString() === userId;
            const canEdit = isGM || (isOwner && campaignData.settings?.allowPlayerCharacterEdit);

            if (!canEdit) {
                return res.status(403).json({ error: 'Permissão negada' });
            }

            character.inventory.push(item);
            await character.save();

            res.json(character);
        } catch (error) {
            console.error('Erro ao adicionar item:', error);
            res.status(500).json({ error: 'Erro ao adicionar item' });
        }
    }

    // Adicionar habilidade/magia
    static async addAbility(req: Request, res: Response) {
        try {
            const { characterId } = req.params;
            const { ability } = req.body;
            const userId = req.user?.id;

            const character = await Character.findById(characterId).populate('campaignId', 'gmId settings');

            if (!character) {
                return res.status(404).json({ error: 'Personagem não encontrado' });
            }

            // Verificar permissões (addAbility)
            const campaignData2 = character.campaignId as unknown as { gmId: { toString: () => string }; settings?: { allowPlayerCharacterEdit: boolean } };
            const isOwner2 = character.playerId.toString() === userId;
            const isGM2 = campaignData2.gmId.toString() === userId;
            const canEdit2 = isGM2 || (isOwner2 && campaignData2.settings?.allowPlayerCharacterEdit);

            if (!canEdit2) {
                return res.status(403).json({ error: 'Permissão negada' });
            }

            character.abilities.push(ability);
            await character.save();

            res.json(character);
        } catch (error) {
            console.error('Erro ao adicionar habilidade:', error);
            res.status(500).json({ error: 'Erro ao adicionar habilidade' });
        }
    }
}

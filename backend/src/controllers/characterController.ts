import { Request, Response } from 'express';
import { Character, Campaign, RPGSystem } from '../models/node';
import { SystemManager } from '../services/systemManager';

// === INTERFACES E TIPOS ===

interface CreateCharacterRequest {
    name: string;
    campaignId: string;
    system: RPGSystem;
    race?: string;
    class?: string;
    level?: number;
}

interface UpdateCharacterRequest {
    name?: string;
    race?: string;
    class?: string;
    level?: number;
    attributes?: Record<string, unknown>;
    inventory?: unknown[];
    abilities?: unknown[];
    [key: string]: unknown;
}

interface CharacterPermissions {
    isOwner: boolean;
    isGM: boolean;
    isInCampaign: boolean;
    hasEditPermission: boolean;
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

// Campos de seleção otimizados
const CHARACTER_SELECT_FIELDS = 'name race class level system attributes inventory abilities isPublic allowEdit playerId campaignId createdAt updatedAt';
const USER_SELECT_FIELDS = 'username avatar role';

export class CharacterController {
    
    // === MÉTODOS UTILITÁRIOS PRIVADOS ===
    
    /**
     * Verifica se o usuário está autenticado
     */
    private static validateAuthentication(req: Request): string {
        const userId = req.user?.id;
        if (!userId) {
            throw new Error('Usuário não autenticado');
        }
        return userId;
    }

    /**
     * Valida ObjectId do MongoDB
     */
    private static validateObjectId(id: string, entityName: string): void {
        if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
            throw new Error(`${entityName} ID inválido`);
        }
    }

    /**
     * Busca personagem com validação de existência
     */
    private static async findCharacterById(characterId: string) {
        this.validateObjectId(characterId, 'Personagem');
        
        const character = await Character.findById(characterId)
            .select(CHARACTER_SELECT_FIELDS);
            
        if (!character) {
            throw new Error('Personagem não encontrado');
        }
        
        return character;
    }

    /**
     * Calcula permissões do usuário para um personagem
     */
    private static async calculatePermissions(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        character: Record<string, any>, 
        userId: string
    ): Promise<CharacterPermissions> {
        // Verifica se é o dono do personagem
        const isOwner = character.playerId?.toString() === userId;
        
        // Busca informações da campanha
        const campaign = await Campaign.findById(character.campaignId)
            .select('gmId players');
            
        if (!campaign) {
            throw new Error('Campanha não encontrada');
        }

        const isGM = campaign.gmId.toString() === userId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isInCampaign = campaign.players.some((p: any) => p.toString() === userId);
        const allowEdit = character.allowEdit || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasEditPermission = allowEdit.some((id: Record<string, any>) => id.toString() === userId);
        
        return {
            isOwner,
            isGM,
            isInCampaign,
            hasEditPermission,
            canView: isOwner || isGM || isInCampaign || Boolean(character.isPublic) || hasEditPermission,
            canEdit: isOwner || isGM || hasEditPermission,
            canDelete: isOwner || isGM
        };
    }

    /**
     * Wrapper para tratamento de erros
     */
    private static handleError(error: unknown, res: Response, defaultMessage: string): void {
        console.error(`${defaultMessage}:`, error);
        
        if (error instanceof Error) {
            const statusCode = this.getErrorStatusCode(error.message);
            res.status(statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: defaultMessage });
        }
    }

    /**
     * Mapeia mensagens de erro para códigos HTTP
     */
    private static getErrorStatusCode(message: string): number {
        if (message.includes('não autenticado')) return 401;
        if (message.includes('não encontrado')) return 404;
        if (message.includes('Acesso negado') || message.includes('Permissão negada')) return 403;
        if (message.includes('inválido') || message.includes('não é suportado')) return 400;
        return 500;
    }

    /**
     * Processa atualizações do personagem
     */
    private static processCharacterUpdates(
        updates: UpdateCharacterRequest,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
        _character: any
    ): Partial<UpdateCharacterRequest> {
        const processed: Partial<UpdateCharacterRequest> = {};

        // Limpar strings
        if (updates.name) processed.name = updates.name.trim();
        if (updates.race) processed.race = updates.race.trim();
        if (updates.class) processed.class = updates.class.trim();

        // Validar level
        if (updates.level !== undefined) {
            processed.level = Math.max(1, Math.min(20, updates.level));
        }

        // Copiar outros campos
        if (updates.attributes) processed.attributes = updates.attributes;
        if (updates.inventory) processed.inventory = updates.inventory;
        if (updates.abilities) processed.abilities = updates.abilities;

        return processed;
    }

    // === MÉTODOS PRINCIPAIS ===

    /**
     * Lista todos os personagens acessíveis ao usuário
     */
    public static async listCharacters(req: Request, res: Response): Promise<void> {
        try {
            const userId = this.validateAuthentication(req);

            // Busca campanhas do usuário (como GM ou jogador)
            const campaigns = await Campaign.find({
                $or: [
                    { gmId: userId },
                    { players: userId }
                ]
            }).select('_id');

            const campaignIds = campaigns.map(c => c._id);

            // Busca personagens das campanhas + personagens públicos
            const characters = await Character.find({
                $or: [
                    { campaignId: { $in: campaignIds } },
                    { playerId: userId },
                    { isPublic: true }
                ]
            })
            .select(CHARACTER_SELECT_FIELDS)
            .populate('campaignId', 'name system')
            .populate('playerId', USER_SELECT_FIELDS)
            .sort({ updatedAt: -1 });

            // Calcula permissões para cada personagem
            const charactersWithPermissions = await Promise.all(
                characters.map(async (character) => {
                    const permissions = await this.calculatePermissions(character, userId);
                    
                    return {
                        ...character.toObject(),
                        permissions
                    };
                })
            );

            res.json({ 
                characters: charactersWithPermissions.filter(c => c.permissions.canView),
                total: charactersWithPermissions.length 
            });
        } catch (error) {
            this.handleError(error, res, 'Erro ao listar personagens');
        }
    }

    /**
     * Busca um personagem específico
     */
    public static async getCharacter(req: Request, res: Response): Promise<void> {
        try {
            const userId = this.validateAuthentication(req);
            const { id } = req.params;

            const character = await this.findCharacterById(id);
            const permissions = await this.calculatePermissions(character, userId);

            if (!permissions.canView) {
                res.status(403).json({ error: 'Acesso negado ao personagem' });
                return;
            }

            res.json({ 
                character: character.toObject(),
                permissions: {
                    canEdit: permissions.canEdit,
                    canDelete: permissions.canDelete
                }
            });
        } catch (error) {
            this.handleError(error, res, 'Erro ao buscar personagem');
        }
    }

    /**
     * Cria um novo personagem
     */
    public static async createCharacter(req: Request, res: Response): Promise<void> {
        try {
            const userId = this.validateAuthentication(req);
            const { 
                name, 
                campaignId, 
                system = 'dnd5e' as RPGSystem, 
                race, 
                class: characterClass, 
                level = 1 
            }: CreateCharacterRequest = req.body;

            // Validações de entrada
            if (!name || !campaignId || !system) {
                res.status(400).json({ error: 'Nome, ID da campanha e sistema são obrigatórios' });
                return;
            }

            // Verificar se o sistema é suportado
            if (!SystemManager.isSystemSupported(system)) {
                res.status(400).json({ 
                    error: `Sistema ${system} não é suportado. Sistemas disponíveis: ${SystemManager.getSupportedSystems().join(', ')}` 
                });
                return;
            }

            this.validateObjectId(campaignId, 'Campanha');

            // Verifica acesso à campanha
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                res.status(404).json({ error: 'Campanha não encontrada' });
                return;
            }

            const isGM = campaign.gmId.toString() === userId;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const isPlayer = campaign.players.some((p: any) => p.toString() === userId);

            if (!isGM && !isPlayer) {
                res.status(403).json({ error: 'Acesso negado à campanha' });
                return;
            }

            // Verificar compatibilidade do sistema
            if (campaign.system && campaign.system !== system) {
                res.status(400).json({ 
                    error: `Personagem deve usar o sistema da campanha: ${campaign.system}` 
                });
                return;
            }

            // Preparar dados do personagem
            const baseData = SystemManager.createCharacterForSystem(system, {
                name: name.trim(),
                race: race?.trim(),
                class: characterClass?.trim(),
                level: Math.max(1, level)
            });

            const characterData = {
                name: name.trim(),
                playerId: userId,
                campaignId,
                race: race?.trim(),
                class: characterClass?.trim(),
                level: Math.max(1, level),
                isPublic: false,
                allowEdit: [],
                ...baseData,
                system
            };

            // Cria o personagem
            const character = new Character(characterData);
            await character.save();

            // Adicionar à campanha (operação atômica)
            await Campaign.findByIdAndUpdate(
                campaignId,
                { $addToSet: { characters: character._id } },
                { new: true }
            );

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const savedCharacter = await this.findCharacterById((character as any)._id.toString());
            const permissions = await this.calculatePermissions(savedCharacter, userId);

            // Formatar resposta
            const formattedCharacter = SystemManager.formatCharacterForDisplay(
                savedCharacter.toObject() as unknown as Record<string, unknown>,
                system
            );

            res.status(201).json({ 
                message: 'Personagem criado com sucesso',
                character: formattedCharacter,
                permissions 
            });
        } catch (error) {
            this.handleError(error, res, 'Erro ao criar personagem');
        }
    }

    /**
     * Atualiza um personagem existente
     */
    public static async updateCharacter(req: Request, res: Response): Promise<void> {
        try {
            const userId = this.validateAuthentication(req);
            const { id } = req.params;
            const updates: UpdateCharacterRequest = req.body;

            this.validateObjectId(id, 'Personagem');

            if (!updates || Object.keys(updates).length === 0) {
                res.status(400).json({ error: 'Nenhum dado para atualizar' });
                return;
            }

            const character = await this.findCharacterById(id);
            const permissions = await this.calculatePermissions(character, userId);

            if (!permissions.canEdit) {
                res.status(403).json({ error: 'Permissão negada para editar personagem' });
                return;
            }

            // Processar atualizações
            const processedUpdates = this.processCharacterUpdates(updates, character);
            
            // Validar dados atualizados
            const mergedData = { ...character.toObject(), ...processedUpdates };
            const validation = SystemManager.validateCharacter(mergedData, character.system);

            if (!validation.isValid) {
                res.status(400).json({
                    error: 'Dados inválidos para o sistema',
                    validation
                });
                return;
            }

            // Atualizar personagem
            const updatedCharacter = await Character.findByIdAndUpdate(
                id,
                { 
                    ...processedUpdates,
                    updatedAt: new Date()
                },
                { new: true, runValidators: true }
            ).select(CHARACTER_SELECT_FIELDS);

            if (!updatedCharacter) {
                res.status(500).json({ error: 'Erro ao atualizar personagem' });
                return;
            }

            const newPermissions = await this.calculatePermissions(updatedCharacter, userId);

            const formattedCharacter = SystemManager.formatCharacterForDisplay(
                updatedCharacter.toObject() as unknown as Record<string, unknown>,
                character.system
            );

            res.json({ 
                message: 'Personagem atualizado com sucesso',
                character: formattedCharacter,
                permissions: newPermissions 
            });
        } catch (error) {
            this.handleError(error, res, 'Erro ao atualizar personagem');
        }
    }

    /**
     * Remove um personagem
     */
    public static async deleteCharacter(req: Request, res: Response): Promise<void> {
        try {
            const userId = this.validateAuthentication(req);
            const { id } = req.params;

            const character = await this.findCharacterById(id);
            const permissions = await this.calculatePermissions(character, userId);

            if (!permissions.canDelete) {
                res.status(403).json({ error: 'Permissão negada para excluir personagem' });
                return;
            }

            // Deletar personagem e remover da campanha (transação)
            await Promise.all([
                Character.findByIdAndDelete(id),
                Campaign.findByIdAndUpdate(
                    character.campaignId,
                    { $pull: { characters: id } }
                )
            ]);

            res.json({ 
                message: 'Personagem excluído com sucesso',
                deletedId: id 
            });
        } catch (error) {
            this.handleError(error, res, 'Erro ao excluir personagem');
        }
    }

    /**
     * Alterna a visibilidade pública de um personagem
     */
    public static async togglePublic(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'Usuário não autenticado' });
                return;
            }

            const character = await this.findCharacterById(id);
            const permissions = await this.calculatePermissions(character, userId);

            if (!permissions.isOwner && !permissions.isGM) {
                res.status(403).json({ error: 'Apenas o dono ou GM pode alterar visibilidade' });
                return;
            }

            const updatedCharacter = await Character.findByIdAndUpdate(
                id,
                { 
                    isPublic: !character.isPublic,
                    updatedAt: new Date()
                },
                { new: true }
            ).select(CHARACTER_SELECT_FIELDS);

            if (!updatedCharacter) {
                res.status(404).json({ error: 'Personagem não encontrado' });
                return;
            }

            res.json({ 
                character: updatedCharacter.toObject(),
                message: `Personagem agora é ${updatedCharacter.isPublic ? 'público' : 'privado'}`
            });
        } catch (error) {
            console.error('Erro ao alterar visibilidade:', error);
            res.status(500).json({ 
                error: 'Erro interno do servidor',
                message: error instanceof Error ? error.message : 'Erro desconhecido'
            });
        }
    }

    /**
     * Duplica um personagem
     */
    public static async duplicateCharacter(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const userId = req.user?.id;
            const { name, campaignId } = req.body;

            if (!userId) {
                res.status(401).json({ error: 'Usuário não autenticado' });
                return;
            }

            if (!name?.trim()) {
                res.status(400).json({ error: 'Nome para o novo personagem é obrigatório' });
                return;
            }

            const originalCharacter = await this.findCharacterById(id);
            const permissions = await this.calculatePermissions(originalCharacter, userId);

            if (!permissions.canView) {
                res.status(403).json({ error: 'Acesso negado ao personagem original' });
                return;
            }

            // Valida campanha de destino se fornecida
            let targetCampaignId = originalCharacter.campaignId;
            if (campaignId) {
                this.validateObjectId(campaignId, 'Campanha de destino');
                
                const targetCampaign = await Campaign.findById(campaignId);
                if (!targetCampaign) {
                    res.status(404).json({ error: 'Campanha de destino não encontrada' });
                    return;
                }

                const isGM = targetCampaign.gmId.toString() === userId;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const isPlayer = targetCampaign.players.some((p: any) => p.toString() === userId);

                if (!isGM && !isPlayer) {
                    res.status(403).json({ error: 'Acesso negado à campanha de destino' });
                    return;
                }

                targetCampaignId = campaignId;
            }

            // Busca dados completos do personagem original
            const fullCharacter = await Character.findById(id);
            if (!fullCharacter) {
                res.status(404).json({ error: 'Personagem original não encontrado' });
                return;
            }

            // Cria a duplicata
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const characterData: any = fullCharacter.toObject();
            delete characterData._id;
            delete characterData.__v;

            const duplicatedCharacter = new Character({
                ...characterData,
                name,
                playerId: userId,
                campaignId: targetCampaignId,
                allowEdit: [],
                isPublic: false
            });

            await duplicatedCharacter.save();

            // Adicionar à campanha
            await Campaign.findByIdAndUpdate(
                targetCampaignId,
                { $addToSet: { characters: duplicatedCharacter._id } }
            );

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const savedCharacter = await this.findCharacterById((duplicatedCharacter as any)._id.toString());
            const newPermissions = await this.calculatePermissions(savedCharacter, userId);

            res.status(201).json({ 
                character: savedCharacter.toObject(),
                permissions: newPermissions,
                message: 'Personagem duplicado com sucesso'
            });
        } catch (error) {
            this.handleError(error, res, 'Erro ao duplicar personagem');
        }
    }

    /**
     * Listar personagens de uma campanha
     */
    public static async getCampaignCharacters(req: Request, res: Response): Promise<void> {
        try {
            const userId = this.validateAuthentication(req);
            const { campaignId } = req.params;

            this.validateObjectId(campaignId, 'Campanha');

            // Verificar acesso à campanha
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                res.status(404).json({ error: 'Campanha não encontrada' });
                return;
            }

            const isGM = campaign.gmId.toString() === userId;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const isPlayer = campaign.players.some((p: any) => p.toString() === userId);

            if (!isGM && !isPlayer) {
                res.status(403).json({ error: 'Acesso negado à campanha' });
                return;
            }

            const characters = await Character.find({ campaignId })
                .select(CHARACTER_SELECT_FIELDS)
                .populate('playerId', USER_SELECT_FIELDS)
                .sort({ name: 1 });

            // Formatar personagens
            const formattedCharacters = characters.map(character => 
                SystemManager.formatCharacterForDisplay(
                    character.toObject() as unknown as Record<string, unknown>,
                    character.system
                )
            );

            res.json({
                characters: formattedCharacters,
                total: formattedCharacters.length
            });
        } catch (error) {
            this.handleError(error, res, 'Erro ao buscar personagens da campanha');
        }
    }

    /**
     * Validar personagem para o sistema
     */
    public static async validateCharacter(req: Request, res: Response): Promise<void> {
        try {
            const userId = this.validateAuthentication(req);
            const { id } = req.params;

            const character = await this.findCharacterById(id);
            const permissions = await this.calculatePermissions(character, userId);

            if (!permissions.canView) {
                res.status(403).json({ error: 'Acesso negado' });
                return;
            }

            const validation = SystemManager.validateCharacter(
                character.toObject() as unknown as Record<string, unknown>, 
                character.system
            );

            res.json({
                validation,
                systemInfo: SystemManager.getSystemInfo(character.system)
            });
        } catch (error) {
            this.handleError(error, res, 'Erro ao validar personagem');
        }
    }

    /**
     * Obter sistemas suportados
     */
    public static async getSupportedSystems(req: Request, res: Response): Promise<void> {
        try {
            const systems = SystemManager.getSupportedSystems().map(system => ({
                id: system,
                name: system,
                info: SystemManager.getSystemInfo(system),
                isFullySupported: SystemManager.isSystemSupported(system)
            }));

            res.json({
                supportedSystems: systems,
                totalSystems: systems.length
            });
        } catch (error) {
            this.handleError(error, res, 'Erro ao obter sistemas suportados');
        }
    }
}

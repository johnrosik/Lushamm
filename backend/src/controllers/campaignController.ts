import { Request, Response } from 'express';
import { Campaign, Character, User } from '../models/node';
import { CampaignStatus, RPGSystem } from '../models/node';

// Interface para criação de campanha
interface CreateCampaignRequest {
    name: string;
    description?: string;
    system: RPGSystem;
    maxPlayers?: number;
}

export class CampaignController {
    // Criar nova campanha
    static async createCampaign(req: Request, res: Response) {
        try {
            const { name, description, system, maxPlayers = 6 }: CreateCampaignRequest = req.body;
            const gmId = req.user?.id; // Assumindo middleware de autenticação

            if (!gmId) {
                return res.status(401).json({ error: 'Usuário não autenticado' });
            }

            const campaign = new Campaign({
                name,
                description,
                system,
                gmId,
                status: CampaignStatus.PLANNING,
                settings: {
                    maxPlayers,
                    allowPlayerDiceRolls: true,
                    allowPlayerCharacterEdit: true,
                    publicRolls: true,
                    voiceChat: true,
                    videoChat: false
                }
            });

            await campaign.save();
            res.status(201).json(campaign);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao criar campanha' });
        }
    }

    // Listar campanhas do usuário
    static async getUserCampaigns(req: Request, res: Response) {
        try {
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: 'Usuário não autenticado' });
            }

            // Campanhas onde o usuário é GM ou jogador
            const campaigns = await Campaign.find({
                $or: [
                    { gmId: userId },
                    { players: userId }
                ]
            }).populate('gmId', 'username avatar')
              .populate('players', 'username avatar');

            res.json(campaigns);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar campanhas' });
        }
    }

    // Buscar campanha específica
    static async getCampaign(req: Request, res: Response) {
        try {
            const { campaignId } = req.params;
            const userId = req.user?.id;

            const campaign = await Campaign.findById(campaignId)
                .populate('gmId', 'username avatar')
                .populate('players', 'username avatar')
                .populate('characters');

            if (!campaign) {
                return res.status(404).json({ error: 'Campanha não encontrada' });
            }

            // Verificar se o usuário tem acesso à campanha
            const hasAccess = campaign.gmId.toString() === userId || 
                            campaign.players.some(p => p.toString() === userId);

            if (!hasAccess) {
                return res.status(403).json({ error: 'Acesso negado' });
            }

            res.json(campaign);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao buscar campanha' });
        }
    }

    // Adicionar jogador à campanha
    static async addPlayer(req: Request, res: Response) {
        try {
            const { campaignId } = req.params;
            const { playerId } = req.body;
            const userId = req.user?.id;

            const campaign = await Campaign.findById(campaignId);

            if (!campaign) {
                return res.status(404).json({ error: 'Campanha não encontrada' });
            }

            // Verificar se é o GM
            if (campaign.gmId.toString() !== userId) {
                return res.status(403).json({ error: 'Apenas o GM pode adicionar jogadores' });
            }

            // Verificar limite de jogadores
            if (campaign.players.length >= campaign.settings.maxPlayers) {
                return res.status(400).json({ error: 'Campanha lotada' });
            }

            // Verificar se o jogador já está na campanha
            if (campaign.players.includes(playerId)) {
                return res.status(400).json({ error: 'Jogador já está na campanha' });
            }

            campaign.players.push(playerId);
            await campaign.save();

            res.json({ message: 'Jogador adicionado com sucesso' });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao adicionar jogador' });
        }
    }

    // Remover jogador da campanha
    static async removePlayer(req: Request, res: Response) {
        try {
            const { campaignId, playerId } = req.params;
            const userId = req.user?.id;

            const campaign = await Campaign.findById(campaignId);

            if (!campaign) {
                return res.status(404).json({ error: 'Campanha não encontrada' });
            }

            // Verificar se é o GM
            if (campaign.gmId.toString() !== userId) {
                return res.status(403).json({ error: 'Apenas o GM pode remover jogadores' });
            }

            campaign.players = campaign.players.filter(id => id.toString() !== playerId);
            await campaign.save();

            res.json({ message: 'Jogador removido com sucesso' });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao remover jogador' });
        }
    }

    // Atualizar configurações da campanha
    static async updateSettings(req: Request, res: Response) {
        try {
            const { campaignId } = req.params;
            const userId = req.user?.id;
            const settings = req.body;

            const campaign = await Campaign.findById(campaignId);

            if (!campaign) {
                return res.status(404).json({ error: 'Campanha não encontrada' });
            }

            // Verificar se é o GM
            if (campaign.gmId.toString() !== userId) {
                return res.status(403).json({ error: 'Apenas o GM pode alterar configurações' });
            }

            campaign.settings = { ...campaign.settings, ...settings };
            await campaign.save();

            res.json(campaign);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao atualizar configurações' });
        }
    }

    // Iniciar sessão
    static async startSession(req: Request, res: Response) {
        try {
            const { campaignId } = req.params;
            const { sessionName } = req.body;
            const userId = req.user?.id;

            const campaign = await Campaign.findById(campaignId);

            if (!campaign) {
                return res.status(404).json({ error: 'Campanha não encontrada' });
            }

            // Verificar se é o GM
            if (campaign.gmId.toString() !== userId) {
                return res.status(403).json({ error: 'Apenas o GM pode iniciar sessões' });
            }

            const newSession = {
                name: sessionName || `Sessão ${campaign.sessions.length + 1}`,
                date: new Date(),
                duration: 0,
                notes: '',
                chatHistory: [],
                isCompleted: false
            };

            campaign.sessions.push(newSession);
            campaign.status = CampaignStatus.ACTIVE;
            await campaign.save();

            res.json({ message: 'Sessão iniciada', session: newSession });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao iniciar sessão' });
        }
    }
}

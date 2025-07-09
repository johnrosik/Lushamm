import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server } from 'http';
import { Campaign, Character } from '../models/node';

// Interface para dados do usuário conectado
interface ConnectedUser {
    id: string;
    username: string;
    role: 'player' | 'gm' | 'admin';
    campaignId?: string;
    socketId: string;
}

// Interface para mensagem de chat
interface ChatMessage {
    id: string;
    content: string;
    type: 'text' | 'dice' | 'image' | 'system' | 'whisper';
    senderId: string;
    senderName: string;
    targetId?: string; // Para whispers
    timestamp: Date;
    diceRoll?: any;
    imageUrl?: string;
    isVisible: boolean;
}

// Interface para posição de token no mapa
interface TokenPosition {
    tokenId: string;
    x: number;
    y: number;
    rotation?: number;
    campaignId: string;
}

export class WebSocketController {
    private io: SocketIOServer;
    private connectedUsers: Map<string, ConnectedUser> = new Map();
    private campaignRooms: Map<string, Set<string>> = new Map(); // campaignId -> Set of socketIds

    constructor(server: Server) {
        this.io = new SocketIOServer(server, {
            cors: {
                origin: "*", // Configurar adequadamente em produção
                methods: ["GET", "POST"]
            }
        });

        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        this.io.on('connection', (socket: Socket) => {
            console.log(`Cliente conectado: ${socket.id}`);

            // Eventos de autenticação e entrada em campanha
            socket.on('authenticate', this.handleAuthenticate.bind(this, socket));
            socket.on('join-campaign', this.handleJoinCampaign.bind(this, socket));
            socket.on('leave-campaign', this.handleLeaveCampaign.bind(this, socket));

            // Eventos de chat
            socket.on('send-message', this.handleSendMessage.bind(this, socket));
            socket.on('send-whisper', this.handleSendWhisper.bind(this, socket));
            socket.on('roll-dice', this.handleRollDice.bind(this, socket));

            // Eventos de mapa
            socket.on('move-token', this.handleMoveToken.bind(this, socket));
            socket.on('add-token', this.handleAddToken.bind(this, socket));
            socket.on('remove-token', this.handleRemoveToken.bind(this, socket));
            socket.on('update-fog', this.handleUpdateFog.bind(this, socket));

            // Eventos de personagem
            socket.on('update-character', this.handleUpdateCharacter.bind(this, socket));
            socket.on('update-hp', this.handleUpdateHP.bind(this, socket));

            // Eventos de mídia
            socket.on('reveal-image', this.handleRevealImage.bind(this, socket));
            socket.on('play-sound', this.handlePlaySound.bind(this, socket));

            // Evento de desconexão
            socket.on('disconnect', this.handleDisconnect.bind(this, socket));
        });
    }

    // Autenticar usuário
    private async handleAuthenticate(socket: Socket, data: { userId: string; username: string; role: string }) {
        try {
            const { userId, username, role } = data;

            const user: ConnectedUser = {
                id: userId,
                username,
                role: role as 'player' | 'gm' | 'admin',
                socketId: socket.id
            };

            this.connectedUsers.set(socket.id, user);
            
            socket.emit('authenticated', { success: true, user });
            console.log(`Usuário autenticado: ${username} (${socket.id})`);
        } catch (error) {
            console.error('Erro na autenticação:', error);
            socket.emit('error', { message: 'Erro na autenticação' });
        }
    }

    // Entrar em uma campanha
    private async handleJoinCampaign(socket: Socket, data: { campaignId: string }) {
        try {
            const { campaignId } = data;
            const user = this.connectedUsers.get(socket.id);

            if (!user) {
                socket.emit('error', { message: 'Usuário não autenticado' });
                return;
            }

            // Verificar se o usuário tem acesso à campanha
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                socket.emit('error', { message: 'Campanha não encontrada' });
                return;
            }

            const hasAccess = campaign.gmId.toString() === user.id || 
                            campaign.players.includes(user.id as never);

            if (!hasAccess) {
                socket.emit('error', { message: 'Acesso negado à campanha' });
                return;
            }

            // Sair da campanha anterior se existir
            if (user.campaignId) {
                await this.handleLeaveCampaign(socket, { campaignId: user.campaignId });
            }

            // Entrar na nova campanha
            socket.join(`campaign-${campaignId}`);
            user.campaignId = campaignId;

            // Adicionar à lista de usuários da campanha
            if (!this.campaignRooms.has(campaignId)) {
                this.campaignRooms.set(campaignId, new Set());
            }
            this.campaignRooms.get(campaignId)!.add(socket.id);

            // Notificar outros usuários da campanha
            socket.to(`campaign-${campaignId}`).emit('user-joined', {
                user: { id: user.id, username: user.username, role: user.role }
            });

            // Enviar dados iniciais da campanha
            const campaignData = await Campaign.findById(campaignId)
                .populate('players', 'username avatar')
                .populate('characters');

            socket.emit('campaign-joined', {
                campaign: campaignData,
                connectedUsers: this.getCampaignUsers(campaignId)
            });

            console.log(`${user.username} entrou na campanha ${campaignId}`);
        } catch (error) {
            console.error('Erro ao entrar na campanha:', error);
            socket.emit('error', { message: 'Erro ao entrar na campanha' });
        }
    }

    // Sair de uma campanha
    private async handleLeaveCampaign(socket: Socket, data: { campaignId: string }) {
        const user = this.connectedUsers.get(socket.id);
        if (!user || !user.campaignId) return;

        const { campaignId } = data;
        
        socket.leave(`campaign-${campaignId}`);
        user.campaignId = undefined;

        // Remover da lista de usuários da campanha
        const campaignUsers = this.campaignRooms.get(campaignId);
        if (campaignUsers) {
            campaignUsers.delete(socket.id);
        }

        // Notificar outros usuários
        socket.to(`campaign-${campaignId}`).emit('user-left', {
            user: { id: user.id, username: user.username }
        });

        socket.emit('campaign-left', { campaignId });
        console.log(`${user.username} saiu da campanha ${campaignId}`);
    }

    // Enviar mensagem no chat
    private async handleSendMessage(socket: Socket, data: { content: string; type?: string }) {
        try {
            const user = this.connectedUsers.get(socket.id);
            if (!user || !user.campaignId) {
                socket.emit('error', { message: 'Usuário não está em uma campanha' });
                return;
            }

            const message: ChatMessage = {
                id: Date.now().toString(),
                content: data.content,
                type: data.type as any || 'text',
                senderId: user.id,
                senderName: user.username,
                timestamp: new Date(),
                isVisible: true
            };

            // Salvar mensagem na campanha
            const campaign = await Campaign.findById(user.campaignId);
            if (campaign) {
                campaign.globalChat.push(message as never);
                await campaign.save();
            }

            // Enviar para todos os usuários da campanha
            this.io.to(`campaign-${user.campaignId}`).emit('new-message', message);
            
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            socket.emit('error', { message: 'Erro ao enviar mensagem' });
        }
    }

    // Enviar whisper (mensagem privada)
    private async handleSendWhisper(socket: Socket, data: { content: string; targetId: string }) {
        try {
            const user = this.connectedUsers.get(socket.id);
            if (!user || !user.campaignId) {
                socket.emit('error', { message: 'Usuário não está em uma campanha' });
                return;
            }

            const { content, targetId } = data;

            // Encontrar o socket do usuário alvo
            const targetSocket = Array.from(this.connectedUsers.entries())
                .find(([_, u]) => u.id === targetId && u.campaignId === user.campaignId)?.[0];

            if (!targetSocket) {
                socket.emit('error', { message: 'Usuário alvo não encontrado ou offline' });
                return;
            }

            const whisper: ChatMessage = {
                id: Date.now().toString(),
                content,
                type: 'whisper',
                senderId: user.id,
                senderName: user.username,
                targetId,
                timestamp: new Date(),
                isVisible: true
            };

            // Enviar apenas para o remetente e destinatário
            socket.emit('new-whisper', whisper);
            this.io.to(targetSocket).emit('new-whisper', whisper);
            
        } catch (error) {
            console.error('Erro ao enviar whisper:', error);
            socket.emit('error', { message: 'Erro ao enviar whisper' });
        }
    }

    // Rolar dados
    private async handleRollDice(socket: Socket, data: { formula: string; context?: string; isPrivate?: boolean }) {
        try {
            const user = this.connectedUsers.get(socket.id);
            if (!user || !user.campaignId) {
                socket.emit('error', { message: 'Usuário não está em uma campanha' });
                return;
            }

            // Aqui você pode integrar com o DiceController
            // Por enquanto, uma implementação simples
            const { formula, context = '', isPrivate = false } = data;

            const rollResult = {
                formula,
                result: Math.floor(Math.random() * 20) + 1, // Simulação simples
                rollerId: user.id,
                rollerName: user.username,
                context,
                timestamp: new Date(),
                isPrivate
            };

            const message: ChatMessage = {
                id: Date.now().toString(),
                content: `🎲 **${context}**: ${formula} = **${rollResult.result}**`,
                type: 'dice',
                senderId: user.id,
                senderName: user.username,
                timestamp: new Date(),
                diceRoll: rollResult,
                isVisible: !isPrivate || user.role === 'gm'
            };

            // Se for privada, enviar apenas para GMs
            if (isPrivate) {
                const gmSockets = Array.from(this.connectedUsers.entries())
                    .filter(([_, u]) => u.campaignId === user.campaignId && u.role === 'gm')
                    .map(([socketId]) => socketId);

                gmSockets.forEach(gmSocket => {
                    this.io.to(gmSocket).emit('new-message', message);
                });
                socket.emit('new-message', message); // Enviar para o próprio jogador também
            } else {
                this.io.to(`campaign-${user.campaignId}`).emit('new-message', message);
            }
            
        } catch (error) {
            console.error('Erro ao rolar dados:', error);
            socket.emit('error', { message: 'Erro ao rolar dados' });
        }
    }

    // Mover token no mapa
    private async handleMoveToken(socket: Socket, data: TokenPosition) {
        try {
            const user = this.connectedUsers.get(socket.id);
            if (!user || !user.campaignId) return;

            // Verificar permissões (GM pode mover qualquer token, jogadores apenas seus próprios)
            if (user.role !== 'gm') {
                // Verificar se o token pertence ao jogador
                const character = await Character.findOne({
                    campaignId: user.campaignId,
                    playerId: user.id
                });
                
                if (!character || data.tokenId !== (character._id as any).toString()) {
                    socket.emit('error', { message: 'Permissão negada para mover este token' });
                    return;
                }
            }

            // Atualizar posição do token na campanha
            const campaign = await Campaign.findById(user.campaignId);
            if (campaign && campaign.maps.length > 0) {
                // Encontrar o mapa ativo e atualizar o token
                const activeMap = campaign.maps[0] as any; // Assumindo primeiro mapa como ativo
                const tokenIndex = activeMap.tokens.findIndex((t: any) => t._id.toString() === data.tokenId);
                
                if (tokenIndex !== -1) {
                    activeMap.tokens[tokenIndex].position.x = data.x;
                    activeMap.tokens[tokenIndex].position.y = data.y;
                    if (data.rotation !== undefined) {
                        activeMap.tokens[tokenIndex].position.rotation = data.rotation;
                    }
                    
                    await campaign.save();

                    // Notificar todos os usuários da campanha
                    this.io.to(`campaign-${user.campaignId}`).emit('token-moved', {
                        tokenId: data.tokenId,
                        position: { x: data.x, y: data.y, rotation: data.rotation },
                        movedBy: user.username
                    });
                }
            }
            
        } catch (error) {
            console.error('Erro ao mover token:', error);
            socket.emit('error', { message: 'Erro ao mover token' });
        }
    }

    // Revelar imagem para todos
    private async handleRevealImage(socket: Socket, data: { imageUrl: string; title?: string }) {
        try {
            const user = this.connectedUsers.get(socket.id);
            if (!user || !user.campaignId || user.role !== 'gm') {
                socket.emit('error', { message: 'Apenas o GM pode revelar imagens' });
                return;
            }

            const { imageUrl, title = 'Imagem revelada' } = data;

            this.io.to(`campaign-${user.campaignId}`).emit('image-revealed', {
                imageUrl,
                title,
                revealedBy: user.username,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('Erro ao revelar imagem:', error);
            socket.emit('error', { message: 'Erro ao revelar imagem' });
        }
    }

    // Outros handlers podem ser implementados aqui...
    private async handleAddToken(socket: Socket, data: any) {
        // Implementar lógica para adicionar token
    }

    private async handleRemoveToken(socket: Socket, data: any) {
        // Implementar lógica para remover token
    }

    private async handleUpdateFog(socket: Socket, data: any) {
        // Implementar lógica para névoa de guerra
    }

    private async handleUpdateCharacter(socket: Socket, data: any) {
        // Implementar lógica para atualizar personagem em tempo real
    }

    private async handleUpdateHP(socket: Socket, data: any) {
        // Implementar lógica para atualizar HP em tempo real
    }

    private async handlePlaySound(socket: Socket, data: any) {
        // Implementar lógica para tocar sons
    }

    // Evento de desconexão
    private handleDisconnect(socket: Socket) {
        const user = this.connectedUsers.get(socket.id);
        
        if (user) {
            // Sair da campanha se estiver em uma
            if (user.campaignId) {
                this.handleLeaveCampaign(socket, { campaignId: user.campaignId });
            }
            
            this.connectedUsers.delete(socket.id);
            console.log(`Usuário desconectado: ${user.username} (${socket.id})`);
        }
    }

    // Métodos auxiliares
    private getCampaignUsers(campaignId: string): ConnectedUser[] {
        const socketIds = this.campaignRooms.get(campaignId) || new Set();
        return Array.from(socketIds)
            .map(socketId => this.connectedUsers.get(socketId))
            .filter(user => user !== undefined) as ConnectedUser[];
    }

    // Método público para enviar notificações
    public sendNotificationToCampaign(campaignId: string, notification: any) {
        this.io.to(`campaign-${campaignId}`).emit('notification', notification);
    }

    // Método público para obter usuários conectados
    public getConnectedUsers(): ConnectedUser[] {
        return Array.from(this.connectedUsers.values());
    }
}

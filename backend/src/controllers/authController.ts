import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/node';
import { UserRole } from '../models/node';

interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    role?: UserRole;
}

interface LoginRequest {
    email: string;
    password: string;
}

export class AuthController {
    // Registrar novo usuário
    static async register(req: Request, res: Response) {
        try {
            const { username, email, password, role = UserRole.PLAYER }: RegisterRequest = req.body;

            // Validações básicas
            if (!username || !email || !password) {
                return res.status(400).json({ error: 'Username, email e password são obrigatórios' });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres' });
            }

            // Verificar se usuário já existe
            const existingUser = await User.findOne({
                $or: [{ email }, { username }]
            });

            if (existingUser) {
                return res.status(409).json({ error: 'Usuário ou email já existe' });
            }

            // Hash da senha
            const saltRounds = 12;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // Criar usuário
            const user = new User({
                username,
                email,
                passwordHash,
                role,
                preferences: {
                    theme: 'dark',
                    diceSound: true,
                    notifications: true,
                    autoRoll: false
                },
                isOnline: false
            });

            await user.save();

            // Gerar JWT
            const secret = process.env.JWT_SECRET || 'your-secret-key';
            const token = jwt.sign(
                {
                    userId: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                },
                secret,
                { expiresIn: '7d' }
            );

            // Retornar dados do usuário (sem senha)
            const userResponse = {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                preferences: user.preferences,
                lastActive: user.lastActive,
                isOnline: user.isOnline
            };

            res.status(201).json({
                message: 'Usuário criado com sucesso',
                user: userResponse,
                token
            });
        } catch (error) {
            console.error('Erro no registro:', error);
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Login
    static async login(req: Request, res: Response) {
        try {
            const { email, password }: LoginRequest = req.body;

            if (!email || !password) {
                return res.status(400).json({ error: 'Email e password são obrigatórios' });
            }

            // Buscar usuário
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }

            // Verificar senha
            const isValidPassword = await bcrypt.compare(password, user.passwordHash);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }

            // Atualizar último acesso e status online
            user.lastActive = new Date();
            user.isOnline = true;
            await user.save();

            // Gerar JWT
            const secret = process.env.JWT_SECRET || 'your-secret-key';
            const token = jwt.sign(
                {
                    userId: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                },
                secret,
                { expiresIn: '7d' }
            );

            // Retornar dados do usuário (sem senha)
            const userResponse = {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                preferences: user.preferences,
                lastActive: user.lastActive,
                isOnline: user.isOnline
            };

            res.json({
                message: 'Login realizado com sucesso',
                user: userResponse,
                token
            });
        } catch (error) {
            console.error('Erro no login:', error);
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Logout
    static async logout(req: Request, res: Response) {
        try {
            const userId = req.user?.id;

            if (userId) {
                // Atualizar status offline
                await User.findByIdAndUpdate(userId, {
                    isOnline: false,
                    lastActive: new Date()
                });
            }

            res.json({ message: 'Logout realizado com sucesso' });
        } catch (error) {
            console.error('Erro no logout:', error);
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Verificar token
    static async verifyToken(req: Request, res: Response) {
        try {
            const user = req.user;

            if (!user) {
                return res.status(401).json({ error: 'Token inválido' });
            }

            // Buscar dados atualizados do usuário
            const currentUser = await User.findById(user.id);
            if (!currentUser) {
                return res.status(401).json({ error: 'Usuário não encontrado' });
            }

            const userResponse = {
                id: currentUser._id,
                username: currentUser.username,
                email: currentUser.email,
                role: currentUser.role,
                avatar: currentUser.avatar,
                preferences: currentUser.preferences,
                lastActive: currentUser.lastActive,
                isOnline: currentUser.isOnline
            };

            res.json({ user: userResponse });
        } catch (error) {
            console.error('Erro na verificação do token:', error);
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Atualizar perfil
    static async updateProfile(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            const { username, avatar, preferences } = req.body;

            if (!userId) {
                return res.status(401).json({ error: 'Usuário não autenticado' });
            }

            // Verificar se o username já está em uso por outro usuário
            if (username) {
                const existingUser = await User.findOne({
                    username,
                    _id: { $ne: userId }
                });

                if (existingUser) {
                    return res.status(409).json({ error: 'Username já está em uso' });
                }
            }

            // Atualizar dados
            const updateData: Partial<{
                username: string;
                avatar: string;
                preferences: Record<string, unknown>;
                lastActive: Date;
            }> = {
                lastActive: new Date()
            };

            if (username) updateData.username = username;
            if (avatar) updateData.avatar = avatar;
            if (preferences) updateData.preferences = { ...preferences };

            const updatedUser = await User.findByIdAndUpdate(
                userId,
                updateData,
                { new: true, runValidators: true }
            );

            if (!updatedUser) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }

            const userResponse = {
                id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role,
                avatar: updatedUser.avatar,
                preferences: updatedUser.preferences,
                lastActive: updatedUser.lastActive,
                isOnline: updatedUser.isOnline
            };

            res.json({
                message: 'Perfil atualizado com sucesso',
                user: userResponse
            });
        } catch (error) {
            console.error('Erro ao atualizar perfil:', error);
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }

    // Alterar senha
    static async changePassword(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            const { currentPassword, newPassword } = req.body;

            if (!userId) {
                return res.status(401).json({ error: 'Usuário não autenticado' });
            }

            if (!currentPassword || !newPassword) {
                return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
            }

            // Buscar usuário
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }

            // Verificar senha atual
            const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Senha atual incorreta' });
            }

            // Hash da nova senha
            const saltRounds = 12;
            const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

            // Atualizar senha
            user.passwordHash = newPasswordHash;
            user.lastActive = new Date();
            await user.save();

            res.json({ message: 'Senha alterada com sucesso' });
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}

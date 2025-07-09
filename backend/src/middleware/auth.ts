import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/node';

interface JWTPayload {
    userId: string;
    username: string;
    email: string;
    role: string;
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ error: 'Token de acesso requerido' });
        }

        const secret = process.env.JWT_SECRET || 'your-secret-key';
        const decoded = jwt.verify(token, secret) as JWTPayload;

        // Buscar usuário no banco de dados para garantir que ainda existe
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }

        // Adicionar dados do usuário ao request
        req.user = {
            id: decoded.userId,
            username: decoded.username,
            email: decoded.email,
            role: decoded.role as 'player' | 'gm' | 'admin'
        };

        next();
    } catch (error) {
        console.error('Erro na autenticação:', error);
        return res.status(403).json({ error: 'Token inválido' });
    }
};

export const requireRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Permissão insuficiente' });
        }

        next();
    };
};

// Middleware específico para GM
export const requireGM = requireRole(['gm', 'admin']);

// Middleware específico para Admin
export const requireAdmin = requireRole(['admin']);

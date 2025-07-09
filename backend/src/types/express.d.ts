// Extensão do Request do Express para incluir dados do usuário autenticado
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                username: string;
                email: string;
                role: 'player' | 'gm' | 'admin';
            };
        }
    }
}

export {};

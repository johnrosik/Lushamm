import "dotenv/config";
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { WebSocketController } from './src/controllers/websocketController';
import { AuthController } from './src/controllers/authController';
import { authenticateToken } from './src/middleware/auth';
import apiRoutes from './src/routes/api';

const app = express();
const server = createServer(app);

// Configurar CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Middleware para parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Conectar ao MongoDB
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lushamm';
        await mongoose.connect(mongoURI);
        console.log('Conectado ao MongoDB');
    } catch (error) {
        console.error('Erro ao conectar ao MongoDB:', error);
        process.exit(1);
    }
};

// Inicializar WebSocket
const websocketController = new WebSocketController(server);

// Rotas públicas (sem autenticação)
app.post('/api/auth/register', AuthController.register);
app.post('/api/auth/login', AuthController.login);

// Rotas protegidas (com autenticação)
app.use('/api/auth/verify', authenticateToken, AuthController.verifyToken);
app.use('/api/auth/logout', authenticateToken, AuthController.logout);
app.use('/api/auth/profile', authenticateToken, AuthController.updateProfile);
app.use('/api/auth/change-password', authenticateToken, AuthController.changePassword);

// Todas as outras rotas da API (protegidas)
app.use('/api', authenticateToken, apiRoutes);

// Rota de teste
app.get("/", (req, res) => {
    res.json({
        message: "Lushamm RPG API",
        version: "1.0.0",
        features: [
            "Sistema de campanhas",
            "Fichas de personagem flexíveis",
            "Chat em tempo real",
            "Sistema de dados",
            "Mapas interativos",
            "Suporte a múltiplos sistemas de RPG"
        ]
    });
});

// Middleware de erro global
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

// Inicializar servidor
const startServer = async () => {
    await connectDB();
    
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`🚀 Servidor rodando na porta ${PORT}`);
        console.log(`📡 WebSocket disponível na mesma porta`);
        console.log(`🌐 API disponível em http://localhost:${PORT}`);
    });
};

// Tratamento de sinais para graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM recebido. Fechando servidor...');
    server.close(() => {
        console.log('Servidor fechado');
        mongoose.connection.close(false, () => {
            console.log('Conexão MongoDB fechada');
            process.exit(0);
        });
    });
});

if (require.main === module) {
    startServer().catch(console.error);
}

export default app;
export { server, websocketController };
import "dotenv/config";
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import imageRoutes from './src/routes/images';

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
        const mongoURI = process.env.MONGO_CONNECTION_STRING || 'mongodb://localhost:27017/lushamm';
        await mongoose.connect(mongoURI);
        console.log('✅ Conectado ao MongoDB');
    } catch (error) {
        console.error('❌ Erro ao conectar ao MongoDB:', error);
        process.exit(1);
    }
};

// Rotas de imagens (sem autenticação para teste)
app.use('/api/images', imageRoutes);

// Rota de teste
app.get("/", (req, res) => {
    res.json({
        message: "🎮 Lushamm RPG API - Sistema de Compressão de Imagens",
        version: "1.0.0",
        endpoints: {
            "POST /api/images/upload/single": "Upload e compressão de imagem única",
            "GET /api/images/:filename": "Buscar imagem comprimida"
        },
        status: "✅ Funcionando"
    });
});

// Middleware de tratamento de erro
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('❌ Erro:', err.stack);
    res.status(500).json({
        error: 'Erro interno do servidor',
        message: err.message
    });
});

// Inicializar servidor
const startServer = async () => {
    await connectDB();
    
    const PORT = 5174; // Forçar porta para teste
    server.listen(PORT, () => {
        console.log(`🚀 Servidor rodando na porta ${PORT}`);
        console.log(`📸 Sistema de compressão de imagens ativo`);
        console.log(`🌐 http://localhost:${PORT}`);
        console.log(`📁 Upload: POST http://localhost:${PORT}/api/images/upload/single`);
    });
};

// Tratamento de sinais para graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM recebido. Fechando servidor...');
    server.close(() => {
        console.log('Servidor fechado');
        mongoose.connection.close().then(() => {
            console.log('Conexão MongoDB fechada');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT recebido. Fechando servidor...');
    server.close(() => {
        console.log('Servidor fechado');
        mongoose.connection.close().then(() => {
            console.log('Conexão MongoDB fechada');
            process.exit(0);
        });
    });
});

// Iniciar o servidor
startServer().catch(console.error);

export default app;
